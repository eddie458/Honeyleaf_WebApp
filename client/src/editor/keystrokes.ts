// The pen never leaves the paper. While the caret is between pages (the book
// turning to follow your words, or the next page still opening), typing
// lands in a hidden notepad and is written onto the page the moment it can
// take the caret, so no keystroke is lost. Keeping a field focused also
// keeps a phone's keyboard open through the turn.

let pad: HTMLTextAreaElement | null = null;
let fallback: ((text: string) => void) | null = null;

function notepad(): HTMLTextAreaElement {
  if (pad) return pad;
  const el = document.createElement('textarea');
  el.setAttribute('aria-hidden', 'true');
  el.tabIndex = -1;
  el.spellcheck = false;
  el.autocomplete = 'off';
  Object.assign(el.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '1px',
    height: '1px',
    opacity: '0',
    border: '0',
    padding: '0',
    resize: 'none',
    pointerEvents: 'none',
  });
  // Focus went somewhere else before the page could take the words (a click
  // elsewhere, the window losing focus): they are written straight into the
  // page's saved text instead.
  el.addEventListener('blur', () => {
    const write = fallback;
    const text = takeKeystrokes();
    if (text && write) write(text);
  });
  document.body.appendChild(el);
  pad = el;
  return el;
}

/** True while the person is typing on a page. */
export const typingOnPage = () => document.activeElement instanceof HTMLElement && document.activeElement.closest('.ProseMirror') !== null;

/**
 * Start catching keystrokes (call before the focused page goes away).
 * `orphaned` writes them into the saved page if no editor takes them.
 */
export function holdKeystrokes(orphaned: (text: string) => void): void {
  const p = notepad();
  if (document.activeElement !== p) p.value = '';
  fallback = orphaned;
  p.focus({ preventScroll: true });
}

/** Whatever was typed while holding, emptied out. */
export function takeKeystrokes(): string {
  fallback = null;
  if (!pad) return '';
  const text = pad.value;
  pad.value = '';
  return text;
}
