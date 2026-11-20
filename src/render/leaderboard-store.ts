import { addEntry, merge, validEntries, type Entry } from '../leaderboard';

const KEY = 'dao-den-long.leaderboard';
const API = './api/leaderboard';

function local(): Entry[] {
  try {
    return validEntries(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
  } catch {
    return [];
  }
}
const setLocal = (e: Entry[]) => localStorage.setItem(KEY, JSON.stringify(e));

async function api(body?: unknown): Promise<Entry[] | null> {
  try {
    const r = await fetch(API, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) return null;
    return validEntries(await r.json());
  } catch {
    return null;
  }
}

/**
 * Top 10. With `npm start` / `npm run dev` the list lives in a file on disk (via /api/leaderboard,
 * exportable with --export-leaderboard); a plain static server (the Release zip) falls back to
 * localStorage, which the browser also keeps on disk. Entries saved offline are pushed to the file
 * the next time the API is reachable.
 */
export async function loadBoard(): Promise<Entry[]> {
  const mine = local();
  const disk = await api(mine.length ? { entries: mine } : undefined);
  const all = disk ? merge(disk, mine) : mine;
  setLocal(all);
  return all;
}

export async function saveEntry(entry: Entry): Promise<Entry[]> {
  const mine = addEntry(local(), entry);
  setLocal(mine);
  const disk = await api({ entry, entries: mine });
  return disk ? merge(disk, mine) : mine;
}
