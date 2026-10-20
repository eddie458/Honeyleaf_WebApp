<?php

declare(strict_types=1);

namespace Honeyleaf;

/**
 * Who is asking: the session behind the hl_session cookie (only its SHA-256
 * is stored), its CSRF token, the idle lock, and signing in and out.
 */
final class Auth
{
    public const COOKIE = 'hl_session';
    public const ANON_COOKIE = 'hl_anon';
    private const REMEMBER_SECONDS = 30 * 86400;
    /** Stored timestamps are refreshed at most this often (fewer writes). */
    private const TOUCH_SECONDS = 30;

    /** @var array<string, mixed>|null */
    public ?array $session = null;
    /** @var array<string, mixed>|null */
    public ?array $user = null;
    private ?string $anon = null;

    public function __construct(private readonly App $app, private readonly Request $req)
    {
    }

    /**
     * Finds the current session. Expired sessions end; one idle longer than
     * its owner's lock time becomes locked. `$activity` is false for reads
     * that must not keep the diary awake (GET session).
     */
    public function load(bool $activity): void
    {
        $token = $this->req->cookies[self::COOKIE] ?? '';
        if (!preg_match('/^[0-9a-f]{64}$/', $token)) {
            return;
        }
        $db = $this->app->db();
        $st = $db->prepare('SELECT s.*, u.username, u.display_name, u.role, u.active, u.must_change_password, u.lock_minutes, u.password_hash, u.recovery_hash, u.storage_limit_bytes
            FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?');
        $st->execute([hash('sha256', $token)]);
        $row = $st->fetch();
        if (!$row) {
            $this->forgetCookie();
            return;
        }
        $now = time();
        if (App::ts($row['expires_at']) <= $now || !(int) $row['active']) {
            $db->prepare('DELETE FROM sessions WHERE id = ?')->execute([$row['id']]);
            $this->forgetCookie();
            return;
        }
        $locked = (bool) (int) $row['locked'];
        if (!$locked && $now - App::ts($row['last_active_at']) > max(1, (int) $row['lock_minutes']) * 60) {
            $locked = true;
            $db->prepare('UPDATE sessions SET locked = 1 WHERE id = ?')->execute([$row['id']]);
        }
        $row['locked'] = $locked ? 1 : 0;

        // Keep the session alive: idle sessions expire after session_hours, remembered ones slide 30 days.
        $sets = [];
        $args = [];
        if ($now - App::ts($row['last_seen_at']) >= self::TOUCH_SECONDS) {
            $sets[] = 'last_seen_at = ?';
            $args[] = App::now();
            $remember = (bool) (int) $row['remember'];
            $life = $remember ? self::REMEMBER_SECONDS : max(1, $this->app->cfgInt('session_hours')) * 3600;
            $sets[] = 'expires_at = ?';
            $args[] = App::at($now + $life);
            if ($remember) {
                $this->setCookie($token, self::REMEMBER_SECONDS);
            }
        }
        if ($activity && !$locked && $now - App::ts($row['last_active_at']) >= self::TOUCH_SECONDS) {
            $sets[] = 'last_active_at = ?';
            $args[] = App::now();
        }
        if ($sets !== []) {
            $args[] = $row['id'];
            $db->prepare('UPDATE sessions SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($args);
        }
        $this->session = $row;
        $this->user = [
            'id' => (int) $row['user_id'],
            'username' => $row['username'],
            'display_name' => $row['display_name'],
            'role' => $row['role'],
            'must_change_password' => (int) $row['must_change_password'],
            'lock_minutes' => (int) $row['lock_minutes'],
            'password_hash' => $row['password_hash'],
            'storage_limit_bytes' => $row['storage_limit_bytes'],
        ];
    }

    public function state(): string
    {
        if ($this->session === null) {
            return 'signed_out';
        }
        return (int) $this->session['locked'] ? 'locked' : 'signed_in';
    }

    /**
     * The signed-in person, or 401/423/403. Locked diaries only allow
     * session, unlock and logout; a temporary password only allows changing it.
     *
     * @return array<string, mixed>
     */
    public function requireUser(bool $allowLocked = false, bool $allowTemporary = false): array
    {
        if ($this->session === null || $this->user === null) {
            throw new HttpError(401, 'unauthenticated', 'Please sign in.');
        }
        if (!$allowLocked && (int) $this->session['locked']) {
            throw new HttpError(423, 'locked', 'The diary is locked.');
        }
        if (!$allowTemporary && $this->user['must_change_password']) {
            throw new HttpError(403, 'must_change_password', 'Please choose your own password first.');
        }
        return $this->user;
    }

    /** @return array<string, mixed> */
    public function requireAdmin(): array
    {
        $user = $this->requireUser();
        if ($user['role'] !== 'admin') {
            throw new HttpError(403, 'forbidden', 'Only the admin can do that.');
        }
        return $user;
    }

    public function userId(): int
    {
        return (int) $this->requireUser()['id'];
    }

    /* ---------------------------------------------------------------- CSRF */

    /** The token the client must send back in X-Honeyleaf-CSRF. */
    public function csrfToken(): string
    {
        if ($this->session !== null) {
            return (string) $this->session['csrf'];
        }
        return hash_hmac('sha256', $this->anonId(), $this->app->secret());
    }

    public function checkCsrf(): void
    {
        $sent = $this->req->header('x-honeyleaf-csrf');
        if ($this->session !== null) {
            $expected = (string) $this->session['csrf'];
        } else {
            $anon = $this->req->cookies[self::ANON_COOKIE] ?? '';
            if (!preg_match('/^[0-9a-f]{64}$/', $anon)) {
                throw new HttpError(403, 'csrf', 'Missing security token. Reload the page.');
            }
            $expected = hash_hmac('sha256', $anon, $this->app->secret());
        }
        if ($sent === '' || !hash_equals($expected, $sent)) {
            throw new HttpError(403, 'csrf', 'Wrong security token. Reload the page.');
        }
    }

    /** The anonymous visitor's random ID (a cookie), made when missing. */
    private function anonId(): string
    {
        if ($this->anon === null) {
            $anon = $this->req->cookies[self::ANON_COOKIE] ?? '';
            if (!preg_match('/^[0-9a-f]{64}$/', $anon)) {
                $anon = bin2hex(random_bytes(32));
                Response::cookie(self::ANON_COOKIE, $anon, $this->req->basePath, $this->req->https, null);
            }
            $this->anon = $anon;
        }
        return $this->anon;
    }

    /* ------------------------------------------------------------ sessions */

    /**
     * Signs someone in with a brand-new session (the old one, if any, ends:
     * session IDs are never reused across a sign-in).
     *
     * @param array<string, mixed> $user
     */
    public function startSession(array $user, bool $remember): string
    {
        $db = $this->app->db();
        if ($this->session !== null) {
            $db->prepare('DELETE FROM sessions WHERE id = ?')->execute([$this->session['id']]);
        }
        $token = bin2hex(random_bytes(32));
        $csrf = bin2hex(random_bytes(32));
        $now = time();
        $life = $remember ? self::REMEMBER_SECONDS : max(1, $this->app->cfgInt('session_hours')) * 3600;
        $db->prepare('INSERT INTO sessions (id, public_id, user_id, csrf, remember, locked, user_agent, created_at, last_seen_at, last_active_at, expires_at)
            VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)')->execute([
            hash('sha256', $token),
            bin2hex(random_bytes(8)),
            $user['id'],
            $csrf,
            $remember ? 1 : 0,
            $this->req->userAgent(),
            App::now(),
            App::now(),
            App::now(),
            App::at($now + $life),
        ]);
        $db->prepare('UPDATE users SET last_login_at = ? WHERE id = ?')->execute([App::now(), $user['id']]);
        $this->setCookie($token, $remember ? self::REMEMBER_SECONDS : null);
        return $csrf;
    }

    public function endSession(): void
    {
        if ($this->session !== null) {
            $this->app->db()->prepare('DELETE FROM sessions WHERE id = ?')->execute([$this->session['id']]);
        }
        $this->session = null;
        $this->user = null;
        $this->forgetCookie();
    }

    /** Signs a person out everywhere, except (optionally) this session. */
    public function endAllSessions(int $userId, bool $keepCurrent = false): void
    {
        if ($keepCurrent && $this->session !== null) {
            $this->app->db()->prepare('DELETE FROM sessions WHERE user_id = ? AND id <> ?')->execute([$userId, $this->session['id']]);
        } else {
            $this->app->db()->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$userId]);
        }
    }

    private function setCookie(string $token, ?int $maxAge): void
    {
        Response::cookie(self::COOKIE, $token, $this->req->basePath, $this->req->https, $maxAge);
    }

    private function forgetCookie(): void
    {
        Response::cookie(self::COOKIE, '', $this->req->basePath, $this->req->https, 0);
    }

    /* --------------------------------------------------------------- users */

    /**
     * A user row as the client sees it.
     *
     * @param array<string, mixed> $u
     * @return array<string, mixed>
     */
    public static function publicUser(array $u): array
    {
        return [
            'id' => (int) $u['id'],
            'username' => (string) $u['username'],
            'displayName' => (string) $u['display_name'],
            'role' => (string) $u['role'],
            'mustChangePassword' => (bool) (int) $u['must_change_password'],
            'lockMinutes' => (int) $u['lock_minutes'],
        ];
    }

    /**
     * Checks a password the slow way even when the account doesn't exist, so
     * the answer time never tells which usernames are real.
     *
     * @param array<string, mixed>|null $user
     */
    public static function passwordMatches(?array $user, string $password): bool
    {
        static $dummy = null;
        if ($user === null) {
            $dummy ??= Util::hashPassword('honeyleaf-timing-' . bin2hex(random_bytes(8)));
            password_verify($password, $dummy);
            return false;
        }
        return password_verify($password, (string) $user['password_hash']);
    }

    /** @return array<string, mixed>|null */
    public function findUser(string $username): ?array
    {
        $st = $this->app->db()->prepare('SELECT * FROM users WHERE username_key = ?');
        $st->execute([mb_strtolower(trim($username))]);
        $row = $st->fetch();
        return $row ?: null;
    }
}
