<?php

declare(strict_types=1);

// Finds the honeyleaf_private folder: the code, settings and uploads that
// must never be reachable from the web. Looked for, in order:
//   1. the HONEYLEAF_PRIVATE environment variable (if a host sets one),
//   2. next to the web root (public_html/../honeyleaf_private) — the normal place,
//   3. one level further up (when Honeyleaf lives in a subfolder of public_html),
//   4. inside this folder (works, but the setup screen warns about it),
//   5. ../private (this repository, for development).
// Returns the folder's path, or null.

return (static function (): ?string {
    $here = __DIR__;
    $candidates = [];
    $env = getenv('HONEYLEAF_PRIVATE');
    if (is_string($env) && $env !== '') {
        $candidates[] = $env;
    }
    $candidates[] = dirname($here) . '/honeyleaf_private';
    $candidates[] = dirname($here, 2) . '/honeyleaf_private';
    $candidates[] = $here . '/honeyleaf_private';
    $candidates[] = dirname($here) . '/private';
    foreach ($candidates as $dir) {
        // @: open_basedir may forbid looking at some of these places.
        if (@is_file($dir . '/src/bootstrap.php')) {
            return (string) (realpath($dir) ?: $dir);
        }
    }
    return null;
})();
