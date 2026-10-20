// The save format (schema v1). Pure data: no React, no DOM.
// Positions and sizes are page units (a page is 594 × 840).

import type { WritingArea } from './page';

export const PAGE_SCHEMA = 1;

/* ----------------------------------------------------------------- text */

export type TextEffect = 'wavy' | 'scribble' | 'loop' | 'shadow' | 'bubble' | 'rainbow';

export type Mark =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'underline' }
  | { type: 'strike' }
  | { type: 'font'; attrs: { id: string } }
  | { type: 'size'; attrs: { px: number } }
  | { type: 'ink'; attrs: { id: string; color: string } }
  | { type: 'highlight'; attrs: { color: string } }
  | { type: 'effect'; attrs: { kind: TextEffect; color?: string } };

export interface TextNode {
  type: 'text';
  text: string;
  marks?: Mark[];
}

export interface HardBreakNode {
  type: 'hardBreak';
}

export type InlineNode = TextNode | HardBreakNode;

export interface ParagraphNode {
  type: 'paragraph';
  /** `cont`: this paragraph continues the last one on the previous page. */
  attrs?: { cont?: boolean; align?: 'left' | 'center' | 'right' };
  content?: InlineNode[];
}

export interface TaskItemNode {
  type: 'taskItem';
  attrs: { checked: boolean };
  content: ParagraphNode[];
}

export interface TaskListNode {
  type: 'taskList';
  content: TaskItemNode[];
}

export type BulletStyle = 'dot' | 'star' | 'heart' | 'leaf' | 'dash';

export interface ListItemNode {
  type: 'listItem';
  content: ParagraphNode[];
}

export interface BulletListNode {
  type: 'bulletList';
  attrs: { bullet: BulletStyle };
  content: ListItemNode[];
}

export type DividerStyle = 'leaves' | 'dots' | 'wave' | 'stars';

export interface DividerNode {
  type: 'divider';
  attrs: { style: DividerStyle };
}

export type BlockNode = ParagraphNode | TaskListNode | BulletListNode | DividerNode;

export interface TextDoc {
  type: 'doc';
  content: BlockNode[];
}

/* ---------------------------------------------------------- decorations */

interface DecorationBase {
  id: string;
  /** Center and size, page units. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Degrees, clockwise. */
  rot: number;
  flipX?: boolean;
  z: number;
  /** Behind the text (pressed flowers, big doodles) or on top of it. */
  layer: 'back' | 'front';
  locked?: boolean;
}

export type PhotoFrame =
  | 'instant'
  | 'instant-wide'
  | 'instant-mini'
  | 'print'
  | 'plain'
  | 'deckled'
  | 'corners'
  | 'film-strip'
  | 'photobooth'
  | 'postage'
  | 'circle'
  | 'heart';

export type PhotoFilter = 'none' | 'warm' | 'faded' | 'mono' | 'sepia';

export interface StrokePoint {
  x: number;
  y: number;
  /** 0..1, from a stylus when available. */
  p: number;
}

export interface Stroke {
  tool: 'pen' | 'brush' | 'highlighter';
  color: string;
  size: number;
  points: StrokePoint[];
}

export type PaperKind = 'sticky' | 'index' | 'scrap' | 'label' | 'ticket' | 'envelope' | 'quote';

export type Decoration =
  | (DecorationBase & { type: 'sticker'; asset: string })
  | (DecorationBase & { type: 'tape'; asset: string; ends: 'torn' | 'zigzag' | 'straight'; seed: number })
  | (DecorationBase & {
      type: 'photo';
      asset: string;
      frame: PhotoFrame;
      filter: PhotoFilter;
      /** The picture's own width ÷ height, when known. */
      ratio?: number;
      /** Which part shows in the frame's window (see model/photo.ts). */
      crop?: { x: number; y: number; zoom: number };
      caption?: string;
      captionFont?: string;
      captionInk?: string;
    })
  | (DecorationBase & { type: 'stamp'; asset: string; ink: string; seed: number; text?: string })
  | (DecorationBase & { type: 'paper'; kind: PaperKind; color?: string; text: TextDoc; seed: number })
  | (DecorationBase & { type: 'text'; text: TextDoc })
  | (DecorationBase & { type: 'drawing'; strokes: Stroke[] });

export type DecorationType = Decoration['type'];

/* ---------------------------------------------------------------- pages */

export interface PageDoc {
  v: typeof PAGE_SCHEMA;
  paper: { id: string };
  area: WritingArea;
  text: TextDoc;
  decorations: Decoration[];
  favorite?: boolean;
  /** Added by the text flow; removed again if it empties. */
  flow?: 'auto';
}

export type DateStyle = 'handwritten' | 'stamp' | 'typewriter';

export interface EntryHeader {
  /** Calendar date in the writer's own time zone. */
  date: string;
  dateStyle: DateStyle;
  title?: string;
  titleLettering?: string;
  mood?: string;
  weather?: string;
  tags: string[];
}
