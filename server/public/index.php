<?php

declare(strict_types=1);

header_remove('X-Powered-By');

// The diary's page: index.html from the build, with a <base href> for
// wherever Honeyleaf is installed (the domain root or a subfolder) and
// strict security headers. Never cached, so updates show up at once.

$html = @file_get_contents(__DIR__ . '/index.html');
if ($html === false) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo "Honeyleaf: index.html is missing here. Upload the whole public_html folder again (see the README).\n";
    return;
}

$dir = str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/index.php')));
$base = rtrim($dir, '/') . '/';
$html = (string) preg_replace('/<head>/i', '<head><base href="' . htmlspecialchars($base, ENT_QUOTES) . '">', $html, 1);

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('X-Frame-Options: DENY');
header('Cross-Origin-Opener-Policy: same-origin');
header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; media-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
echo $html;
