export interface Settings {
  volume: number; // 0..1
  sensitivity: number; // 0.2..2, multiplies mouse yaw speed
}

const KEY = 'dao-den-long.settings';
const DEFAULTS: Settings = { volume: 0.7, sensitivity: 1 };
const clamp = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;

/** Persisted in localStorage so they survive reopening the game. */
export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    return {
      volume: clamp(raw.volume, 0, 1, DEFAULTS.volume),
      sensitivity: clamp(raw.sensitivity, 0.2, 2, DEFAULTS.sensitivity),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}
