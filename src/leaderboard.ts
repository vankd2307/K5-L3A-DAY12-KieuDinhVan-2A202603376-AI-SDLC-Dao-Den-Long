/**
 * Phase 4 §3 local leaderboard: pure logic shared by the browser (save / show) and Node
 * (vite middleware file store, `--export-leaderboard`). No DOM, no fs.
 */
export interface Entry {
  name: string;
  score: number; // sum of the scores of the Nights won
  nights_won: number; // 0..3
  achieved_at: string; // ISO 8601 with time zone offset
  seed: number;
}

export const TOP_N = 10;
export const NAME_MIN = 3;
export const NAME_MAX = 12;

/**
 * 3–12 characters. Required set [A-Za-z0-9_]; Vietnamese letters with diacritics are also accepted
 * (bonus). Length counts characters after NFC (so "Mây" is 3).
 */
export function normalizeName(raw: string): string {
  return raw.trim().normalize('NFC');
}
export function nameError(raw: string): string | null {
  const name = normalizeName(raw);
  const len = [...name].length;
  if (len < NAME_MIN || len > NAME_MAX) return `Tên cần ${NAME_MIN}–${NAME_MAX} ký tự`;
  // Latin-script letters cover A–Z and Vietnamese (ă â đ ê ô ơ ư + tones); \p{M} = leftover combining marks
  if (!/^[0-9_\p{Script=Latin}\p{M}]+$/u.test(name)) return 'Chỉ dùng chữ cái (có thể có dấu tiếng Việt), chữ số và dấu _';
  return null;
}

/** ISO 8601 with the local offset, e.g. 2026-11-20T21:30:05+07:00. */
export function isoWithOffset(d: Date): string {
  const p = (n: number) => String(Math.trunc(Math.abs(n))).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${sign}${p(off / 60)}:${p(off % 60)}`;
}

const ISO_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/** Drops anything that is not a well-formed entry (corrupt file / storage). */
export function validEntries(raw: unknown): Entry[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'object' && raw !== null && Array.isArray((raw as { entries?: unknown }).entries) ? (raw as { entries: unknown[] }).entries : [];
  return list.filter((e): e is Entry => {
    if (typeof e !== 'object' || e === null) return false;
    const o = e as Record<string, unknown>;
    return typeof o.name === 'string' && nameError(o.name) === null
      && Number.isInteger(o.score) && (o.score as number) >= 0
      && Number.isInteger(o.nights_won) && (o.nights_won as number) >= 0 && (o.nights_won as number) <= 3
      && typeof o.achieved_at === 'string' && ISO_TZ.test(o.achieved_at) && !Number.isNaN(Date.parse(o.achieved_at))
      && Number.isInteger(o.seed);
  }).map((o) => ({ name: normalizeName(o.name), score: o.score, nights_won: o.nights_won, achieved_at: o.achieved_at, seed: o.seed }));
}

/** Score descending; equal score: whoever got it first (earlier achieved_at) ranks higher. Top 10 kept. */
export function rank(entries: readonly Entry[]): Entry[] {
  return entries
    .map((e, i) => ({ e, i, t: Date.parse(e.achieved_at) }))
    .sort((a, b) => b.e.score - a.e.score || a.t - b.t || a.i - b.i)
    .slice(0, TOP_N)
    .map((x) => x.e);
}

/** Adds an entry and returns the new top 10 (the entry may not make it). */
export function addEntry(entries: readonly Entry[], entry: Entry): Entry[] {
  return rank([...entries, entry]);
}

export const exportJson = (entries: readonly Entry[]): string => JSON.stringify({ entries: rank(entries) }, null, 2) + '\n';

/** Union of two lists without duplicates (same name, score and achieved_at), ranked. */
export function merge(a: readonly Entry[], b: readonly Entry[]): Entry[] {
  const seen = new Set<string>();
  const key = (e: Entry) => `${e.name}\u0000${e.score}\u0000${e.achieved_at}`;
  return rank([...a, ...b].filter((e) => !seen.has(key(e)) && (seen.add(key(e)), true)));
}
