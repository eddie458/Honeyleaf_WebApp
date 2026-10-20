import type { CSSProperties, ReactNode } from 'react';
import { fontFamily } from '../library/fonts';
import { GRID } from '../model/page';
import type { BlockNode, InlineNode, Mark, ParagraphNode, TextDoc, TextNode } from '../model/types';
import { Checkbox, DividerDoodle } from '../art/HandDrawn';
import { highlighterStroke, loopAround, scribbleOut, wavyUnderline } from './inkEffects';
import s from './RichText.module.css';

export interface TextDefaults {
  font: string;
  size: number;
  color: string;
}

interface Props {
  doc: TextDoc;
  defaults: TextDefaults;
  /** Snap lines to the paper's ruled grid (page text) or flow freely (notes, captions). */
  grid?: boolean;
  className?: string;
}

/**
 * Renders saved text (TipTap-style JSON) exactly as the editor lays it out.
 * Fonts share one normalized ascent/descent (see build-fonts), so baselines
 * can be placed on the ruled lines with simple arithmetic.
 */
export function RichText({ doc, defaults, grid = true, className }: Props) {
  return (
    <div className={`${s.flow} ${grid ? s.grid : s.free} ${className ?? ''}`}>
      {doc.content.map((block, i) => (
        <Block key={i} node={block} defaults={defaults} grid={grid} />
      ))}
    </div>
  );
}

/* Normalized font metrics (scripts/build-fonts.mjs: target ascent/descent). */
const ASCENT = 0.8;
const DESCENT = 0.24;
/** Where the baseline sits inside one ruled row (the rule is drawn just below). */
export const BASELINE = 20;

/** Rows a line of text needs: big lettering takes whole multiples of the grid. */
export function rowsFor(size: number): number {
  return size <= 26 ? 1 : Math.ceil((size * 1.12) / GRID);
}

function sizeOf(node: TextNode, fallback: number): number {
  const m = node.marks?.find((mk) => mk.type === 'size');
  return m && m.type === 'size' ? m.attrs.px : fallback;
}

function maxSize(content: InlineNode[] | undefined, fallback: number): number {
  let max = 0;
  for (const n of content ?? []) if (n.type === 'text') max = Math.max(max, sizeOf(n, fallback));
  return max || fallback;
}

function Block({ node, defaults, grid }: { node: BlockNode; defaults: TextDefaults; grid: boolean }) {
  switch (node.type) {
    case 'paragraph':
      return <Paragraph node={node} defaults={defaults} grid={grid} />;
    case 'taskList':
      return (
        <div className={s.list}>
          {node.content.map((item, i) => (
            <div key={i} className={s.item}>
              <Checkbox className={s.box} checked={item.attrs.checked} color={inkOf(item.content[0], defaults.color)} />
              {item.content.map((p, j) => (
                <Paragraph key={j} node={p} defaults={defaults} grid={grid} done={item.attrs.checked} />
              ))}
            </div>
          ))}
        </div>
      );
    case 'bulletList':
      return (
        <div className={s.list}>
          {node.content.map((item, i) => (
            <div key={i} className={s.item}>
              <span className={s.bullet} data-bullet={node.attrs.bullet} />
              {item.content.map((p, j) => (
                <Paragraph key={j} node={p} defaults={defaults} grid={grid} />
              ))}
            </div>
          ))}
        </div>
      );
    case 'divider':
      return (
        <div className={s.divider} aria-hidden="true">
          <DividerDoodle kind={node.attrs.style} />
        </div>
      );
  }
}

function inkOf(p: ParagraphNode | undefined, fallback: string): string {
  const first = p?.content?.find((n): n is TextNode => n.type === 'text');
  const m = first?.marks?.find((mk) => mk.type === 'ink');
  return m && m.type === 'ink' ? m.attrs.color : fallback;
}

function Paragraph({ node, defaults, grid, done }: { node: ParagraphNode; defaults: TextDefaults; grid: boolean; done?: boolean }) {
  const strut = maxSize(node.content, defaults.size);
  const style: CSSProperties = { textAlign: node.attrs?.align ?? 'left', fontSize: `${strut}px` };
  if (grid) {
    const rows = rowsFor(strut);
    const lineH = rows * GRID;
    style.lineHeight = `${lineH}px`;
    // Put the baseline of the last row of a tall line on its ruled line.
    const natural = lineH / 2 + ((ASCENT - DESCENT) * strut) / 2;
    const shift = (rows - 1) * GRID + BASELINE - natural;
    if (Math.abs(shift) > 0.05) style.transform = `translateY(${shift.toFixed(2)}px)`;
  }
  const parts = node.content ?? [];
  return (
    <p className={`${s.para} ${done ? s.done : ''}`} style={style}>
      {parts.length === 0 ? <br /> : parts.map((n, i) => <Inline key={i} node={n} defaults={defaults} grid={grid} />)}
    </p>
  );
}

function Inline({ node, defaults, grid }: { node: InlineNode; defaults: TextDefaults; grid: boolean }): ReactNode {
  if (node.type === 'hardBreak') return <br />;
  let font = defaults.font;
  let size = defaults.size;
  let color = defaults.color;
  const classes: string[] = [s.run ?? ''];
  const style: CSSProperties = {};
  const marks: Mark[] = node.marks ?? [];
  let highlight: string | null = null;
  let effect: string | null = null;
  for (const m of marks) {
    switch (m.type) {
      case 'font':
        font = m.attrs.id;
        break;
      case 'size':
        size = m.attrs.px;
        break;
      case 'ink':
        color = m.attrs.color;
        break;
      case 'bold':
        style.fontWeight = 700;
        break;
      case 'italic':
        style.fontStyle = 'italic';
        break;
      case 'underline':
        classes.push(s.underline ?? '');
        break;
      case 'strike':
        classes.push(s.strike ?? '');
        break;
      case 'highlight':
        highlight = m.attrs.color;
        break;
      case 'effect':
        effect = m.attrs.kind;
        break;
    }
  }
  style.fontFamily = `${fontFamily(font)}, cursive`;
  style.fontSize = `${size}px`;
  style.color = color;
  if (grid) style.lineHeight = 0;
  const images: string[] = [];
  if (effect === 'wavy') {
    classes.push(s.wavy ?? '');
    images.push(wavyUnderline(color));
  } else if (effect === 'scribble') {
    classes.push(s.scribble ?? '');
    images.push(scribbleOut(color));
  } else if (effect === 'loop') {
    classes.push(s.loop ?? '');
    images.push(loopAround(color));
  } else if (effect) {
    classes.push(s[effect] ?? '');
  }
  if (highlight) {
    classes.push(s.highlight ?? '');
    images.push(highlighterStroke(highlight));
  }
  if (images.length) style.backgroundImage = images.join(', ');
  return (
    <span className={classes.join(' ')} style={style}>
      {node.text}
    </span>
  );
}
