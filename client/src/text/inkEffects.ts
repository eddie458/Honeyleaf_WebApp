// Hand-made text effects drawn as tiny SVGs in the ink's own color. They are
// used as backgrounds on the marked text, so they wrap across lines with it.

const cache = new Map<string, string>();

function svgUrl(key: string, svg: () => string): string {
  let url = cache.get(key);
  if (!url) {
    url = `url("data:image/svg+xml,${encodeURIComponent(svg())}")`;
    cache.set(key, url);
  }
  return url;
}

const open = (vb: string) =>
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${vb}' preserveAspectRatio='none'>`;

/** A real marker stroke: uneven edges and ink pooled where the pen stopped. */
export const highlighterStroke = (c: string) =>
  svgUrl(`hl:${c}`, () =>
    open('0 0 100 40') +
    `<path d='M3 8C22 5 48 8 70 6S94 4 98 7L99 31C80 34 52 31 30 34S6 35 2 32Z' fill='${c}' fill-opacity='0.6'/>` +
    `<path d='M3 9C4 18 3 26 3 31M97 8C98 16 97 24 98 30' stroke='${c}' stroke-opacity='0.4' stroke-width='5' fill='none'/>` +
    `<path d='M6 14C30 12 64 14 96 11M5 26C40 28 70 25 96 27' stroke='${c}' stroke-opacity='0.2' stroke-width='3' fill='none'/>` +
    '</svg>',
  );

export const wavyUnderline = (c: string) =>
  svgUrl(`wavy:${c}`, () =>
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 8'>` +
    `<path d='M0 4.6C3 1.4 6 1.6 9 4.6S15 7.6 18 4.2S22 1.8 24 4.6' fill='none' stroke='${c}' stroke-width='1.7' stroke-linecap='round'/>` +
    '</svg>',
  );

export const scribbleOut = (c: string) =>
  svgUrl(`scribble:${c}`, () =>
    open('0 0 120 24') +
    `<path d='M2 14C9 5 13 19 21 9S31 18 39 8S51 19 59 9S71 18 79 8S91 19 99 10S111 17 118 9' fill='none' stroke='${c}' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/>` +
    `<path d='M4 10C12 18 18 6 26 15S38 7 46 15S60 6 68 15S82 7 90 15S104 7 116 14' fill='none' stroke='${c}' stroke-width='1.6' stroke-linecap='round' opacity='0.8'/>` +
    '</svg>',
  );

export const loopAround = (c: string) =>
  svgUrl(`loop:${c}`, () =>
    open('0 0 120 60') +
    `<path d='M16 41C4 24 32 6 66 6C102 6 119 20 113 36C107 52 66 57 38 53C12 49 3 37 11 25C17 17 30 12 46 10' fill='none' stroke='${c}' stroke-width='2.4' stroke-linecap='round'/>` +
    '</svg>',
  );
