<?php

declare(strict_types=1);

header_remove('X-Powered-By');

// Every API request comes through here (api/.htaccess sends api/<route> to
// index.php?r=<route>). The real code lives in honeyleaf_private/src.

$private = require __DIR__ . '/../hl-locate.php';
if (!is_string($private)) {
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo '{"error":{"code":"setup_required","message":"The honeyleaf_private folder was not found next to public_html. See the README."}}';
    return;
}

require $private . '/src/bootstrap.php';
\Honeyleaf\Api::handle($private, (string) ($_GET['r'] ?? ''));
