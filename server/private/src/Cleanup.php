<?php

declare(strict_types=1);

namespace Honeyleaf;

/**
 * Housekeeping: empties trash older than trash_days (files too), and drops
 * expired sessions and old rate-limit marks. Run by cron/cleanup.php when a
 * cron job exists, and by the API itself at most once an hour otherwise.
 */
final class Cleanup
{
    /** Runs at most once an hour, from ordinary requests (no cron needed). */
    public static function maybe(App $app): void
    {
        try {
            $last = (int) ($app->meta('last_cleanup') ?? '0');
            if (time() - $last < 3600) {
                return;
            }
            // Claim the run first, so two requests don't both do it.
            $st = $app->db()->prepare("UPDATE app_meta SET value = ? WHERE name = 'last_cleanup' AND value = ?");
            $st->execute([(string) time(), (string) $last]);
            if ($st->rowCount() === 0) {
                if ($app->meta('last_cleanup') !== null) {
                    return;
                }
                $app->setMeta('last_cleanup', (string) time());
            }
            self::run($app, 200);
        } catch (\Throwable $e) {
            error_log('Honeyleaf cleanup: ' . $e->getMessage()); // never let housekeeping break a request
        }
    }

    /** @return array<string, int> what was removed */
    public static function run(App $app, int $limit = 5000): array
    {
        $db = $app->db();
        $now = App::now();
        $cutoff = App::at(time() - max(1, $app->cfgInt('trash_days')) * 86400);
        $done = ['sessions' => 0, 'rateLimits' => 0, 'journals' => 0, 'entries' => 0, 'pages' => 0, 'assets' => 0];

        $st = $db->prepare('DELETE FROM sessions WHERE expires_at < ?');
        $st->execute([$now]);
        $done['sessions'] = $st->rowCount();
        $st = $db->prepare('DELETE FROM rate_limits WHERE hit_at < ?');
        $st->execute([App::at(time() - 86400)]);
        $done['rateLimits'] = $st->rowCount();

        $st = $db->prepare("SELECT user_id, id, deleted_at FROM journals WHERE deleted_at IS NOT NULL AND deleted_at < ? LIMIT $limit");
        $st->execute([$cutoff]);
        foreach ($st->fetchAll() as $j) {
            $entries = $db->prepare('SELECT id FROM entries WHERE user_id = ? AND journal_id = ? AND deleted_at = ?');
            $entries->execute([$j['user_id'], $j['id'], $j['deleted_at']]);
            foreach ($entries->fetchAll(\PDO::FETCH_COLUMN) as $entryId) {
                self::deleteEntry($app, (int) $j['user_id'], (string) $entryId);
                $done['entries']++;
            }
            $db->prepare('DELETE FROM journals WHERE user_id = ? AND id = ?')->execute([$j['user_id'], $j['id']]);
            $done['journals']++;
        }
        $st = $db->prepare("SELECT user_id, id FROM entries WHERE deleted_at IS NOT NULL AND deleted_at < ? LIMIT $limit");
        $st->execute([$cutoff]);
        foreach ($st->fetchAll() as $e) {
            self::deleteEntry($app, (int) $e['user_id'], (string) $e['id']);
            $done['entries']++;
        }
        $st = $db->prepare("DELETE FROM pages WHERE deleted_at IS NOT NULL AND deleted_at < ? LIMIT $limit");
        $st->execute([$cutoff]);
        $done['pages'] = $st->rowCount();
        $st = $db->prepare("SELECT * FROM assets WHERE deleted_at IS NOT NULL AND deleted_at < ? LIMIT $limit");
        $st->execute([$cutoff]);
        foreach ($st->fetchAll() as $a) {
            self::deleteAsset($app, (int) $a['user_id'], $a);
            $done['assets']++;
        }
        return $done;
    }

    public static function deleteEntry(App $app, int $uid, string $id): void
    {
        $db = $app->db();
        $db->prepare('DELETE FROM pages WHERE user_id = ? AND entry_id = ?')->execute([$uid, $id]);
        $db->prepare('DELETE FROM entry_tags WHERE user_id = ? AND entry_id = ?')->execute([$uid, $id]);
        $db->prepare('DELETE FROM entries WHERE user_id = ? AND id = ?')->execute([$uid, $id]);
    }

    /** @param array<string, mixed> $asset */
    public static function deleteAsset(App $app, int $uid, array $asset): void
    {
        $app->db()->prepare('DELETE FROM assets WHERE user_id = ? AND id = ?')->execute([$uid, $asset['id']]);
        Storage::remove($app, $uid, $asset['file_name'] ?? null);
        Storage::remove($app, $uid, $asset['thumb_name'] ?? null);
    }
}
