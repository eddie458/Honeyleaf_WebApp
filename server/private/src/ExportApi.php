<?php

declare(strict_types=1);

namespace Honeyleaf;

/**
 * export: the whole diary (or one year) as a .zip — every entry, page,
 * setting and stored file — streamed straight to the browser. The client
 * can import it again on any Honeyleaf install.
 */
final class ExportApi
{
    private const EXT = ['image/webp' => 'webp', 'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif', 'font/woff2' => 'woff2', 'font/ttf' => 'ttf', 'font/otf' => 'otf'];

    public function __construct(private readonly App $app, private readonly Request $req, private readonly Auth $auth)
    {
    }

    /** @param list<string> $seg */
    public function handle(string $method, array $seg): void
    {
        if ($method !== 'GET' || $seg !== []) {
            throw HttpError::notFound();
        }
        $user = $this->auth->requireUser();
        $uid = (int) $user['id'];
        $year = $this->req->query['year'] ?? '';
        if ($year !== '' && preg_match('/^\d{4}$/', $year) !== 1) {
            throw HttpError::validation(['year' => 'invalid']);
        }
        $db = $this->app->db();

        $st = $db->prepare('SELECT * FROM journals WHERE user_id = ? AND deleted_at IS NULL ORDER BY sort_order, created_at');
        $st->execute([$uid]);
        $journals = array_map([JournalApi::class, 'view'], $st->fetchAll());

        $sql = 'SELECT e.* FROM entries e JOIN journals j ON j.user_id = e.user_id AND j.id = e.journal_id
            WHERE e.user_id = ? AND e.deleted_at IS NULL AND j.deleted_at IS NULL';
        $args = [$uid];
        if ($year !== '') {
            $sql .= ' AND e.entry_date BETWEEN ? AND ?';
            array_push($args, "$year-01-01", "$year-12-31");
        }
        $st = $db->prepare($sql . ' ORDER BY e.entry_date, e.created_at');
        $st->execute($args);
        $ps = $db->prepare('SELECT id, page_index, doc, favorite FROM pages WHERE user_id = ? AND entry_id = ? AND deleted_at IS NULL ORDER BY page_index');
        $entries = [];
        $used = [];
        foreach ($st->fetchAll() as $e) {
            $ps->execute([$uid, $e['id']]);
            $pages = [];
            foreach ($ps->fetchAll() as $i => $p) {
                $doc = Util::decode($p['doc']);
                foreach (Util::assetIds($doc) as $assetId) {
                    $used[$assetId] = true;
                }
                $pages[] = ['id' => $p['id'], 'index' => $i, 'doc' => $doc, 'favorite' => (bool) (int) $p['favorite']];
            }
            $entries[] = [
                'id' => $e['id'],
                'journalId' => $e['journal_id'],
                'date' => $e['entry_date'],
                'title' => $e['title'],
                'header' => Util::decode($e['header']),
                'version' => (int) $e['version'],
                'conflictOf' => $e['conflict_of'],
                'createdAt' => App::iso($e['created_at']),
                'updatedAt' => App::iso($e['updated_at']),
                'pages' => $pages,
            ];
        }

        // Everything stored (a full backup), or just what that year's pages use.
        $st = $db->prepare('SELECT * FROM assets WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at');
        $st->execute([$uid]);
        $assets = [];
        $files = [];
        foreach ($st->fetchAll() as $a) {
            if ($year !== '' && !isset($used[$a['id']])) {
                continue;
            }
            $path = Storage::path($this->app, $uid, (string) $a['file_name']);
            if (!is_file($path)) {
                continue;
            }
            $item = [
                'id' => $a['id'],
                'kind' => $a['kind'],
                'mime' => $a['mime'],
                'width' => $a['width'] === null ? null : (int) $a['width'],
                'height' => $a['height'] === null ? null : (int) $a['height'],
                'file' => 'assets/' . $a['id'] . '.' . (self::EXT[$a['mime']] ?? 'bin'),
            ];
            $files[$item['file']] = $path;
            if ($a['thumb_name'] !== null) {
                $thumbPath = Storage::path($this->app, $uid, (string) $a['thumb_name']);
                if (is_file($thumbPath)) {
                    $item['thumb'] = 'assets/' . $a['id'] . '.thumb.' . (self::EXT[(string) $a['thumb_mime']] ?? 'bin');
                    $files[$item['thumb']] = $thumbPath;
                }
            }
            $assets[] = $item;
        }

        $export = [
            'format' => 1,
            'exportedAt' => App::iso(App::now()),
            'app' => 'Honeyleaf ' . HONEYLEAF_VERSION,
            'journals' => $journals,
            'entries' => $entries,
            'assets' => $assets,
            'settings' => SettingsApi::load($this->app, $uid),
        ];
        $json = Util::encode($export);

        $name = 'honeyleaf-' . preg_replace('/[^a-z0-9._-]/', '', mb_strtolower((string) $user['username'])) . '-' . gmdate('Y-m-d') . ($year !== '' ? "-$year" : '') . '.zip';
        @set_time_limit(0);
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        Response::securityHeaders();
        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="' . $name . '"');
        header('Cache-Control: no-store');
        Response::sendCookies();

        $pending = 0;
        $zip = new ZipStream(static function (string $bytes) use (&$pending): void {
            echo $bytes;
            $pending += strlen($bytes);
            if ($pending >= 1 << 18) {
                flush();
                $pending = 0;
            }
        });
        $zip->addString('honeyleaf-export.json', $json);
        foreach ($files as $zipName => $path) {
            $zip->addFile($zipName, $path);
        }
        $zip->finish();
        flush();
    }
}
