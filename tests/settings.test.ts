import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_KEYS, DEFAULTS, loadSettings, saveSettings } from '../src/render/settings';

// Minimal in-memory localStorage: the same store survives between "page loads".
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as unknown as { localStorage: Pick<Storage, 'getItem' | 'setItem'> }).localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
  };
});

// Phase 4 added reducedMotion, largeText and keys to Settings: expectations use the full object.
describe('F5 settings persistence', () => {
  it('defaults when nothing is saved', () => {
    expect(loadSettings()).toEqual(DEFAULTS);
  });
  it('saved volume and sensitivity are loaded again (survive a reload)', () => {
    const s = { ...DEFAULTS, volume: 0.25, sensitivity: 1.6, colorblind: true, reducedMotion: true, largeText: true, keys: { ...DEFAULT_KEYS, jump: 'KeyJ' } };
    saveSettings(s);
    expect(loadSettings()).toEqual(s);
  });
  it('corrupt or out-of-range values fall back safely', () => {
    store.set('dao-den-long.settings', '{"volume": 9, "sensitivity": "x"}');
    expect(loadSettings()).toEqual({ ...DEFAULTS, volume: 1 });
    store.set('dao-den-long.settings', 'not json');
    expect(loadSettings()).toEqual(DEFAULTS);
  });
});
