// Desk props, part C: radio, desk lamp, drawer unit, journal stack, padlock,
// key ring, wastebasket, pen tray and its three tools, fallen leaves.
import { doc, lin, rad, blur, circle, ellipse, rect, path, g, polar, dark, light, f, rng, speckles } from './lib.mjs';

/* -------------------------------------------------------------- radio */

export function radio() {
  const W = 320;
  const H = 210;
  const rose = '#d29a90';
  const defs = [
    lin('topFace', [[0, light(rose, 0.35)], [1, light(rose, 0.05)]]),
    lin('front', [[0, rose], [1, dark(rose, 0.22)]], [0, 0, 0.3, 1]),
    `<pattern id="grille" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#f1e6cf"/><circle cx="3.5" cy="3.5" r="1.6" fill="#8d7458" opacity="0.75"/></pattern>`,
    lin('dial', [[0, '#fffaf0'], [1, '#eadcbf']]),
    rad('knob', [[0, '#fbe3a8'], [0.6, '#c99a4a'], [1, '#7f5a22']], { fx: 0.35, fy: 0.3 }),
    lin('strap', [[0, '#a4683c'], [1, '#6f4320']], [0, 0, 0, 1]),
    lin('chrome', [[0, '#ffffff'], [0.5, '#b9b6b0'], [1, '#6f6b65']], [0, 0, 0, 1]),
    blur('soft', 3.5),
    blur('soft2', 1.5),
  ].join('');
  let s = '';
  // Telescopic antenna lying back along the top.
  s += path('M276 46L314 10', `stroke="url(#chrome)" stroke-width="5" stroke-linecap="round"`);
  s += path('M276 46L296 27', `stroke="#9a968f" stroke-width="7" stroke-linecap="round"`);
  s += circle(314, 10, 4.5, `fill="#e9e6df" stroke="#77736c" stroke-width="1"`);
  // Body: lit top face, front face toward the viewer.
  s += rect(22, 26, 276, 170, 22, `fill="#2a1709" opacity="0.3" filter="url(#soft)" transform="translate(5 8)"`);
  s += rect(22, 26, 276, 170, 22, `fill="url(#front)" stroke="${dark(rose, 0.5)}" stroke-width="2.4"`);
  s += path('M22 74V48C22 36 32 26 44 26H276C288 26 298 36 298 48V74Z', `fill="url(#topFace)"`);
  s += path('M24 74H296', `stroke="${dark(rose, 0.35)}" stroke-width="2"`);
  s += path('M24 77H296', `stroke="${light(rose, 0.4)}" stroke-width="1.4" opacity="0.7"`);
  // Carry strap folded flat on top.
  s += rect(104, 36, 112, 18, 9, `fill="url(#strap)" stroke="#52301a" stroke-width="1.4"`);
  s += path('M112 45H208', `stroke="#e1b07f" stroke-width="1.2" stroke-dasharray="4 4" opacity="0.8"`);
  s += rect(96, 38, 14, 14, 3, `fill="url(#chrome)" stroke="#6f6b65" stroke-width="1"`);
  s += rect(210, 38, 14, 14, 3, `fill="url(#chrome)" stroke="#6f6b65" stroke-width="1"`);
  // Speaker grille.
  s += rect(40, 90, 150, 92, 12, `fill="url(#grille)" stroke="${dark(rose, 0.45)}" stroke-width="2"`);
  s += rect(40, 90, 150, 92, 12, `fill="none" stroke="#2a1709" stroke-width="6" opacity="0.12"`);
  // Tuning dial.
  s += rect(204, 90, 78, 48, 8, `fill="url(#dial)" stroke="${dark(rose, 0.45)}" stroke-width="2"`);
  for (let x = 212; x <= 274; x += 6) s += path(`M${x} 100v${(x - 212) % 18 === 0 ? 12 : 7}`, `stroke="#7c6247" stroke-width="1.1"`);
  s += path('M210 124H276', `stroke="#c9b28f" stroke-width="1"`);
  s += path('M246 96V132', `stroke="#d4553e" stroke-width="2.4" stroke-linecap="round"`);
  s += path('M210 96C224 93 250 93 270 96', `fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" opacity="0.8"`);
  // Knobs.
  for (const x of [224, 264]) {
    s += circle(x + 2, 166, 15, `fill="#2a1709" opacity="0.3" filter="url(#soft2)" transform="translate(1 2)"`);
    s += circle(x, 164, 15, `fill="url(#knob)" stroke="#6f4d1c" stroke-width="1.6"`);
    for (let a = 0; a < 360; a += 30) {
      const [x1, y1] = polar(x, 164, 11.5, a);
      const [x2, y2] = polar(x, 164, 14.5, a);
      s += path(`M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`, `stroke="#8f6a2c" stroke-width="1" opacity="0.7"`);
    }
    s += circle(x - 4, 160, 4, `fill="#fff6dc" opacity="0.6"`);
  }
  s += path('M36 34C80 28 160 28 240 30', `fill="none" stroke="#fff6ee" stroke-width="2.4" stroke-linecap="round" opacity="0.6"`);
  return doc(W, H, defs, s, 'Little radio');
}

/* --------------------------------------------------------------- lamp */

export function lamp() {
  const W = 470;
  const H = 430;
  const mustard = '#e3b448';
  const defs = [
    rad('base', [[0, light(mustard, 0.4)], [0.65, mustard], [1, dark(mustard, 0.35)]], { fx: 0.34, fy: 0.3 }),
    lin('coneBody', [[0, dark(mustard, 0.32)], [0.42, light(mustard, 0.25)], [0.58, mustard], [1, dark(mustard, 0.38)]], [0, 0, 0, 1]),
    lin('arm', [[0, '#fbf3e2'], [1, '#bfae8e']], [0, 0, 0, 1]),
    rad('joint', [[0, '#ffffff'], [0.5, '#cfc7b8'], [1, '#7e7668']], { fx: 0.35, fy: 0.3 }),
    lin('cap', [[0, light(mustard, 0.3)], [1, dark(mustard, 0.3)]]),
    blur('soft', 6),
    blur('soft2', 2),
  ].join('');
  let s = '';
  // Heavy round base.
  s += circle(96, 92, 74, `fill="url(#base)" stroke="${dark(mustard, 0.5)}" stroke-width="2.4"`);
  s += circle(96, 92, 62, `fill="none" stroke="${light(mustard, 0.5)}" stroke-width="2" opacity="0.6"`);
  s += circle(96, 92, 20, `fill="url(#joint)" stroke="#6e675c" stroke-width="1.6"`);
  // Two-part arm with springs.
  const arm = (x1, y1, x2, y2) => {
    const a = Math.atan2(y2 - y1, x2 - x1);
    const nx = -Math.sin(a) * 7;
    const ny = Math.cos(a) * 7;
    let out = '';
    out += path(`M${f(x1 + nx + 6)} ${f(y1 + ny + 10)}L${f(x2 + nx + 6)} ${f(y2 + ny + 10)}M${f(x1 - nx + 6)} ${f(y1 - ny + 10)}L${f(x2 - nx + 6)} ${f(y2 - ny + 10)}`, `stroke="#2a1709" stroke-width="7" opacity="0.22" filter="url(#soft2)"`);
    out += path(`M${f(x1 + nx)} ${f(y1 + ny)}L${f(x2 + nx)} ${f(y2 + ny)}M${f(x1 - nx)} ${f(y1 - ny)}L${f(x2 - nx)} ${f(y2 - ny)}`, `stroke="#8d7c60" stroke-width="7" stroke-linecap="round"`);
    out += path(`M${f(x1 + nx)} ${f(y1 + ny)}L${f(x2 + nx)} ${f(y2 + ny)}M${f(x1 - nx)} ${f(y1 - ny)}L${f(x2 - nx)} ${f(y2 - ny)}`, `stroke="url(#arm)" stroke-width="4.5" stroke-linecap="round"`);
    // Spring coil running alongside.
    const sx = x1 + (x2 - x1) * 0.2 + nx * 2.4;
    const sy = y1 + (y2 - y1) * 0.2 + ny * 2.4;
    const ex = x1 + (x2 - x1) * 0.62 + nx * 2.4;
    const ey = y1 + (y2 - y1) * 0.62 + ny * 2.4;
    const turns = 14;
    let d = `M${f(sx)} ${f(sy)}`;
    for (let i = 1; i <= turns; i++) {
      const t = i / turns;
      const px = sx + (ex - sx) * t + (i % 2 ? nx : -nx) * 0.6;
      const py = sy + (ey - sy) * t + (i % 2 ? ny : -ny) * 0.6;
      d += `L${f(px)} ${f(py)}`;
    }
    out += path(d, `fill="none" stroke="#b7ad9c" stroke-width="2.2" stroke-linejoin="round"`);
    return out;
  };
  s += arm(96, 92, 236, 150);
  s += arm(236, 150, 300, 244);
  s += circle(236, 150, 13, `fill="url(#joint)" stroke="#6e675c" stroke-width="1.6"`);
  s += circle(236, 150, 4, `fill="#6e675c"`);
  // Shade: a cone seen from above, tilted toward the journal. Its ridge
  // faces the light; the rolled rim sits at the wide end.
  const L = 122;
  const r1 = 22;
  const r2 = 86;
  const rx = 34;
  const cone = `M0 ${-r1}L${L} ${-r2}A${rx} ${r2} 0 0 1 ${L} ${r2}L0 ${r1}A9 ${r1} 0 0 1 0 ${-r1}Z`;
  let shade = '';
  shade += path(cone, `fill="#2a1709" opacity="0.32" filter="url(#soft)" transform="translate(14 18)"`);
  shade += path(cone, `fill="url(#coneBody)" stroke="${dark(mustard, 0.5)}" stroke-width="2.6" stroke-linejoin="round"`);
  shade += path(`M8 -3L${L - 6} -10`, `stroke="#fff6dc" stroke-width="7" stroke-linecap="round" opacity="0.55"`);
  shade += path(`M${L} ${-r2 + 4}A${rx - 3} ${r2 - 4} 0 0 1 ${L} ${r2 - 4}`, `fill="none" stroke="${light(mustard, 0.45)}" stroke-width="3.5" opacity="0.8"`);
  shade += path(`M${L} ${-r2}A${rx} ${r2} 0 0 1 ${L} ${r2}`, `fill="none" stroke="${dark(mustard, 0.5)}" stroke-width="2.6"`);
  for (const t of [0.28, 0.4]) {
    const x = L * t;
    const r = r1 + (r2 - r1) * t;
    shade += path(`M${x} ${-r + 3}A${rx * t * 0.9} ${r - 3} 0 0 1 ${x} ${r - 3}`, `fill="none" stroke="${dark(mustard, 0.3)}" stroke-width="1.4" opacity="0.6"`);
  }
  shade += ellipse(-2, 0, 13, r1 + 6, `fill="url(#cap)" stroke="${dark(mustard, 0.5)}" stroke-width="2"`);
  shade += circle(-6, 0, 7, `fill="url(#joint)" stroke="#6e675c" stroke-width="1.2"`);
  s += g('transform="translate(304 248) rotate(45)"', shade);
  s += path('M50 54C62 36 82 26 104 24', `fill="none" stroke="#fffaf0" stroke-width="4" stroke-linecap="round" opacity="0.65"`);
  // Cord trailing off the base.
  s += path('M30 130C10 160 4 200 0 240', `fill="none" stroke="#5a4636" stroke-width="5" stroke-linecap="round"`);
  return doc(W, H, defs, s, 'Desk lamp');
}

/* ------------------------------------------------------------- drawer */

export function drawer() {
  const W = 350;
  const H = 300;
  const walnut = '#80502f';
  const defs = [
    lin('top', [[0, light(walnut, 0.28)], [1, light(walnut, 0.08)]]),
    lin('front', [[0, walnut], [1, dark(walnut, 0.28)]], [0, 0, 0.3, 1]),
    lin('drawerFace', [[0, light(walnut, 0.14)], [1, dark(walnut, 0.12)]]),
    lin('brass', [[0, '#f8dc96'], [0.5, '#cfa458'], [1, '#7f5a22']]),
    lin('card', [[0, '#fffaf0'], [1, '#eadfca']]),
    blur('soft', 4),
    blur('soft2', 1.5),
  ].join('');
  let s = '';
  s += rect(20, 18, 310, 262, 14, `fill="#2a1709" opacity="0.32" filter="url(#soft)" transform="translate(6 10)"`);
  s += rect(20, 18, 310, 262, 14, `fill="url(#front)" stroke="${dark(walnut, 0.5)}" stroke-width="2.4"`);
  s += path('M20 82V32C20 24 26 18 34 18H316C324 18 330 24 330 32V82Z', `fill="url(#top)"`);
  for (let i = 0; i < 6; i++) {
    const y = 28 + i * 9 + (i % 2) * 2;
    s += path(`M30 ${y}C110 ${y - 3} 200 ${y + 3} 322 ${y - 1}`, `fill="none" stroke="${dark(walnut, 0.25)}" stroke-width="1" opacity="0.35"`);
  }
  s += path('M22 82H328', `stroke="${dark(walnut, 0.5)}" stroke-width="2"`);
  s += path('M22 85H328', `stroke="${light(walnut, 0.3)}" stroke-width="1.2" opacity="0.6"`);
  const drawerAt = (x, y, open) => {
    let d = '';
    if (open) {
      d += rect(x, y, 138, 86, 6, `fill="#2a1709" opacity="0.65"`);
      d += rect(x + 6, y + 2, 126, 10, 2, `fill="${light(walnut, 0.2)}"`);
      d += rect(x + 22, y - 4, 40, 12, 1, `fill="#f4ecd9" stroke="#c9bb9f" stroke-width="0.8" transform="rotate(-4 ${x + 42} ${y + 2})"`);
      d += rect(x + 70, y - 3, 44, 12, 1, `fill="#e9d3a4" stroke="#c4a66f" stroke-width="0.8" transform="rotate(5 ${x + 92} ${y + 3})"`);
      y += 12;
    }
    d += rect(x, y, 138, 86, 6, `fill="url(#drawerFace)" stroke="${dark(walnut, 0.5)}" stroke-width="2"`);
    d += path(`M${x + 3} ${y + 83}V${y + 6}C${x + 3} ${y + 4} ${x + 4} ${y + 3} ${x + 6} ${y + 3}H${x + 135}`, `fill="none" stroke="${light(walnut, 0.35)}" stroke-width="1.6" opacity="0.8"`);
    d += rect(x + 44, y + 14, 50, 24, 3, `fill="url(#brass)" stroke="#6f4d1c" stroke-width="1.4"`);
    d += rect(x + 49, y + 18, 40, 16, 1.5, `fill="url(#card)"`);
    d += path(`M${x + 53} ${y + 26}H${x + 85}`, `stroke="#b9a988" stroke-width="1.2" stroke-dasharray="3 3"`);
    d += path(`M${x + 50} ${y + 50}H${x + 88}C${x + 88} ${y + 66} ${x + 50} ${y + 66} ${x + 50} ${y + 50}Z`, `fill="url(#brass)" stroke="#6f4d1c" stroke-width="1.4"`);
    d += path(`M${x + 54} ${y + 53}H${x + 84}`, `stroke="#fff3c8" stroke-width="1.4" opacity="0.7"`);
    return d;
  };
  s += drawerAt(34, 96, false);
  s += drawerAt(178, 96, true);
  s += drawerAt(34, 188, false);
  s += drawerAt(178, 188, false);
  return doc(W, H, defs, s, 'Desk drawer');
}

/* ------------------------------------------------------ journal stack */

export function journalStack() {
  const W = 330;
  const H = 290;
  const books = [
    { x: 150, y: 150, rot: -9, color: '#d9a49c', floral: true },
    { x: 162, y: 140, rot: 6, color: '#d9a548' },
    { x: 158, y: 146, rot: -2, color: '#9fb58d', band: true },
  ];
  let defs = blur('soft', 3.5);
  books.forEach((b, i) => {
    defs += lin(`cov${i}`, [[0, light(b.color, 0.2)], [0.6, b.color], [1, dark(b.color, 0.25)]]);
  });
  defs += `<pattern id="floral" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="8" cy="8" r="3.5" fill="#fbefe6"/><circle cx="8" cy="8" r="1.4" fill="#e3b448"/><circle cx="23" cy="22" r="3" fill="#f5d3cf"/><circle cx="23" cy="22" r="1.2" fill="#fff6e0"/><path d="M14 18c3-2 6-2 8 0" stroke="#9db48c" stroke-width="1.4" fill="none"/></pattern>`;
  defs += lin('pages', [[0, '#fbf4e6'], [1, '#dccdb1']], [0, 0, 1, 0]);
  let s = '';
  books.forEach((b, i) => {
    let bk = '';
    bk += rect(-92, -126, 184, 252, 10, `fill="#2a1709" opacity="0.28" filter="url(#soft)" transform="translate(4 7)"`);
    bk += rect(-86, -122, 182, 246, 6, `fill="url(#pages)"`);
    for (let k = 0; k < 5; k++) bk += path(`M${90 - k * 1.5} -118V120`, `stroke="#d6c7aa" stroke-width="0.8"`);
    bk += rect(-92, -126, 180, 252, 10, `fill="url(#cov${i})" stroke="${dark(b.color, 0.45)}" stroke-width="2"`);
    if (b.floral) bk += rect(-92, -126, 180, 252, 10, `fill="url(#floral)" opacity="0.85"`);
    bk += rect(-92, -126, 24, 252, 10, `fill="${dark(b.color, 0.22)}" opacity="0.7"`);
    bk += path('M-68 -124V124', `stroke="${dark(b.color, 0.4)}" stroke-width="1.4" opacity="0.6"`);
    if (b.band) {
      bk += rect(58, -128, 11, 256, 3, `fill="#5b4a3d" stroke="#3b2f26" stroke-width="1"`);
      bk += rect(-40, -80, 74, 34, 4, `fill="#f4ead5" stroke="#c4b391" stroke-width="1.2" transform="rotate(-2)"`);
      bk += path('M-30 -64H22', `stroke="#c4b391" stroke-width="1.2" stroke-dasharray="3 4"`);
      bk += path('M-10 126C-12 140 -6 152 4 160L-2 166', `fill="none" stroke="#c9534a" stroke-width="7" stroke-linecap="round"`);
    }
    bk += path('M-80 -116C-30 -120 20 -120 70 -116', `fill="none" stroke="#fffaf0" stroke-width="2" stroke-linecap="round" opacity="0.45"`);
    s += g(`transform="translate(${b.x} ${b.y}) rotate(${b.rot})"`, bk);
  });
  return doc(W, H, defs, s, 'Stack of journals');
}

/* ----------------------------------------------------- padlock, keys */

export function padlock() {
  const W = 130;
  const H = 170;
  const defs = [
    lin('steel', [[0, '#fbfaf6'], [0.5, '#b8b3aa'], [1, '#6f6a62']]),
    lin('brass', [[0, '#fae2a2'], [0.45, '#d4aa5c'], [1, '#86602a']]),
    blur('soft', 3),
  ].join('');
  let s = '';
  s += rect(20, 72, 90, 86, 16, `fill="#2a1709" opacity="0.3" filter="url(#soft)" transform="translate(4 7)"`);
  s += path('M40 80V48C40 22 90 22 90 48V80', `fill="none" stroke="#5f5a52" stroke-width="15" stroke-linecap="round"`);
  s += path('M40 80V48C40 22 90 22 90 48V80', `fill="none" stroke="url(#steel)" stroke-width="11" stroke-linecap="round"`);
  s += path('M44 46C46 34 56 28 66 28', `fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.7"`);
  s += rect(20, 72, 90, 86, 16, `fill="url(#brass)" stroke="#6f4d1c" stroke-width="2.4"`);
  s += rect(27, 79, 76, 72, 11, `fill="none" stroke="#fbe6b0" stroke-width="1.6" opacity="0.6"`);
  s += circle(65, 106, 9, `fill="#3a2410"`);
  s += path('M60 110L57 132H73L70 110Z', `fill="#3a2410"`);
  s += path('M65 146C59 142 58 138 61 136C63 135 65 137 65 138C65 137 67 135 69 136C72 138 71 142 65 146Z', `fill="none" stroke="#8a6326" stroke-width="1.4"`);
  s += path('M30 92C32 84 38 80 46 79', `fill="none" stroke="#fff6d8" stroke-width="3" stroke-linecap="round" opacity="0.8"`);
  return doc(W, H, defs, s, 'Padlock');
}

export function keyring() {
  const W = 210;
  const H = 180;
  const defs = [
    lin('brass', [[0, '#fae2a2'], [0.45, '#d0a456'], [1, '#86602a']]),
    lin('ring', [[0, '#f6f3ec'], [0.5, '#b9b3a9'], [1, '#6f6a62']]),
    lin('tag', [[0, '#ead2a8'], [1, '#c9a173']]),
    blur('soft', 2.4),
  ].join('');
  const key = (bow) => {
    let k = '';
    if (bow === 'round') k += path('M0 -15a15 15 0 1 0 0.1 0ZM0 -7a7 7 0 1 1 -0.1 0Z', `fill="url(#brass)" fill-rule="evenodd" stroke="#6f4d1c" stroke-width="1.5"`);
    if (bow === 'trefoil') {
      k += path('M0 -18a8 8 0 1 0 0.1 0ZM-12 -2a8 8 0 1 0 0.1 0ZM12 -2a8 8 0 1 0 0.1 0Z', `fill="url(#brass)" stroke="#6f4d1c" stroke-width="1.5"`);
      k += circle(0, -4, 4, `fill="#2a1709" opacity="0.55"`);
    }
    if (bow === 'heart') k += path('M0 14C-20 2-20-12-10-15C-4-17 0-12 0-8C0-12 4-17 10-15C20-12 20 2 0 14ZM0 2C-6-2-6-8-3-8C-1-8 0-6 0-5C0-6 1-8 3-8C6-8 6-2 0 2Z', `fill="url(#brass)" fill-rule="evenodd" stroke="#6f4d1c" stroke-width="1.5"`);
    return k;
  };
  const keys = [
    { angle: 18, len: 112, bow: 'round' },
    { angle: 56, len: 96, bow: 'trefoil' },
    { angle: 94, len: 80, bow: 'heart' },
  ];
  let s = '';
  const cx = 58;
  const cy = 54;
  for (const k of keys) {
    let shape = '';
    shape += rect(18, -4, k.len - 18, 8, 3, `fill="url(#brass)" stroke="#6f4d1c" stroke-width="1.4"`);
    shape += rect(k.len - 14, 4, 6, 12, 1, `fill="url(#brass)" stroke="#6f4d1c" stroke-width="1.2"`);
    shape += rect(k.len - 4, 4, 6, 8, 1, `fill="url(#brass)" stroke="#6f4d1c" stroke-width="1.2"`);
    shape += g('transform="translate(14 0) rotate(-90)"', key(k.bow));
    shape += path(`M22 -2H${k.len - 6}`, `stroke="#fff3c8" stroke-width="1.4" opacity="0.6"`);
    const [bx, by] = polar(cx, cy, 30, k.angle);
    s += g(`transform="translate(${f(bx + 3)} ${f(by + 5)}) rotate(${k.angle})" opacity="0.3" filter="url(#soft)"`, shape.replace(/url\(#brass\)/g, '#2a1709'));
    s += g(`transform="translate(${f(bx)} ${f(by)}) rotate(${k.angle})"`, shape);
  }
  s += g('transform="translate(30 104) rotate(-24)"', path('M-16 -10H16V10H-16L-22 0Z', `fill="url(#tag)" stroke="#9b7149" stroke-width="1"`) + circle(-16, 0, 2.2, `fill="#7b5a35"`));
  s += path('M14 96C24 82 30 76 36 72', `fill="none" stroke="#9b7149" stroke-width="1.4"`);
  s += circle(cx, cy, 36, `fill="none" stroke="#5f5a52" stroke-width="7.5"`);
  s += circle(cx, cy, 36, `fill="none" stroke="url(#ring)" stroke-width="5"`);
  s += path(`M${cx - 30} ${cy - 18}C${cx - 22} ${cy - 30} ${cx - 10} ${cy - 36} ${cx + 4} ${cy - 36}`, `fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.8"`);
  return doc(W, H, defs, s, 'Ring of brass keys');
}

/* ---------------------------------------------------------- wastebasket */

export function wastebasket(full = true) {
  const W = 240;
  const H = 240;
  const cx = 120;
  const cy = 120;
  const straw = '#d6b27a';
  const defs = [
    lin('rimLight', [[0, light(straw, 0.35)], [1, dark(straw, 0.25)]]),
    lin('inner', [[0, dark(straw, 0.55)], [0.5, dark(straw, 0.3)], [1, light(straw, 0.05)]]),
    rad('floor', [[0, dark(straw, 0.45)], [1, dark(straw, 0.6)]]),
    lin('paper', [[0, '#ffffff'], [1, '#d9d0bf']]),
    blur('soft', 3),
  ].join('');
  let s = '';
  s += circle(cx, cy, 112, `fill="url(#inner)" stroke="${dark(straw, 0.5)}" stroke-width="2.4"`);
  // Woven inner wall: spokes and rounds.
  for (let a = 0; a < 360; a += 9) {
    const [x1, y1] = polar(cx, cy, 70, a);
    const [x2, y2] = polar(cx, cy, 100, a);
    s += path(`M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`, `stroke="${dark(straw, 0.45)}" stroke-width="1.6" opacity="0.6"`);
  }
  for (let r = 74; r < 100; r += 5) s += circle(cx, cy, r, `fill="none" stroke="${light(straw, 0.2)}" stroke-width="2" stroke-dasharray="5 4" opacity="0.55"`);
  s += circle(cx, cy, 70, `fill="url(#floor)" stroke="${dark(straw, 0.55)}" stroke-width="1.5"`);
  if (full) {
    const ball = (x, y, r, seed, lined) => {
      const rand = rng(seed);
      const pts = Array.from({ length: 9 }, (_, i) => polar(x, y, r * (0.82 + rand() * 0.22), i * 40 + rand() * 12));
      let b = path(`M${pts.map(([px, py]) => `${f(px)} ${f(py)}`).join('L')}Z`, `fill="#2a1709" opacity="0.35" filter="url(#soft)" transform="translate(3 5)"`);
      b += path(`M${pts.map(([px, py]) => `${f(px)} ${f(py)}`).join('L')}Z`, `fill="url(#paper)" stroke="#b9ad97" stroke-width="1.2" stroke-linejoin="round"`);
      for (let i = 0; i < 9; i += 2) {
        const [px, py] = pts[i];
        b += path(`M${f(x + (rand() - 0.5) * r * 0.4)} ${f(y + (rand() - 0.5) * r * 0.4)}L${f(px)} ${f(py)}`, `stroke="#b9ad97" stroke-width="1" opacity="0.8"`);
      }
      b += path(`M${f(pts[5][0])} ${f(pts[5][1])}L${f(x)} ${f(y)}L${f(pts[7][0])} ${f(pts[7][1])}Z`, `fill="#2a1709" opacity="0.1"`);
      if (lined) b += path(`M${f(x - r * 0.6)} ${f(y - 4)}L${f(x + r * 0.5)} ${f(y - 8)}M${f(x - r * 0.5)} ${f(y + 6)}L${f(x + r * 0.6)} ${f(y + 3)}`, `stroke="#a9c3df" stroke-width="1.2"`);
      return b;
    };
    s += ball(98, 108, 30, 3, true);
    s += ball(140, 128, 27, 8, false);
    s += ball(112, 146, 22, 13, false);
  }
  // Braided rim.
  s += circle(cx, cy, 106, `fill="none" stroke="url(#rimLight)" stroke-width="14"`);
  s += circle(cx, cy, 106, `fill="none" stroke="${dark(straw, 0.4)}" stroke-width="14" stroke-dasharray="4 5" opacity="0.4"`);
  s += circle(cx, cy, 99, `fill="none" stroke="${dark(straw, 0.55)}" stroke-width="1.4"`);
  s += path(`M${cx - 88} ${cy - 40}C${cx - 74} ${cy - 76} ${cx - 40} ${cy - 98} ${cx} ${cy - 104}`, `fill="none" stroke="#fff3d6" stroke-width="3" stroke-linecap="round" opacity="0.6"`);
  return doc(W, H, defs, s, 'Wastebasket');
}

/* ---------------------------------------------------- pen tray + tools */

export function penTray() {
  const W = 480;
  const H = 130;
  const walnut = '#7a4a2b';
  const defs = [
    lin('wood', [[0, light(walnut, 0.25)], [1, dark(walnut, 0.2)]]),
    lin('well', [[0, dark(walnut, 0.5)], [0.3, dark(walnut, 0.25)], [1, light(walnut, 0.05)]]),
    blur('soft', 4),
  ].join('');
  let s = '';
  s += rect(12, 12, 456, 106, 30, `fill="#2a1709" opacity="0.3" filter="url(#soft)" transform="translate(5 8)"`);
  s += rect(12, 12, 456, 106, 30, `fill="url(#wood)" stroke="${dark(walnut, 0.5)}" stroke-width="2.4"`);
  for (let i = 0; i < 5; i++) s += path(`M40 ${20 + i * 22}C150 ${16 + i * 22} 300 ${26 + i * 22} 440 ${19 + i * 22}`, `fill="none" stroke="${dark(walnut, 0.3)}" stroke-width="1" opacity="0.35"`);
  s += rect(30, 26, 420, 78, 20, `fill="url(#well)" stroke="${dark(walnut, 0.55)}" stroke-width="1.6"`);
  s += path('M50 102H430', `stroke="${light(walnut, 0.35)}" stroke-width="1.6" opacity="0.6"`);
  s += path('M26 30C60 16 200 14 420 18', `fill="none" stroke="#f3d2b0" stroke-width="2" stroke-linecap="round" opacity="0.45"`);
  return doc(W, H, defs, s, 'Pen tray');
}

export function fountainPen() {
  const W = 380;
  const H = 40;
  const plum = '#6d2f3e';
  const defs = [
    lin('barrel', [[0, light(plum, 0.35)], [0.35, plum], [1, dark(plum, 0.45)]], [0, 0, 0, 1]),
    lin('gold', [[0, '#fff0b8'], [0.5, '#d9ac4f'], [1, '#8a6224']], [0, 0, 0, 1]),
    lin('grip', [[0, '#5a5350'], [1, '#1f1b19']], [0, 0, 0, 1]),
  ].join('');
  let s = '';
  s += rect(8, 9, 196, 22, 11, `fill="url(#barrel)" stroke="${dark(plum, 0.55)}" stroke-width="1.4"`);
  s += rect(196, 8, 112, 24, 10, `fill="url(#barrel)" stroke="${dark(plum, 0.55)}" stroke-width="1.4"`);
  s += rect(196, 8, 10, 24, 2, `fill="url(#gold)"`);
  s += rect(290, 8, 6, 24, 1, `fill="url(#gold)"`);
  s += path('M210 6H284C288 6 290 8 290 11H212Z', `fill="url(#gold)" stroke="#8a6224" stroke-width="0.8"`);
  s += circle(284, 9, 2.6, `fill="url(#gold)"`);
  s += rect(306, 11, 30, 18, 6, `fill="url(#grip)"`);
  s += path('M334 11L370 20L334 29Z', `fill="url(#gold)" stroke="#8a6224" stroke-width="1"`);
  s += path('M338 20H366', `stroke="#6e4e18" stroke-width="1"`);
  s += circle(346, 20, 1.8, `fill="#6e4e18"`);
  s += path('M16 13H300', `stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.4"`);
  return doc(W, H, defs, s, 'Fountain pen');
}

export function tweezers() {
  const W = 360;
  const H = 40;
  const defs = [lin('steel', [[0, '#ffffff'], [0.45, '#c3c0b9'], [1, '#77736b']], [0, 0, 0, 1])].join('');
  let s = '';
  s += path('M10 14C10 10 14 8 20 8H300L352 15L350 17L300 13H24C18 13 16 14 16 18Z', `fill="url(#steel)" stroke="#5f5b54" stroke-width="1.2"`);
  s += path('M10 26C10 30 14 32 20 32H300L352 25L350 23L300 27H24C18 27 16 26 16 22Z', `fill="url(#steel)" stroke="#5f5b54" stroke-width="1.2"`);
  s += rect(6, 12, 14, 16, 5, `fill="url(#steel)" stroke="#5f5b54" stroke-width="1.2"`);
  for (let x = 120; x < 190; x += 6) s += path(`M${x} 9V12M${x} 28V31`, `stroke="#77736b" stroke-width="1.2"`);
  s += path('M24 10H290', `stroke="#ffffff" stroke-width="1.4" opacity="0.8"`);
  return doc(W, H, defs, s, 'Tweezers');
}

export function pencil() {
  const W = 370;
  const H = 36;
  const green = '#5f7f55';
  const defs = [
    lin('paint', [[0, light(green, 0.35)], [0.34, light(green, 0.1)], [0.35, green], [0.66, green], [0.67, dark(green, 0.25)], [1, dark(green, 0.35)]], [0, 0, 0, 1]),
    lin('ferrule', [[0, '#f4f1ea'], [0.5, '#b9b3a7'], [1, '#7c766c']], [0, 0, 0, 1]),
    lin('wood', [[0, '#f6d7a8'], [1, '#c99761']], [0, 0, 0, 1]),
  ].join('');
  let s = '';
  s += rect(6, 9, 26, 18, 7, `fill="#e89a96" stroke="#b46c68" stroke-width="1.2"`);
  s += rect(26, 8, 24, 20, 1, `fill="url(#ferrule)" stroke="#6f695f" stroke-width="1"`);
  s += path('M32 8V28M38 8V28M44 8V28', `stroke="#8d877c" stroke-width="1"`);
  s += rect(50, 8, 254, 20, 0, `fill="url(#paint)" stroke="${dark(green, 0.45)}" stroke-width="1.2"`);
  s += path('M304 8L346 15V21L304 28Z', `fill="url(#wood)" stroke="#a97c4c" stroke-width="1"`);
  s += path('M346 15L362 18L346 21Z', `fill="#3b3633"`);
  s += path('M60 12H300', `stroke="#ffffff" stroke-width="1.4" opacity="0.45"`);
  return doc(W, H, defs, s, 'Pencil');
}

/* ------------------------------------------------------- fallen leaves */

function leafPath(kind) {
  if (kind === 'maple') {
    const half = [
      [0, -46], [5, -33], [13, -37], [12, -22], [18, -16], [30, -27], [44, -22], [33, -9], [41, -3], [24, 3], [27, 13], [33, 23], [17, 19], [6, 15], [2, 18],
    ];
    const pts = [...half, ...half.slice(1, -1).reverse().map(([x, y]) => [-x, y])];
    return `M${pts.map(([x, y]) => `${x} ${y}`).join('L')}Z`;
  }
  if (kind === 'oak') {
    return 'M0 -40C8 -38 6 -30 10 -27C18 -30 20 -22 14 -16C22 -16 24 -8 16 -4C24 0 22 8 14 10C18 18 12 22 6 20C4 28 2 32 0 34C-2 32 -4 28 -6 20C-12 22 -18 18 -14 10C-22 8 -24 0 -16 -4C-24 -8 -22 -16 -14 -16C-20 -22 -18 -30 -10 -27C-6 -30 -8 -38 0 -40Z';
  }
  return 'M0 -38C16 -30 22 -10 18 8C14 22 6 30 0 34C-6 30 -14 22 -18 8C-22 -10 -16 -30 0 -38Z';
}

export function leaf(kind, colors, seed = 1) {
  const W = 100;
  const H = 100;
  const defs = [lin('leaf', [[0, colors[0]], [0.55, colors[1]], [1, colors[2]]]), blur('soft', 2)].join('');
  const rand = rng(seed);
  let s = '';
  const d = leafPath(kind);
  s += g('transform="translate(52 50)"', path(d, `fill="#2a1709" opacity="0.3" filter="url(#soft)" transform="translate(2 4)"`));
  let inner = path(d, `fill="url(#leaf)" stroke="${dark(colors[2], 0.35)}" stroke-width="1.4" stroke-linejoin="round"`);
  const tips = kind === 'maple' ? [[0, -40], [38, -20], [28, 20], [-28, 20], [-38, -20]] : [[0, -34]];
  for (const [x, y] of tips) inner += path(`M0 16L${x * 0.85} ${y * 0.85}`, `stroke="${light(colors[0], 0.35)}" stroke-width="1.6" stroke-linecap="round" opacity="0.7"`);
  if (kind !== 'maple') for (let i = -2; i <= 2; i++) inner += path(`M0 ${i * 9 + 4}L${12 - Math.abs(i) * 2} ${i * 9 - 4}M0 ${i * 9 + 4}L${-12 + Math.abs(i) * 2} ${i * 9 - 4}`, `stroke="${light(colors[0], 0.35)}" stroke-width="1.1" opacity="0.6"`);
  inner += path('M0 16C1 26 3 36 6 44', `fill="none" stroke="${dark(colors[2], 0.2)}" stroke-width="2.2" stroke-linecap="round"`);
  inner += speckles(0, 0, 26, 8, dark(colors[2], 0.3), { seed, size: [0.8, 2], opacity: 0.4 });
  s += g(`transform="translate(52 50) rotate(${f(rand() * 10 - 5)})"`, inner);
  return doc(W, H, defs, s, 'Fallen leaf');
}
