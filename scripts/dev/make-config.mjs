// DEVELOPMENT ONLY. Writes the local PHP settings from .tools/dev.json (the
// portable MariaDB's credentials; git-ignored): server/private/config.php
// for the dev database and .tools/config.test.php for the smoke test's own
// database. Prints no secrets.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const devFile = join(root, '.tools', 'dev.json');
if (!existsSync(devFile)) {
  console.error('No .tools/dev.json: set up the portable PHP and MariaDB first (see README, "Working on Honeyleaf").');
  process.exit(1);
}
// (PowerShell writes a byte-order mark at the start; JSON.parse doesn't allow one.)
const dev = JSON.parse(readFileSync(devFile, 'utf8').replace(/^﻿/, ''));
const php = (s) => `'${String(s).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
const config = (dbName, uploads) => `<?php
// Written by scripts/dev/make-config.mjs for local development. Not for a server.
return [
    'db_host' => ${php(dev.db_host)},
    'db_port' => ${Number(dev.db_port)},
    'db_name' => ${php(dbName)},
    'db_user' => ${php(dev.db_user)},
    'db_pass' => ${php(dev.db_pass)},
    'setup_key' => ${php(dev.setup_key)},
    'admin_reset_token' => '',
    'max_upload_bytes' => 15 * 1024 * 1024,
    'storage_default_bytes' => null,
    'trash_days' => 30,
    'session_hours' => 12,
    'uploads_dir' => ${uploads ? php(uploads) : 'null'},
    'trust_proxy_https' => false,
];
`;
writeFileSync(join(root, 'server', 'private', 'config.php'), config(dev.db_name, null));
writeFileSync(join(root, '.tools', 'config.test.php'), config(dev.db_test_name, join(root, '.tools', 'test-uploads').replaceAll('\\', '/')));
console.log('Wrote server/private/config.php (database %s) and .tools/config.test.php (database %s).', dev.db_name, dev.db_test_name);
