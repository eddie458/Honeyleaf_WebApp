<?php

declare(strict_types=1);

namespace Honeyleaf;

/**
 * Stored files: uploads/<userId>/<32 random hex>, outside the web root, no
 * extensions (nothing there is ever run or served directly; the API reads
 * them for their owner only).
 */
final class Storage
{
    public static function userDir(App $app, int $uid): string
    {
        $dir = $app->uploadsDir() . '/' . $uid;
        if (!is_dir($dir) && !@mkdir($dir, 0750, true) && !is_dir($dir)) {
            throw new \RuntimeException("Cannot create upload folder $dir");
        }
        return $dir;
    }

    public static function newName(): string
    {
        return bin2hex(random_bytes(16));
    }

    public static function path(App $app, int $uid, string $name): string
    {
        if (preg_match('/^[0-9a-f]{32}$/', $name) !== 1) {
            throw new \RuntimeException('Bad stored file name');
        }
        return $app->uploadsDir() . '/' . $uid . '/' . $name;
    }

    public static function write(App $app, int $uid, string $data): string
    {
        self::userDir($app, $uid);
        $name = self::newName();
        $path = self::path($app, $uid, $name);
        if (file_put_contents($path, $data, LOCK_EX) !== strlen($data)) {
            @unlink($path);
            throw new \RuntimeException('Could not write an uploaded file');
        }
        @chmod($path, 0640);
        return $name;
    }

    public static function remove(App $app, int $uid, ?string $name): void
    {
        if ($name !== null && $name !== '') {
            @unlink(self::path($app, $uid, $name));
        }
    }

    public static function removeUserFolder(App $app, int $uid): void
    {
        $dir = $app->uploadsDir() . '/' . $uid;
        if (!is_dir($dir)) {
            return;
        }
        foreach (scandir($dir) ?: [] as $f) {
            if ($f !== '.' && $f !== '..' && is_file("$dir/$f")) {
                @unlink("$dir/$f");
            }
        }
        @rmdir($dir);
    }

    /** Bytes a person stores (trash included, until it's emptied). */
    public static function used(App $app, int $uid): int
    {
        $st = $app->db()->prepare('SELECT COALESCE(SUM(bytes), 0) FROM assets WHERE user_id = ?');
        $st->execute([$uid]);
        return (int) $st->fetchColumn();
    }
}
