// DEVELOPMENT ONLY. Runs PHP with the given arguments: the portable PHP in
// .tools/ when it's there, otherwise `php` from the PATH.
//   node scripts/dev/php.mjs server/tests/smoke.php

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const portable = join(root, '.tools', 'php', process.platform === 'win32' ? 'php.exe' : 'php');
const php = existsSync(portable) ? portable : 'php';
const result = spawnSync(php, process.argv.slice(2), { stdio: 'inherit', cwd: root });
process.exit(result.status ?? 1);
