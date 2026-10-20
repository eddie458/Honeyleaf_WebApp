// DEVELOPMENT ONLY. `npm run api`: the PHP API on http://127.0.0.1:8787 for
// `npm run dev` to talk to. Uses the portable PHP in .tools/ when it's there,
// otherwise `php` from the PATH. Needs server/private/config.php
// (scripts/dev/make-config.mjs writes one for the portable MariaDB).

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const portable = join(root, '.tools', 'php', process.platform === 'win32' ? 'php.exe' : 'php');
const php = existsSync(portable) ? portable : 'php';
const port = process.env.HONEYLEAF_API_PORT ?? '8787';
if (!existsSync(join(root, 'server', 'private', 'config.php'))) {
  console.warn('No server/private/config.php yet: the diary will open on the setup screen.');
}
console.log(`Honeyleaf API on http://127.0.0.1:${port}/api/ (PHP: ${php})`);
const child = spawn(php, ['-S', `127.0.0.1:${port}`, '-t', join(root, 'server', 'public'), join(root, 'server', 'dev-router.php')], { stdio: 'inherit', cwd: root });
child.on('exit', (code) => process.exit(code ?? 0));
