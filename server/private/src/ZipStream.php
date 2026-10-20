<?php

declare(strict_types=1);

namespace Honeyleaf;

/**
 * Writes a .zip straight to the browser while it's being made, so a big
 * diary never has to fit in memory or in a temporary file. Photos are
 * stored as they are (already compressed); JSON is deflated.
 */
final class ZipStream
{
    /** @var list<array{name: string, crc: int, csize: int, usize: int, offset: int, method: int, time: int, date: int}> */
    private array $files = [];
    private int $offset = 0;

    /** @param callable(string): void $out */
    public function __construct(private $out)
    {
    }

    public function addString(string $name, string $data, bool $deflate = true): void
    {
        $crc = (int) hexdec(hash('crc32b', $data));
        $packed = $deflate ? (string) gzdeflate($data, 6) : $data;
        $this->header($name, $crc, strlen($packed), strlen($data), $deflate ? 8 : 0);
        $this->write($packed);
    }

    public function addFile(string $name, string $path): void
    {
        $size = (int) filesize($path);
        $crc = (int) hexdec((string) hash_file('crc32b', $path));
        $this->header($name, $crc, $size, $size, 0);
        $fh = fopen($path, 'rb');
        if ($fh === false) {
            throw new \RuntimeException("Cannot read $path");
        }
        while (!feof($fh)) {
            $chunk = fread($fh, 1 << 16);
            if ($chunk === false) {
                break;
            }
            $this->write($chunk);
        }
        fclose($fh);
    }

    private function header(string $name, int $crc, int $csize, int $usize, int $method): void
    {
        if ($this->offset > 0xFFFFFFFF - $csize - 1024) {
            throw new HttpError(413, 'too_large', 'This export is too big for one file. Export one year at a time.');
        }
        [$time, $date] = self::dosTime(time());
        $this->files[] = ['name' => $name, 'crc' => $crc, 'csize' => $csize, 'usize' => $usize, 'offset' => $this->offset, 'method' => $method, 'time' => $time, 'date' => $date];
        // Local file header; bit 11 = names are UTF-8.
        $this->write(pack('VvvvvvVVVvv', 0x04034b50, 20, 0x0800, $method, $time, $date, $crc, $csize, $usize, strlen($name), 0) . $name);
    }

    public function finish(): void
    {
        $start = $this->offset;
        foreach ($this->files as $f) {
            $this->write(pack('VvvvvvvVVVvvvvvVV', 0x02014b50, 20, 20, 0x0800, $f['method'], $f['time'], $f['date'], $f['crc'], $f['csize'], $f['usize'], strlen($f['name']), 0, 0, 0, 0, 0, $f['offset']) . $f['name']);
        }
        $size = $this->offset - $start;
        $count = count($this->files);
        $this->write(pack('VvvvvVVv', 0x06054b50, 0, 0, $count, $count, $size, $start, 0));
    }

    private function write(string $bytes): void
    {
        ($this->out)($bytes);
        $this->offset += strlen($bytes);
    }

    /** @return array{0: int, 1: int} */
    private static function dosTime(int $ts): array
    {
        $d = getdate($ts);
        $time = ($d['hours'] << 11) | ($d['minutes'] << 5) | intdiv($d['seconds'], 2);
        $date = (max(0, $d['year'] - 1980) << 9) | ($d['mon'] << 5) | $d['mday'];
        return [$time, $date];
    }
}
