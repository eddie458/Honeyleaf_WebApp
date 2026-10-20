// Desk props, part A: mug, potted plant, pencil cup, washi rolls, sticker book.
import { doc, lin, rad, blur, circle, ellipse, rect, path, g, polar, dark, light, f, rng, speckles, smoothClosed } from './lib.mjs';

/* ------------------------------------------------------------------ mug */

export function mug(drink = 'cocoa') {
  const W = 214;
  const H = 182;
  const cx = 92;
  const cy = 90;
  const glaze = '#93ad80';
  const cream = '#f5ead6';
  const drinks = {
    cocoa: { c: ['#9a5f3d', '#6f3f26', '#4d2a18'], foam: '#b98a63' },
    coffee: { c: ['#caa06e', '#a66f40', '#7b4a29'], foam: '#e6c9a0' },
    tea: { c: ['#e3a457', '#b8702c', '#8a4d1a'], foam: '#f0c27a' },
  };
  const d = drinks[drink];
  const defs = [
    lin('handle', [[0, light(glaze, 0.4)], [0.5, glaze], [1, dark(glaze, 0.35)]]),
    lin('outer', [[0, light(glaze, 0.3)], [0.6, glaze], [1, dark(glaze, 0.3)]]),
    lin('lip', [[0, '#fffaf2'], [0.55, cream], [1, dark(cream, 0.16)]]),
    lin('wall', [[0, dark(cream, 0.42)], [0.55, dark(cream, 0.16)], [1, light(cream, 0.25)]]),
    rad('drink', [[0, d.c[0]], [0.7, d.c[1]], [1, d.c[2]]], { fx: 0.55, fy: 0.55, r: 0.55 }),
    lin('rimShade', [[0, '#2a1709', 0.55], [0.32, '#2a1709', 0.12], [0.5, '#2a1709', 0]]),
    lin('mallow', [[0, '#fffdf8'], [0.6, '#f6ece0'], [1, '#dcc6b0']]),
    lin('mallowPink', [[0, '#fff3f1'], [0.6, '#f5d2cf'], [1, '#d8a9a3']]),
    blur('soft', 1.6),
    blur('soft3', 3),
  ].join('');

  let body = '';
  // Handle: a D-shaped loop on the right; its hole shows the desk.
  body += path(
    'M146 50C180 40 208 62 207 90C206 118 180 140 146 130ZM161 72C176 70 189 80 189 90C189 100 176 110 161 108C167 98 167 82 161 72Z',
    `fill="url(#handle)" fill-rule="evenodd" stroke="${dark(glaze, 0.45)}" stroke-width="2.4" stroke-linejoin="round"`,
  );
  body += path('M168 55C188 58 200 72 201 86', `fill="none" stroke="#fffaf0" stroke-width="2.6" stroke-linecap="round" opacity="0.55"`);
  // Body: sage glaze lip, cream rim, shaded inner wall.
  body += circle(cx, cy, 75, `fill="url(#outer)" stroke="${dark(glaze, 0.5)}" stroke-width="2.4"`);
  body += circle(cx, cy, 70, `fill="url(#lip)"`);
  body += speckles(cx, cy, 70, 46, '#7b5a3f', { seed: 9, inner: 63, size: [0.5, 1.2], opacity: 0.6 });
  body += circle(cx, cy, 63.5, `fill="url(#wall)" stroke="${dark(cream, 0.3)}" stroke-width="1"`);
  // Drink with foam ring and the rim's shadow falling across it.
  body += circle(cx + 1.5, cy + 2, 57, `fill="url(#drink)"`);
  body += circle(cx + 1.5, cy + 2, 54.5, `fill="none" stroke="${d.foam}" stroke-width="4" opacity="0.5"`);
  body += speckles(cx + 1.5, cy + 2, 56, 34, light(d.foam, 0.3), { seed: 4, inner: 50, size: [0.8, 2], opacity: 0.7 });

  if (drink === 'cocoa') {
    const m = [
      [72, 72, -18, 'mallow'],
      [101, 64, 12, 'mallowPink'],
      [112, 96, -6, 'mallow'],
      [80, 104, 28, 'mallow'],
    ];
    for (const [x, y, a, fill] of m) {
      body += g(`transform="translate(${x + 3} ${y + 4}) rotate(${a})"`, rect(-9, -9, 18, 18, 5, `fill="#2a1709" opacity="0.35" filter="url(#soft)"`));
      body += g(
        `transform="translate(${x} ${y}) rotate(${a})"`,
        rect(-9, -9, 18, 18, 5, `fill="url(#${fill})" stroke="#cdb59d" stroke-width="0.8"`) +
          path('M-5 -6.5h8', `stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.8"`),
      );
    }
    body += speckles(cx + 4, cy + 4, 40, 40, '#3d1f10', { seed: 21, size: [0.5, 1.1], opacity: 0.55 });
  } else if (drink === 'coffee') {
    // Latte-art heart with a little swirl.
    body += path(
      'M93 116C70 101 64 86 72 77C79 69 89 72 93 80C97 72 107 69 114 77C122 86 116 101 93 116Z',
      `fill="#f2e0c3" opacity="0.92"`,
    );
    body += path('M93 112C92 100 92 90 93 80', `fill="none" stroke="#c99a68" stroke-width="2.2" stroke-linecap="round"`);
    body += path('M80 79C86 84 99 84 106 79', `fill="none" stroke="#d9b48a" stroke-width="1.6" stroke-linecap="round" opacity="0.8"`);
  } else {
    // Tea: a slice of lemon and the tea bag's string over the rim.
    body += circle(78, 80, 15, `fill="#f6e27a" stroke="#e1b93b" stroke-width="2.5" opacity="0.92"`);
    for (let i = 0; i < 8; i++) {
      const [x, y] = polar(78, 80, 10.5, i * 45 + 10);
      body += path(`M78 80L${f(x)} ${f(y)}`, `stroke="#f8f0b8" stroke-width="2"`);
    }
    body += path('M112 74C130 62 150 56 166 60C176 64 184 74 190 92', `fill="none" stroke="#efe6d2" stroke-width="1.4"`);
    body += g('transform="translate(190 92) rotate(18)"', rect(-9, 0, 18, 24, 2, `fill="#e8c98f" stroke="#b8925a" stroke-width="1"`));
  }
  body += circle(cx + 1.5, cy + 2, 57, `fill="url(#rimShade)"`);
  // Glints on the lip and inside the wall.
  body += path('M33 70C38 50 54 34 74 27', `fill="none" stroke="#fffdf6" stroke-width="3.2" stroke-linecap="round" opacity="0.85"`);
  body += path('M120 146C138 139 152 124 158 108', `fill="none" stroke="#fffdf6" stroke-width="1.8" stroke-linecap="round" opacity="0.45"`);
  return doc(W, H, defs, body, `Mug of ${drink}`);
}

/* --------------------------------------------------------------- plant */

/** A Chinese money plant (pilea) seen from above; stage 1–5 adds leaves. */
export function plant(stage = 3) {
  const W = 340;
  const H = 340;
  const cx = 170;
  const cy = 170;
  const counts = [5, 8, 11, 14, 18];
  const n = counts[Math.max(0, Math.min(4, stage - 1))];
  const greens = [
    ['#b6d27f', '#94b85d', '#76994a'],
    ['#a2c46c', '#7fa652', '#628a3e'],
    ['#8fb565', '#6c9548', '#517836'],
    ['#9bbf72', '#78a058', '#5a8442'],
  ];
  const defs = [
    lin('pot', [[0, '#e0946a'], [0.5, '#c4734b'], [1, '#93512f']]),
    rad('soil', [[0, '#6a4a33'], [0.7, '#4a3222'], [1, '#2f1e13']], { fx: 0.6, fy: 0.62 }),
    ...greens.map((gr, i) => lin(`leaf${i}`, [[0, gr[0]], [0.5, gr[1]], [1, gr[2]]])),
    blur('leafShadow', 3.5),
  ].join('');

  let body = '';
  body += circle(cx, cy, 84, `fill="url(#pot)" stroke="#86472a" stroke-width="2.4"`);
  body += circle(cx, cy, 84, `fill="none" stroke="#f3b893" stroke-width="2" stroke-dasharray="70 460" stroke-dashoffset="-290" opacity="0.8"`);
  body += circle(cx, cy, 72, `fill="url(#soil)" stroke="#6e3c22" stroke-width="2"`);
  body += speckles(cx, cy, 70, 60, '#f1eadf', { seed: 8, size: [0.8, 1.8], opacity: 0.55 });
  body += speckles(cx, cy, 70, 70, '#1f130b', { seed: 18, size: [0.6, 1.5], opacity: 0.5 });

  // Newest leaves sit near the middle and highest; the oldest spread outside.
  const rand = rng(40 + stage);
  const leaves = [];
  for (let i = n - 1; i >= 0; i--) {
    const angle = i * 137.5 + 20 + rand() * 18;
    const dist = 10 + 27 * Math.sqrt(i + 0.4) + rand() * 8;
    const r = 15 + 4.2 * Math.sqrt(i + 1) + rand() * 6;
    const [x, y] = polar(cx, cy, dist, angle);
    leaves.push({ x, y, r, angle, fill: `leaf${Math.floor(rand() * greens.length)}` });
  }
  for (const L of leaves) {
    const [px, py] = polar(L.x, L.y, -L.r * 0.22, L.angle);
    body += path(`M${f(cx + 2)} ${f(cy + 2)}Q${f((cx + px) / 2 + 5)} ${f((cy + py) / 2 - 5)} ${f(px)} ${f(py)}`, `fill="none" stroke="#6f8e44" stroke-width="2.4" stroke-linecap="round"`);
  }
  for (const L of leaves) {
    const [px, py] = polar(L.x, L.y, -L.r * 0.22, L.angle);
    body += circle(L.x + 4, L.y + 6, L.r, `fill="#1d2b10" opacity="0.3" filter="url(#leafShadow)"`);
    body += circle(L.x, L.y, L.r, `fill="url(#${L.fill})" stroke="#4d7130" stroke-width="1.3"`);
    // Cupped edge: a light lip on the far side, a soft dark one near the light.
    body += path(`M${f(L.x + L.r * 0.92)} ${f(L.y - L.r * 0.3)}A${f(L.r * 0.96)} ${f(L.r * 0.96)} 0 0 1 ${f(L.x - L.r * 0.3)} ${f(L.y + L.r * 0.92)}`, `fill="none" stroke="#d6e9a9" stroke-width="1.6" opacity="0.55"`);
    for (let v = 0; v < 6; v++) {
      const [vx, vy] = polar(px, py, L.r * 0.78, v * 60 + L.angle + 30);
      body += path(`M${f(px)} ${f(py)}L${f(vx)} ${f(vy)}`, `stroke="#cfe3a2" stroke-width="0.9" opacity="0.45"`);
    }
    body += circle(px, py, 2.4, `fill="#d9e9b4" stroke="#6f8e44" stroke-width="0.7"`);
  }
  return doc(W, H, defs, body, 'Potted plant');
}

/* ----------------------------------------------------------- pencil cup */

export function pencilCup() {
  const W = 360;
  const H = 360;
  const cx = 180;
  const cy = 180;
  const defs = [
    lin('cupRim', [[0, '#fffaf0'], [0.5, '#efe2c8'], [1, '#c9b08a']]),
    rad('cupIn', [[0, '#1f140d'], [0.7, '#3a281b'], [1, '#6b5139']], { fx: 0.62, fy: 0.64, r: 0.55 }),
    rad('depth', [[0, '#120b06', 0.95], [0.55, '#1a0f08', 0.75], [1, '#1a0f08', 0]], { fx: 0.5, fy: 0.5 }),
    lin('ferrule', [[0, '#f4f1ea'], [0.5, '#b9b3a7'], [1, '#7c766c']], [0, 0, 0, 1]),
    lin('wood', [[0, '#f1cf9c'], [1, '#c99761']], [0, 0, 0, 1]),
    blur('soft', 2.5),
  ].join('');
  // Light comes from the top-left (direction 225°).
  const litSide = (deg) => {
    const a = (deg * Math.PI) / 180;
    return -0.707 * Math.sin(a) + 0.707 * Math.cos(a) > 0 ? -1 : 1; // -1: local -y faces the light
  };
  const shade = (w, x0, x1, side) => {
    const top = side < 0 ? -w / 2 : w / 2 - w * 0.3;
    const bot = side < 0 ? w / 2 - w * 0.3 : -w / 2;
    return (
      rect(x0, top, x1 - x0, w * 0.28, 0, `fill="#fffaf0" opacity="0.45"`) +
      rect(x0, bot, x1 - x0, w * 0.3, 0, `fill="#2a1709" opacity="0.28"`)
    );
  };
  const items = [
    { kind: 'pencil', angle: -158, len: 128, color: '#e8b64a' },
    { kind: 'marker', angle: -118, len: 112, color: '#d98f8a' },
    { kind: 'gel', angle: -80, len: 132, color: '#5c7fb3' },
    { kind: 'brush', angle: -42, len: 142, color: '#c9925a' },
    { kind: 'pencil', angle: -4, len: 116, color: '#8fb07a' },
    { kind: 'marker', angle: 36, len: 100, color: '#e3b448' },
    { kind: 'gel', angle: 76, len: 120, color: '#6b3a5c' },
    { kind: 'pencil', angle: 118, len: 112, color: '#b46a9b' },
    { kind: 'ruler', angle: 160, len: 136, color: '#e2c08c' },
  ];
  let body = '';
  body += circle(cx, cy, 68, `fill="url(#cupRim)" stroke="#9c8463" stroke-width="2.4"`);
  body += circle(cx, cy, 68, `fill="none" stroke="#9db48c" stroke-width="5" stroke-dasharray="6 7" opacity="0.65"`);
  body += circle(cx, cy, 58, `fill="url(#cupIn)" stroke="#8b7457" stroke-width="1.6"`);
  for (const it of items) {
    const side = litSide(it.angle);
    const r0 = 16;
    const end = r0 + it.len;
    let s = '';
    if (it.kind === 'pencil') {
      const w = 13;
      s += rect(r0, -w / 2, end - r0 - 26, w, 0, `fill="${it.color}" stroke="${dark(it.color, 0.4)}" stroke-width="1"`);
      s += path(`M${r0} -2.2H${end - 26}M${r0} 2.2H${end - 26}`, `stroke="${dark(it.color, 0.25)}" stroke-width="0.8" opacity="0.6"`);
      s += shade(w, r0, end - 26, side);
      s += rect(end - 26, -w / 2 - 0.5, 14, w + 1, 0, `fill="url(#ferrule)" stroke="#6f695f" stroke-width="0.8"`);
      s += path(`M${end - 22} ${-w / 2}v${w}M${end - 17} ${-w / 2}v${w}`, `stroke="#8d877c" stroke-width="1"`);
      s += rect(end - 13, -w / 2, 13, w, 5, `fill="#ec9f9b" stroke="#b9706c" stroke-width="1"`);
    } else if (it.kind === 'marker') {
      const w = 19;
      s += rect(r0, -w / 2, end - r0 - 36, w, 3, `fill="#f4efe6" stroke="#9f978a" stroke-width="1"`);
      s += rect(r0 + 10, -w / 2 + 3, end - r0 - 52, 5, 2, `fill="${it.color}" opacity="0.8"`);
      s += rect(end - 38, -w / 2 - 1, 38, w + 2, 8, `fill="${it.color}" stroke="${dark(it.color, 0.45)}" stroke-width="1.2"`);
      s += rect(end - 34, (side < 0 ? -1 : 1) * 4 - 2, 24, 4, 2, `fill="${light(it.color, 0.45)}"`);
      s += shade(w, r0, end - 38, side);
    } else if (it.kind === 'gel') {
      const w = 10;
      s += rect(r0, -w / 2, end - r0 - 30, w, 2, `fill="#e9eef2" stroke="#9aa3ab" stroke-width="0.9" opacity="0.95"`);
      s += rect(r0 + 4, -1.4, end - r0 - 38, 2.8, 1, `fill="${it.color}"`);
      s += rect(end - 32, -w / 2 - 0.6, 32, w + 1.2, 4, `fill="${it.color}" stroke="${dark(it.color, 0.45)}" stroke-width="1"`);
      s += rect(end - 28, (side < 0 ? -w / 2 - 3 : w / 2 - 1), 20, 4, 2, `fill="#d9d4cb" stroke="#8d877c" stroke-width="0.8"`);
      s += shade(w, r0, end - 32, side);
    } else if (it.kind === 'brush') {
      s += path(`M${r0} -5L${end - 42} -4L${end - 42} 4L${r0} 5Z`, `fill="${it.color}" stroke="${dark(it.color, 0.45)}" stroke-width="1"`);
      s += shade(10, r0, end - 42, side);
      s += rect(end - 44, -5.5, 20, 11, 2, `fill="url(#ferrule)" stroke="#6f695f" stroke-width="0.8"`);
      s += path(`M${end - 24} -5.5C${end - 10} -6 ${end - 2} -2 ${end + 4} 0C${end - 2} 2 ${end - 10} 6 ${end - 24} 5.5Z`, `fill="#5b3a26" stroke="#3b2417" stroke-width="1"`);
      s += path(`M${end - 18} -2C${end - 8} -2 ${end - 3} -1 ${end + 1} 0`, `stroke="#a67a52" stroke-width="1.2" fill="none"`);
    } else {
      const w = 22;
      s += rect(r0, -w / 2, end - r0, w, 2, `fill="url(#wood)" stroke="#a87b4a" stroke-width="1"`);
      for (let t = r0 + 6; t < end - 4; t += 6) {
        const long = Math.round((t - r0) / 6) % 5 === 0;
        s += path(`M${t} ${-w / 2}v${long ? 8 : 4.5}`, `stroke="#7a5532" stroke-width="1"`);
      }
    }
    body += g(`transform="translate(${cx} ${cy}) rotate(${it.angle})"`, s);
  }
  // The cup swallows the pens: they fade into its dark inside.
  body += circle(cx, cy, 57, `fill="url(#depth)"`);
  body += path(`M${cx - 52} ${cy - 30}C${cx - 42} ${cy - 52} ${cx - 22} ${cy - 62} ${cx + 2} ${cy - 64}`, `fill="none" stroke="#fffdf6" stroke-width="3" stroke-linecap="round" opacity="0.8"`);
  return doc(W, H, defs, body, 'Pencil cup');
}

/* -------------------------------------------------------------- washi */

function washiPattern(id, kind) {
  if (kind === 'gingham') {
    return `<pattern id="${id}" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#f4d3cd"/><rect width="6" height="12" fill="#dd9b95" opacity="0.5"/><rect width="12" height="6" fill="#dd9b95" opacity="0.5"/></pattern>`;
  }
  if (kind === 'dots') {
    return `<pattern id="${id}" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#efcf7e"/><circle cx="3.5" cy="3.5" r="2.4" fill="#fff8e6"/><circle cx="10.5" cy="10.5" r="2.4" fill="#fff8e6"/></pattern>`;
  }
  return `<pattern id="${id}" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#c7d8b9"/><rect width="4" height="10" fill="#93ad80"/></pattern>`;
}

export function washiRolls() {
  const W = 340;
  const H = 240;
  const rolls = [
    { x: 90, y: 128, R: 60, r: 33, edge: '#e6b4ad', kind: 'gingham' },
    { x: 202, y: 80, R: 54, r: 30, edge: '#e8c46c', kind: 'dots' },
    { x: 268, y: 172, R: 47, r: 27, edge: '#b3c9a3', kind: 'stripes' },
  ];
  let defs = blur('soft', 3) + blur('soft2', 1.5);
  rolls.forEach((ro, i) => {
    defs += rad(`edge${i}`, [[0, light(ro.edge, 0.35)], [0.75, ro.edge], [1, dark(ro.edge, 0.25)]], { fx: 0.32, fy: 0.28, r: 0.6 });
    defs += washiPattern(`pat${i}`, ro.kind);
  });
  defs += lin('core', [[0, '#e2c49a'], [1, '#a77d50']]);
  let body = '';
  // Unrolled strip lying flat, leaving the first roll toward the bottom right.
  const strip = 'M70 168L196 196L192 214L189 210L186 216L183 211L180 217L177 211L174 216L171 210L167 215L64 192Z';
  body += path(strip, `fill="#2a1709" opacity="0.25" filter="url(#soft2)" transform="translate(2 4)"`);
  body += path(strip, `fill="url(#pat0)" opacity="0.88"`);
  body += path('M72 170L194 197', `stroke="#fff" stroke-width="1.4" opacity="0.5"`);
  rolls.forEach((ro, i) => {
    const ring = `M${ro.x - ro.R} ${ro.y}a${ro.R} ${ro.R} 0 1 0 ${ro.R * 2} 0a${ro.R} ${ro.R} 0 1 0 ${-ro.R * 2} 0ZM${ro.x - ro.r} ${ro.y}a${ro.r} ${ro.r} 0 1 1 ${ro.r * 2} 0a${ro.r} ${ro.r} 0 1 1 ${-ro.r * 2} 0Z`;
    body += path(ring, `fill="#2a1709" opacity="0.28" filter="url(#soft)" transform="translate(4 6)" fill-rule="evenodd"`);
    body += path(ring, `fill="url(#edge${i})" fill-rule="evenodd" stroke="${dark(ro.edge, 0.35)}" stroke-width="2"`);
    // Wound layers.
    for (let k = ro.r + 9; k < ro.R - 2; k += 3.2) {
      body += circle(ro.x, ro.y, k, `fill="none" stroke="${dark(ro.edge, 0.12)}" stroke-width="0.7" opacity="0.55"`);
    }
    // A hint of the print showing on the edge.
    body += circle(ro.x, ro.y, (ro.R + ro.r + 9) / 2, `fill="none" stroke="url(#pat${i})" stroke-width="${ro.R - ro.r - 12}" opacity="0.25"`);
    // Cardboard core.
    const core = `M${ro.x - ro.r - 8} ${ro.y}a${ro.r + 8} ${ro.r + 8} 0 1 0 ${(ro.r + 8) * 2} 0a${ro.r + 8} ${ro.r + 8} 0 1 0 ${-(ro.r + 8) * 2} 0ZM${ro.x - ro.r} ${ro.y}a${ro.r} ${ro.r} 0 1 1 ${ro.r * 2} 0a${ro.r} ${ro.r} 0 1 1 ${-ro.r * 2} 0Z`;
    body += path(core, `fill="url(#core)" fill-rule="evenodd" stroke="#8a6440" stroke-width="1.2"`);
    body += circle(ro.x, ro.y, ro.r, `fill="none" stroke="#5e4128" stroke-width="2.5" opacity="0.5"`);
    const [ax, ay] = polar(ro.x, ro.y, ro.R - 6, 200);
    const [bx, by] = polar(ro.x, ro.y, ro.R - 6, 250);
    body += path(`M${f(ax)} ${f(ay)}A${ro.R - 6} ${ro.R - 6} 0 0 1 ${f(bx)} ${f(by)}`, `fill="none" stroke="#fffdf6" stroke-width="3" stroke-linecap="round" opacity="0.7"`);
  });
  return doc(W, H, defs, body, 'Washi tape rolls');
}

/* --------------------------------------------------------- sticker book */

export function stickerBook() {
  const W = 290;
  const H = 350;
  const cover = '#a8be95';
  const defs = [
    lin('cover', [[0, light(cover, 0.22)], [0.6, cover], [1, dark(cover, 0.22)]]),
    lin('spine', [[0, dark(cover, 0.18)], [1, dark(cover, 0.38)]], [0, 0, 1, 0]),
    lin('sheet', [[0, '#ffffff'], [1, '#ece7de']], [0, 0, 1, 0]),
    lin('kraftLabel', [[0, '#e6c999'], [1, '#c69c69']]),
    `<pattern id="linen" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 1h4M1 0v4" stroke="${dark(cover, 0.3)}" stroke-width="0.6" opacity="0.35"/></pattern>`,
    blur('soft', 2.5),
  ].join('');
  let body = '';
  // Sheets peeking out on the right, with a few stickers showing.
  body += rect(214, 46, 50, 250, 6, `fill="url(#sheet)" stroke="#c8c0b2" stroke-width="1.2"`);
  body += rect(222, 40, 46, 262, 6, `fill="#fbf8f2" stroke="#cbc3b5" stroke-width="1"`);
  body += circle(252, 84, 13, `fill="#f0b9a8" stroke="#fff" stroke-width="3.5"`);
  body += path('M246 140l6-12 6 12 13 2-10 8 3 13-12-7-12 7 3-13-10-8z', `fill="#e3b448" stroke="#fff" stroke-width="3" stroke-linejoin="round"`);
  body += circle(256, 220, 11, `fill="#9fc3d8" stroke="#fff" stroke-width="3.5"`);
  body += path('M244 262c6-10 20-10 24 0c-4 8-18 10-24 0z', `fill="#97b77e" stroke="#fff" stroke-width="3"`);
  // The book.
  body += rect(26, 20, 214, 300, 12, `fill="#2a1709" opacity="0.3" filter="url(#soft)" transform="translate(3 5)"`);
  body += rect(26, 20, 214, 300, 12, `fill="url(#cover)" stroke="${dark(cover, 0.45)}" stroke-width="2.4"`);
  body += rect(26, 20, 214, 300, 12, `fill="url(#linen)"`);
  body += rect(26, 20, 30, 300, 12, `fill="url(#spine)"`);
  body += path('M56 22V318', `stroke="${dark(cover, 0.5)}" stroke-width="1.6" opacity="0.6"`);
  body += path('M44 34V306', `stroke="#f3ead6" stroke-width="1.6" stroke-dasharray="5 5" opacity="0.7"`);
  // Elastic closure.
  body += rect(212, 18, 12, 304, 3, `fill="#6b5a4a" stroke="#45372b" stroke-width="1"`);
  body += path('M215 22V318', `stroke="#9a8673" stroke-width="1.2" opacity="0.7"`);
  // Blank kraft label and stickers on the cover.
  body += g('transform="rotate(-3 132 92)"', rect(84, 66, 100, 50, 6, `fill="url(#kraftLabel)" stroke="#9b7149" stroke-width="1.4"`) + path('M96 84h76M96 98h52', `stroke="#9b7149" stroke-width="1.4" stroke-dasharray="2 4" opacity="0.6"`));
  body += g('transform="translate(152 196) rotate(12)"', path('M0 -30l9 18 20 3-14 14 3 20-18-9-18 9 3-20-14-14 20-3z', `fill="#e3b448" stroke="#fff" stroke-width="5" stroke-linejoin="round"`) + path('M-6 -16l4-8', `stroke="#fff6d6" stroke-width="3" stroke-linecap="round"`));
  body += g('transform="translate(96 250) rotate(-10)"', path('M0 18C-24 2-26-14-14-20C-6-24 0-18 0-12C0-18 6-24 14-20C26-14 24 2 0 18Z', `fill="#dda7a5" stroke="#fff" stroke-width="5" stroke-linejoin="round"`));
  body += g('transform="translate(170 272) rotate(6)"', path(smoothClosed([[-20, 6], [-14, -6], [-2, -10], [10, -8], [20, -2], [18, 8], [0, 10]]), 'fill="#f4f1ea" stroke="#fff" stroke-width="5"'));
  body += path('M36 30C70 26 120 24 170 26', `fill="none" stroke="#fffaf0" stroke-width="2.2" stroke-linecap="round" opacity="0.5"`);
  return doc(W, H, defs, body, 'Sticker book');
}

