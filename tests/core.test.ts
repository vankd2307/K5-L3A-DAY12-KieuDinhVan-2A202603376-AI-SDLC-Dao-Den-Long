import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRng, DEFAULT_CONFIG, Game } from '../src/core';

describe('rng', () => {
  it('same seed -> same sequence', () => {
    const a = createRng(7);
    const b = createRng(7);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
});

describe('game', () => {
  it('moves player at configured speed for 1 second', () => {
    const g = new Game(DEFAULT_CONFIG, 1);
    for (let i = 0; i < DEFAULT_CONFIG.tickRate; i++) g.step({ moveX: 1, moveZ: 0 });
    expect(g.state.player.pos.x).toBeCloseTo(DEFAULT_CONFIG.playerSpeed, 6);
    expect(g.state.tick).toBe(DEFAULT_CONFIG.tickRate);
  });
});

describe('architecture', () => {
  it('src/core imports nothing from three, node or render', () => {
    const dir = join(__dirname, '../src/core');
    for (const f of readdirSync(dir)) {
      const src = readFileSync(join(dir, f), 'utf8');
      expect(src, f).not.toMatch(/from\s+['"](three|node:|\.\.\/render)/);
    }
  });
});
