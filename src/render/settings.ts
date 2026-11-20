/** Rebindable actions (Phase 4 §4): 4 move directions, jump, dash, interact, pulse, pause, + camera turn. */
export const ACTIONS = ['up', 'down', 'left', 'right', 'jump', 'dash', 'interact', 'pulse', 'pause', 'camLeft', 'camRight'] as const;
export type Action = (typeof ACTIONS)[number];
export type KeyMap = Record<Action, string>; // action -> KeyboardEvent.code

export const ACTION_LABEL: Record<Action, string> = {
  up: 'Đi tới', down: 'Đi lùi', left: 'Sang trái', right: 'Sang phải', jump: 'Nhảy', dash: 'Lướt',
  interact: 'Tương tác (nạp đèn)', pulse: 'Tỏa sáng', pause: 'Tạm dừng', camLeft: 'Xoay camera trái', camRight: 'Xoay camera phải',
};

export const DEFAULT_KEYS: KeyMap = {
  up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', dash: 'ShiftLeft',
  interact: 'KeyE', pulse: 'KeyF', pause: 'Escape', camLeft: 'ArrowLeft', camRight: 'ArrowRight',
};

export interface Settings {
  volume: number; // 0..1
  sensitivity: number; // 0.2..2, multiplies mouse yaw speed
  colorblind: boolean; // Ticket-03 "Bảng màu dễ phân biệt"
  reducedMotion: boolean; // Phase 4: no camera shake, no screen flash / blinking
  largeText: boolean; // Phase 4: UI text x1.25
  keys: KeyMap;
}

const KEY = 'dao-den-long.settings';
export const DEFAULTS: Settings = { volume: 0.7, sensitivity: 1, colorblind: false, reducedMotion: false, largeText: false, keys: { ...DEFAULT_KEYS } };
const clamp = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;

/** Saved key map, falling back to defaults for missing/invalid entries or if the saved map has duplicates. */
function loadKeys(raw: unknown): KeyMap {
  const keys = { ...DEFAULT_KEYS };
  if (typeof raw !== 'object' || raw === null) return keys;
  for (const a of ACTIONS) {
    const v = (raw as Record<string, unknown>)[a];
    if (typeof v === 'string' && v.length > 0) keys[a] = v;
  }
  return new Set(Object.values(keys)).size === ACTIONS.length ? keys : { ...DEFAULT_KEYS };
}

/** Persisted in localStorage so they survive reopening the game. */
export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    return {
      volume: clamp(raw.volume, 0, 1, DEFAULTS.volume),
      sensitivity: clamp(raw.sensitivity, 0.2, 2, DEFAULTS.sensitivity),
      colorblind: raw.colorblind === true,
      reducedMotion: raw.reducedMotion === true,
      largeText: raw.largeText === true,
      keys: loadKeys(raw.keys),
    };
  } catch {
    return { ...DEFAULTS, keys: { ...DEFAULT_KEYS } };
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

/** The other action already using `code`, if any. */
export function conflictOf(keys: KeyMap, action: Action, code: string): Action | null {
  return ACTIONS.find((a) => a !== action && keys[a] === code) ?? null;
}

/**
 * Try to bind `code` to `action`. A key used by another action is refused (keys unchanged) and the
 * clashing action is reported so the UI can tell the player.
 */
export function rebind(keys: KeyMap, action: Action, code: string): { ok: true; keys: KeyMap } | { ok: false; conflict: Action } {
  const conflict = conflictOf(keys, action, code);
  if (conflict) return { ok: false, conflict };
  return { ok: true, keys: { ...keys, [action]: code } };
}

/** Human label for a KeyboardEvent.code. */
export function keyLabel(code: string): string {
  const named: Record<string, string> = {
    Space: 'Space', ShiftLeft: 'Shift trái', ShiftRight: 'Shift phải', ControlLeft: 'Ctrl trái', ControlRight: 'Ctrl phải',
    AltLeft: 'Alt trái', AltRight: 'Alt phải', Escape: 'Esc', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  };
  if (named[code]) return named[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad/.test(code)) return `Num ${code.slice(6)}`;
  return code;
}
