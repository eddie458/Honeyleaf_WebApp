<?php

declare(strict_types=1);

namespace Honeyleaf;

/**
 * First run: check the server, create the tables, make the first admin. All
 * of it switches off for good once an admin exists. These routes need the
 * setup key from config.php instead of a CSRF token (no one else knows it).
 */
final class SetupApi
{
    public function __construct(private readonly App $app, private readonly Request $req, private readonly Auth $auth)
    {
    }

    public static function adminExists(App $app): bool
    {
        try {
            return (bool) $app->db()->query("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1")->fetchColumn();
        } catch (\PDOException) {
            return false;
        }
    }

    public function handle(string $method, string $route): void
    {
        if ($this->dbReachable() && $this->app->tablesReady() && self::adminExists($this->app)) {
            throw new HttpError(403, 'setup_done', 'Honeyleaf is already set up.');
        }
        match ("$method $route") {
            'GET check' => $this->check(),
            'POST install-schema' => $this->installSchema(),
            'POST admin' => $this->makeAdmin(),
            default => throw HttpError::notFound(),
        };
    }

    private function dbReachable(): bool
    {
        try {
            $this->app->db();
            return true;
        } catch (HttpError) {
            return false;
        }
    }

    private function check(): void
    {
        $extensions = [];
        foreach (['pdo_mysql' => true, 'gd' => true, 'fileinfo' => true, 'mbstring' => true, 'json' => true, 'openssl' => false, 'zlib' => true, 'sodium' => false] as $ext => $required) {
            $extensions[] = ['name' => $ext, 'ok' => extension_loaded($ext), 'required' => $required];
        }
        $webp = function_exists('imagewebp') && function_exists('gd_info') && !empty(gd_info()['WebP Support']);
        $extensions[] = ['name' => 'gd-webp', 'ok' => $webp, 'required' => false];

        $docRoot = realpath((string) ($_SERVER['DOCUMENT_ROOT'] ?? '')) ?: '';
        $private = realpath($this->app->privateDir) ?: $this->app->privateDir;
        $inside = $docRoot !== '' && str_starts_with(str_replace('\\', '/', $private) . '/', rtrim(str_replace('\\', '/', $docRoot), '/') . '/');
        $uploads = $this->app->uploadsDir();
        if (!is_dir($uploads)) {
            @mkdir($uploads, 0750, true);
        }

        $db = ['connected' => false, 'tablesReady' => false, 'error' => null];
        try {
            $this->app->db();
            $db['connected'] = true;
            $db['tablesReady'] = $this->app->tablesReady();
        } catch (HttpError $e) {
            $db['error'] = $e->errorCode === 'setup_required' ? 'config' : 'connect';
        }

        Response::json([
            'php' => ['version' => PHP_VERSION, 'ok' => version_compare(PHP_VERSION, '8.2.0', '>=')],
            'extensions' => $extensions,
            'privateDir' => ['outsideWebRoot' => !$inside, 'writable' => is_writable($this->app->privateDir)],
            'uploads' => ['writable' => is_dir($uploads) && is_writable($uploads)],
            'https' => $this->req->https,
            'config' => ['found' => $this->app->configFound, 'setupKeySet' => strlen($this->app->cfgStr('setup_key')) >= 12],
            'db' => $db,
        ]);
    }

    private function requireKey(): void
    {
        $key = $this->app->cfgStr('setup_key');
        if (strlen($key) < 12 || !hash_equals($key, $this->req->str('setupKey'))) {
            // Same pace for every wrong guess.
            usleep(400000);
            throw new HttpError(403, 'bad_setup_key', 'That setup key is not right.');
        }
    }

    private function installSchema(): void
    {
        $this->requireKey();
        Migrator::run($this->app);
        $this->app->secret();
        Response::json(['ok' => true]);
    }

    private function makeAdmin(): void
    {
        $this->requireKey();
        if (!$this->app->tablesReady()) {
            Migrator::run($this->app);
        }
        $username = trim($this->req->str('username'));
        $display = trim($this->req->str('displayName'));
        $password = $this->req->str('password');
        $fields = UserRules::check($username, $display, $password);
        if ($fields !== []) {
            throw HttpError::validation($fields);
        }
        $code = Util::recoveryCode();
        $db = $this->app->db();
        $db->query("SELECT GET_LOCK('honeyleaf_setup', 10)")->fetchColumn();
        try {
            if (self::adminExists($this->app)) {
                throw new HttpError(403, 'setup_done', 'Honeyleaf is already set up.');
            }
            $db->prepare('INSERT INTO users (username, username_key, display_name, password_hash, role, active, must_change_password, recovery_hash, lock_minutes, created_at, updated_at)
                VALUES (?, ?, ?, ?, \'admin\', 1, 0, ?, 15, ?, ?)')->execute([
                $username,
                mb_strtolower($username),
                $display !== '' ? $display : $username,
                Util::hashPassword($password),
                Util::hashPassword(Util::normalizeCode($code)),
                App::now(),
                App::now(),
            ]);
        } finally {
            $db->query("SELECT RELEASE_LOCK('honeyleaf_setup')")->fetchColumn();
        }
        $this->app->secret();
        Response::json(['recoveryCode' => $code]);
    }
}
