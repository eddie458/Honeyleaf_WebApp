<?php

declare(strict_types=1);

namespace Honeyleaf;

/**
 * trash/*: the wastebasket. Things stay restorable for trash_days, then
 * Cleanup deletes them (files too).
 */
final class TrashApi
{
    public function __construct(private readonly App $app, private readonly Request $req, private readonly Auth $auth)
    {
    }

    /** @param list<string> $seg */
    public function handle(string $method, array $seg): void
    {
        $uid = $this->auth->userId();
        $route = implode('/', $seg);
        match ("$method $route") {
            'GET ' => $this->list($uid),
            'POST restore' => $this->restore($uid),
            'POST purge' => $this->purge($uid),
            default => throw HttpError::notFound(),
        };
    }

    private function purgeAt(string $deletedAt): string
    {
        return (string) App::iso(App::at(App::ts($deletedAt) + $this->app->cfgInt('trash_days') * 86400));
    }

    private function list(int $uid): void
    {
        $db = $this->app->db();
        $items = [];
        $st = $db->prepare('SELECT id, title, deleted_at FROM journals WHERE user_id = ? AND deleted_at IS NOT NULL');
        $st->execute([$uid]);
        foreach ($st->fetchAll() as $j) {
            $items[] = ['type' => 'journal', 'id' => $j['id'], 'label' => $j['title'], 'deletedAt' => App::iso($j['deleted_at']), 'purgeAt' => $this->purgeAt($j['deleted_at'])];
        }
        // Entries that went with their journal come back with it, so only lone ones are listed.
        $st = $db->prepare('SELECT e.id, e.title, e.entry_date, e.deleted_at FROM entries e
            JOIN journals j ON j.user_id = e.user_id AND j.id = e.journal_id
            WHERE e.user_id = ? AND e.deleted_at IS NOT NULL AND (j.deleted_at IS NULL OR j.deleted_at <> e.deleted_at)');
        $st->execute([$uid]);
        foreach ($st->fetchAll() as $e) {
            $items[] = ['type' => 'entry', 'id' => $e['id'], 'label' => $e['title'] !== '' ? $e['title'] : $e['entry_date'], 'date' => $e['entry_date'], 'deletedAt' => App::iso($e['deleted_at']), 'purgeAt' => $this->purgeAt($e['deleted_at'])];
        }
        $st = $db->prepare('SELECT p.id, p.entry_id, p.deleted_at, e.title, e.entry_date FROM pages p
            JOIN entries e ON e.user_id = p.user_id AND e.id = p.entry_id
            WHERE p.user_id = ? AND p.deleted_at IS NOT NULL AND e.deleted_at IS NULL');
        $st->execute([$uid]);
        foreach ($st->fetchAll() as $p) {
            $items[] = ['type' => 'page', 'id' => $p['id'], 'entryId' => $p['entry_id'], 'label' => $p['title'] !== '' ? $p['title'] : $p['entry_date'], 'date' => $p['entry_date'], 'deletedAt' => App::iso($p['deleted_at']), 'purgeAt' => $this->purgeAt($p['deleted_at'])];
        }
        $st = $db->prepare('SELECT id, kind, original_name, created_at, deleted_at FROM assets WHERE user_id = ? AND deleted_at IS NOT NULL');
        $st->execute([$uid]);
        foreach ($st->fetchAll() as $a) {
            $items[] = ['type' => 'asset', 'id' => $a['id'], 'label' => $a['original_name'] !== '' ? $a['original_name'] : $a['kind'], 'deletedAt' => App::iso($a['deleted_at']), 'purgeAt' => $this->purgeAt($a['deleted_at'])];
        }
        usort($items, static fn ($a, $b) => strcmp((string) $b['deletedAt'], (string) $a['deletedAt']));
        Response::json(['items' => $items]);
    }

    /** @return array{0: string, 1: string} */
    private function target(): array
    {
        $type = $this->req->str('type');
        $id = $this->req->str('id');
        if (!in_array($type, ['journal', 'entry', 'page', 'asset'], true) || !Util::isUlid($id)) {
            throw HttpError::validation(['type' => 'invalid']);
        }
        return [$type, $id];
    }

    private function restore(int $uid): void
    {
        [$type, $id] = $this->target();
        $db = $this->app->db();
        $db->beginTransaction();
        try {
            match ($type) {
                'journal' => $this->restoreJournal($uid, $id),
                'entry' => $this->restoreRow('entries', $uid, $id),
                'asset' => $this->restoreRow('assets', $uid, $id),
                'page' => $this->restorePage($uid, $id),
            };
            $db->commit();
        } catch (\Throwable $e) {
            $db->rollBack();
            throw $e;
        }
        Response::json([]);
    }

    private function restoreRow(string $table, int $uid, string $id): void
    {
        $st = $this->app->db()->prepare("UPDATE $table SET deleted_at = NULL WHERE user_id = ? AND id = ? AND deleted_at IS NOT NULL");
        $st->execute([$uid, $id]);
        if ($st->rowCount() === 0) {
            throw HttpError::notFound();
        }
    }

    private function restoreJournal(int $uid, string $id): void
    {
        $db = $this->app->db();
        $st = $db->prepare('SELECT deleted_at FROM journals WHERE user_id = ? AND id = ? AND deleted_at IS NOT NULL');
        $st->execute([$uid, $id]);
        $at = $st->fetchColumn();
        if ($at === false) {
            throw HttpError::notFound();
        }
        $db->prepare('UPDATE journals SET deleted_at = NULL WHERE user_id = ? AND id = ?')->execute([$uid, $id]);
        $db->prepare('UPDATE entries SET deleted_at = NULL WHERE user_id = ? AND journal_id = ? AND deleted_at = ?')->execute([$uid, $id, $at]);
    }

    /**
     * A page goes back to the end of its entry (a new version, so open copies
     * of the entry notice); a page whose entry is gone becomes a new entry.
     */
    private function restorePage(int $uid, string $id): void
    {
        $db = $this->app->db();
        $st = $db->prepare('SELECT p.entry_id, e.id AS entry_exists, e.deleted_at AS entry_deleted, e.journal_id, e.entry_date, e.header, e.title
            FROM pages p LEFT JOIN entries e ON e.user_id = p.user_id AND e.id = p.entry_id
            WHERE p.user_id = ? AND p.id = ? AND p.deleted_at IS NOT NULL');
        $st->execute([$uid, $id]);
        $p = $st->fetch();
        if (!$p) {
            throw HttpError::notFound();
        }
        $now = App::now();
        if ($p['entry_exists'] !== null && $p['entry_deleted'] === null) {
            $max = $db->prepare('SELECT COALESCE(MAX(page_index), -1) + 1 FROM pages WHERE user_id = ? AND entry_id = ? AND deleted_at IS NULL');
            $max->execute([$uid, $p['entry_id']]);
            $db->prepare('UPDATE pages SET deleted_at = NULL, page_index = ?, updated_at = ? WHERE user_id = ? AND id = ?')->execute([(int) $max->fetchColumn(), $now, $uid, $id]);
            $db->prepare('UPDATE entries SET version = version + 1, updated_at = ? WHERE user_id = ? AND id = ?')->execute([$now, $uid, $p['entry_id']]);
            return;
        }
        // Its entry is gone: the page comes back as an entry of its own, in the first journal.
        $journal = $p['journal_id'] ?? null;
        if ($journal === null || $p['entry_deleted'] !== null) {
            $j = $db->prepare('SELECT id FROM journals WHERE user_id = ? AND deleted_at IS NULL ORDER BY sort_order, created_at LIMIT 1');
            $j->execute([$uid]);
            $journal = $j->fetchColumn();
            if ($journal === false) {
                throw new HttpError(409, 'conflict', 'There is no journal to put this page in.');
            }
        }
        $entryId = Util::ulid();
        $date = $p['entry_date'] ?? gmdate('Y-m-d');
        $db->prepare('INSERT INTO entries (user_id, id, journal_id, entry_date, title, header, schema_version, version, has_photos, conflict_of, created_at, updated_at, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, NULL, ?, ?, NULL)')
            ->execute([$uid, $entryId, $journal, $date, (string) ($p['title'] ?? ''), $p['header'] ?? Util::encode(['date' => $date]), HONEYLEAF_SCHEMA, $now, $now]);
        $db->prepare('UPDATE pages SET deleted_at = NULL, entry_id = ?, page_index = 0, updated_at = ? WHERE user_id = ? AND id = ?')->execute([$entryId, $now, $uid, $id]);
    }

    /** Deletes something for good, files included. Only things already in the trash. */
    private function purge(int $uid): void
    {
        [$type, $id] = $this->target();
        $db = $this->app->db();
        switch ($type) {
            case 'journal':
                $st = $db->prepare('SELECT deleted_at FROM journals WHERE user_id = ? AND id = ? AND deleted_at IS NOT NULL');
                $st->execute([$uid, $id]);
                $at = $st->fetchColumn();
                if ($at === false) {
                    throw HttpError::notFound();
                }
                $entries = $db->prepare('SELECT id FROM entries WHERE user_id = ? AND journal_id = ? AND deleted_at = ?');
                $entries->execute([$uid, $id, $at]);
                foreach ($entries->fetchAll(\PDO::FETCH_COLUMN) as $entryId) {
                    Cleanup::deleteEntry($this->app, $uid, (string) $entryId);
                }
                $db->prepare('DELETE FROM journals WHERE user_id = ? AND id = ?')->execute([$uid, $id]);
                break;
            case 'entry':
                $st = $db->prepare('SELECT 1 FROM entries WHERE user_id = ? AND id = ? AND deleted_at IS NOT NULL');
                $st->execute([$uid, $id]);
                if (!$st->fetchColumn()) {
                    throw HttpError::notFound();
                }
                Cleanup::deleteEntry($this->app, $uid, $id);
                break;
            case 'page':
                $st = $db->prepare('DELETE FROM pages WHERE user_id = ? AND id = ? AND deleted_at IS NOT NULL');
                $st->execute([$uid, $id]);
                if ($st->rowCount() === 0) {
                    throw HttpError::notFound();
                }
                break;
            case 'asset':
                $a = AssetApi::find($this->app, $uid, $id);
                if ($a === null || $a['deleted_at'] === null) {
                    throw HttpError::notFound();
                }
                Cleanup::deleteAsset($this->app, $uid, $a);
                break;
        }
        Response::json([]);
    }
}
