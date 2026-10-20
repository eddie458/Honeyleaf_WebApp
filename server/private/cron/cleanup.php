<?php

declare(strict_types=1);

// Optional daily housekeeping. In hPanel → Advanced → Cron Jobs, run once a day:
//   php /home/<you>/domains/<your-domain>/honeyleaf_private/cron/cleanup.php
// Without a cron job the API does the same work by itself, at most once an hour.

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/../src/bootstrap.php';

$app = new Honeyleaf\App(dirname(__DIR__));
$done = Honeyleaf\Cleanup::run($app);
echo 'Honeyleaf cleanup: ' . json_encode($done) . PHP_EOL;
