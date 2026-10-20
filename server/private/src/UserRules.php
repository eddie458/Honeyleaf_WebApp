<?php

declare(strict_types=1);

namespace Honeyleaf;

/** What a username, name and password must look like. */
final class UserRules
{
    public const MIN_PASSWORD = 10;

    /** @return array<string, string> field → reason */
    public static function check(?string $username, ?string $displayName, ?string $password): array
    {
        $fields = [];
        if ($username !== null) {
            if ($username === '') {
                $fields['username'] = 'required';
            } elseif (preg_match('/^[a-zA-Z0-9._-]{3,32}$/', $username) !== 1) {
                $fields['username'] = 'invalid';
            }
        }
        if ($displayName !== null && mb_strlen($displayName) > 80) {
            $fields['displayName'] = 'too_long';
        }
        if ($password !== null) {
            $fields += self::password($password, 'password');
        }
        return $fields;
    }

    /** @return array<string, string> */
    public static function password(string $password, string $field): array
    {
        if ($password === '') {
            return [$field => 'required'];
        }
        if (mb_strlen($password) < self::MIN_PASSWORD) {
            return [$field => 'weak'];
        }
        if (strlen($password) > 1024) {
            return [$field => 'too_long'];
        }
        return [];
    }
}
