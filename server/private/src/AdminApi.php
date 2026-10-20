<?php

declare(strict_types=1);

namespace Honeyleaf;

/**
 * admin/*: the key ring. Admins manage accounts (names, roles, sign-ins,
 * storage) and never see anyone's diary. Every route checks the admin role.
 */
final class AdminApi
{
    public function __construct(private readonly App $app, private readonly Request $req, private readonly Auth $auth)
    {
    }

    /** @param list<string> $seg */
    public function handle(string $method, array $seg): void
    {
        $me = $this->auth->requireAdmin();
        if (($seg[0] ?? '') !== 'users') {
            throw HttpError::notFound();
        }
        if (!isset($seg[1])) {
            match ($method) {
                'GET' => $this->list(),
                'POST' => $this->create(),
                default => throw HttpError::notFound(),
            };
            return;
        }
        if (preg_match('/^\d{1,10}$/', $seg[1]) !== 1) {
            throw HttpError::notFound();
        }
        $target = $this->find((int) $seg[1]);
        $action = $seg[2] ?? '';
        match ("$method $action") {
            'PATCH ' => $this->update($me, $target),
            'POST password' => $this->setPassword($target),
            'POST signout' => $this->signOut($target),
            'DELETE ' => $this->delete($me, $target),
            default => throw HttpError::notFound(),
        };
    }

    /** @return array<string, mixed> */
    private function find(int $id): array
    {
        $st = $this->app->db()->prepare('SELECT * FROM users WHERE id = ?');
        $st->execute([$id]);
        $row = $st->fetch();
        if (!$row) {
            throw HttpError::notFound();
        }
        return $row;
    }

    /**
     * @param array<string, mixed> $u
     * @return array<string, mixed>
     */
    private function view(array $u): array
    {
        $st = $this->app->db()->prepare('SELECT COALESCE(SUM(bytes), 0) FROM assets WHERE user_id = ?');
        $st->execute([$u['id']]);
        return [
            'id' => (int) $u['id'],
            'username' => (string) $u['username'],
            'displayName' => (string) $u['display_name'],
            'role' => (string) $u['role'],
            'active' => (bool) (int) $u['active'],
            'mustChangePassword' => (bool) (int) $u['must_change_password'],
            'lastLoginAt' => App::iso($u['last_login_at']),
            'storageUsedBytes' => (int) $st->fetchColumn(),
            'storageLimitBytes' => $u['storage_limit_bytes'] === null ? null : (int) $u['storage_limit_bytes'],
            'createdAt' => App::iso($u['created_at']),
        ];
    }

    private function list(): void
    {
        $rows = $this->app->db()->query('SELECT * FROM users ORDER BY role ASC, display_name ASC')->fetchAll();
        Response::json(['users' => array_map(fn ($u) => $this->view($u), $rows)]);
    }

    private function create(): void
    {
        $username = trim($this->req->str('username'));
        $display = trim($this->req->str('displayName'));
        $password = $this->req->str('password');
        $fields = UserRules::check($username, $display, $password);
        if ($fields === [] && $this->auth->findUser($username) !== null) {
            $fields['username'] = 'taken';
        }
        if ($fields !== []) {
            throw HttpError::validation($fields);
        }
        $default = $this->app->config['storage_default_bytes'];
        $db = $this->app->db();
        try {
            $db->prepare('INSERT INTO users (username, username_key, display_name, password_hash, role, active, must_change_password, storage_limit_bytes, lock_minutes, created_at, updated_at)
                VALUES (?, ?, ?, ?, \'member\', 1, 1, ?, 15, ?, ?)')->execute([
                $username,
                mb_strtolower($username),
                $display !== '' ? $display : $username,
                Util::hashPassword($password),
                is_int($default) && $default > 0 ? $default : null,
                App::now(),
                App::now(),
            ]);
        } catch (\PDOException $e) {
            if ($e->getCode() === '23000') {
                throw HttpError::validation(['username' => 'taken']);
            }
            throw $e;
        }
        Response::json(['user' => $this->view($this->find((int) $db->lastInsertId()))], 201);
    }

    private function adminCount(): int
    {
        return (int) $this->app->db()->query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND active = 1")->fetchColumn();
    }

    /**
     * @param array<string, mixed> $me
     * @param array<string, mixed> $target
     */
    private function update(array $me, array $target): void
    {
        $body = $this->req->json();
        $sets = [];
        $args = [];
        $fields = [];
        $self = (int) $target['id'] === (int) $me['id'];
        $isAdmin = $target['role'] === 'admin' && (int) $target['active'];

        if (property_exists($body, 'displayName')) {
            $name = is_string($body->displayName) ? trim($body->displayName) : '';
            if ($name === '' || mb_strlen($name) > 80) {
                $fields['displayName'] = $name === '' ? 'required' : 'too_long';
            } else {
                $sets[] = 'display_name = ?';
                $args[] = $name;
            }
        }
        $turnedOff = false;
        if (property_exists($body, 'active')) {
            $active = (bool) $body->active;
            if (!$active && $self) {
                $fields['active'] = 'invalid'; // can't turn yourself off
            } elseif (!$active && $isAdmin && $this->adminCount() <= 1) {
                $fields['active'] = 'invalid'; // the last admin stays
            } else {
                $sets[] = 'active = ?';
                $args[] = $active ? 1 : 0;
                $turnedOff = !$active;
            }
        }
        if (property_exists($body, 'role')) {
            $role = $body->role;
            if (!in_array($role, ['admin', 'member'], true)) {
                $fields['role'] = 'invalid';
            } elseif ($role === 'member' && $isAdmin && $this->adminCount() <= 1) {
                $fields['role'] = 'invalid';
            } else {
                $sets[] = 'role = ?';
                $args[] = $role;
            }
        }
        if (property_exists($body, 'storageLimitBytes')) {
            $limit = $body->storageLimitBytes;
            if ($limit === null) {
                $sets[] = 'storage_limit_bytes = NULL';
            } elseif (is_int($limit) && $limit >= 0) {
                $sets[] = 'storage_limit_bytes = ?';
                $args[] = $limit;
            } else {
                $fields['storageLimitBytes'] = 'invalid';
            }
        }
        if ($fields !== []) {
            throw HttpError::validation($fields);
        }
        if ($sets !== []) {
            $sets[] = 'updated_at = ?';
            $args[] = App::now();
            $args[] = $target['id'];
            $this->app->db()->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($args);
        }
        if ($turnedOff) {
            $this->auth->endAllSessions((int) $target['id']);
        }
        Response::json(['user' => $this->view($this->find((int) $target['id']))]);
    }

    /** @param array<string, mixed> $target */
    private function setPassword(array $target): void
    {
        $password = $this->req->str('password');
        $fields = UserRules::password($password, 'password');
        if ($fields !== []) {
            throw HttpError::validation($fields);
        }
        $this->app->db()->prepare('UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?')
            ->execute([Util::hashPassword($password), App::now(), $target['id']]);
        $this->auth->endAllSessions((int) $target['id']);
        (new RateLimit($this->app))->clear('login-user:' . mb_strtolower((string) $target['username']));
        Response::json(['user' => $this->view($this->find((int) $target['id']))]);
    }

    /** @param array<string, mixed> $target */
    private function signOut(array $target): void
    {
        $this->auth->endAllSessions((int) $target['id'], keepCurrent: true);
        Response::json([]);
    }

    /**
     * Deletes the account, every row it owns (foreign keys cascade) and every
     * stored file. The admin types the username to confirm.
     *
     * @param array<string, mixed> $me
     * @param array<string, mixed> $target
     */
    private function delete(array $me, array $target): void
    {
        if ((int) $target['id'] === (int) $me['id']) {
            throw new HttpError(403, 'forbidden', 'You cannot delete your own account.');
        }
        if ($target['role'] === 'admin' && $this->adminCount() <= 1 && (int) $target['active']) {
            throw new HttpError(403, 'forbidden', 'The last admin cannot be deleted.');
        }
        if (mb_strtolower($this->req->str('confirm')) !== mb_strtolower((string) $target['username'])) {
            throw HttpError::validation(['confirm' => 'invalid']);
        }
        $this->app->db()->prepare('DELETE FROM users WHERE id = ?')->execute([$target['id']]);
        Storage::removeUserFolder($this->app, (int) $target['id']);
        Response::json([]);
    }
}
