// The journal as a physical book: entries laid out page after page.
//
// Slot 0 is the inside of the front cover (the nameplate), then every page of
// every entry in date order, then one fresh blank page to start the next
// entry. On wide screens two slots make a spread: (0,1), (2,3), …

export interface EntrySummary {
  id: string;
  date: string;
  title: string;
  pageIds: string[];
  createdAt: string;
  version?: number;
  hasPhotos?: boolean;
  conflictOf?: string | null;
}

export type BookSlot =
  | { kind: 'lining' }
  | { kind: 'page'; entryId: string; pageId: string; index: number; first: boolean; date: string }
  | { kind: 'blank' };

export function sortEntries<T extends EntrySummary>(entries: T[]): T[] {
  return [...entries].sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)));
}

export function bookSlots(entries: EntrySummary[]): BookSlot[] {
  const slots: BookSlot[] = [{ kind: 'lining' }];
  for (const e of sortEntries(entries)) {
    e.pageIds.forEach((pageId, index) => slots.push({ kind: 'page', entryId: e.id, pageId, index, first: index === 0, date: e.date }));
  }
  slots.push({ kind: 'blank' });
  return slots;
}

export const spreadOf = (slot: number) => Math.floor(slot / 2);
export const spreadCount = (slots: BookSlot[]) => Math.ceil(slots.length / 2);

/** The two slots of a spread; the right one may be past the end of the book. */
export function spreadSlots(slots: BookSlot[], spread: number): [BookSlot | undefined, BookSlot | undefined] {
  return [slots[spread * 2], slots[spread * 2 + 1]];
}

export function slotOf(slots: BookSlot[], entryId: string, index = 0): number {
  const found = slots.findIndex((s) => s.kind === 'page' && s.entryId === entryId && s.index === index);
  return found >= 0 ? found : slots.length - 1;
}

export interface MonthTab {
  /** YYYY-MM */
  month: string;
  slot: number;
}

/** One tab per month that has entries, at the month's first page. */
export function monthTabs(slots: BookSlot[]): MonthTab[] {
  const tabs: MonthTab[] = [];
  let last = '';
  slots.forEach((s, slot) => {
    if (s.kind !== 'page' || !s.first) return;
    const month = s.date.slice(0, 7);
    if (month !== last) {
      tabs.push({ month, slot });
      last = month;
    }
  });
  return tabs;
}

/** The most recent entry written for this date. */
export function entryForDate<T extends EntrySummary>(entries: T[], date: string): T | undefined {
  const same = sortEntries(entries).filter((e) => e.date === date && !e.conflictOf);
  return same[same.length - 1];
}

/** Dates (YYYY-MM-DD) that have at least one entry, for the desk calendar. */
export function datesWithEntries(entries: EntrySummary[]): Set<string> {
  return new Set(entries.map((e) => e.date));
}

/** Today's calendar date on this device, as YYYY-MM-DD. */
export function localDate(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
