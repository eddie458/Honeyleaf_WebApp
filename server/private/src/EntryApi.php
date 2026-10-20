<?php

declare(strict_types=1);

namespace Honeyleaf;

/**
 * entries/{id}: one diary entry with all its pages, saved atomically.
 *
 * Saves carry the version they were based on. When that isn't the stored
 * version (another device saved in between), nothing is overwritten: the
 * incoming words are kept as a conflict copy and both versions survive.
 */
final class EntryApi
{
    private const MAX_PAGES = 300;
    private const MAX_DOC = 2 * 1024 * 1024;
    private const MAX_HEADER = 64 * 1024;
    private const MAX_TAGS = 50;

    public function __construct(private readonly App $app, private readonly Request $req, private readonly Auth $auth)
    {
    }

    /** @param list<string> $seg */
    public function handle(string $method, array $seg): void
    {
        $uid = $this->auth->userId();
        if (count($seg) !== 1) {
            throw HttpError::notFound();
        }
        $id = Util::ulidOr404($seg[0]);
        match ($method) {
            'GET' => Response::json(self::load($this->app, $uid, $id) ?? throw HttpError::notFound()),
            'PUT' => $this->put($uid, $id),
            'DELETE' => $this->delete($uid, $id),
            default => throw HttpError::notFound(),
        };
    }

    /**
     * An entry as GET entries/{id} returns it, or null when missing or trashed.
     *
     * @return array<string, mixed>|null
     */
    public static function load(App $app, int $uid, string $id, bool $includeTrashed = false): ?array
    {
        $db = $app->db();
        $st = $db->prepare('SELECT * FROM entries WHERE user_id = ? AND id = ?' . ($includeTrashed ? '' : ' AND deleted_at IS NULL'));
        $st->execute([$uid, $id]);
        $e = $st->fetch();
        if (!$e) {
            return null;
        }
        $ps = $db->prepare('SELECT id, page_index, doc, favorite FROM pages WHERE user_id = ? AND entry_id = ? AND deleted_at IS NULL ORDER BY page_index');
        $ps->execute([$uid, $id]);
        $pages = [];
        foreach ($ps->fetchAll() as $i => $p) {
            $pages[] = ['id' => $p['id'], 'index' => $i, 'doc' => Util::decode($p['doc']), 'favorite' => (bool) (int) $p['favorite']];
        }
        return [
            'entry' => [
                'id' => $e['id'],
                'journalId' => $e['journal_id'],
                'date' => $e['entry_date'],
                'title' => $e['title'],
                'header' => Util::decode($e['header']),
                'version' => (int) $e['version'],
                'schema' => (int) $e['schema_version'],
                'conflictOf' => $e['conflict_of'],
                'createdAt' => App::iso($e['created_at']),
                'updatedAt' => App::iso($e['updated_at']),
            ],
            'pages' => $pages,
        ];
    }

    /**
     * Checks a save request and turns it into rows to write.
     *
     * @return array{base: ?int, journalId: string, date: string, title: string, header: string, schema: int, tags: list<string>, pages: list<array{id: string, doc: string, text: string, photo: bool, favorite: bool}>}
     */
    private function parse(int $uid): array
    {
        $b = $this->req->json();
        $entry = $b->entry ?? null;
        $pagesIn = $b->pages ?? null;
        if (!$entry instanceof \stdClass || !is_array($pagesIn)) {
            throw HttpError::badRequest('Expected entry and pages.');
        }
        $fields = [];
        $base = $b->baseVersion ?? null;
        if ($base !== null && !is_int($base)) {
            $fields['baseVersion'] = 'invalid';
        }
        $journalId = $entry->journalId ?? null;
        if (!Util::isUlid($journalId)) {
            $fields['journalId'] = 'invalid';
        } else {
            $st = $this->app->db()->prepare('SELECT 1 FROM journals WHERE user_id = ? AND id = ?');
            $st->execute([$uid, $journalId]);
            if (!$st->fetchColumn()) {
                $fields['journalId'] = 'invalid';
            }
        }
        $date = $entry->date ?? null;
        if (!Util::isDate($date)) {
            $fields['date'] = 'invalid';
        }
        $title = $entry->title ?? '';
        if (!is_string($title)) {
            $fields['title'] = 'invalid';
        } elseif (mb_strlen($title) > 200) {
            $fields['title'] = 'too_long';
        }
        $header = $entry->header ?? new \stdClass();
        $headerJson = $header instanceof \stdClass ? Util::encode($header) : null;
        if ($headerJson === null) {
            $fields['header'] = 'invalid';
        } elseif (strlen($headerJson) > self::MAX_HEADER) {
            $fields['header'] = 'too_long';
        }
        $schema = $entry->schema ?? 1;
        if (!is_int($schema) || $schema < 1 || $schema > HONEYLEAF_SCHEMA) {
            $fields['schema'] = 'invalid'; // written by a newer Honeyleaf than this server
        }
        if (count($pagesIn) > self::MAX_PAGES) {
            $fields['pages'] = 'too_long';
        }
        $tags = [];
        if ($header instanceof \stdClass && isset($header->tags) && is_array($header->tags)) {
            foreach ($header->tags as $tag) {
                if (is_string($tag) && trim($tag) !== '' && count($tags) < self::MAX_TAGS) {
                    $tags[mb_strtolower(mb_substr(trim($tag), 0, 64))] = true;
                }
            }
        }

        $order = [];
        foreach ($pagesIn as $i => $p) {
            if (!$p instanceof \stdClass || !Util::isUlid($p->id ?? null) || !($p->doc ?? null) instanceof \stdClass) {
                $fields["pages.$i"] = 'invalid';
                continue;
            }
            $v = $p->doc->v ?? 1;
            if (!is_int($v) || $v > HONEYLEAF_SCHEMA) {
                $fields["pages.$i"] = 'invalid';
                continue;
            }
            $order[] = ['index' => is_int($p->index ?? null) ? $p->index : $i, 'page' => $p];
        }
        usort($order, static fn ($a, $b) => $a['index'] <=> $b['index']);
        $pages = [];
        $seen = [];
        foreach ($order as $k => $o) {
            $p = $o['page'];
            if (isset($seen[$p->id])) {
                $fields["pages.$k"] = 'invalid';
                continue;
            }
            $seen[$p->id] = true;
            $doc = Util::encode($p->doc);
            if (strlen($doc) > self::MAX_DOC) {
                throw new HttpError(413, 'too_large', 'A page is too large.');
            }
            $pages[] = [
                'id' => $p->id,
                'doc' => $doc,
                'text' => Util::plainText($p->doc),
                'photo' => Util::hasPhoto($p->doc),
                'favorite' => (bool) ($p->doc->favorite ?? false),
            ];
        }
        if ($fields !== []) {
            throw HttpError::validation($fields);
        }
        return [
            'base' => $base,
            'journalId' => (string) $journalId,
            'date' => (string) $date,
            'title' => (string) $title,
            'header' => (string) $headerJson,
            'schema' => (int) $schema,
            'tags' => array_keys($tags),
            'pages' => $pages,
        ];
    }

    private function put(int $uid, string $id): void
    {
        $in = $this->parse($uid);
        $db = $this->app->db();
        $db->beginTransaction();
        try {
            $st = $db->prepare('SELECT version, deleted_at FROM entries WHERE user_id = ? AND id = ? FOR UPDATE');
            $st->execute([$uid, $id]);
            $row = $st->fetch();
            if ($row && ($in['base'] === null || $in['base'] !== (int) $row['version'])) {
                // Someone else saved first: keep these words as a copy, overwrite nothing.
                $copyId = $this->writeCopy($uid, $id, $in);
                $db->commit();
                $current = $row['deleted_at'] === null ? self::load($this->app, $uid, $id) : null;
                throw new HttpError(409, 'conflict', 'This entry changed on another device.', null, null, ['conflictCopyId' => $copyId, 'current' => $current]);
            }
            $version = $row ? (int) $row['version'] + 1 : 1;
            $now = App::now();
            $hasPhotos = array_reduce($in['pages'], static fn ($c, $p) => $c || $p['photo'], false);
            $db->prepare('INSERT INTO entries (user_id, id, journal_id, entry_date, title, header, schema_version, version, has_photos, conflict_of, created_at, updated_at, deleted_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)
                ON DUPLICATE KEY UPDATE journal_id = VALUES(journal_id), entry_date = VALUES(entry_date), title = VALUES(title), header = VALUES(header),
                  schema_version = VALUES(schema_version), version = VALUES(version), has_photos = VALUES(has_photos), updated_at = VALUES(updated_at), deleted_at = NULL')
                ->execute([$uid, $id, $in['journalId'], $in['date'], $in['title'], $in['header'], $in['schema'], $version, $hasPhotos ? 1 : 0, $now, $now]);
            $this->writePages($uid, $id, $in['pages'], $now);
            $this->writeTags($uid, $id, $in['tags']);
            $db->commit();
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $e;
        }
        Response::json(['version' => $version, 'updatedAt' => App::iso($now)]);
    }

    /**
     * The entry's pages become exactly `$pages`. A page that's gone moves to
     * the trash, unless it was a page the text flow added by itself with
     * nothing else on it (its words moved to the pages around it).
     *
     * @param list<array{id: string, doc: string, text: string, photo: bool, favorite: bool}> $pages
     */
    private function writePages(int $uid, string $entryId, array $pages, string $now): void
    {
        $db = $this->app->db();
        $st = $db->prepare('SELECT id, doc FROM pages WHERE user_id = ? AND entry_id = ? AND deleted_at IS NULL');
        $st->execute([$uid, $entryId]);
        $before = [];
        foreach ($st->fetchAll() as $p) {
            $before[$p['id']] = $p['doc'];
        }
        $upsert = $db->prepare('INSERT INTO pages (user_id, id, entry_id, page_index, doc, plain_text, favorite, created_at, updated_at, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
            ON DUPLICATE KEY UPDATE entry_id = VALUES(entry_id), page_index = VALUES(page_index), doc = VALUES(doc), plain_text = VALUES(plain_text),
              favorite = VALUES(favorite), updated_at = VALUES(updated_at), deleted_at = NULL');
        foreach ($pages as $i => $p) {
            unset($before[$p['id']]);
            $upsert->execute([$uid, $p['id'], $entryId, $i, $p['doc'], $p['text'], $p['favorite'] ? 1 : 0, $now, $now]);
        }
        $trash = $db->prepare('UPDATE pages SET deleted_at = ? WHERE user_id = ? AND id = ?');
        $drop = $db->prepare('DELETE FROM pages WHERE user_id = ? AND id = ?');
        foreach ($before as $pageId => $docJson) {
            $doc = Util::decode($docJson);
            $flowPage = $doc instanceof \stdClass && ($doc->flow ?? null) === 'auto' && (!isset($doc->decorations) || $doc->decorations === []);
            if ($flowPage) {
                $drop->execute([$uid, $pageId]);
            } else {
                $trash->execute([$now, $uid, $pageId]);
            }
        }
    }

    /** @param list<string> $tags */
    private function writeTags(int $uid, string $entryId, array $tags): void
    {
        $db = $this->app->db();
        $db->prepare('DELETE FROM entry_tags WHERE user_id = ? AND entry_id = ?')->execute([$uid, $entryId]);
        $ins = $db->prepare('INSERT IGNORE INTO entry_tags (user_id, entry_id, tag) VALUES (?, ?, ?)');
        foreach ($tags as $tag) {
            $ins->execute([$uid, $entryId, $tag]);
        }
    }

    /**
     * Stores an incoming save as a new entry beside the original (new IDs
     * for it and its pages), titled so the person can tell them apart.
     *
     * @param array{base: ?int, journalId: string, date: string, title: string, header: string, schema: int, tags: list<string>, pages: list<array{id: string, doc: string, text: string, photo: bool, favorite: bool}>} $in
     */
    private function writeCopy(int $uid, string $originalId, array $in): string
    {
        $copyId = Util::ulid();
        $now = App::now();
        $title = trim($in['title']) === '' ? '(copy from another device)' : mb_substr($in['title'], 0, 170) . ' (copy from another device)';
        $header = Util::decode($in['header']);
        if ($header instanceof \stdClass) {
            $header->title = $title;
        }
        $hasPhotos = array_reduce($in['pages'], static fn ($c, $p) => $c || $p['photo'], false);
        $this->app->db()->prepare('INSERT INTO entries (user_id, id, journal_id, entry_date, title, header, schema_version, version, has_photos, conflict_of, created_at, updated_at, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, NULL)')
            ->execute([$uid, $copyId, $in['journalId'], $in['date'], $title, Util::encode($header), $in['schema'], $hasPhotos ? 1 : 0, $originalId, $now, $now]);
        $pages = array_map(static fn ($p) => ['id' => Util::ulid()] + $p, $in['pages']);
        $this->writePages($uid, $copyId, $pages, $now);
        $this->writeTags($uid, $copyId, $in['tags']);
        return $copyId;
    }

    private function delete(int $uid, string $id): void
    {
        $st = $this->app->db()->prepare('UPDATE entries SET deleted_at = ? WHERE user_id = ? AND id = ? AND deleted_at IS NULL');
        $st->execute([App::now(), $uid, $id]);
        if ($st->rowCount() === 0) {
            throw HttpError::notFound();
        }
        Response::json([]);
    }
}
