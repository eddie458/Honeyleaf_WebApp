import { loadManifest } from './library';
import type { TagPlacement } from '../desk/PaperTag';

export interface PropEntry {
  file: string;
  w: number;
  h: number;
  lift: number;
  variants?: Record<string, string>;
  stages?: string[];
}

export interface PlacedProp {
  x: number;
  y: number;
  rot?: number;
  tag?: TagPlacement;
  hidden?: boolean;
}

export interface SceneEntry {
  id: string;
  name: string;
  desk: { tint: string; texture: string; detail: string };
  light: 'morning' | 'afternoon' | 'golden' | 'night';
  layout: Record<string, PlacedProp>;
}

export const loadProps = () =>
  loadManifest<{ props: Record<string, PropEntry> }>('props').then((m) => m.props);

export const loadScenes = () => loadManifest<{ scenes: SceneEntry[] }>('scenes').then((m) => m.scenes);
