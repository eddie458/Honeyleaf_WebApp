// ULIDs: 26-character, time-sortable IDs made on the device, so journals,
// entries, pages and photos can be created offline without asking the server.

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

export function ulid(now: number = Date.now(), random: (n: number) => Uint8Array = randomBytes): string {
  let time = Math.max(0, Math.floor(now));
  let head = '';
  for (let i = 0; i < 10; i++) {
    head = ALPHABET[time % 32] + head;
    time = Math.floor(time / 32);
  }
  const bytes = random(16);
  let tail = '';
  for (let i = 0; i < 16; i++) tail += ALPHABET[bytes[i]! & 31];
  return head + tail;
}

/**
 * The first journal's ID is fixed for each person, so two tabs (or React's
 * double start in development) opening a brand-new diary at the same moment
 * both save the same journal instead of making two.
 */
export function firstJournalId(userId: number): string {
  let n = Math.max(0, Math.floor(userId));
  let tail = '';
  for (let i = 0; i < 16; i++) {
    tail = ALPHABET[n % 32] + tail;
    n = Math.floor(n / 32);
  }
  return '0000000000' + tail;
}

export function isUlid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(value);
}
