<?php

declare(strict_types=1);

namespace Honeyleaf;

/** auth/*: signing in and out, the padlock, passwords and recovery. */
final class AuthApi
{
    private const WINDOW = 900; // 15 minutes

    public function __construct(private readonly App $app, private readonly Request $req, private readonly Auth $auth)
    {
    }

    /** @param list<string> $seg */
    public function handle(string $method, array $seg): void
    {
        $route = implode('/', $seg);
        if ($method === 'DELETE' && ($seg[0] ?? '') === 'sessions' && isset($seg[1])) {
            $this->revoke($seg[1]);
            return;
        }
        match ("$method $route") {
            'POST login' => $this->login(),
            'POST logout' => $this->logout(),
            'POST lock' => $this->lock(),
            'POST unlock' => $this->unlock(),
            'POST password' => $this->password(),
            'POST recover' => $this->recover(),
            'POST reset-token' => $this->resetToken(),
            'GET sessions' => $this->sessions(),
            default => throw HttpError::notFound(),
        };
    }

    private function limits(): RateLimit
    {
        return new RateLimit($this->app);
    }

    /** 5 wrong tries per username and 30 per address in 15 minutes. */
    private function checkLoginLimits(string $username): void
    {
        $this->limits()->check('login-user:' . mb_strtolower($username), 5, self::WINDOW);
        $this->limits()->check('login-ip:' . $this->req->ip, 30, self::WINDOW);
    }

    private function failedLogin(string $username): never
    {
        $this->limits()->hit('login-user:' . mb_strtolower($username));
        $this->limits()->hit('login-ip:' . $this->req->ip);
        throw new HttpError(401, 'invalid_credentials', 'Wrong name or password.');
    }

    private function login(): void
    {
        $username = trim($this->req->str('username'));
        $password = $this->req->str('password');
        $remember = (bool) ($this->req->json()->remember ?? false);
        if ($username === '' || $password === '') {
            throw HttpError::validation(['username' => $username === '' ? 'required' : 'invalid', 'password' => 'required']);
        }
        $this->checkLoginLimits($username);
        $user = $this->auth->findUser($username);
        $ok = Auth::passwordMatches($user, $password);
        if (!$ok || $user === null || !(int) $user['active']) {
            $this->failedLogin($username);
        }
        $this->limits()->clear('login-user:' . mb_strtolower($username));
        if (password_needs_rehash((string) $user['password_hash'], defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT)) {
            $this->app->db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([Util::hashPassword($password), $user['id']]);
        }
        $csrf = $this->auth->startSession($user, $remember);
        Response::json(['user' => Auth::publicUser($user), 'csrf' => $csrf]);
    }

    private function logout(): void
    {
        $this->auth->endSession();
        Response::json([]);
    }

    private function lock(): void
    {
        $this->auth->requireUser(allowLocked: true, allowTemporary: true);
        $this->app->db()->prepare('UPDATE sessions SET locked = 1 WHERE id = ?')->execute([$this->auth->session['id']]);
        Response::json([]);
    }

    private function unlock(): void
    {
        $user = $this->auth->requireUser(allowLocked: true, allowTemporary: true);
        $bucket = 'unlock:' . $this->auth->session['public_id'];
        if ($this->limits()->count($bucket, self::WINDOW) >= 5) {
            $this->auth->endSession();
            throw new HttpError(401, 'unauthenticated', 'Too many wrong tries. Please sign in again.');
        }
        if (!password_verify($this->req->str('password'), (string) $user['password_hash'])) {
            $this->limits()->hit($bucket);
            if ($this->limits()->count($bucket, self::WINDOW) >= 5) {
                $this->auth->endSession();
                throw new HttpError(401, 'unauthenticated', 'Too many wrong tries. Please sign in again.');
            }
            throw new HttpError(401, 'invalid_credentials', 'Wrong password.');
        }
        $this->limits()->clear($bucket);
        $this->app->db()->prepare('UPDATE sessions SET locked = 0, last_active_at = ? WHERE id = ?')->execute([App::now(), $this->auth->session['id']]);
        Response::json(['csrf' => (string) $this->auth->session['csrf']]);
    }

    private function password(): void
    {
        $user = $this->auth->requireUser(allowTemporary: true);
        $current = $this->req->str('current');
        $next = $this->req->str('next');
        $this->limits()->check('password:' . $user['id'], 10, self::WINDOW);
        if (!password_verify($current, (string) $user['password_hash'])) {
            $this->limits()->hit('password:' . $user['id']);
            throw new HttpError(401, 'invalid_credentials', 'That is not your current password.');
        }
        $fields = UserRules::password($next, 'next');
        if ($fields === [] && hash_equals($current, $next) && $user['must_change_password']) {
            $fields = ['next' => 'invalid']; // a temporary password must be replaced
        }
        if ($fields !== []) {
            throw HttpError::validation($fields);
        }
        $db = $this->app->db();
        $db->prepare('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?')->execute([Util::hashPassword($next), App::now(), $user['id']]);
        $this->auth->endAllSessions((int) $user['id'], keepCurrent: true);
        $st = $db->prepare('SELECT * FROM users WHERE id = ?');
        $st->execute([$user['id']]);
        Response::json(['user' => Auth::publicUser($st->fetch())]);
    }

    /**
     * An admin who forgot their password uses their one-time recovery code.
     * The same screen takes config.php's admin_reset_token for when the code
     * is lost too (README: "Locked out?").
     */
    private function recover(): void
    {
        $username = trim($this->req->str('username'));
        $raw = trim($this->req->str('recoveryCode'));
        $code = Util::normalizeCode($raw);
        $next = $this->req->str('next');
        $this->checkLoginLimits($username);
        $user = $this->auth->findUser($username);
        $isAdmin = $user !== null && $user['role'] === 'admin';
        $byCode = $isAdmin && (int) $user['active'] && $user['recovery_hash'] !== null && password_verify($code, (string) $user['recovery_hash']);
        $byToken = $isAdmin && $this->resetTokenMatches($raw);
        if ($user === null) {
            Auth::passwordMatches(null, $code);
        }
        if (!$byCode && !$byToken) {
            $this->failedLogin($username);
        }
        $fields = UserRules::password($next, 'next');
        if ($fields !== []) {
            throw HttpError::validation($fields);
        }
        if ($byToken && !$byCode) {
            $this->app->setMeta('used_reset_token', hash('sha256', $this->app->cfgStr('admin_reset_token')));
        }
        Response::json(['recoveryCode' => $this->resetAdmin($user, $next)]);
    }

    /** config.php's admin_reset_token: long enough, matching, and not used before. */
    private function resetTokenMatches(string $token): bool
    {
        $configured = $this->app->cfgStr('admin_reset_token');
        return strlen($configured) >= 16 && hash_equals($configured, $token)
            && $this->app->meta('used_reset_token') !== hash('sha256', $configured);
    }

    /** The emergency reset with config.php's admin_reset_token (see README). Works once per token. */
    private function resetToken(): void
    {
        $username = trim($this->req->str('username'));
        $token = $this->req->str('token');
        $next = $this->req->str('next');
        $this->checkLoginLimits($username);
        $user = $this->auth->findUser($username);
        if ($user === null || $user['role'] !== 'admin' || !$this->resetTokenMatches($token)) {
            usleep(400000);
            $this->failedLogin($username);
        }
        $fields = UserRules::password($next, 'next');
        if ($fields !== []) {
            throw HttpError::validation($fields);
        }
        $this->app->setMeta('used_reset_token', hash('sha256', $this->app->cfgStr('admin_reset_token')));
        Response::json(['recoveryCode' => $this->resetAdmin($user, $next)]);
    }

    /**
     * New password and a fresh recovery code; the account is switched back on
     * and signed out everywhere.
     *
     * @param array<string, mixed> $user
     */
    private function resetAdmin(array $user, string $password): string
    {
        $code = Util::recoveryCode();
        $this->app->db()->prepare('UPDATE users SET password_hash = ?, recovery_hash = ?, must_change_password = 0, active = 1, updated_at = ? WHERE id = ?')
            ->execute([Util::hashPassword($password), Util::hashPassword(Util::normalizeCode($code)), App::now(), $user['id']]);
        $this->auth->endAllSessions((int) $user['id']);
        $this->limits()->clear('login-user:' . mb_strtolower((string) $user['username']));
        return $code;
    }

    private function sessions(): void
    {
        $user = $this->auth->requireUser(allowTemporary: true);
        $st = $this->app->db()->prepare('SELECT id, public_id, remember, user_agent, created_at, last_seen_at FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY last_seen_at DESC');
        $st->execute([$user['id'], App::now()]);
        $out = [];
        foreach ($st->fetchAll() as $s) {
            $out[] = [
                'id' => $s['public_id'],
                'createdAt' => App::iso($s['created_at']),
                'lastSeenAt' => App::iso($s['last_seen_at']),
                'remember' => (bool) (int) $s['remember'],
                'current' => $s['id'] === $this->auth->session['id'],
                'device' => Util::deviceName((string) $s['user_agent']),
            ];
        }
        Response::json(['sessions' => $out]);
    }

    private function revoke(string $publicId): void
    {
        $user = $this->auth->requireUser(allowTemporary: true);
        if (preg_match('/^[0-9a-f]{16}$/', $publicId) !== 1) {
            throw HttpError::notFound();
        }
        $this->app->db()->prepare('DELETE FROM sessions WHERE user_id = ? AND public_id = ?')->execute([$user['id'], $publicId]);
        Response::json([]);
    }
}
