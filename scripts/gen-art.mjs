// Writes the built-in desk art (props) as plain SVG files into
// client/public/library/props. The SVGs are committed: they are ordinary,
// swappable art files. Re-run with `npm run art` after changing the drawings.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as A from './art/props-a.mjs';
import * as B from './art/props-b.mjs';
import * as C from './art/props-c.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'client/public/library/props');
mkdirSync(out, { recursive: true });

const files = {
  'mug-cocoa.svg': A.mug('cocoa'),
  'mug-coffee.svg': A.mug('coffee'),
  'mug-tea.svg': A.mug('tea'),
  'plant-1.svg': A.plant(1),
  'plant-2.svg': A.plant(2),
  'plant-3.svg': A.plant(3),
  'plant-4.svg': A.plant(4),
  'plant-5.svg': A.plant(5),
  'pencil-cup.svg': A.pencilCup(),
  'washi-rolls.svg': A.washiRolls(),
  'sticker-book.svg': A.stickerBook(),
  'camera.svg': B.cameraAndShoebox(),
  'stamps.svg': B.stamps(),
  'sticky-notes.svg': B.stickyNotes(),
  'calendar.svg': B.calendar(),
  'magnifier.svg': B.magnifier(),
  'prompt-jar.svg': B.promptJar(),
  'radio.svg': C.radio(),
  'lamp.svg': C.lamp(),
  'drawer.svg': C.drawer(),
  'journal-stack.svg': C.journalStack(),
  'padlock.svg': C.padlock(),
  'keyring.svg': C.keyring(),
  'wastebasket.svg': C.wastebasket(true),
  'wastebasket-empty.svg': C.wastebasket(false),
  'pen-tray.svg': C.penTray(),
  'tool-fountain-pen.svg': C.fountainPen(),
  'tool-tweezers.svg': C.tweezers(),
  'tool-pencil.svg': C.pencil(),
  'leaf-maple-red.svg': C.leaf('maple', ['#f0a24a', '#d8612e', '#a8392a'], 3),
  'leaf-maple-gold.svg': C.leaf('maple', ['#f6d36a', '#e7a43a', '#c4702a'], 5),
  'leaf-oak.svg': C.leaf('oak', ['#d9a75a', '#b97a36', '#87501f'], 7),
  'leaf-birch.svg': C.leaf('birch', ['#f4dc7a', '#e2b440', '#b98222'], 9),
};

let total = 0;
for (const [name, svg] of Object.entries(files)) {
  writeFileSync(join(out, name), svg);
  total += svg.length;
}
console.log(`${Object.keys(files).length} props written (${(total / 1024).toFixed(0)} KB)`);
