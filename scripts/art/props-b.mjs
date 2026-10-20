// Desk props, part B: instant camera + shoebox, stamps + ink pad, sticky
// notes, desk calendar, magnifying glass, prompt jar.
import { doc, lin, rad, blur, circle, ellipse, rect, path, g, polar, dark, light, f, rng, speckles, tornEdge } from './lib.mjs';

/* ------------------------------------------------- camera + shoebox */

function miniPrint(x, y, rot, scene, id) {
  // An instant print: thick bottom border, little painted scene.
  const scenes = {
    sunset: ['#f6c48f', '#e98a6a', '#7a5b7e'],
    meadow: ['#bfdcef', '#9ec27f', '#5f8f4a'],
    sea: ['#cfe3ee', '#7fb2cf', '#3f7192'],
    blossom: ['#f8e4e6', '#e7a6b3', '#9db48c'],
  }[scene];
  const s = [
    rect(-34, -40, 68, 82, 2, `fill="#fbf8f1" stroke="#d6cfc2" stroke-width="1"`),
    `<clipPath id="${id}"><rect x="-28" y="-34" width="56" height="54"/></clipPath>`,
    g(
      `clip-path="url(#${id})"`,
      rect(-28, -34, 56, 54, 0, `fill="${scenes[0]}"`) +
        path('M-28 6C-14 -4 -2 2 8 -6S24 -6 28 -2V20H-28Z', `fill="${scenes[1]}"`) +
        path('M-28 14C-10 8 6 16 28 10V20H-28Z', `fill="${scenes[2]}"`) +
        circle(12, -18, 6, `fill="#fff6dc" opacity="0.8"`),
    ),
    rect(-28, -34, 56, 54, 0, `fill="none" stroke="#2a1709" stroke-opacity="0.15"`),
  ].join('');
  return g(`transform="translate(${x} ${y}) rotate(${rot})"`, rect(-34, -40, 68, 82, 2, `fill="#2a1709" opacity="0.22" filter="url(#soft2)" transform="translate(2 3)"`) + s);
}

export function cameraAndShoebox() {
  const W = 420;
  const H = 300;
  const kraft = '#c99f6e';
  const body = '#f1e5cd';
  const defs = [
    lin('box', [[0, light(kraft, 0.18)], [1, dark(kraft, 0.18)]]),
    lin('lid', [[0, light(kraft, 0.05)], [1, dark(kraft, 0.3)]]),
    lin('floor', [[0, dark(kraft, 0.36)], [1, dark(kraft, 0.2)]]),
    lin('body', [[0, light(body, 0.5)], [0.6, body], [1, dark(body, 0.2)]]),
    lin('top', [[0, '#fffaf0'], [1, light(body, 0.1)]], [0, 0, 0, 1]),
    lin('flash', [[0, '#ffffff'], [0.5, '#d8d4cc'], [1, '#a29d94']], [0, 0, 0, 1]),
    lin('ring', [[0, '#6c5f56'], [1, '#2e2621']]),
    rad('glass', [[0, '#6f86c2'], [0.45, '#33406c'], [1, '#141726']], { fx: 0.36, fy: 0.3 }),
    rad('barrel', [[0, '#b5aca1'], [0.8, '#7b7168'], [1, '#4d443d']], { fx: 0.4, fy: 0.35 }),
    lin('strap', [[0, '#c98a4f'], [1, '#8f5a2f']]),
    lin('mustard', [[0, '#f1cb6a'], [1, '#c99a2e']]),
    blur('soft', 3.5),
    blur('soft2', 1.6),
  ].join('');
  let s = '';

  // Shoebox (lid underneath, open box on top), slightly turned.
  let box = '';
  box += rect(0, 0, 236, 196, 6, `fill="url(#lid)" stroke="${dark(kraft, 0.45)}" stroke-width="2" transform="translate(16 18)"`);
  box += rect(0, 0, 236, 196, 6, `fill="#2a1709" opacity="0.3" filter="url(#soft)" transform="translate(5 7)"`);
  box += rect(0, 0, 236, 196, 6, `fill="url(#box)" stroke="${dark(kraft, 0.45)}" stroke-width="2.2"`);
  // Inner walls: far and left walls in shadow, near and right walls lit.
  box += path('M10 10H226L214 24H22Z', `fill="${dark(kraft, 0.42)}"`);
  box += path('M10 10L22 24V172L10 186Z', `fill="${dark(kraft, 0.32)}"`);
  box += path('M226 10V186L214 172V24Z', `fill="${light(kraft, 0.12)}"`);
  box += path('M10 186H226L214 172H22Z', `fill="${light(kraft, 0.2)}"`);
  box += rect(22, 24, 192, 148, 0, `fill="url(#floor)"`);
  box += path('M4 4H232V192H4Z', `fill="none" stroke="${light(kraft, 0.3)}" stroke-width="1.5" opacity="0.6"`);
  box += miniPrint(70, 92, -14, 'meadow', 'p1');
  box += miniPrint(150, 84, 9, 'sea', 'p2');
  box += miniPrint(112, 118, -3, 'sunset', 'p3');
  box += miniPrint(178, 128, 18, 'blossom', 'p4');
  s += g('transform="translate(166 24) rotate(5 118 98)"', box);

  // A print half ejected from the camera.
  s += g('transform="translate(108 96) rotate(-4)"', rect(-40, -50, 80, 52, 2, `fill="#fbf8f1" stroke="#d6cfc2" stroke-width="1"`) + rect(-33, -44, 66, 42, 0, `fill="#4b4552"`) + rect(-33, -44, 66, 42, 0, `fill="#7b7383" opacity="0.5"`));

  // Camera body, face up.
  s += rect(20, 96, 200, 166, 30, `fill="#2a1709" opacity="0.32" filter="url(#soft)" transform="translate(5 8)"`);
  s += rect(20, 96, 200, 166, 30, `fill="url(#body)" stroke="#a28f72" stroke-width="2.4"`);
  s += path('M20 140H220V126C220 109 207 96 190 96H50C33 96 20 109 20 126Z', `fill="url(#top)"`);
  s += path('M22 140H218', `stroke="#c7b597" stroke-width="1.6"`);
  s += rect(20, 170, 200, 16, 0, `fill="url(#mustard)"`);
  s += path('M20 170H220M20 186H220', `stroke="#a37a22" stroke-width="1" opacity="0.6"`);
  // Viewfinder and flash.
  s += rect(38, 106, 30, 24, 5, `fill="#2a2d3c" stroke="#5a5247" stroke-width="2"`);
  s += path('M43 112l8-2', `stroke="#9fb3e6" stroke-width="2" stroke-linecap="round"`);
  s += rect(146, 104, 58, 28, 5, `fill="url(#flash)" stroke="#857c70" stroke-width="2"`);
  for (let y = 109; y < 130; y += 3.5) s += path(`M150 ${f(y)}H200`, `stroke="#8f887d" stroke-width="0.8" opacity="0.7"`);
  // Lens.
  s += circle(114, 196, 54, `fill="#2a1709" opacity="0.28" filter="url(#soft2)" transform="translate(2 3)"`);
  s += circle(114, 196, 54, `fill="url(#ring)" stroke="#231c18" stroke-width="2"`);
  for (let a = 0; a < 360; a += 10) {
    const [x1, y1] = polar(114, 196, 49, a);
    const [x2, y2] = polar(114, 196, 53, a);
    s += path(`M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`, `stroke="#9c8f84" stroke-width="1.4" opacity="0.6"`);
  }
  s += circle(114, 196, 44, `fill="url(#barrel)"`);
  s += circle(114, 196, 33, `fill="url(#glass)" stroke="#0e0f18" stroke-width="2"`);
  s += circle(114, 196, 24, `fill="none" stroke="#9e7cc0" stroke-width="2" opacity="0.4"`);
  s += path('M94 182C98 172 108 166 118 166', `fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.75"`);
  s += circle(128, 206, 3.5, `fill="#ffffff" opacity="0.6"`);
  // Shutter button and strap.
  s += circle(192, 232, 12, `fill="#2a1709" opacity="0.25" filter="url(#soft2)" transform="translate(1.5 2.5)"`);
  s += circle(192, 232, 12, `fill="url(#mustard)" stroke="#9d7424" stroke-width="1.8"`);
  s += circle(189, 228, 4, `fill="#fff3c8" opacity="0.7"`);
  s += path('M24 236C6 246 4 272 22 286C36 296 60 292 70 280', `fill="none" stroke="#2a1709" stroke-width="13" stroke-linecap="round" opacity="0.18" filter="url(#soft2)" transform="translate(3 4)"`);
  s += path('M24 236C6 246 4 272 22 286C36 296 60 292 70 280', `fill="none" stroke="url(#strap)" stroke-width="12" stroke-linecap="round"`);
  s += path('M22 240C10 250 9 268 22 280', `fill="none" stroke="#f3cf9e" stroke-width="1.4" stroke-dasharray="4 4" opacity="0.8"`);
  s += path('M42 108C80 100 140 100 196 104', `fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity="0.6"`);
  return doc(W, H, defs, s, 'Instant camera and a shoebox of prints');
}

/* ----------------------------------------------------- stamps + ink */

export function stamps() {
  const W = 360;
  const H = 240;
  const ink = '#6b3a5c';
  const defs = [
    lin('tin', [[0, '#fbf3df'], [0.4, '#cdb98f'], [1, '#86714c']]),
    rad('ink', [[0, light(ink, 0.25)], [0.7, ink], [1, dark(ink, 0.35)]], { fx: 0.35, fy: 0.3 }),
    lin('wood', [[0, '#e6b882'], [0.6, '#c48e57'], [1, '#93612f']]),
    lin('woodSide', [[0, '#a8743f'], [1, '#6e4520']]),
    rad('knob', [[0, '#f0c896'], [0.6, '#b97f47'], [1, '#7a4a22']], { fx: 0.34, fy: 0.3 }),
    rad('handle', [[0, '#c48d57'], [1, '#7f5026']], { fx: 0.36, fy: 0.3 }),
    lin('label', [[0, '#fffaf0'], [1, '#eadfca']]),
    blur('soft', 3.5),
    blur('soft2', 1.8),
  ].join('');
  let s = '';
  // Ink pad tin, its lid tucked underneath.
  s += circle(104, 140, 74, `fill="#2a1709" opacity="0.3" filter="url(#soft)" transform="translate(5 8)"`);
  s += circle(116, 150, 74, `fill="url(#tin)" stroke="#6f5d3c" stroke-width="2"`);
  s += circle(96, 128, 74, `fill="#2a1709" opacity="0.25" filter="url(#soft2)" transform="translate(3 5)"`);
  s += circle(96, 128, 74, `fill="url(#tin)" stroke="#6f5d3c" stroke-width="2.2"`);
  s += circle(96, 128, 66, `fill="none" stroke="#fffaf0" stroke-width="2" opacity="0.6"`);
  s += circle(96, 128, 62, `fill="url(#ink)" stroke="#3e2236" stroke-width="2"`);
  s += speckles(96, 128, 60, 120, '#2a1424', { seed: 33, size: [0.5, 1.2], opacity: 0.45 });
  s += ellipse(78, 106, 28, 14, `fill="#ffffff" opacity="0.16" transform="rotate(-30 78 106)"`);
  s += path('M42 112C48 88 66 72 90 66', `fill="none" stroke="#fffdf6" stroke-width="3" stroke-linecap="round" opacity="0.8"`);

  // A turned-handle stamp.
  let st = '';
  st += rect(-48, -48, 96, 96, 10, `fill="#2a1709" opacity="0.32" filter="url(#soft)" transform="translate(6 9)"`);
  st += rect(-48, -48, 96, 96, 10, `fill="url(#wood)" stroke="#7a4d24" stroke-width="2"`);
  st += path('M-40 -30C-10 -34 20 -26 40 -30M-40 -6C-6 -10 22 -2 40 -8M-40 20C-8 16 18 24 40 18', `fill="none" stroke="#9b6a3b" stroke-width="1" opacity="0.45"`);
  st += circle(0, 0, 31, `fill="#2a1709" opacity="0.3" filter="url(#soft2)" transform="translate(4 6)"`);
  st += circle(0, 0, 31, `fill="url(#handle)" stroke="#5f3a1b" stroke-width="2"`);
  st += circle(-2, -2, 20, `fill="url(#knob)" stroke="#6b4220" stroke-width="1.5"`);
  st += circle(-8, -9, 5, `fill="#fff3dc" opacity="0.65"`);
  s += g('transform="translate(236 76) rotate(8)"', st);

  // A flat block stamp with its design printed on top.
  let fb = '';
  fb += rect(-46, -36, 92, 72, 7, `fill="#2a1709" opacity="0.3" filter="url(#soft)" transform="translate(4 7)"`);
  fb += rect(-46, -36, 92, 72, 7, `fill="url(#wood)" stroke="#7a4d24" stroke-width="2"`);
  fb += rect(-34, -25, 68, 50, 3, `fill="url(#label)" stroke="#cdbb9a" stroke-width="1"`);
  fb += path('M0 15C-18 3-20-9-12-14C-6-17 0-13 0-8C0-13 6-17 12-14C20-9 18 3 0 15Z', `fill="${ink}" opacity="0.85"`);
  s += g('transform="translate(286 184) rotate(-10)"', fb);
  return doc(W, H, defs, s, 'Rubber stamps and an ink pad');
}

/* --------------------------------------------------------- sticky notes */

export function stickyNotes() {
  const W = 280;
  const H = 240;
  const yellow = '#f4d56a';
  const defs = [
    lin('pad', [[0, light(yellow, 0.25)], [0.7, yellow], [1, dark(yellow, 0.1)]]),
    lin('curl', [[0, dark(yellow, 0.18)], [0.5, light(yellow, 0.4)], [1, light(yellow, 0.1)]], [1, 1, 0.3, 0.3]),
    lin('card', [[0, '#ffffff'], [1, '#ece6d9']]),
    lin('scrap', [[0, '#fffaf0'], [1, '#efe4cf']]),
    blur('soft', 3),
    blur('soft2', 1.6),
  ].join('');
  let s = '';
  // Index card.
  let card = rect(-92, -62, 184, 124, 2, `fill="#2a1709" opacity="0.25" filter="url(#soft)" transform="translate(3 6)"`);
  card += rect(-92, -62, 184, 124, 2, `fill="url(#card)" stroke="#cfc6b6" stroke-width="1"`);
  card += path('M-92 -38H92', `stroke="#e38c8c" stroke-width="1.6"`);
  for (let y = -22; y < 60; y += 15) card += path(`M-92 ${y}H92`, `stroke="#a9c3df" stroke-width="1"`);
  s += g('transform="translate(126 150) rotate(-10)"', card);
  // Torn notebook scrap with ragged spiral holes.
  const top = tornEdge(-84, -54, 84, -54, { teeth: 22, depth: 6, seed: 12 });
  let d = `M${f(top[0][0])} ${f(top[0][1])}`;
  for (const [x, y] of top.slice(1)) d += `L${f(x)} ${f(y)}`;
  d += 'L84 56L-84 56Z';
  let scrap = path(d, `fill="#2a1709" opacity="0.22" filter="url(#soft)" transform="translate(3 6)"`);
  scrap += path(d, `fill="url(#scrap)" stroke="#d8cbb2" stroke-width="1"`);
  for (let y = -30; y < 56; y += 14) scrap += path(`M-84 ${y}H84`, `stroke="#b7cfe6" stroke-width="1"`);
  scrap += path('M-58 -54V56', `stroke="#e8a3a3" stroke-width="1.4"`);
  for (let x = -70; x < 80; x += 18) scrap += ellipse(x, -44, 4, 5.5, `fill="#2a1709" opacity="0.18"`);
  s += g('transform="translate(150 92) rotate(7)"', scrap);
  // Sticky pad on top: stacked edge, curled corner on the top sheet.
  let pad = '';
  pad += rect(-66, -66, 132, 132, 3, `fill="#2a1709" opacity="0.3" filter="url(#soft)" transform="translate(4 7)"`);
  for (let i = 4; i >= 1; i--) pad += rect(-66 + i * 0.8, -66 + i * 1.4, 132, 132, 3, `fill="${dark(yellow, 0.06 + i * 0.03)}"`);
  pad += path('M-66 -66H66V30L30 66H-66Z', `fill="url(#pad)" stroke="${dark(yellow, 0.35)}" stroke-width="1.2"`);
  pad += path('M-66 -58H66', `stroke="${dark(yellow, 0.2)}" stroke-width="5" opacity="0.18"`);
  pad += path('M66 30L30 66C36 52 44 40 66 30Z', `fill="#2a1709" opacity="0.25" filter="url(#soft2)"`);
  pad += path('M66 30C50 34 38 44 30 66C46 60 58 52 66 30Z', `fill="url(#curl)" stroke="${dark(yellow, 0.3)}" stroke-width="1"`);
  s += g('transform="translate(178 144) rotate(-3)"', pad);
  return doc(W, H, defs, s, 'Sticky notes and paper scraps');
}

/* ---------------------------------------------------------- calendar */

/** A tear-off calendar. The month, day and weekday are drawn by the app over it. */
export function calendar() {
  const W = 240;
  const H = 200;
  const defs = [
    lin('board', [[0, '#d9b17c'], [1, '#a77845']]),
    lin('paper', [[0, '#fffdf7'], [1, '#efe6d3']]),
    lin('band', [[0, '#d97f60'], [1, '#a9533a']], [0, 0, 0, 1]),
    rad('rivet', [[0, '#ffffff'], [0.5, '#c9c2b6'], [1, '#7c756b']], { fx: 0.35, fy: 0.3 }),
    blur('soft', 3),
  ].join('');
  let s = '';
  s += rect(12, 12, 216, 178, 10, `fill="#2a1709" opacity="0.3" filter="url(#soft)" transform="translate(4 6)"`);
  s += rect(12, 12, 216, 178, 10, `fill="url(#board)" stroke="#86592c" stroke-width="2"`);
  // Paper block with its stacked edge.
  for (let i = 4; i >= 1; i--) s += rect(26 + i * 0.6, 40 + i * 1.6, 188, 138, 2, `fill="${['#e9dfca', '#e2d6bd', '#dbcdb2', '#d3c4a6'][i - 1]}"`);
  s += rect(26, 40, 188, 138, 2, `fill="url(#paper)" stroke="#cfc3ab" stroke-width="1"`);
  // Torn stubs left by yesterday's pages.
  const stub = tornEdge(26, 46, 214, 46, { teeth: 26, depth: 5, seed: 4 });
  let d = 'M26 38';
  for (const [x, y] of stub) d += `L${f(x)} ${f(y)}`;
  d += 'L214 38Z';
  s += path(d, `fill="#f7f0e2" stroke="#d6cab2" stroke-width="0.8"`);
  // Binding band with rivets.
  s += rect(20, 20, 200, 24, 5, `fill="url(#band)" stroke="#7c3a26" stroke-width="1.6"`);
  s += path('M24 24H216', `stroke="#f2b8a2" stroke-width="1.4" opacity="0.6"`);
  s += circle(50, 32, 5, `fill="url(#rivet)" stroke="#6e675e" stroke-width="0.8"`);
  s += circle(190, 32, 5, `fill="url(#rivet)" stroke="#6e675e" stroke-width="0.8"`);
  s += path('M40 168H200', `stroke="#d8ccb4" stroke-width="1" stroke-dasharray="3 4"`);
  return doc(W, H, defs, s, 'Desk calendar');
}

/* --------------------------------------------------------- magnifier */

export function magnifier() {
  const W = 340;
  const H = 150;
  const defs = [
    lin('brass', [[0, '#f8dc96'], [0.45, '#cfa458'], [1, '#7f5a22']]),
    rad('lens', [[0, '#ffffff', 0.08], [0.75, '#d7e6ea', 0.16], [1, '#9fb8c2', 0.42]], { fx: 0.4, fy: 0.35 }),
    lin('walnut', [[0, '#8a5634'], [0.5, '#5e361d'], [1, '#3e2211']], [0, 0, 0, 1]),
    blur('soft', 3),
    blur('soft2', 1.5),
  ].join('');
  let s = '';
  s += path('M150 64H316C326 64 332 70 332 75C332 80 326 86 316 86H150Z', `fill="#2a1709" opacity="0.3" filter="url(#soft)" transform="translate(4 7)"`);
  s += circle(76, 75, 64, `fill="none" stroke="#2a1709" stroke-width="12" opacity="0.3" filter="url(#soft)" transform="translate(4 7)"`);
  // Handle and collar.
  s += path('M164 63H316C327 63 334 69 334 75C334 81 327 87 316 87H164Z', `fill="url(#walnut)" stroke="#2f190b" stroke-width="2"`);
  s += path('M176 68C220 66 270 67 318 69', `fill="none" stroke="#c8936a" stroke-width="2" stroke-linecap="round" opacity="0.55"`);
  s += path('M186 79C230 80 270 78 314 81', `fill="none" stroke="#2f190b" stroke-width="1" opacity="0.4"`);
  s += rect(134, 64, 32, 22, 4, `fill="url(#brass)" stroke="#6f4d1c" stroke-width="1.8"`);
  s += path('M142 64V86M154 64V86', `stroke="#8f6a2c" stroke-width="1.2" opacity="0.6"`);
  // Lens: clear glass, so the desk shows through.
  s += circle(76, 75, 56, `fill="url(#lens)"`);
  s += circle(76, 75, 61, `fill="none" stroke="url(#brass)" stroke-width="11"`);
  s += circle(76, 75, 66.5, `fill="none" stroke="#6f4d1c" stroke-width="1.6"`);
  s += circle(76, 75, 55.5, `fill="none" stroke="#6f4d1c" stroke-width="1.6"`);
  s += path('M36 60C42 40 58 30 76 28', `fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.7"`);
  s += path('M48 84C50 92 54 98 60 102', `fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="0.45"`);
  s += path('M30 46C40 30 56 20 76 16', `fill="none" stroke="#fff6d8" stroke-width="2.5" stroke-linecap="round" opacity="0.8"`);
  return doc(W, H, defs, s, 'Magnifying glass');
}

/* --------------------------------------------------------- prompt jar */

export function promptJar() {
  const W = 190;
  const H = 210;
  const cx = 92;
  const cy = 100;
  const pastels = ['#f6d1cc', '#f9e2a6', '#cfe1c2', '#cfe0ef', '#e7d3ee', '#fbe9d6'];
  const defs = [
    rad('glass', [[0, '#ffffff', 0.05], [0.8, '#e8f2ee', 0.18], [1, '#b8d0c8', 0.55]], { fx: 0.4, fy: 0.35 }),
    lin('rim', [[0, '#ffffff', 0.9], [0.5, '#dcebe6', 0.5], [1, '#8fb0a5', 0.7]]),
    lin('twine', [[0, '#d9b98d'], [1, '#a37e52']]),
    lin('tag', [[0, '#ead2a8'], [1, '#c9a173']]),
    blur('soft', 3),
    blur('soft2', 1.4),
  ].join('');
  let s = '';
  s += circle(cx, cy, 80, `fill="#2a1709" opacity="0.18" filter="url(#soft)" transform="translate(6 10)"`);
  // Glass shoulder.
  s += circle(cx, cy, 80, `fill="url(#glass)" stroke="#9cbab0" stroke-width="2"`);
  // Folded slips inside, seen through the mouth.
  const rand = rng(77);
  let slips = '';
  for (let i = 0; i < 16; i++) {
    const a = rand() * 360;
    const r = Math.sqrt(rand()) * 34;
    const [x, y] = polar(cx, cy, r, a);
    const c = pastels[i % pastels.length];
    const rot = rand() * 180;
    slips += g(
      `transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})"`,
      rect(-16, -9, 32, 18, 2, `fill="${c}" stroke="${dark(c, 0.25)}" stroke-width="1"`) +
        path('M0 -9V9', `stroke="${dark(c, 0.3)}" stroke-width="1"`) +
        rect(0, -9, 16, 18, 0, `fill="#2a1709" opacity="0.08"`),
    );
  }
  s += `<clipPath id="mouth"><circle cx="${cx}" cy="${cy}" r="52"/></clipPath>`;
  s += g('clip-path="url(#mouth)"', circle(cx, cy, 52, `fill="#efe8da"`) + slips + circle(cx, cy, 52, `fill="none" stroke="#2a1709" stroke-width="16" opacity="0.12"`));
  // Thick glass rim.
  s += circle(cx, cy, 56, `fill="none" stroke="url(#rim)" stroke-width="9"`);
  s += circle(cx, cy, 60.5, `fill="none" stroke="#86a69b" stroke-width="1.2" opacity="0.8"`);
  // Twine around the neck with a bow and a blank tag.
  s += circle(cx, cy, 65, `fill="none" stroke="url(#twine)" stroke-width="4.5"`);
  s += circle(cx, cy, 65, `fill="none" stroke="#7b5a35" stroke-width="4.5" stroke-dasharray="2 3" opacity="0.5"`);
  const [bx, by] = polar(cx, cy, 65, 52);
  s += g(
    `transform="translate(${f(bx)} ${f(by)}) rotate(52)"`,
    path('M0 0C10 -16 26 -14 22 -2C18 6 6 4 0 0Z', `fill="url(#twine)" stroke="#7b5a35" stroke-width="1.2"`) +
      path('M0 0C10 16 26 14 22 2C18 -6 6 -4 0 0Z', `fill="url(#twine)" stroke="#7b5a35" stroke-width="1.2"`) +
      path('M0 0C14 8 24 22 30 36M0 0C16 2 30 8 40 18', `fill="none" stroke="url(#twine)" stroke-width="3" stroke-linecap="round"`) +
      circle(0, 0, 4, `fill="#b08a5c" stroke="#7b5a35" stroke-width="1"`),
  );
  s += g('transform="translate(150 178) rotate(-18)"', rect(-18, -11, 36, 22, 3, `fill="#2a1709" opacity="0.2" filter="url(#soft2)" transform="translate(2 3)"`) + path('M-18 -11H18V11H-18L-24 0Z', `fill="url(#tag)" stroke="#9b7149" stroke-width="1"`) + circle(-14, 0, 2.4, `fill="#7b5a35"`));
  s += path(`M${cx - 66} ${cy - 18}C${cx - 60} ${cy - 50} ${cx - 34} ${cy - 72} ${cx - 2} ${cy - 76}`, `fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.7"`);
  s += path(`M${cx + 46} ${cy + 50}C${cx + 56} ${cy + 40} ${cx + 64} ${cy + 26} ${cx + 66} ${cy + 12}`, `fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="0.5"`);
  return doc(W, H, defs, s, 'Jar of folded prompts');
}

