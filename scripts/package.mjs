// Makes the two folders (and zips) you upload to Hostinger:
//
//   upload/public_html/          → into your domain's public_html (or a subfolder of it)
//   upload/honeyleaf_private/    → next to public_html, never inside it
//   upload/honeyleaf-public_html.zip, upload/honeyleaf_private.zip
//                                → the same, zipped, for hPanel's File Manager
//
// Run through `npm run package`, which builds and checks everything first.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const out = join(root, 'upload');
const pub = join(out, 'public_html');
const priv = join(out, 'honeyleaf_private');
for (const need of [join(dist, 'index.html'), join(root, 'server', 'schema.sql'), join(root, 'licenses', 'THIRD-PARTY.txt')]) {
  if (!existsSync(need)) {
    console.error(`Missing ${relative(root, need)}: run \`npm run package\` (it builds and checks first).`);
    process.exit(1);
  }
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// public_html: the built app, plus the two PHP doors (the page and the API).
cpSync(dist, pub, { recursive: true });
cpSync(join(root, 'server', 'public'), pub, { recursive: true });
// Vite's files have content hashes in their names: browsers may keep them a year.
writeFileSync(
  join(pub, 'assets', '.htaccess'),
  `# Built files have a content hash in their names, so they never change.
<IfModule mod_headers.c>
  Header set Cache-Control "public, max-age=31536000, immutable"
</IfModule>
`,
);

// honeyleaf_private: code, settings template, schema, licenses. Never a real
// config.php and never anyone's photos.
cpSync(join(root, 'server', 'private'), priv, {
  recursive: true,
  filter: (src) => {
    const rel = relative(join(root, 'server', 'private'), src).replaceAll('\\', '/');
    if (rel === 'config.php') return false;
    if (rel.startsWith('uploads/') && rel !== 'uploads/.htaccess') return false;
    return true;
  },
});
cpSync(join(root, 'server', 'schema.sql'), join(priv, 'schema.sql'));
cpSync(join(root, 'licenses'), join(priv, 'licenses'), { recursive: true });
writeFileSync(
  join(priv, 'licenses', 'ART.txt'),
  `All of Honeyleaf's built-in art — desk objects, stickers, washi tapes,
papers, textures and icons — was drawn in code for Honeyleaf (see
scripts/art/ and client/assets-src/ in the source). No outside images are used.

Fonts: see fonts/ (SIL Open Font License or Apache 2.0, each with its text).
Code libraries: see THIRD-PARTY.txt.
`,
);
writeFileSync(
  join(priv, 'README.txt'),
  `This is honeyleaf_private. It belongs NEXT TO public_html, never inside it.

1. Copy config.sample.php to config.php and fill it in.
2. Open your diary's address in a browser: the setup screen takes it from there.

The full guide is README.md in the Honeyleaf source.
`,
);

// Zips for hPanel's File Manager (upload, then "Extract").
const walk = (dir) => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]));
function zipFolder(folder, prefix) {
  const files = {};
  for (const file of walk(folder)) files[prefix + relative(folder, file).replaceAll('\\', '/')] = new Uint8Array(readFileSync(file));
  return zipSync(files, { level: 6 });
}
const zipPub = zipFolder(pub, '');
const zipPriv = zipFolder(priv, 'honeyleaf_private/');
writeFileSync(join(out, 'honeyleaf-public_html.zip'), zipPub);
writeFileSync(join(out, 'honeyleaf_private.zip'), zipPriv);

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const count = (dir) => walk(dir).length;
console.log(`
Ready to upload (see README, "Put it on Hostinger"):
  upload/public_html/        ${count(pub)} files   (zip: ${mb(zipPub.length)})
  upload/honeyleaf_private/  ${count(priv)} files   (zip: ${mb(zipPriv.length)})
`);
