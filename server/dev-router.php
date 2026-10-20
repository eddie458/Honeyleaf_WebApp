<?php

declare(strict_types=1);

// Router for PHP's built-in server, mirroring the .htaccess rules:
//   php -S 127.0.0.1:8787 -t server/public server/dev-router.php   (npm run api)
//   api/<route>   → api/index.php?r=<route>
//   real files    → served as they are (never .php, never dotfiles)
//   anything else → index.php (the diary's page)

$root = rtrim(str_replace('\\', '/', (string) $_SERVER['DOCUMENT_ROOT']), '/');
$path = rawurldecode((string) parse_url((string) $_SERVER['REQUEST_URI'], PHP_URL_PATH));

if (preg_match('#^/api/(.*)$#', $path, $m) === 1) {
    $_GET['r'] = $m[1];
    $_SERVER['SCRIPT_NAME'] = '/api/index.php';
    require $root . '/api/index.php';
    return true;
}
$isHidden = preg_match('#(^|/)\.#', $path) === 1 || str_ends_with($path, '.php') || str_ends_with($path, '.map');
if ($path !== '/' && !$isHidden && is_file($root . $path)) {
    return false;
}
if ($isHidden && $path !== '/index.php') {
    http_response_code(404);
    return true;
}
$_SERVER['SCRIPT_NAME'] = '/index.php';
require $root . '/index.php';
return true;
