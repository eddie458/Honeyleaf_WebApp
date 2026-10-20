<?php

declare(strict_types=1);

namespace Honeyleaf;

/** One API request: method, route, query, JSON body, cookies and client facts. */
final class Request
{
    /** Request bodies (JSON) over this are refused. */
    public const MAX_BODY = 8 * 1024 * 1024;

    private mixed $json = null;
    private bool $jsonRead = false;

    /**
     * @param array<string, string> $query
     * @param array<string, string> $cookies
     * @param array<string, string> $headers lower-case names
     */
    public function __construct(
        public readonly string $method,
        public readonly string $route,
        public readonly array $query,
        public readonly array $cookies,
        public readonly array $headers,
        public readonly string $ip,
        public readonly bool $https,
        public readonly string $basePath,
        private readonly ?string $rawBody = null,
    ) {
    }

    public static function fromGlobals(string $route, bool $trustProxyHttps): self
    {
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (is_string($value) && str_starts_with($key, 'HTTP_')) {
                $headers[strtolower(str_replace('_', '-', substr($key, 5)))] = $value;
            }
        }
        if (isset($_SERVER['CONTENT_TYPE'])) {
            $headers['content-type'] = (string) $_SERVER['CONTENT_TYPE'];
        }
        if (isset($_SERVER['CONTENT_LENGTH'])) {
            $headers['content-length'] = (string) $_SERVER['CONTENT_LENGTH'];
        }
        $https = (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off')
            || (string) ($_SERVER['SERVER_PORT'] ?? '') === '443'
            || ($trustProxyHttps && strtolower($headers['x-forwarded-proto'] ?? '') === 'https');

        // The install base: the folder above api/, e.g. "/" or "/diary/". It is
        // the cookies' Path, so it must be a real URL path: dirname() answers
        // with backslashes on Windows, which browsers would quietly ignore.
        $script = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? '/api/index.php'));
        $base = rtrim(str_replace('\\', '/', dirname($script, 2)), '/') . '/';
        if (!str_starts_with($base, '/')) {
            $base = '/' . $base;
        }

        $query = [];
        foreach ($_GET as $k => $v) {
            if (is_string($k) && is_string($v) && $k !== 'r') {
                $query[$k] = $v;
            }
        }
        $cookies = [];
        foreach ($_COOKIE as $k => $v) {
            if (is_string($k) && is_string($v)) {
                $cookies[$k] = $v;
            }
        }
        return new self(
            strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')),
            trim($route, '/'),
            $query,
            $cookies,
            $headers,
            (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'),
            $https,
            $base,
        );
    }

    public function header(string $name): string
    {
        return $this->headers[strtolower($name)] ?? '';
    }

    public function isMultipart(): bool
    {
        return str_starts_with(strtolower($this->header('content-type')), 'multipart/form-data');
    }

    /**
     * The JSON body as objects (stdClass), so empty objects stay objects when
     * page documents are stored and sent back.
     */
    public function json(): \stdClass
    {
        if (!$this->jsonRead) {
            $this->jsonRead = true;
            $length = (int) $this->header('content-length');
            if ($length > self::MAX_BODY) {
                throw new HttpError(413, 'too_large', 'Request body too large.');
            }
            $raw = $this->rawBody ?? (string) file_get_contents('php://input', false, null, 0, self::MAX_BODY + 1);
            if (strlen($raw) > self::MAX_BODY) {
                throw new HttpError(413, 'too_large', 'Request body too large.');
            }
            if (trim($raw) === '') {
                $this->json = new \stdClass();
            } else {
                try {
                    $this->json = json_decode($raw, false, 512, JSON_THROW_ON_ERROR | JSON_BIGINT_AS_STRING);
                } catch (\JsonException) {
                    throw HttpError::badRequest('Malformed JSON.');
                }
            }
        }
        if (!$this->json instanceof \stdClass) {
            throw HttpError::badRequest('Expected a JSON object.');
        }
        return $this->json;
    }

    /** A string field of the JSON body ('' when missing). */
    public function str(string $field): string
    {
        $value = $this->json()->{$field} ?? '';
        return is_string($value) ? $value : '';
    }

    public function userAgent(): string
    {
        return mb_substr($this->header('user-agent'), 0, 255);
    }
}
