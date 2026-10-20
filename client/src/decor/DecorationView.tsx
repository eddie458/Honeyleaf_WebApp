import { useState, type CSSProperties } from 'react';
import { getStroke } from 'perfect-freehand';
import { assetSrc, freshPhotos } from '../data/assets';
import { freshDecorations } from './decorate';
import { fontFamily } from '../library/fonts';
import { libraryUrl } from '../library/library';
import type { Decoration, PhotoFilter, Stroke } from '../model/types';
import { RichText } from '../text/RichText';
import { dropShadow, seeded } from './shadow';
import s from './DecorationView.module.css';

export interface WashiTile {
  file: string;
  tile: number;
}

interface Props {
  deco: Decoration;
  washi: Record<string, WashiTile>;
  /** Being crumpled and tossed into the wastebasket. */
  leaving?: boolean;
}

/** One decoration on a page, positioned by its center, size and rotation. */
export function DecorationView({ deco, washi, leaving }: Props) {
  const [fresh] = useState(() => freshDecorations.delete(deco.id));
  const style: CSSProperties = {
    left: deco.x - deco.w / 2,
    top: deco.y - deco.h / 2,
    width: deco.w,
    height: deco.h,
    zIndex: deco.z,
    transform: `rotate(${deco.rot}deg)${deco.flipX ? ' scaleX(-1)' : ''}`,
  };
  return (
    <div className={`${s.deco} ${leaving ? s.leaving : ''} ${fresh ? s.pressed : ''}`} style={style} data-type={deco.type} data-deco-id={deco.id}>
      <Body deco={deco} washi={washi} />
    </div>
  );
}

function Body({ deco, washi }: { deco: Decoration; washi: Record<string, WashiTile> }) {
  const shadow = (dx: number, dy: number, blur: number, alpha: number) => dropShadow(deco.rot, deco.flipX, dx, dy, blur, alpha);
  switch (deco.type) {
    case 'sticker':
      return <img className={s.fill} src={libraryUrl(`stickers/${deco.asset}.svg`)} alt="" draggable={false} style={{ filter: shadow(1.6, 2.6, 1.4, 0.4) }} />;

    case 'tape': {
      const tile = washi[deco.asset];
      return (
        <div className={s.fill} style={{ filter: shadow(0.8, 1.4, 0.8, 0.28) }}>
          <div
            className={s.tape}
            style={{
              backgroundImage: tile ? `url("${libraryUrl(tile.file)}")` : undefined,
              backgroundSize: tile ? `${tile.tile}px ${tile.tile}px` : undefined,
              clipPath: tapeEnds(deco.w, deco.h, deco.ends, deco.seed),
            }}
          />
        </div>
      );
    }

    case 'photo':
      return <InstantPhoto deco={deco} shadow={shadow(2.4, 4, 2.4, 0.38)} />;

    case 'stamp':
      return <Postmark id={deco.id} text={deco.text ?? ''} ink={deco.ink} seed={deco.seed} />;

    case 'paper':
      if (deco.kind === 'quote') {
        return (
          <>
            <div className={s.fill} style={{ filter: shadow(1.2, 2.4, 1.6, 0.32) }}>
              <div className={s.strip} style={{ clipPath: tornStrip(deco.w, deco.h, deco.seed) }}>
                <RichText doc={deco.text} grid={false} defaults={{ font: 'special-elite', size: 15, color: '#3b2a22' }} />
              </div>
            </div>
            <MiniTape left asset="gingham-rose" washi={washi} />
            <MiniTape asset="gingham-rose" washi={washi} />
          </>
        );
      }
      return (
        <div className={`${s.fill} ${s.sticky}`} style={{ '--note': deco.color ?? '#f6dc84', filter: shadow(2, 4, 2.6, 0.34) } as CSSProperties}>
          <RichText doc={deco.text} grid={false} defaults={{ font: 'indie-flower', size: 19, color: '#3b2a22' }} />
        </div>
      );

    case 'text':
      return (
        <div className={s.fill}>
          <RichText doc={deco.text} grid={false} defaults={{ font: 'caveat', size: 24, color: '#3b2a22' }} />
        </div>
      );

    case 'drawing':
      return (
        <svg className={s.fill} viewBox={`0 0 ${deco.w} ${deco.h}`} preserveAspectRatio="none" aria-hidden="true">
          {deco.strokes.map((st, i) => (
            <path key={i} d={strokePath(st)} fill={st.color} opacity={st.tool === 'highlighter' ? 0.45 : 0.95} />
          ))}
        </svg>
      );
  }
}

const PHOTO_FILTERS: Record<PhotoFilter, string> = {
  none: 'none',
  warm: 'sepia(0.16) saturate(1.12) brightness(1.03)',
  faded: 'contrast(0.84) brightness(1.08) saturate(0.78)',
  mono: 'grayscale(1) contrast(1.06)',
  sepia: 'sepia(0.78) contrast(0.96)',
};

/** An instant print. A photo added just now develops from pale as it lands. */
function InstantPhoto({ deco, shadow }: { deco: Extract<Decoration, { type: 'photo' }>; shadow: string }) {
  const id = deco.asset.startsWith('user:') ? deco.asset.slice(5) : '';
  const [developing] = useState(() => id !== '' && freshPhotos.delete(id));
  const [missing, setMissing] = useState(false);
  return (
    <div className={`${s.fill} ${s.instant}`} style={{ filter: shadow }}>
      <div className={s.window}>
        {!missing && (
          <img
            src={assetSrc(deco.asset, deco.w > 320 ? 'full' : 'thumb')}
            alt=""
            draggable={false}
            style={{ filter: PHOTO_FILTERS[deco.filter] }}
            onError={() => setMissing(true)}
          />
        )}
        {developing && <span className={s.develop} aria-hidden="true" />}
      </div>
      {deco.caption && (
        <div className={s.caption} style={{ fontFamily: `${fontFamily(deco.captionFont ?? 'gochi-hand')}, cursive`, color: deco.captionInk ?? '#3b2a22' }}>
          {deco.caption}
        </div>
      )}
    </div>
  );
}

/** Tape ends: torn fibers or pinking-shear zigzags, stable for a given seed. */
function tapeEnds(w: number, h: number, ends: 'torn' | 'zigzag' | 'straight', seed: number): string {
  if (ends === 'straight') return 'none';
  const rand = seeded(seed);
  const teeth = Math.max(4, Math.round(h / 5));
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i <= teeth; i++) {
    const y = (h * i) / teeth;
    const depthL = ends === 'zigzag' ? (i % 2 ? 4 : 0) : rand() * 4.5;
    const depthR = ends === 'zigzag' ? (i % 2 ? 0 : 4) : rand() * 4.5;
    left.push(`${depthL.toFixed(1)}px ${y.toFixed(1)}px`);
    right.push(`${(w - depthR).toFixed(1)}px ${(h - y).toFixed(1)}px`);
  }
  return `polygon(${[...left, ...right].join(', ')})`;
}

/** A strip of paper torn along its long edges. */
function tornStrip(w: number, h: number, seed: number): string {
  const rand = seeded(seed);
  const steps = Math.round(w / 9);
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = (w * i) / steps;
    top.push(`${x.toFixed(1)}px ${(rand() * 4).toFixed(1)}px`);
    bottom.push(`${(w - x).toFixed(1)}px ${(h - rand() * 4).toFixed(1)}px`);
  }
  return `polygon(${[...top, ...bottom].join(', ')})`;
}

function MiniTape({ left, asset, washi }: { left?: boolean; asset: string; washi: Record<string, WashiTile> }) {
  const tile = washi[asset];
  return (
    <div className={`${s.miniTape} ${left ? s.miniLeft : s.miniRight}`}>
      <div
        className={s.tape}
        style={{
          backgroundImage: tile ? `url("${libraryUrl(tile.file)}")` : undefined,
          backgroundSize: tile ? `${tile.tile}px ${tile.tile}px` : undefined,
          clipPath: tapeEnds(46, 22, 'torn', left ? 2 : 5),
        }}
      />
    </div>
  );
}

/** A round postmark with a wavy cancellation, printed in patchy ink. */
function Postmark({ id, text, ink, seed }: { id: string; text: string; ink: string; seed: number }) {
  const rand = seeded(seed);
  const style = {
    color: ink,
    '--mask-x': `${Math.round(rand() * 240)}px`,
    '--mask-y': `${Math.round(rand() * 240)}px`,
  } as CSSProperties;
  const arc = `arc-${id}`;
  const [name = '', date = ''] = text.split('·').map((x) => x.trim());
  const [day = '', mon = '', year = ''] = date.split(' ');
  return (
    <div className={`${s.fill} ${s.stamp}`} style={style}>
      <svg viewBox="0 0 150 112" aria-hidden="true">
        <circle cx="56" cy="56" r="48" fill="none" stroke="currentColor" strokeWidth="3.4" />
        <circle cx="56" cy="56" r="34" fill="none" stroke="currentColor" strokeWidth="2" />
        <path id={arc} d="M56 56m-41 0a41 41 0 1 1 82 0a41 41 0 1 1-82 0" fill="none" />
        <text className={s.stampText} fontSize="10.5" letterSpacing="1.6">
          <textPath href={`#${arc}`} startOffset="2%">
            {name} ★ {name} ★
          </textPath>
        </text>
        <text className={s.stampText} x="56" y="52" textAnchor="middle" fontSize="15">
          {day} {mon}
        </text>
        <text className={s.stampText} x="56" y="70" textAnchor="middle" fontSize="12.5" letterSpacing="1">
          {year}
        </text>
        {[30, 44, 58, 72, 86].map((y) => (
          <path key={y} d={`M104 ${y}c7-6 13-6 20 0s13 6 20 0`} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        ))}
      </svg>
    </div>
  );
}

/** perfect-freehand outline → SVG path. */
export function strokePath(st: Stroke): string {
  const outline = getStroke(
    st.points.map((p) => [p.x, p.y, p.p]),
    { size: st.size * (st.tool === 'brush' ? 2.2 : 1.6), thinning: st.tool === 'highlighter' ? 0 : 0.55, smoothing: 0.6, streamline: 0.45, simulatePressure: false, last: true },
  );
  const pts = outline as [number, number][];
  const first = pts[0];
  if (!first || pts.length < 2) return '';
  const rest = pts.slice(1);
  let d = `M${first[0].toFixed(2)} ${first[1].toFixed(2)}Q`;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i] as [number, number];
    const b = (rest[i + 1] ?? first) as [number, number];
    d += `${a[0].toFixed(2)} ${a[1].toFixed(2)} ${((a[0] + b[0]) / 2).toFixed(2)} ${((a[1] + b[1]) / 2).toFixed(2)} `;
  }
  return d + 'Z';
}
