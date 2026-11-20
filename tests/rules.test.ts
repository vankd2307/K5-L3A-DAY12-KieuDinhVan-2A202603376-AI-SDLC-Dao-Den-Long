import { describe, expect, it } from 'vitest';
import { hdist, TUNING as T } from '../src/core';
import { QUIET, run } from './helpers';

describe('movement', () => {
  it('moves player_speed m/s along +Z at yaw 0', () => {
    const r = run({ ticks: 60, scenario: QUIET, frames: [{ tick: 0, move: [0, 1] }] });
    expect(r.snaps.at(-1)!.player.pos).toEqual([0, 0, T.player_speed]);
  });
  it('rotates by cam_yaw_deg: move [0,1] at 90 deg goes +X', () => {
    const r = run({ ticks: 60, scenario: QUIET, frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }] });
    expect(r.snaps.at(-1)!.player.pos).toEqual([T.player_speed, 0, 0]);
  });
  it('normalises vectors longer than 1', () => {
    const r = run({ ticks: 60, scenario: QUIET, frames: [{ tick: 0, move: [1, 1] }] });
    const [x, , z] = r.snaps.at(-1)!.player.pos as [number, number, number];
    expect(Math.hypot(x, z)).toBeCloseTo(T.player_speed, 2);
  });
  it('held values persist until changed', () => {
    const r = run({ ticks: 60, scenario: QUIET, frames: [{ tick: 0, move: [1, 0] }, { tick: 30, cam_yaw_deg: 0 }] });
    expect(r.snaps.at(-1)!.player.pos).toEqual([T.player_speed, 0, 0]);
  });
  it('jump leaves the ground and lands again', () => {
    const r = run({ ticks: 60, scenario: QUIET, frames: [{ tick: 0, jump: true }], every: 10 });
    expect(r.snaps[1]!.player.pos[1]).toBeGreaterThan(0);
    expect(r.snaps.at(-1)!.player.pos[1]).toBe(0);
  });
});

describe('motes and lanterns', () => {
  it('picks motes within pickup_radius, up to carry_capacity', () => {
    const motes = Array.from({ length: T.carry_capacity + 2 }, () => [0, 0, 1]);
    const r = run({ ticks: 1, scenario: { ...QUIET, motes } });
    expect(r.events('mote_picked')).toHaveLength(T.carry_capacity);
    expect(r.events('mote_picked')[0]).toMatchObject({ tick: 1, data: { carried: 1 } });
    expect(r.snaps.at(-1)!.motes_active).toBe(2);
  });
  it('does not pick a mote just outside pickup_radius', () => {
    const r = run({ ticks: 1, scenario: { ...QUIET, motes: [[0, 0, T.pickup_radius + 0.01]] } });
    expect(r.events('mote_picked')).toHaveLength(0);
  });
  it('interact deposits into the lantern in reach and lights it at lantern_cost', () => {
    const r = run({
      ticks: 5,
      scenario: { ...QUIET, player: { pos: [0, 0, 23], carried: T.lantern_cost + 1 } },
      frames: [{ tick: 2, interact: true }],
    });
    expect(r.events('deposit')).toEqual([
      { type: 'event', tick: 3, name: 'deposit', data: { lantern_id: 'L1', amount: T.lantern_cost, deposited: T.lantern_cost } },
    ]);
    expect(r.events('lantern_lit')[0]).toMatchObject({ tick: 3, data: { lantern_id: 'L1' } });
    expect(r.snaps.at(-1)!.player.carried).toBe(1);
  });
  it('interact only fires on the false->true edge', () => {
    const r = run({
      ticks: 10,
      scenario: { ...QUIET, player: { pos: [0, 0, 23], carried: 3 } },
      frames: [{ tick: 0, interact: true }],
    });
    expect(r.events('deposit')).toHaveLength(1);
  });
  it('lighting the last lantern wins with all_lit and the end bonus', () => {
    const lit = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
    const r = run({
      ticks: 100,
      scenario: { ...QUIET, player: { pos: [0, 0, 23], carried: T.lantern_cost }, lanterns: lit },
      frames: [{ tick: 0, interact: true }],
    });
    expect(r.events('game_over')).toEqual([{ type: 'event', tick: 1, name: 'game_over', data: { result: 'won', reason: 'all_lit' } }]);
    const bonus = Math.floor(T.night1_duration_s - 1 / 60) * T.score.per_second_left + T.flames * T.score.per_flame_left;
    expect(r.end).toMatchObject({ ticks: 1, state: 'won', score: T.score.per_lantern + bonus });
  });
  it('scenario setup emits no events and no score', () => {
    const r = run({ ticks: 0, scenario: { ...QUIET, lanterns: [{ id: 'L1', lit: true }] } });
    expect(r.events()).toHaveLength(0);
    expect(r.end.score).toBe(0);
  });
});

describe('shades and pulse', () => {
  it('shade chases at shade_speed and hits within shade_hit_radius', () => {
    const r = run({ ticks: 120, scenario: { ...QUIET, shades: [{ id: 'S1', pos: [5, 0, 0] }], player: { carried: 4 } } });
    const hit = r.events('player_hit')[0]!;
    // closes 5 - hit_radius metres at shade_speed
    expect(hit.tick).toBe(Math.ceil(((5 - T.shade_hit_radius) / T.shade_speed) * 60));
    expect(hit.data).toEqual({ by: 'shade', flames: T.flames - 1, dropped: Math.floor(4 * T.hit_drop_ratio) });
  });
  it('invulnerability prevents a second hit for invuln_s', () => {
    const r = run({ ticks: 600, scenario: { ...QUIET, shades: [{ pos: [2, 0, 0] }] } });
    const ticks = r.events('player_hit').map((e) => e.tick!);
    expect(ticks[1]! - ticks[0]!).toBe(T.invuln_s * 60);
  });
  it('losing all flames ends the game: no_flames', () => {
    const r = run({ ticks: 1000, scenario: { ...QUIET, player: { flames: 1 }, shades: [{ pos: [2, 0, 0] }] } });
    expect(r.events('game_over')[0]!.data).toEqual({ result: 'lost', reason: 'no_flames' });
    expect(r.end.state).toBe('lost');
  });
  it('pulse costs light, stuns and pushes shades in pulse_radius, then respects cooldown', () => {
    const r = run({
      ticks: 30,
      every: 1,
      scenario: { ...QUIET, player: { carried: 10 }, shades: [{ id: 'S1', pos: [3, 0, 0] }, { id: 'S2', pos: [20, 0, 0] }] },
      frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 2, pulse: true }],
    });
    const pulses = r.events('pulse');
    expect(pulses).toHaveLength(1); // second press is inside cooldown
    expect(pulses[0]!.data).toEqual({ stunned_ids: ['S1'] });
    const s1 = r.snaps[1]!.shades as Array<{ id: string; pos: number[]; state: string }>;
    expect(s1[0]).toMatchObject({ state: 'stunned', pos: [3 + T.pulse_push_m, 1, 0] });
    expect(r.snaps[1]!.player.carried).toBe(10 - T.pulse_cost);
    expect(r.end.score).toBe(T.score.per_stun);
  });
  it('stun lasts pulse_stun_s', () => {
    const r = run({
      ticks: T.pulse_stun_s * 60 + 5,
      every: 1,
      scenario: { ...QUIET, player: { carried: 10 }, shades: [{ pos: [3, 0, 0] }] },
      frames: [{ tick: 0, pulse: true }],
    });
    const state = (t: number) => (r.snaps[t]!.shades as Array<{ state: string }>)[0]!.state;
    expect(state(T.pulse_stun_s * 60)).toBe('stunned');
    expect(state(T.pulse_stun_s * 60 + 1)).toBe('chase');
  });
  it('pulse without enough light does nothing', () => {
    const r = run({ ticks: 2, scenario: { ...QUIET, player: { carried: T.pulse_cost - 1 }, shades: [{ pos: [3, 0, 0] }] }, frames: [{ tick: 0, pulse: true }] });
    expect(r.events('pulse')).toHaveLength(0);
  });
  it('shades never enter safe_radius of a lantern (player hiding at L1 is safe)', () => {
    const r = run({
      ticks: 600,
      every: 1,
      scenario: { ...QUIET, player: { pos: [0, 0, 25] }, shades: [{ pos: [0, 0, 10] }, { pos: [10, 0, 25] }] },
    });
    expect(r.events('player_hit')).toHaveLength(0);
    for (const s of r.snaps) {
      for (const sh of s.shades as Array<{ pos: [number, number, number] }>) {
        expect(hdist(sh.pos, [0, 0, 25])).toBeGreaterThanOrEqual(T.safe_radius - 1e-3);
      }
    }
  });
});

describe('time and determinism', () => {
  it('dawn ends the night: lost / dawn', () => {
    const r = run({ ticks: 1000, scenario: { ...QUIET, time_left_s: 2 } });
    expect(r.events('game_over')[0]).toMatchObject({ tick: 120, data: { result: 'lost', reason: 'dawn' } });
    expect(r.end).toMatchObject({ ticks: 120, state: 'lost' });
  });
  it('same seed -> identical output; different seed -> different world', () => {
    const frames = [{ tick: 0, move: [0.3, 1] as [number, number] }, { tick: 300, pulse: true }];
    const a = JSON.stringify(run({ seed: 7, ticks: 3000, frames }).lines);
    const b = JSON.stringify(run({ seed: 7, ticks: 3000, frames }).lines);
    const c = JSON.stringify(run({ seed: 8, ticks: 3000, frames }).lines);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
  it('random shades spawn over time with shade_spawned events', () => {
    const r = run({ ticks: 41 * 60, scenario: { random_motes: false, player: { pos: [0, 0, 25] } } });
    expect(r.events('shade_spawned')[0]).toMatchObject({ data: { id: 'S3' } });
  });
});
