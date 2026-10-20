<?php

declare(strict_types=1);

namespace Honeyleaf;

/** An error the API answers with its own status and code (see docs/API.md). */
final class HttpError extends \RuntimeException
{
    /**
     * @param array<string, mixed> $extra merged into the response body next to "error"
     * @param array<string, string>|null $fields per-field reasons for "validation"
     */
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message = '',
        public readonly ?array $fields = null,
        public readonly ?int $retryAfter = null,
        public readonly array $extra = [],
    ) {
        parent::__construct($message !== '' ? $message : $errorCode);
    }

    /** @param array<string, string> $fields */
    public static function validation(array $fields): self
    {
        return new self(400, 'validation', 'Some fields are not valid.', $fields);
    }

    public static function notFound(): self
    {
        return new self(404, 'not_found', 'Not found.');
    }

    public static function badRequest(string $message = 'Bad request.'): self
    {
        return new self(400, 'bad_request', $message);
    }
}
