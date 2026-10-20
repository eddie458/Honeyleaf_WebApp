<?php

declare(strict_types=1);

namespace Honeyleaf;

/** journals/*: the person's journals, and the light index of a journal's entries. */
final class JournalApi
{
    private const MAX_JSON = 64 * 1024;

    public function __construct(private readonly App $app, private readonly Request $req, private readonly Auth $auth)
    {
    }

    /** @param list<string> $seg */
    public function handle(string $method, array $seg): void
    {
        $uid = $this->auth->userId();
        if ($seg === []) {
            if ($method !== 'GET') {
                throw HttpError::notFound();
            }
            $this->list($uid);
            return;
        }
        $id = Util::ulidOr404($seg[0]);
        $sub = $seg[1] ?? '';
        match ("$method $sub") {
            'PUT ' => $this->put($uid, $id),
            'DELETE ' => $this->delete($uid, $id),
            'GET entries' => $this->entries($uid, $id),
            default => throw HttpError::notFound(),
        };
    }

    /**
     * @param array<string, mixed> $j
     * @return array<string, mixed>
     */
    public static function view(array $j): array
    {
        return [
            'id' => $j['id'],
            'title' => $j['title'],
            'cover' => Util::decode($j['cover']),
            'defaults' => Util::decode($j['defaults_json']),
            'sortOrder' => (int) $j['sort_order'],
            'createdAt' => App::iso($j['created_at']),
            'updatedAt' => App::iso($j['updated_at']),
        ];
    }

    private function list(int $uid): void
    {
        $st = $this->app->db()->prepare('SELECT * FROM journals WHERE user_id = ? AND deleted_at IS NULL ORDER BY sort_order, created_at');
        $st->execute([$uid]);
        Response::json(['journals' => array_map([self::class, 'view'], $st->fetchAll())]);
    }

    private function put(int $uid, string $id): void
    {
        $b = $this->req->json();
        $title = is_string($b->title ?? null) ? trim($b->title) : '';
        $fields = [];
        if ($title === '') {
            $fields['title'] = 'required';
        } elseif (mb_strlen($title) > 120) {
            $fields['title'] = 'too_long';
        }
        $cover = ($b->cover ?? null) instanceof \stdClass ? Util::encode($b->cover) : null;
        $defaults = ($b->defaults ?? null) instanceof \stdClass ? Util::encode($b->defaults) : null;
        if ($cover === null || strlen($cover) > self::MAX_JSON) {
            $fields['cover'] = $cover === null ? 'required' : 'too_long';
        }
        if ($defaults === null || strlen($defaults) > self::MAX_JSON) {
            $fields['defaults'] = $defaults === null ? 'required' : 'too_long';
        }
        $sort = $b->sortOrder ?? 0;
        if (!is_int($sort)) {
            $fields['sortOrder'] = 'invalid';
        }
        if ($fields !== []) {
            throw HttpError::validation($fields);
        }
        $now = App::now();
        $this->app->db()->prepare('INSERT INTO journals (user_id, id, title, cover, defaults_json, sort_order, created_at, updated_at, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
            ON DUPLICATE KEY UPDATE title = VALUES(title), cover = VALUES(cover), defaults_json = VALUES(defaults_json),
              sort_order = VALUES(sort_order), updated_at = VALUES(updated_at), deleted_at = NULL')
            ->execute([$uid, $id, $title, $cover, $defaults, $sort, $now, $now]);
        $st = $this->app->db()->prepare('SELECT * FROM journals WHERE user_id = ? AND id = ?');
        $st->execute([$uid, $id]);
        Response::json(['journal' => self::view($st->fetch())]);
    }

    /** To the trash, with all its entries and their pages. */
    private function delete(int $uid, string $id): void
    {
        $db = $this->app->db();
        $now = App::now();
        $st = $db->prepare('UPDATE journals SET deleted_at = ? WHERE user_id = ? AND id = ? AND deleted_at IS NULL');
        $st->execute([$now, $uid, $id]);
        if ($st->rowCount() === 0) {
            throw HttpError::notFound();
        }
        $db->prepare('UPDATE entries SET deleted_at = ? WHERE user_id = ? AND journal_id = ? AND deleted_at IS NULL')->execute([$now, $uid, $id]);
        Response::json([]);
    }

    private function entries(int $uid, string $journalId): void
    {
        $db = $this->app->db();
        $st = $db->prepare('SELECT id, entry_date, title, version, has_photos, conflict_of, created_at, updated_at
            FROM entries WHERE user_id = ? AND journal_id = ? AND deleted_at IS NULL ORDER BY entry_date, created_at');
        $st->execute([$uid, $journalId]);
        $entries = $st->fetchAll();
        $pages = [];
        $ps = $db->prepare('SELECT p.entry_id, p.id FROM pages p JOIN entries e ON e.user_id = p.user_id AND e.id = p.entry_id
            WHERE p.user_id = ? AND e.journal_id = ? AND e.deleted_at IS NULL AND p.deleted_at IS NULL ORDER BY p.entry_id, p.page_index');
        $ps->execute([$uid, $journalId]);
        foreach ($ps->fetchAll() as $p) {
            $pages[$p['entry_id']][] = $p['id'];
        }
        $out = [];
        foreach ($entries as $e) {
            $ids = $pages[$e['id']] ?? [];
            $out[] = [
                'id' => $e['id'],
                'date' => $e['entry_date'],
                'title' => $e['title'],
                'pageCount' => count($ids),
                'pageIds' => $ids,
                'version' => (int) $e['version'],
                'hasPhotos' => (bool) (int) $e['has_photos'],
                'conflictOf' => $e['conflict_of'],
                'createdAt' => App::iso($e['created_at']),
                'updatedAt' => App::iso($e['updated_at']),
            ];
        }
        Response::json(['entries' => $out]);
    }
}
