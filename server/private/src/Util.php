<?php

declare(strict_types=1);

namespace Honeyleaf;

/** Small helpers shared by the API handlers. */
final class Util
{
    private const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

    public static function isUlid(mixed $value): bool
    {
        return is_string($value) && preg_match('/^[0-9A-HJKMNP-TV-Z]{26}$/', $value) === 1;
    }

    /** Throws 404 for anything that isn't an ID (it can't name a row anyway). */
    public static function ulidOr404(string $value): string
    {
        if (!self::isUlid($value)) {
            throw HttpError::notFound();
        }
        return $value;
    }

    public static function ulid(): string
    {
        $time = (int) floor(microtime(true) * 1000);
        $head = '';
        for ($i = 0; $i < 10; $i++) {
            $head = self::CROCKFORD[$time % 32] . $head;
            $time = intdiv($time, 32);
        }
        $tail = '';
        foreach (str_split(random_bytes(16)) as $byte) {
            $tail .= self::CROCKFORD[ord($byte) & 31];
        }
        return $head . $tail;
    }

    /** A recovery code like 7KQ2-M9XD-4TPA-W3HN (easy to copy, no 0/O or 1/I). */
    public static function recoveryCode(): string
    {
        $alphabet = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
        $groups = [];
        for ($g = 0; $g < 4; $g++) {
            $s = '';
            for ($i = 0; $i < 4; $i++) {
                $s .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
            $groups[] = $s;
        }
        return implode('-', $groups);
    }

    /** Recovery codes are compared without dashes, spaces or case. */
    public static function normalizeCode(string $code): string
    {
        return strtoupper(preg_replace('/[^0-9A-Za-z]/', '', $code) ?? '');
    }

    public static function hashPassword(string $password): string
    {
        return password_hash($password, defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT);
    }

    public static function isDate(mixed $value): bool
    {
        if (!is_string($value) || preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $m) !== 1) {
            return false;
        }
        return checkdate((int) $m[2], (int) $m[3], (int) $m[1]);
    }

    /** JSON for storage, keeping objects as objects. */
    public static function encode(mixed $value): string
    {
        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION | JSON_THROW_ON_ERROR);
    }

    /** Stored JSON back as objects (an unreadable value becomes an empty object). */
    public static function decode(?string $json): mixed
    {
        if ($json === null || $json === '') {
            return new \stdClass();
        }
        try {
            return json_decode($json, false, 512, JSON_THROW_ON_ERROR | JSON_BIGINT_AS_STRING);
        } catch (\JsonException) {
            return new \stdClass();
        }
    }

    /** All the words on a page (its text and any text decorations), for search. */
    public static function plainText(mixed $doc): string
    {
        $parts = [];
        $walk = static function (mixed $node) use (&$walk, &$parts): void {
            if ($node instanceof \stdClass) {
                if (isset($node->text) && is_string($node->text)) {
                    $parts[] = $node->text;
                }
                foreach (['content', 'text', 'decorations'] as $key) {
                    if (isset($node->{$key}) && (is_array($node->{$key}) || $node->{$key} instanceof \stdClass)) {
                        $walk($node->{$key});
                    }
                }
                if (isset($node->type) && in_array($node->type, ['paragraph', 'listItem', 'taskItem'], true)) {
                    $parts[] = "\n";
                }
            } elseif (is_array($node)) {
                foreach ($node as $child) {
                    $walk($child);
                }
            }
        };
        $walk($doc);
        $text = preg_replace('/[ \t]+/', ' ', implode(' ', $parts)) ?? '';
        $text = preg_replace('/\s*\n\s*/', "\n", $text) ?? '';
        return mb_substr(trim($text), 0, 200000);
    }

    /** Whether a page document has a photo on it. */
    public static function hasPhoto(mixed $doc): bool
    {
        if (!$doc instanceof \stdClass || !isset($doc->decorations) || !is_array($doc->decorations)) {
            return false;
        }
        foreach ($doc->decorations as $d) {
            if ($d instanceof \stdClass && ($d->type ?? null) === 'photo') {
                return true;
            }
        }
        return false;
    }

    /**
     * Asset IDs a page uses ("user:<id>" in its decorations).
     *
     * @return list<string>
     */
    public static function assetIds(mixed $doc): array
    {
        $ids = [];
        if ($doc instanceof \stdClass && isset($doc->decorations) && is_array($doc->decorations)) {
            foreach ($doc->decorations as $d) {
                $asset = $d instanceof \stdClass ? ($d->asset ?? null) : null;
                if (is_string($asset) && str_starts_with($asset, 'user:') && self::isUlid(substr($asset, 5))) {
                    $ids[] = substr($asset, 5);
                }
            }
        }
        return $ids;
    }

    /** "Firefox on Windows", for the list of places you're signed in. */
    public static function deviceName(string $ua): string
    {
        $browser = match (true) {
            str_contains($ua, 'Edg/') => 'Edge',
            str_contains($ua, 'OPR/') => 'Opera',
            str_contains($ua, 'Firefox/') => 'Firefox',
            str_contains($ua, 'SamsungBrowser/') => 'Samsung Internet',
            str_contains($ua, 'Chrome/') => 'Chrome',
            str_contains($ua, 'Safari/') => 'Safari',
            default => 'A browser',
        };
        $os = match (true) {
            str_contains($ua, 'iPhone') => 'iPhone',
            str_contains($ua, 'iPad') => 'iPad',
            str_contains($ua, 'Android') => 'Android',
            str_contains($ua, 'Windows') => 'Windows',
            str_contains($ua, 'Mac OS X') => 'Mac',
            str_contains($ua, 'CrOS') => 'Chromebook',
            str_contains($ua, 'Linux') => 'Linux',
            default => '',
        };
        return $os === '' ? $browser : "$browser on $os";
    }
}
