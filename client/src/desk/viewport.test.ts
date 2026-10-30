import { describe, expect, it } from 'vitest';
import { settle, type Reading } from './viewport';

const phone = { w: 390, h: 844, top: 0, bottom: 844 };
const reading = (r: Partial<Reading>): Reading => ({ w: 390, h: 844, seenTop: 0, seenHeight: 844, touch: true, typing: false, msSinceField: Infinity, ...r });

describe('the window the desk is laid out for', () => {
  it('keeps its height when a keyboard comes up, and only what you can see shrinks', () => {
    const v = settle(phone, reading({ h: 508, seenHeight: 508, typing: true }));
    expect(v).toEqual({ w: 390, h: 844, top: 0, bottom: 508 });
  });

  it('follows the browser sliding the page up to show the caret', () => {
    expect(settle(phone, reading({ h: 844, seenTop: 120, seenHeight: 508, typing: true }))).toEqual({ w: 390, h: 844, top: 120, bottom: 628 });
  });

  it('stays put while the keyboard goes down after you finish typing', () => {
    expect(settle(phone, reading({ h: 640, seenHeight: 640, msSinceField: 300 })).h).toBe(844);
    expect(settle(phone, reading({ msSinceField: 300 }))).toEqual(phone);
  });

  it('lays out again when the window really changes', () => {
    // Turned sideways mid-sentence.
    expect(settle(phone, reading({ w: 844, h: 390, seenHeight: 390, typing: true }))).toEqual({ w: 844, h: 390, top: 0, bottom: 390 });
    // A desktop window made shorter while the caret is in a page.
    expect(settle({ w: 1440, h: 900, top: 0, bottom: 900 }, reading({ w: 1440, h: 700, seenHeight: 700, touch: false, typing: true })).h).toBe(700);
    // A phone's browser bars sliding away, nothing being typed.
    expect(settle(phone, reading({ h: 760, seenHeight: 760 })).h).toBe(760);
  });
});
