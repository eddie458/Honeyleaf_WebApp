<?php

declare(strict_types=1);

namespace Honeyleaf;

/**
 * Creates and upgrades the tables from migrations/NNNN_name.sql, in order,
 * each exactly once (recorded in `migrations`). Upgrades run by themselves on
 * the first request after new files arrive, one process at a time.
 */
final class Migrator
{
    /** @return list<array{id: int, name: string, file: string}> */
    public static function files(App $app): array
    {
        $out = [];
        foreach (glob($app->privateDir . '/migrations/*.sql') ?: [] as $file) {
            if (preg_match('/^(\d{4})_([a-z0-9_]+)\.sql$/', basename($file), $m)) {
                $out[] = ['id' => (int) $m[1], 'name' => $m[1] . '_' . $m[2], 'file' => $file];
            }
        }
        usort($out, static fn ($a, $b) => $a['id'] <=> $b['id']);
        return $out;
    }

    public static function latest(App $app): int
    {
        $files = self::files($app);
        return $files === [] ? 0 : $files[count($files) - 1]['id'];
    }

    public static function applied(App $app): int
    {
        try {
            return (int) $app->db()->query('SELECT COALESCE(MAX(id), 0) FROM migrations')->fetchColumn();
        } catch (\PDOException) {
            return -1; // no tables yet
        }
    }

    /** Upgrades an installed database when newer migrations exist. */
    public static function upgrade(App $app): void
    {
        $applied = self::applied($app);
        if ($applied >= 0 && $applied < self::latest($app)) {
            self::run($app);
        }
    }

    /** Runs every migration not yet recorded. Safe to call from two requests at once. */
    public static function run(App $app): void
    {
        $db = $app->db();
        $db->query("SELECT GET_LOCK('honeyleaf_migrate', 30)")->fetchColumn();
        try {
            $done = max(0, self::applied($app));
            foreach (self::files($app) as $m) {
                if ($m['id'] <= $done) {
                    continue;
                }
                foreach (self::statements((string) file_get_contents($m['file'])) as $sql) {
                    $db->exec($sql);
                }
                $db->prepare('INSERT IGNORE INTO migrations (id, name, applied_at) VALUES (?, ?, ?)')->execute([$m['id'], $m['name'], App::now()]);
            }
        } finally {
            $db->query("SELECT RELEASE_LOCK('honeyleaf_migrate')")->fetchColumn();
        }
    }

    /** @return list<string> */
    public static function statements(string $sql): array
    {
        $lines = array_filter(preg_split('/\R/', $sql) ?: [], static fn ($l) => !str_starts_with(ltrim($l), '--'));
        $out = [];
        foreach (preg_split('/;\s*(?:\R|$)/', implode("\n", $lines)) ?: [] as $stmt) {
            if (trim($stmt) !== '') {
                $out[] = trim($stmt);
            }
        }
        return $out;
    }
}
