import { libraryUrl, loadManifest } from './library';

export interface FontFaceFile {
  weight: number;
  subset: string;
  file: string;
  unicodeRange: string;
}

export interface FontEntry {
  id: string;
  name: string;
  family: string;
  category: 'handwriting' | 'script' | 'serif' | 'typewriter' | 'display' | 'readable';
  weights: number[];
  faces: FontFaceFile[];
  metrics: { sizeAdjust: number; ascentOverride: number; descentOverride: number; lineGapOverride: number };
}

interface FontManifest {
  fonts: FontEntry[];
}

const registered = new Map<string, { entry: FontEntry; faces: FontFace[] }>();
let registering: Promise<void> | null = null;

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

/**
 * Registers every library font with the FontFace API. Nothing downloads until
 * a font is used or ensureFonts() asks for it. Metric overrides make every
 * family the same optical size on the same baseline.
 */
export function registerFonts(): Promise<void> {
  registering ??= loadManifest<FontManifest>('fonts').then((manifest) => {
    for (const entry of manifest.fonts) {
      const faces = entry.faces.map((face) => {
        const descriptors: FontFaceDescriptors & { sizeAdjust?: string } = {
          weight: String(face.weight),
          style: 'normal',
          display: 'swap',
          unicodeRange: face.unicodeRange,
          ascentOverride: pct(entry.metrics.ascentOverride),
          descentOverride: pct(entry.metrics.descentOverride),
          lineGapOverride: pct(entry.metrics.lineGapOverride),
          sizeAdjust: pct(entry.metrics.sizeAdjust),
        };
        const ff = new FontFace(entry.family, `url("${libraryUrl(face.file)}") format("woff2")`, descriptors);
        document.fonts.add(ff);
        return ff;
      });
      registered.set(entry.id, { entry, faces });
    }
  });
  return registering;
}

/** Downloads every face (all weights, latin + latin-ext) of the given fonts. */
export async function ensureFonts(ids: Iterable<string>): Promise<void> {
  await registerFonts();
  const loads: Promise<unknown>[] = [];
  for (const id of new Set(ids)) {
    const font = registered.get(id);
    if (!font) continue;
    for (const ff of font.faces) loads.push(ff.load().catch(() => undefined));
  }
  await Promise.all(loads);
}

export function fontFamily(id: string): string {
  const font = registered.get(id);
  return font ? `"${font.entry.family}"` : `"HL ${id}"`;
}
