// The swappable library (manifests), loaded once at start and shared.

import { create } from 'zustand';
import type { WashiTile } from '../decor/DecorationView';
import type { PaperEntry } from '../journal/PageSurface';
import { registerFonts, type FontEntry } from './fonts';
import { loadManifest } from './library';
import { loadProps, loadScenes, type PropEntry, type SceneEntry } from './scene';
import { applyTextures } from './textures';

export interface InkEntry {
  id: string;
  name: string;
  kind: 'fountain' | 'gel' | 'metallic' | 'marker' | 'highlighter';
  color: string;
}

export interface StickerEntry {
  id: string;
  name: string;
  size: number;
}

export interface StickerPack {
  id: string;
  name: string;
  stickers: StickerEntry[];
}

export interface WashiEntry extends WashiTile {
  id: string;
  name: string;
  width: number;
}

export interface Library {
  ready: boolean;
  papers: Record<string, PaperEntry>;
  paperList: PaperEntry[];
  washi: Record<string, WashiTile>;
  washiList: WashiEntry[];
  stickerPacks: StickerPack[];
  inks: InkEntry[];
  fonts: FontEntry[];
  props: Record<string, PropEntry>;
  scenes: SceneEntry[];
}

export const useLibrary = create<Library>(() => ({
  ready: false,
  papers: {},
  paperList: [],
  washi: {},
  washiList: [],
  stickerPacks: [],
  inks: [],
  fonts: [],
  props: {},
  scenes: [],
}));

let loading: Promise<void> | null = null;

export function loadLibrary(): Promise<void> {
  loading ??= Promise.all([
    loadManifest<{ papers: PaperEntry[] }>('papers'),
    loadManifest<{ tapes: WashiEntry[] }>('washi'),
    loadManifest<{ packs: StickerPack[] }>('stickers'),
    loadManifest<{ inks: InkEntry[] }>('inks'),
    loadManifest<{ fonts: FontEntry[] }>('fonts'),
    loadProps(),
    loadScenes(),
    registerFonts(),
    applyTextures(),
  ]).then(([papers, washi, stickers, inks, fonts, props, scenes]) => {
    useLibrary.setState({
      ready: true,
      papers: Object.fromEntries(papers.papers.map((p) => [p.id, p])),
      paperList: papers.papers,
      washi: Object.fromEntries(washi.tapes.map((w) => [w.id, { file: w.file, tile: w.tile }])),
      washiList: washi.tapes,
      stickerPacks: stickers.packs,
      inks: inks.inks,
      fonts: fonts.fonts,
      props,
      scenes,
    });
  });
  return loading;
}
