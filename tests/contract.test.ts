import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/core';
import { QUIET, run } from './helpers';

const root = join(__dirname, '..');

describe('game.contract.json', () => {
  const c = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));
  it('declares contract 1.0 and the commands', () => {
    expect(c.contract_version).toBe('1.0');
    for (const k of ['team', 'build_cmd', 'run_cmd', 'headless_cmd']) expect(typeof c[k]).toBe('string');
  });
  it('tuning mirrors the numbers the game actually uses', () => {
    expect(c.tuning).toEqual(TUNING);
  });
});

describe('tick model', () => {
  it('tick 0 snapshot is before any input; --ticks N runs exactly N steps', () => {
    const r = run({ ticks: 10, scenario: QUIET, frames: [{ tick: 0, move: [0, 1] }], every: 5 });
    expect(r.snaps.map((s) => s.tick)).toEqual([0, 5, 10]);
    expect(r.snaps[0]!.player.pos).toEqual([0, 0, 0]);
    expect(r.end).toMatchObject({ type: 'end', ticks: 10, state: 'playing' });
  });
  it('time_left_s = duration - steps/60', () => {
    const r = run({ ticks: 120, scenario: QUIET });
    expect(r.snaps.at(-1)!.time_left_s).toBe(TUNING.night1_duration_s - 2);
  });
  it('snapshot shape matches contract E', () => {
    const s = run({ ticks: 0 }).snaps[0]!;
    expect(Object.keys(s)).toEqual(
      expect.arrayContaining(['type', 'tick', 'sim_tick', 'state', 'time_left_s', 'player', 'lanterns', 'shades', 'motes_active']),
    );
    expect((s.lanterns as unknown[]).length).toBe(5);
    expect(s.lanterns).toContainEqual({ id: 'L1', pos: [0, 0, 25], lit: false, deposited: 0 });
  });
  it('end is always the last line', () => {
    expect(run({ ticks: 37, every: 10 }).end.type).toBe('end');
  });
});

describe('architecture', () => {
  it('src/core imports nothing from three, node or render', () => {
    const dir = join(root, 'src/core');
    for (const f of readdirSync(dir)) {
      expect(readFileSync(join(dir, f), 'utf8'), f).not.toMatch(/from\s+['"](three|node:|\.\.\/render)/);
    }
  });
});
