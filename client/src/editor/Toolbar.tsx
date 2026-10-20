import { useEffect, useReducer, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/core';
import { useBook } from '../data/bookStore';
import { fontFamily } from '../library/fonts';
import { useLibrary } from '../library/useLibrary';
import { t } from '../strings/en';
import { ColorTin } from '../ui/ColorTin';
import { useActiveEditor } from './activeEditor';
import s from './Toolbar.module.css';

const SIZES = [18, 22, 30, 38] as const;
const HIGHLIGHTERS = ['#ffe94a', '#ff8ec1', '#9cf27a', '#ffb15a'];

type Pop = 'font' | 'ink' | 'hl' | null;

/** The paper strip that floats above selected words. */
export function TextToolbar() {
  const editor = useActiveEditor((st) => st.editor);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [pop, setPop] = useState<Pop>(null);
  const [focusInside, setFocusInside] = useState(false);

  useEffect(() => {
    if (!editor) return;
    const update = () => rerender();
    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    editor.on('focus', update);
    editor.on('blur', update);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
      editor.off('focus', update);
      editor.off('blur', update);
    };
  }, [editor]);

  useEffect(() => setPop(null), [editor]);

  if (!editor || editor.isDestroyed) return null;
  const { from, to, empty } = editor.state.selection;
  if (empty || (!editor.isFocused && !focusInside)) return null;

  const a = editor.view.coordsAtPos(from);
  const b = editor.view.coordsAtPos(to);
  const top = Math.max(8, Math.min(a.top, b.top) - 68);
  const left = Math.min(window.innerWidth - 24, Math.max(24, (a.left + b.right) / 2));

  return createPortal(
    <div
      className={s.strip}
      style={{ left, top } as CSSProperties}
      role="toolbar"
      aria-label={t.toolbar.label}
      onMouseDown={(e) => e.preventDefault()}
      onFocus={() => setFocusInside(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setFocusInside(false);
          setPop(null);
        }
      }}
    >
      <FontButton editor={editor} open={pop === 'font'} toggle={() => setPop(pop === 'font' ? null : 'font')} />
      <span className={s.sep} />
      {SIZES.map((px) => (
        <Btn key={px} label={`${t.toolbar.size}: ${t.toolbar.sizes[px]}`} active={editor.isActive('size', { px })} onClick={() => editor.chain().focus().setMark('size', { px }).run()}>
          <span className={s.sizeA} style={{ fontSize: 9 + px / 3 }}>
            a
          </span>
        </Btn>
      ))}
      <span className={s.sep} />
      <InkButton editor={editor} open={pop === 'ink'} toggle={() => setPop(pop === 'ink' ? null : 'ink')} close={() => setPop(null)} />
      <HighlightButton editor={editor} open={pop === 'hl'} toggle={() => setPop(pop === 'hl' ? null : 'hl')} close={() => setPop(null)} />
      <span className={s.sep} />
      <Btn label={t.toolbar.bold} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <b className={s.letter}>B</b>
      </Btn>
      <Btn label={t.toolbar.italic} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <i className={s.letter}>I</i>
      </Btn>
      <Btn label={t.toolbar.underline} active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <u className={s.letter}>U</u>
      </Btn>
      <Btn label={t.toolbar.strike} active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <s className={s.letter}>S</s>
      </Btn>
      <span className={s.sep} />
      <EffectBtn editor={editor} kind="wavy" label={t.toolbar.wavy} icon="M2 14c3-5 6-5 9 0s6 5 9 0" />
      <EffectBtn editor={editor} kind="scribble" label={t.toolbar.scribble} icon="M2 13l3-5 3 7 3-7 3 7 3-7 3 5" />
      <EffectBtn editor={editor} kind="loop" label={t.toolbar.loop} icon="M5 15C1 9 7 4 13 4c6 0 9 4 7 8-2 5-11 6-15 3" />
      <span className={s.sep} />
      <Btn label={t.toolbar.clear} onClick={() => editor.chain().focus().unsetAllMarks().run()}>
        <svg viewBox="0 0 24 24" className={s.icon} aria-hidden="true">
          <path d="M4 16l8-9 7 6-6 7H8zM10 20h10" />
        </svg>
      </Btn>
    </div>,
    document.body,
  );
}

function Btn({ label, active, onClick, children }: { label: string; active?: boolean; onClick(): void; children: ReactNode }) {
  return (
    <button type="button" className={s.btn} aria-label={label} title={label} aria-pressed={active ?? undefined} data-active={active ? '' : undefined} onClick={onClick}>
      {children}
    </button>
  );
}

function FontButton({ editor, open, toggle }: { editor: Editor; open: boolean; toggle(): void }) {
  const fonts = useLibrary((st) => st.fonts);
  const current = (editor.getAttributes('font').id as string | undefined) ?? useBook.getState().journal?.defaults.font ?? 'caveat';
  const groups = ['handwriting', 'script', 'serif', 'typewriter', 'display', 'readable'];
  return (
    <span className={s.popWrap}>
      <button type="button" className={`${s.btn} ${s.font}`} onClick={toggle} aria-expanded={open} aria-label={t.toolbar.font} title={t.toolbar.font} style={{ fontFamily: `${fontFamily(current)}, cursive` }}>
        Aa
      </button>
      {open && (
        <div className={s.card} role="listbox" aria-label={t.toolbar.font}>
          {groups.map((g) => {
            const list = fonts.filter((f) => f.category === g);
            if (!list.length) return null;
            return (
              <div key={g} className={s.group}>
                <span className={s.groupName}>{t.toolbar.families[g]}</span>
                {list.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="option"
                    aria-selected={f.id === current}
                    className={s.fontOption}
                    style={{ fontFamily: `"${f.family}", cursive` }}
                    onClick={() => {
                      editor.chain().focus().setMark('font', { id: f.id }).run();
                      toggle();
                    }}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </span>
  );
}

function InkButton({ editor, open, toggle, close }: { editor: Editor; open: boolean; toggle(): void; close(): void }) {
  const inks = useLibrary((st) => st.inks).filter((i) => i.kind !== 'highlighter');
  const color = (editor.getAttributes('ink').color as string | undefined) ?? useBook.getState().journal?.defaults.inkColor ?? '#3b2a22';
  const [tin, setTin] = useState(false);
  const apply = (id: string, c: string) => {
    editor.chain().focus().setMark('ink', { id, color: c }).run();
    close();
  };
  return (
    <span className={s.popWrap}>
      <button type="button" className={s.btn} onClick={toggle} aria-expanded={open} aria-label={t.toolbar.ink} title={t.toolbar.ink}>
        <span className={s.inkBlot} style={{ background: color }} />
      </button>
      {open && (
        <div className={`${s.card} ${s.inkCard}`}>
          <div className={s.inkGrid}>
            {inks.map((ink) => (
              <button key={ink.id} type="button" className={s.inkSwatch} style={{ background: ink.color }} aria-label={ink.name} title={ink.name} data-kind={ink.kind} onClick={() => apply(ink.id, ink.color)} />
            ))}
          </div>
          {tin ? (
            <ColorTin onPick={(c) => apply('custom', c)} />
          ) : (
            <button type="button" className={s.tinButton} onClick={() => setTin(true)}>
              {t.tools.customInk}
            </button>
          )}
        </div>
      )}
    </span>
  );
}

function HighlightButton({ editor, open, toggle, close }: { editor: Editor; open: boolean; toggle(): void; close(): void }) {
  const active = editor.getAttributes('highlight').color as string | undefined;
  return (
    <span className={s.popWrap}>
      <button type="button" className={s.btn} onClick={toggle} aria-expanded={open} aria-label={t.toolbar.highlighter} title={t.toolbar.highlighter} data-active={active ? '' : undefined}>
        <svg viewBox="0 0 24 24" className={s.icon} aria-hidden="true">
          <path d="M5 19l3-1 10-10-3-3L5 15z" />
          <path d="M3 21h8" stroke={active ?? '#e3b448'} strokeWidth="4" />
        </svg>
      </button>
      {open && (
        <div className={`${s.card} ${s.hlCard}`}>
          {HIGHLIGHTERS.map((c) => (
            <button
              key={c}
              type="button"
              className={s.cap}
              style={{ background: c }}
              aria-label={t.toolbar.highlighter}
              onClick={() => {
                editor.chain().focus().setMark('highlight', { color: c }).run();
                close();
              }}
            />
          ))}
          <button
            type="button"
            className={s.capNone}
            aria-label={t.toolbar.noHighlight}
            title={t.toolbar.noHighlight}
            onClick={() => {
              editor.chain().focus().unsetMark('highlight').run();
              close();
            }}
          >
            ×
          </button>
        </div>
      )}
    </span>
  );
}

function EffectBtn({ editor, kind, label, icon }: { editor: Editor; kind: string; label: string; icon: string }) {
  const active = editor.isActive('effect', { kind });
  const ink = (editor.getAttributes('ink').color as string | undefined) ?? useBook.getState().journal?.defaults.inkColor ?? '#3b2a22';
  return (
    <Btn label={label} active={active} onClick={() => (active ? editor.chain().focus().unsetMark('effect').run() : editor.chain().focus().setMark('effect', { kind, color: ink }).run())}>
      <svg viewBox="0 0 24 24" className={s.icon} aria-hidden="true">
        <path d={icon} />
      </svg>
    </Btn>
  );
}
