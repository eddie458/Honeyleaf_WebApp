<?php

declare(strict_types=1);

namespace Honeyleaf;

/** Sliding-window limits kept in MySQL (works on any shared host, no cache server). */
final class RateLimit
{
    public function __construct(private readonly App $app)
    {
    }

    /** How many hits the bucket had in the last `$window` seconds. */
    public function count(string $bucket, int $window): int
    {
        $st = $this->app->db()->prepare('SELECT COUNT(*) FROM rate_limits WHERE bucket = ? AND hit_at > ?');
        $st->execute([self::key($bucket), App::at(time() - $window)]);
        return (int) $st->fetchColumn();
    }

    public function hit(string $bucket): void
    {
        $this->app->db()->prepare('INSERT INTO rate_limits (bucket, hit_at) VALUES (?, ?)')->execute([self::key($bucket), App::now()]);
    }

    public function clear(string $bucket): void
    {
        $this->app->db()->prepare('DELETE FROM rate_limits WHERE bucket = ?')->execute([self::key($bucket)]);
    }

    /** Throws 429 (with retryAfter) when the bucket is full. */
    public function check(string $bucket, int $max, int $window): void
    {
        $key = self::key($bucket);
        $st = $this->app->db()->prepare('SELECT hit_at FROM rate_limits WHERE bucket = ? AND hit_at > ? ORDER BY hit_at ASC LIMIT 1 OFFSET ' . max(0, $max - 1));
        $st->execute([$key, App::at(time() - $window)]);
        $nth = $st->fetchColumn();
        if ($nth !== false) {
            // Free again once the oldest of the last $max hits leaves the window.
            $oldest = $this->app->db()->prepare('SELECT MIN(hit_at) FROM rate_limits WHERE bucket = ? AND hit_at > ?');
            $oldest->execute([$key, App::at(time() - $window)]);
            $retry = max(1, App::ts((string) $oldest->fetchColumn()) + $window - time());
            throw new HttpError(429, 'rate_limited', 'Too many attempts. Please wait a little.', null, $retry);
        }
    }

    /** Long values (user agents, names) are hashed to fit the column. */
    private static function key(string $bucket): string
    {
        return strlen($bucket) <= 120 ? $bucket : substr($bucket, 0, 40) . ':' . hash('sha256', $bucket);
    }
}
