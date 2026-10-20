<?php

declare(strict_types=1);

namespace Honeyleaf;

use PDO;

/** Settings, the database connection, folders and the clock, for one request. */
final class App
{
    /** @var array<string, mixed> */
    public readonly array $config;
    public readonly bool $configFound;
    private ?PDO $pdo = null;
    private ?string $secret = null;

    public function __construct(public readonly string $privateDir)
    {
        $file = getenv('HONEYLEAF_CONFIG') ?: $privateDir . '/config.php';
        $loaded = is_file($file) ? require $file : null;
        $this->configFound = is_array($loaded);
        $this->config = (is_array($loaded) ? $loaded : []) + [
            'db_host' => 'localhost',
            'db_port' => 3306,
            'db_name' => '',
            'db_user' => '',
            'db_pass' => '',
            'setup_key' => '',
            'admin_reset_token' => '',
            'max_upload_bytes' => 15 * 1024 * 1024,
            'trash_days' => 30,
            'session_hours' => 12,
            'uploads_dir' => null,
            'trust_proxy_https' => false,
            'storage_default_bytes' => null,
        ];
    }

    public function cfgInt(string $key): int
    {
        return (int) $this->config[$key];
    }

    public function cfgStr(string $key): string
    {
        $v = $this->config[$key] ?? '';
        return is_string($v) ? $v : '';
    }

    public function uploadsDir(): string
    {
        $dir = $this->config['uploads_dir'];
        return is_string($dir) && $dir !== '' ? rtrim($dir, '/\\') : $this->privateDir . '/uploads';
    }

    /** The database, connecting on first use. Throws 503 db_unavailable. */
    public function db(): PDO
    {
        if ($this->pdo === null) {
            if (!$this->configFound || $this->cfgStr('db_name') === '') {
                throw new HttpError(503, 'setup_required', 'config.php is missing or has no database name.');
            }
            try {
                $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $this->cfgStr('db_host'), $this->cfgInt('db_port'), $this->cfgStr('db_name'));
                $this->pdo = new PDO($dsn, $this->cfgStr('db_user'), $this->cfgStr('db_pass'), [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                    PDO::ATTR_STRINGIFY_FETCHES => false,
                ]);
                $this->pdo->exec("SET time_zone = '+00:00'");
            } catch (\PDOException $e) {
                error_log('Honeyleaf: database connection failed: ' . $e->getMessage());
                throw new HttpError(503, 'db_unavailable', 'The database cannot be reached.');
            }
        }
        return $this->pdo;
    }

    /** Whether the tables exist (setup may not have created them yet). */
    public function tablesReady(): bool
    {
        try {
            $this->db()->query('SELECT 1 FROM migrations LIMIT 1');
            return true;
        } catch (\PDOException) {
            return false;
        }
    }

    /**
     * The install's own secret (for anonymous CSRF tokens), made once and
     * kept in the database.
     */
    public function secret(): string
    {
        if ($this->secret === null) {
            $db = $this->db();
            $db->prepare('INSERT IGNORE INTO app_meta (name, value) VALUES (?, ?)')->execute(['app_secret', bin2hex(random_bytes(32))]);
            $this->secret = (string) $db->query("SELECT value FROM app_meta WHERE name = 'app_secret'")->fetchColumn();
        }
        return $this->secret;
    }

    public function meta(string $name): ?string
    {
        $st = $this->db()->prepare('SELECT value FROM app_meta WHERE name = ?');
        $st->execute([$name]);
        $v = $st->fetchColumn();
        return $v === false ? null : (string) $v;
    }

    public function setMeta(string $name, string $value): void
    {
        $this->db()->prepare('INSERT INTO app_meta (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)')->execute([$name, $value]);
    }

    /* ----------------------------------------------------------- time */

    /** Now, as stored in the database (UTC). */
    public static function now(): string
    {
        return gmdate('Y-m-d H:i:s');
    }

    public static function at(int $timestamp): string
    {
        return gmdate('Y-m-d H:i:s', $timestamp);
    }

    /** A database time as the API's ISO 8601 UTC string. */
    public static function iso(?string $dbTime): ?string
    {
        if ($dbTime === null) {
            return null;
        }
        return str_replace(' ', 'T', substr($dbTime, 0, 19)) . 'Z';
    }

    public static function ts(string $dbTime): int
    {
        return (int) strtotime($dbTime . ' UTC');
    }
}
