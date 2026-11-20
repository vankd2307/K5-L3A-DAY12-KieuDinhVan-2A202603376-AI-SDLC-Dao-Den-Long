import { beforeEach, describe, expect, it } from 'vitest';
import { loadSettings, saveSettings } from '../src/render/settings';

// Minimal in-memory localStorage: the same store survives between "page loads".
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as unknown as { localStorage: Pick<Storage, 'getItem' | 'setItem'> }).localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
  };
});

describe('F5 settings persistence', () => {
  it('defaults when nothing is saved', () => {
    expect(loadSettings()).toEqual({ volume: 0.7, sensitivity: 1, colorblind: false });
  });
  it('saved volume and sensitivity are loaded again (survive a reload)', () => {
    saveSettings({ volume: 0.25, sensitivity: 1.6, colorblind: true });
    expect(loadSettings()).toEqual({ volume: 0.25, sensitivity: 1.6, colorblind: true });
  });
  it('corrupt or out-of-range values fall back safely', () => {
    store.set('dao-den-long.settings', '{"volume": 9, "sensitivity": "x"}');
    expect(loadSettings()).toEqual({ volume: 1, sensitivity: 1, colorblind: false });
    store.set('dao-den-long.settings', 'not json');
    expect(loadSettings()).toEqual({ volume: 0.7, sensitivity: 1, colorblind: false });
  });
});
