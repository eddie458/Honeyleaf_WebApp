<?php

declare(strict_types=1);

namespace Honeyleaf;

/** assets/*: photos, custom stickers and fonts, readable only by their owner. */
final class AssetApi
{
    private const PHOTO_EDGE = 2560;
    private const THUMB_EDGE = 480;
    private const STICKER_EDGE = 1024;
    private const FONT_MAX = 5 * 1024 * 1024;
    private const UPLOADS_PER_WINDOW = 300;
    private const WINDOW = 600;

    public function __construct(private readonly App $app, private readonly Request $req, private readonly Auth $auth)
    {
    }

    /** @param list<string> $seg */
    public function handle(string $method, array $seg): void
    {
        $uid = $this->auth->userId();
        if ($seg === []) {
            match ($method) {
                'GET' => $this->list($uid),
                'POST' => $this->upload($uid),
                default => throw HttpError::notFound(),
            };
            return;
        }
        if (count($seg) !== 1) {
            throw HttpError::notFound();
        }
        $id = Util::ulidOr404($seg[0]);
        match ($method) {
            'GET' => $this->file($uid, $id),
            'DELETE' => $this->delete($uid, $id),
            default => throw HttpError::notFound(),
        };
    }

    /**
     * @param array<string, mixed> $a
     * @return array<string, mixed>
     */
    public static function view(array $a): array
    {
        return [
            'id' => $a['id'],
            'kind' => $a['kind'],
            'mime' => $a['mime'],
            'width' => $a['width'] === null ? null : (int) $a['width'],
            'height' => $a['height'] === null ? null : (int) $a['height'],
            'bytes' => (int) $a['bytes'],
            'createdAt' => App::iso($a['created_at']),
        ];
    }

    /** @return array<string, mixed>|null */
    public static function find(App $app, int $uid, string $id): ?array
    {
        $st = $app->db()->prepare('SELECT * FROM assets WHERE user_id = ? AND id = ?');
        $st->execute([$uid, $id]);
        $row = $st->fetch();
        return $row ?: null;
    }

    private function list(int $uid): void
    {
        $kind = $this->req->query['kind'] ?? 'photo';
        if (!in_array($kind, ['photo', 'sticker', 'font'], true)) {
            throw HttpError::validation(['kind' => 'invalid']);
        }
        $st = $this->app->db()->prepare('SELECT * FROM assets WHERE user_id = ? AND kind = ? AND deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 500');
        $st->execute([$uid, $kind]);
        Response::json(['assets' => array_map([self::class, 'view'], $st->fetchAll())]);
    }

    private function upload(int $uid): void
    {
        if (!$this->req->isMultipart()) {
            throw HttpError::badRequest('Expected a file upload.');
        }
        // Over post_max_size PHP drops the whole form, so say what happened.
        $postMax = self::iniBytes((string) ini_get('post_max_size'));
        if ($postMax > 0 && (int) $this->req->header('content-length') > $postMax) {
            throw new HttpError(413, 'too_large', 'That file is too large for this server.');
        }
        $limits = new RateLimit($this->app);
        $limits->check('upload:' . $uid, self::UPLOADS_PER_WINDOW, self::WINDOW);

        $id = is_string($_POST['id'] ?? null) ? $_POST['id'] : '';
        $kind = is_string($_POST['kind'] ?? null) ? $_POST['kind'] : 'photo';
        if (!Util::isUlid($id) || !in_array($kind, ['photo', 'sticker', 'font'], true)) {
            throw HttpError::validation(Util::isUlid($id) ? ['kind' => 'invalid'] : ['id' => 'invalid']);
        }
        $existing = self::find($this->app, $uid, $id);
        if ($existing !== null) {
            // A retry of an upload that already arrived.
            Response::json(['asset' => self::view($existing)], 201);
            return;
        }
        $file = $this->uploadedFile('file');
        $limits->hit('upload:' . $uid);

        $original = mb_substr(basename((string) ($_FILES['file']['name'] ?? '')), 0, 200);
        $width = null;
        $height = null;
        $thumbData = null;
        $thumbMime = null;
        if ($kind === 'font') {
            [$data, $mime] = $this->font($file);
        } else {
            $img = Images::open($file, Images::sniff($file));
            $full = Images::encode(Images::fit($img, $kind === 'photo' ? self::PHOTO_EDGE : self::STICKER_EDGE), $kind === 'sticker');
            [$data, $mime, $width, $height] = [$full['data'], $full['mime'], $full['width'], $full['height']];
            if ($kind === 'photo') {
                // Thumbnails are made here, never taken from the browser.
                $thumb = Images::encode(Images::fit($img, self::THUMB_EDGE), false);
                [$thumbData, $thumbMime] = [$thumb['data'], $thumb['mime']];
            }
        }
        $bytes = strlen($data) + ($thumbData === null ? 0 : strlen($thumbData));
        $limit = $this->auth->user['storage_limit_bytes'] ?? null;
        if ($limit !== null && Storage::used($this->app, $uid) + $bytes > (int) $limit) {
            throw new HttpError(413, 'storage_full', 'Your storage is full.');
        }

        $name = Storage::write($this->app, $uid, $data);
        $thumbName = $thumbData === null ? null : Storage::write($this->app, $uid, $thumbData);
        try {
            $this->app->db()->prepare('INSERT INTO assets (user_id, id, kind, mime, file_name, thumb_name, thumb_mime, width, height, bytes, original_name, created_at, deleted_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)')
                ->execute([$uid, $id, $kind, $mime, $name, $thumbName, $thumbMime, $width, $height, $bytes, $original, App::now()]);
        } catch (\PDOException $e) {
            Storage::remove($this->app, $uid, $name);
            Storage::remove($this->app, $uid, $thumbName);
            if ($e->getCode() === '23000' && ($row = self::find($this->app, $uid, $id)) !== null) {
                Response::json(['asset' => self::view($row)], 201);
                return;
            }
            throw $e;
        }
        Response::json(['asset' => self::view((array) self::find($this->app, $uid, $id))], 201);
    }

    /** "40M" → bytes. */
    public static function iniBytes(string $value): int
    {
        $value = trim($value);
        if ($value === '') {
            return 0;
        }
        $n = (int) $value;
        return match (strtolower(substr($value, -1))) {
            'g' => $n * 1024 * 1024 * 1024,
            'm' => $n * 1024 * 1024,
            'k' => $n * 1024,
            default => $n,
        };
    }

    /** The temporary path of an uploaded file, after PHP's own checks. */
    private function uploadedFile(string $field): string
    {
        $f = $_FILES[$field] ?? null;
        if (!is_array($f) || is_array($f['error'] ?? null)) {
            throw HttpError::validation([$field => 'required']);
        }
        $error = (int) ($f['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE) {
            throw new HttpError(413, 'too_large', 'That file is too large.');
        }
        if ($error === UPLOAD_ERR_NO_FILE) {
            throw HttpError::validation([$field => 'required']);
        }
        if ($error !== UPLOAD_ERR_OK || !is_uploaded_file((string) $f['tmp_name'])) {
            throw HttpError::badRequest('The upload did not arrive.');
        }
        if ((int) $f['size'] > $this->app->cfgInt('max_upload_bytes')) {
            throw new HttpError(413, 'too_large', 'That file is too large.');
        }
        return (string) $f['tmp_name'];
    }

    /**
     * Fonts are kept as they are, after their first bytes prove what they are.
     *
     * @return array{0: string, 1: string}
     */
    private function font(string $path): array
    {
        if (filesize($path) > self::FONT_MAX) {
            throw new HttpError(413, 'too_large', 'Fonts can be at most 5 MB.');
        }
        $data = (string) file_get_contents($path);
        $magic = substr($data, 0, 4);
        $mime = match (true) {
            $magic === 'wOF2' => 'font/woff2',
            $magic === 'OTTO' => 'font/otf',
            $magic === "\x00\x01\x00\x00", $magic === 'true' => 'font/ttf',
            default => null,
        };
        if ($mime === null) {
            throw new HttpError(415, 'unsupported_type', 'Only WOFF2, TTF and OTF fonts can be added.');
        }
        return [$data, $mime];
    }

    private function file(int $uid, string $id): void
    {
        $a = self::find($this->app, $uid, $id);
        if ($a === null) {
            throw HttpError::notFound();
        }
        $thumb = ($this->req->query['size'] ?? 'full') === 'thumb' && $a['thumb_name'] !== null;
        $name = $thumb ? (string) $a['thumb_name'] : (string) $a['file_name'];
        $mime = $thumb ? (string) $a['thumb_mime'] : (string) $a['mime'];
        $path = Storage::path($this->app, $uid, $name);
        if (!is_file($path)) {
            throw HttpError::notFound();
        }
        $etag = '"' . $name . '"';
        Response::securityHeaders();
        header('Cache-Control: private, max-age=31536000, immutable');
        header('ETag: ' . $etag);
        Response::sendCookies();
        if (trim($this->req->header('if-none-match')) === $etag) {
            http_response_code(304);
            return;
        }
        $ext = ['image/webp' => 'webp', 'image/jpeg' => 'jpg', 'image/png' => 'png', 'font/woff2' => 'woff2', 'font/ttf' => 'ttf', 'font/otf' => 'otf'][$mime] ?? 'bin';
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . filesize($path));
        header('Content-Disposition: inline; filename="' . $a['kind'] . '.' . $ext . '"');
        if ($this->req->method !== 'HEAD') {
            readfile($path);
        }
    }

    private function delete(int $uid, string $id): void
    {
        $st = $this->app->db()->prepare('UPDATE assets SET deleted_at = ? WHERE user_id = ? AND id = ? AND deleted_at IS NULL');
        $st->execute([App::now(), $uid, $id]);
        if ($st->rowCount() === 0) {
            throw HttpError::notFound();
        }
        Response::json([]);
    }
}
