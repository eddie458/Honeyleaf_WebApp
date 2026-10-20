<?php

declare(strict_types=1);

// Loaded by api/index.php and cron/cleanup.php. No framework, no Composer:
// classes under the Honeyleaf\ namespace live in this folder, one per file.

const HONEYLEAF_VERSION = '0.2.0';
/** The newest page/entry document format this server understands. */
const HONEYLEAF_SCHEMA = 1;

spl_autoload_register(static function (string $class): void {
    if (!str_starts_with($class, 'Honeyleaf\\')) {
        return;
    }
    $file = __DIR__ . '/' . str_replace('\\', '/', substr($class, 10)) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// Warnings and notices are bugs: turn them into exceptions (the API answers
// 500 and the details go to the PHP error log, never to the browser).
set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    if (!(error_reporting() & $severity)) {
        return false; // silenced with @
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
});

mb_internal_encoding('UTF-8');
date_default_timezone_set('UTC');
