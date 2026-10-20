// Writes server/schema.sql: every migration in order, plus the rows that
// record them, so importing this one file in phpMyAdmin gives exactly the
// database the setup screen would create.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'server', 'private', 'migrations');
const files = readdirSync(dir)
  .filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f))
  .sort();

let out = `-- Honeyleaf database (generated from server/private/migrations by scripts/build-schema.mjs).
-- Import this file in phpMyAdmin into an empty database, or let the setup
-- screen create the tables for you. Either way gives the same result.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

`;
for (const f of files) out += `-- ${f}\n\n${readFileSync(join(dir, f), 'utf8').trim()}\n\n`;
out += `-- Record the migrations above as applied.\n`;
for (const f of files) {
  const [, id, name] = f.match(/^(\d{4})_(.+)\.sql$/);
  out += `INSERT IGNORE INTO migrations (id, name, applied_at) VALUES (${Number(id)}, '${id}_${name}', UTC_TIMESTAMP());\n`;
}
writeFileSync(join(root, 'server', 'schema.sql'), out);
console.log(`server/schema.sql: ${files.length} migration(s).`);
