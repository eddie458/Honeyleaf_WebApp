<?php

declare(strict_types=1);

namespace Honeyleaf;

/** Sends API answers: JSON (never cached), files, or nothing more (streams). */
final class Response
{
    /** @var list<string> */
    private static array $cookies = [];

    public static function cookie(string $name, string $value, string $path, bool $secure, ?int $maxAge): void
    {
        $parts = [rawurlencode($name) . '=' . rawurlencode($value), 'Path=' . $path, 'HttpOnly', 'SameSite=Lax'];
        if ($secure) {
            $parts[] = 'Secure';
        }
        if ($maxAge !== null) {
            $parts[] = 'Max-Age=' . $maxAge;
            if ($maxAge <= 0) {
                $parts[] = 'Expires=Thu, 01 Jan 1970 00:00:00 GMT';
            }
        }
        self::$cookies[] = implode('; ', $parts);
    }

    public static function sendCookies(): void
    {
        foreach (self::$cookies as $cookie) {
            header('Set-Cookie: ' . $cookie, false);
        }
        self::$cookies = [];
    }

    public static function securityHeaders(): void
    {
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: same-origin');
        header('X-Frame-Options: DENY');
        header('Cross-Origin-Resource-Policy: same-origin');
    }

    /** @param array<mixed>|\stdClass $data */
    public static function json(array|\stdClass $data, int $status = 200): void
    {
        http_response_code($status);
        self::securityHeaders();
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        self::sendCookies();
        echo self::encode($data);
    }

    public static function error(HttpError $e): void
    {
        $error = ['code' => $e->errorCode, 'message' => $e->getMessage()];
        if ($e->fields !== null) {
            $error['fields'] = $e->fields;
        }
        if ($e->retryAfter !== null) {
            $error['retryAfter'] = $e->retryAfter;
            header('Retry-After: ' . $e->retryAfter);
        }
        self::json(['error' => $error] + $e->extra, $e->status);
    }

    /** @param array<mixed>|\stdClass $data */
    public static function encode(array|\stdClass $data): string
    {
        $out = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION | JSON_THROW_ON_ERROR);
        // An empty PHP array is "[]"; the API's empty bodies are objects.
        return $out === '[]' ? '{}' : $out;
    }
}
