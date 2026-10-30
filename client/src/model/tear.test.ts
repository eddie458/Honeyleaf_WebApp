import { describe, expect, it } from 'vitest';
import { emptyPage } from './migrations';
import { CONT_AREA, DEFAULT_AREA } from './page';
import { hasContent, withoutPage, withoutTitle } from './tear';
import type { Decoration, PageDoc, TextDoc } from './types';

const words = (text: string, cont = false): TextDoc => ({ type: 'doc', content: [{ type: 'paragraph', attrs: { cont }, content: [{ type: 'text', text }] }] });
const first = (id: string, text: string) => ({ id, doc: { ...emptyPage('lined-cream', DEFAULT_AREA), text: words(text) } });
const later = (id: string, text: TextDoc): { id: string; doc: PageDoc } => ({ id, doc: { ...emptyPage('lined-cream', CONT_AREA), text, flow: 'auto' } });
const fresh = () => ({ id: 'fresh', doc: emptyPage('grid-white', DEFAULT_AREA) });

describe('tearing out a page', () => {
  it('takes the page with everything on it and leaves the others as they were', () => {
    const pages = [first('a', 'Dear diary'), later('b', words('the middle')), later('c', words('the end'))];
    const left = withoutPage(pages, 'b', fresh)!;
    expect(left.map((p) => p.id)).toEqual(['a', 'c']);
    expect(left[0]).toBe(pages[0]);
    expect(left[1]).toBe(pages[2]);
  });

  it('leaves a fresh page when the only one goes', () => {
    expect(withoutPage([first('a', 'Dear Eddie,')], 'a', fresh)).toEqual([fresh()]);
  });

  it('lets the next page take the first one’s place, with room for the date and title', () => {
    const [only, ...more] = withoutPage([first('a', 'A letter'), later('b', words('my own words'))], 'a', fresh)!;
    expect(more).toEqual([]);
    expect(only!.id).toBe('b');
    expect(only!.doc.flow).toBeUndefined();
    expect(only!.doc.area).toEqual({ ...CONT_AREA, top: DEFAULT_AREA.top });
  });

  it('starts the words after the tear on a paragraph of their own', () => {
    const pages = [first('a', 'We walked'), later('b', words('to the lake and', true)), later('c', words('swam until dusk.', true))];
    const left = withoutPage(pages, 'b', fresh)!;
    expect(left[1]!.doc.text.content[0]).toMatchObject({ attrs: { cont: false }, content: [{ text: 'swam until dusk.' }] });
    expect(pages[2]!.doc.text.content[0]).toMatchObject({ attrs: { cont: true } });
  });

  it('starts an entry over without its title, but with its date, mood and tags', () => {
    const header = { date: '2026-10-29', dateStyle: 'handwritten' as const, title: 'Welcome to Honeyleaf', titleLettering: 'bubble', mood: 'cozy', tags: ['letters'] };
    expect(withoutTitle(header)).toEqual({ date: '2026-10-29', dateStyle: 'handwritten', mood: 'cozy', tags: ['letters'] });
    const untitled = { date: '2026-10-29', dateStyle: 'stamp' as const, tags: [] };
    expect(withoutTitle(untitled)).toBe(untitled);
  });

  it('does nothing for a page that isn’t there', () => {
    expect(withoutPage([first('a', 'Hello')], 'nope', fresh)).toBeNull();
  });

  it('tells a blank page from one with something on it', () => {
    const doodle: Decoration = { id: 'd', type: 'drawing', x: 100, y: 100, w: 40, h: 40, rot: 0, z: 1, layer: 'front', strokes: [] };
    expect(hasContent(emptyPage('lined-cream'))).toBe(false);
    expect(hasContent({ ...emptyPage('lined-cream'), text: words('   ') })).toBe(false);
    expect(hasContent({ ...emptyPage('lined-cream'), text: words('Hello') })).toBe(true);
    expect(hasContent({ ...emptyPage('lined-cream'), decorations: [doodle] })).toBe(true);
  });
});
