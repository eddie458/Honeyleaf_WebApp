<?php

declare(strict_types=1);

namespace Honeyleaf;

/**
 * Re-encodes uploaded pictures with GD. Only real images get through (judged
 * by their bytes), they're turned upright, scaled down when huge, and saved
 * fresh, which leaves every bit of metadata (GPS, camera, names) behind.
 */
final class Images
{
    public const MAX_PIXELS = 40_000_000;
    private const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    /** The image's real type from its bytes, or 415. */
    public static function sniff(string $path): string
    {
        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = (string) $finfo->file($path);
        $info = @getimagesize($path);
        if (!in_array($mime, self::TYPES, true) || $info === false || !in_array($info['mime'] ?? '', self::TYPES, true)) {
            throw new HttpError(415, 'unsupported_type', 'Only JPEG, PNG, WebP and GIF pictures can be added.');
        }
        if ((int) $info[0] < 1 || (int) $info[1] < 1) {
            throw new HttpError(415, 'unsupported_type', 'That picture is empty.');
        }
        if ((int) $info[0] * (int) $info[1] > self::MAX_PIXELS) {
            throw new HttpError(413, 'too_large', 'That picture has too many pixels.');
        }
        return $mime;
    }

    public static function webpAvailable(): bool
    {
        return function_exists('imagewebp') && !empty(gd_info()['WebP Support']);
    }

    /** Decodes, turns upright (EXIF) and returns a true-colour image with alpha kept. */
    public static function open(string $path, string $mime): \GdImage
    {
        @ini_set('memory_limit', '512M');
        $img = match ($mime) {
            'image/jpeg' => @imagecreatefromjpeg($path),
            'image/png' => @imagecreatefrompng($path),
            'image/webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($path) : false,
            'image/gif' => @imagecreatefromgif($path),
            default => false,
        };
        if (!$img instanceof \GdImage) {
            throw new HttpError(415, 'unsupported_type', 'That picture could not be read.');
        }
        if (!imageistruecolor($img)) {
            imagepalettetotruecolor($img);
        }
        imagealphablending($img, false);
        imagesavealpha($img, true);
        if ($mime === 'image/jpeg' && function_exists('exif_read_data')) {
            $exif = @exif_read_data($path);
            $img = self::orient($img, (int) (is_array($exif) ? ($exif['Orientation'] ?? 1) : 1));
        }
        return $img;
    }

    private static function orient(\GdImage $img, int $o): \GdImage
    {
        if ($o === 2 || $o === 4 || $o === 5 || $o === 7) {
            imageflip($img, IMG_FLIP_HORIZONTAL);
        }
        // EXIF: 5 = mirror + 270° clockwise, 6 = 90° clockwise, 7 = mirror +
        // 90° clockwise, 8 = 270° clockwise. imagerotate() turns anticlockwise.
        $angle = match ($o) {
            3, 4 => 180,
            6, 7 => 270,
            5, 8 => 90,
            default => 0,
        };
        if ($angle !== 0) {
            $rotated = imagerotate($img, $angle, 0);
            if ($rotated instanceof \GdImage) {
                return $rotated;
            }
        }
        return $img;
    }

    /** A copy no longer than `$maxEdge` on its long side (never enlarged). */
    public static function fit(\GdImage $img, int $maxEdge): \GdImage
    {
        $w = imagesx($img);
        $h = imagesy($img);
        $scale = min(1, $maxEdge / max($w, $h));
        if ($scale >= 1) {
            return $img;
        }
        $nw = max(1, (int) round($w * $scale));
        $nh = max(1, (int) round($h * $scale));
        $out = imagecreatetruecolor($nw, $nh);
        imagealphablending($out, false);
        imagesavealpha($out, true);
        imagefill($out, 0, 0, imagecolorallocatealpha($out, 0, 0, 0, 127));
        imagecopyresampled($out, $img, 0, 0, 0, 0, $nw, $nh, $w, $h);
        return $out;
    }

    /**
     * Encodes for storage: WebP when this server can, else JPEG (photos) or
     * PNG (stickers, which need their transparency).
     *
     * @return array{data: string, mime: string, width: int, height: int}
     */
    public static function encode(\GdImage $img, bool $alpha): array
    {
        ob_start();
        if (self::webpAvailable()) {
            imagewebp($img, null, $alpha ? 92 : 86);
            $mime = 'image/webp';
        } elseif ($alpha) {
            imagepng($img, null, 6);
            $mime = 'image/png';
        } else {
            // JPEG has no transparency: lay the picture on white first.
            $flat = imagecreatetruecolor(imagesx($img), imagesy($img));
            imagefill($flat, 0, 0, imagecolorallocate($flat, 255, 255, 255));
            imagealphablending($flat, true);
            imagecopy($flat, $img, 0, 0, 0, 0, imagesx($img), imagesy($img));
            imageinterlace($flat, true);
            imagejpeg($flat, null, 88);
            $mime = 'image/jpeg';
        }
        $data = (string) ob_get_clean();
        if ($data === '') {
            throw new \RuntimeException('Image encoding failed');
        }
        return ['data' => $data, 'mime' => $mime, 'width' => imagesx($img), 'height' => imagesy($img)];
    }
}
