// The handwritten welcome letter waiting in a new diary.

import type { BlockNode, InlineNode, Mark, TextDoc } from '../model/types';

const ink = (id: string, color: string): Mark => ({ type: 'ink', attrs: { id, color } });
const hl = (color: string): Mark => ({ type: 'highlight', attrs: { color } });
const txt = (text: string, ...marks: Mark[]): InlineNode => (marks.length ? { type: 'text', text, marks } : { type: 'text', text });
const p = (...content: InlineNode[]): BlockNode => ({ type: 'paragraph', content });
const empty = (): BlockNode => ({ type: 'paragraph' });

const TEAL = ink('teal', '#1f5f63');
const OXBLOOD = ink('oxblood', '#6b2430');

export function welcomeLetter(name: string): TextDoc {
  const items: [string, string][] = [
    ['The pencil cup', ' holds your pens: inks, hands and sizes.'],
    ['Washi tape, stickers and the instant camera', ' are for decorating. Pick up the tweezers in the pen tray to move things about.'],
    ['The pencil', ' in the tray is for doodles.'],
    ['The desk calendar', ' takes you to any day; the ribbon brings you back to today.'],
    ['The drawer', ' keeps settings and backups, and the padlock locks your diary in a hurry.'],
    ['The wastebasket', ' keeps anything you throw away for 30 days.'],
  ];
  return {
    type: 'doc',
    content: [
      p(txt(`Dear ${name},`)),
      p(txt('This little journal is all yours. Nobody else can open it, not even the person who gave you the key.')),
      p(txt('A few things live on your desk:')),
      {
        type: 'bulletList',
        attrs: { bullet: 'leaf' },
        content: items.map(([lead, rest]) => ({ type: 'listItem', content: [{ type: 'paragraph', content: [txt(lead, TEAL), txt(rest)] }] })),
      },
      p(txt('Write past the bottom of a page and your words '), txt('carry on to the next one', hl('#ffe94a')), txt(', just like a real notebook.')),
      p(txt('When you’re ready, tear this letter out and make the first page your own.')),
      empty(),
      p(txt('With love,', OXBLOOD)),
      p(txt('the Honeyleaf desk ♡', OXBLOOD)),
    ],
  };
}
