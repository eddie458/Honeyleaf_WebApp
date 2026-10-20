<?php

declare(strict_types=1);

namespace Honeyleaf;

/** settings: one JSON object per person (desk choices, lock time, …). */
final class SettingsApi
{
    private const MAX = 256 * 1024;

    public function __construct(private readonly App $app, private readonly Request $req, private readonly Auth $auth)
    {
    }

    /** @param list<string> $seg */
    public function handle(string $method, array $seg): void
    {
        if ($seg !== []) {
            throw HttpError::notFound();
        }
        $uid = $this->auth->userId();
        match ($method) {
            'GET' => Response::json(['settings' => self::load($this->app, $uid)]),
            'PUT' => $this->put($uid),
            default => throw HttpError::notFound(),
        };
    }

    public static function load(App $app, int $uid): \stdClass
    {
        $st = $app->db()->prepare('SELECT data FROM settings WHERE user_id = ?');
        $st->execute([$uid]);
        $data = Util::decode(($st->fetchColumn() ?: null));
        return $data instanceof \stdClass ? $data : new \stdClass();
    }

    private function put(int $uid): void
    {
        $settings = $this->req->json()->settings ?? null;
        if (!$settings instanceof \stdClass) {
            throw HttpError::validation(['settings' => 'required']);
        }
        $json = Util::encode($settings);
        if (strlen($json) > self::MAX) {
            throw new HttpError(413, 'too_large', 'Settings are too large.');
        }
        $db = $this->app->db();
        $db->prepare('INSERT INTO settings (user_id, data, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = VALUES(updated_at)')
            ->execute([$uid, $json, App::now()]);
        $lock = $settings->lockMinutes ?? null;
        if (is_int($lock) && $lock >= 1 && $lock <= 240) {
            $db->prepare('UPDATE users SET lock_minutes = ? WHERE id = ?')->execute([$lock, $uid]);
        }
        Response::json([]);
    }
}
