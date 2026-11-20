import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/core';
import { QUIET, run } from './helpers';

const root = join(__dirname, '..');

describe('game.contract.json (v1.3)', () => {
  const c = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));
  // Ticket-03: contract 1.1 -> 1.2; Phase 4: 1.2 -> 1.3 and adds bench_cmd + soak_cmd
  it('declares contract 1.3 and the commands', () => {
    expect(c.contract_version).toBe('1.3');
    for (const k of ['team', 'build_cmd', 'run_cmd', 'headless_cmd', 'bench_cmd', 'soak_cmd']) expect(typeof c[k]).toBe('string');
  });
  it('tuning mirrors the numbers the game uses', () => {
    expect(c.tuning).toEqual(TUNING);
  });
  // Ticket-03 replaced durations (240/270/300), added fuel keys and the new score table
  it('tuning equals the Ticket-02 + Ticket-03 standard tables', () => {
    expect(c.tuning).toMatchObject({
      player_speed: 6, carry_capacity: 10, lantern_cost: 10, lantern_count_night1: 5, pickup_radius: 1,
      interact_radius: 2, pulse_cost: 3, pulse_radius: 5, night1_duration_s: 240, night2_duration_s: 270,
      night3_duration_s: 300, flames: 3,
      fuel_max: 100, fuel_decay_per_s: 1, fuel_per_mote: 10, relight_cost: 5, win_ratio: 0.6, drain_per_s: 5,
      low_fuel_threshold: 30, capacity_max: 20, invuln_s: 1.5, hit_drop_ratio: 0.5, pulse_stun_s: 2, pulse_push_m: 4,
      pulse_cooldown_s: 3, safe_radius: 6, shade_speed: 4, shade_hit_radius: 1, dash_speed: 14,
      dash_duration_s: 0.2, dash_cooldown_s: 1.5, fall_enabled: true,
      score: { per_mote: 5, per_lantern: 100, per_relight: 40, per_stun: 5, per_stun_drain: 15, per_second_left: 0, per_flame_left: 50 },
    });
  });
});

describe('tick model and output', () => {
  it('tick 0 snapshot is before input; night_start at tick 0; --ticks N runs N steps', () => {
    const r = run({ ticks: 10, scenario: QUIET, frames: [{ tick: 0, move: [0, 1] }], every: 5 });
    expect(r.snaps.map((s) => s.tick)).toEqual([0, 5, 10]);
    expect(r.snaps[0]!.player.pos).toEqual([0, 0, 0]);
    expect(r.lines[1]).toEqual({ type: 'event', tick: 0, name: 'night_start', data: { night: 1 } });
    expect(r.end).toMatchObject({ type: 'end', ticks: 10, state: 'playing' });
  });
  it('snapshot has every v1.1 field', () => {
    for (const night of [1, 2, 3] as const) {
      const s = run({ night, ticks: 0 }).snaps[0]!;
      expect(s).toMatchObject({ type: 'snapshot', tick: 0, sim_tick: 0, state: 'playing', night });
      expect(Object.keys(s)).toEqual(expect.arrayContaining(
        ['time_left_s', 'wind', 'player', 'lanterns', 'shades', 'motes', 'motes_active', 'drifters', 'charms']));
      expect(Object.keys(s.player)).toEqual(expect.arrayContaining(
        ['pos', 'vel', 'grounded', 'invuln', 'flames', 'carried', 'dash_cd_s', 'pulse_cd_s', 'charm_s']));
      expect(s.wind).toEqual({ active: false, dir_deg: null });
    }
  });
  it('maps match the standard lantern tables', () => {
    expect(run({ night: 1, ticks: 0 }).snaps[0]!.lanterns.map((l) => l.pos)).toEqual(
      [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]);
    expect(run({ night: 2, ticks: 0 }).snaps[0]!.lanterns.map((l) => l.id)).toEqual(['L1', 'L2', 'L3', 'L4', 'L5', 'L6']);
    expect(run({ night: 3, ticks: 0 }).snaps[0]!.lanterns.map((l) => l.pos)).toEqual(
      [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]]);
    expect(run({ night: 2, ticks: 0 }).snaps[0]!.charms).toEqual([{ id: 'C1', available: true, respawn_s: 0 }]);
    expect(run({ night: 3, ticks: 0 }).snaps[0]!.charms.map((c) => c.id)).toEqual(['C1', 'C2']);
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
