import { describe, expect, it } from 'vitest';
import { hdist, type Vec3 } from '../src/core';
import { QUIET, run } from './helpers';

const near = (a: number[], b: number[], eps = 1e-3) => a.every((v, i) => Math.abs(v - b[i]!) <= eps);

describe('P2 movement and jump', () => {
  it('runs 6 m/s along +Z at yaw 0 (vel reported)', () => {
    const r = run({ ticks: 60, scenario: QUIET, frames: [{ tick: 0, move: [0, 1] }] });
    expect(r.last.player.pos).toEqual([0, 0, 6]);
    expect(r.last.player.vel).toEqual([0, 0, 6]);
  });
  it('rotates by cam_yaw_deg and normalises long vectors', () => {
    expect(run({ ticks: 60, scenario: QUIET, frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }] }).last.player.pos).toEqual([6, 0, 0]);
    const p = run({ ticks: 60, scenario: QUIET, frames: [{ tick: 0, move: [1, 1] }] }).last.player.pos;
    expect(Math.hypot(p[0]!, p[2]!)).toBeCloseTo(6, 2);
  });
  it('jumps at 7 m/s with g=20 (apex ~1.225 m), only from the ground', () => {
    const r = run({ ticks: 90, every: 1, scenario: QUIET, frames: [{ tick: 0, jump: true }, { tick: 10, jump: false }, { tick: 20, jump: true }] });
    const ys = r.snaps.map((s) => s.player.pos[1]!);
    expect(Math.max(...ys)).toBeGreaterThan(1.15);
    expect(Math.max(...ys)).toBeLessThan(1.3);
    expect(r.at(1).player.grounded).toBe(false);
    expect(r.last.player).toMatchObject({ grounded: true });
    expect(r.last.player.pos[1]).toBe(0);
    // the press at tick 20 was mid-air: only one rise
    const rises = ys.filter((y, i) => i > 0 && y > ys[i - 1]! && ys[i - 1] === 0).length;
    expect(rises).toBe(1);
  });
});

describe('P3 dash', () => {
  it('14 m/s for 12 ticks in the facing direction when standing still, cooldown 90 ticks from start', () => {
    const r = run({
      ticks: 120, every: 1, scenario: QUIET,
      frames: [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 50, dash: true }, { tick: 51, dash: false }, { tick: 90, dash: true }],
    });
    expect(r.events('dash').map((e) => e.tick)).toEqual([1, 91]);
    expect(r.at(12).player.pos[2]).toBeCloseTo(2.8, 3);
    expect(r.at(13).player.pos[2]).toBeCloseTo(2.8, 3);
    expect(r.at(1).player.dash_cd_s).toBe(1.5); // counted from the dash start
  });
  it('dash in the air keeps altitude', () => {
    const r = run({ ticks: 30, every: 1, scenario: QUIET, frames: [{ tick: 0, jump: true }, { tick: 8, dash: true }] });
    const y = r.at(9).player.pos[1];
    for (let t = 9; t <= 20; t++) expect(r.at(t).player.pos[1]).toBe(y);
    expect(r.at(22).player.pos[1]).toBeLessThan(y!);
  });
});

describe('P4 motes', () => {
  it('starts with 20 random motes at 20 distinct spawn points; +1 at tick 240', () => {
    const r = run({ ticks: 240, every: 1, scenario: { random_shades: false } });
    const s0 = r.at(0);
    expect(s0.motes_active).toBe(20);
    expect(new Set(s0.motes.map((m) => m.pos.join())).size).toBe(20);
    expect(s0.motes.every((m) => m.kind === 'random' && m.ttl_s === null)).toBe(true);
    expect(r.at(239).motes_active).toBe(20);
    expect(r.at(240).motes_active).toBe(21);
  });
  it('picks within XZ 1.0 and height 1.5, up to capacity 10', () => {
    const r = run({ ticks: 1, scenario: { ...QUIET, motes: [...Array(12).fill([0, 0, 1]), [0, 0, 1.01], [0, 2, 0.5]] } });
    expect(r.events('mote_picked')).toHaveLength(10);
    expect(r.last.motes_active).toBe(4);
  });
  it('mote pickup gives no score (score is per deposited mote)', () => {
    expect(run({ ticks: 1, scenario: { ...QUIET, motes: [[0, 0, 0.5]] } }).end.score).toBe(0);
  });
});

describe('P5 lanterns', () => {
  const atL1 = { ...QUIET, player: { pos: [0, 0, 23.5], carried: 6 } };
  it('deposits min(carried, missing) several times; lights at 10; +10/mote, +100/lantern', () => {
    const r = run({
      ticks: 10, scenario: atL1,
      frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }],
    });
    expect(r.events('deposit')[0]!.data).toEqual({ lantern_id: 'L1', amount: 6, deposited: 6 });
    const r2 = run({ ticks: 3, scenario: { ...atL1, player: { pos: [0, 0, 23.5], carried: 9 }, lanterns: [{ id: 'L1', deposited: 6 }] }, frames: [{ tick: 0, interact: true }] });
    expect(r2.events('deposit')[0]!.data).toEqual({ lantern_id: 'L1', amount: 4, deposited: 10 });
    expect(r2.events('lantern_lit')).toHaveLength(1);
    expect(r2.last.player.carried).toBe(5);
    expect(r2.end.score).toBe(4 * 10 + 100);
  });
  it('interact radius is 2.0; ties go to the smaller id', () => {
    expect(run({ ticks: 2, scenario: { ...QUIET, player: { pos: [0, 0, 22.99], carried: 3 } }, frames: [{ tick: 0, interact: true }] }).events('deposit')).toHaveLength(0);
    const tie = run({
      ticks: 2,
      scenario: { ...QUIET, player: { pos: [0, 0, 0], carried: 3 }, lanterns: [{ id: 'L2', pos: [1, 0, 0] }, { id: 'L1', pos: [-1, 0, 0] }] },
      frames: [{ tick: 0, interact: true }],
    });
    expect(tie.events('deposit')[0]!.data).toMatchObject({ lantern_id: 'L1' });
  });
});

describe('P6 safe zone', () => {
  it('an unlit lantern does not protect; a lit lantern keeps shades at 6 m', () => {
    const unlit = run({ ticks: 120, scenario: { ...QUIET, player: { pos: [0, 0, 25] }, shades: [{ id: 'S1', pos: [8, 0, 25] }] } });
    expect(unlit.events('player_hit')).toHaveLength(1);
    const lit = run({ ticks: 600, every: 1, scenario: { ...QUIET, player: { pos: [0, 0, 25] }, lanterns: [{ id: 'L1', lit: true }], shades: [{ pos: [8, 0, 25] }] } });
    expect(lit.events('player_hit')).toHaveLength(0);
    for (const s of lit.snaps) expect(hdist(s.shades[0]!.pos as Vec3, [0, 0, 25])).toBeGreaterThanOrEqual(6 - 1e-3);
  });
  it('a shade inside when the lantern lights is pushed to the edge within 30 ticks, harmless meanwhile', () => {
    const r = run({
      ticks: 40, every: 1,
      scenario: { ...QUIET, player: { pos: [0, 0, 23.5], carried: 10 }, shades: [{ id: 'S1', pos: [0, 0, 22.8] }] },
      frames: [{ tick: 0, interact: true }],
    });
    expect(r.events('lantern_lit')).toHaveLength(1);
    expect(r.events('player_hit')).toHaveLength(0);
    expect(hdist(r.at(30).shades[0]!.pos as Vec3, [0, 0, 25])).toBeCloseTo(6, 2);
  });
});

describe('P7 pulse', () => {
  const sc = (shadePos: number[], carried = 10) => ({ ...QUIET, player: { carried }, shades: [{ id: 'S1', pos: shadePos }] });
  it('costs 3, 3D radius 5 from feet+0.8, stun 120, push 4 m over 15 ticks, +5 each, cooldown 180', () => {
    const r = run({
      ticks: 200, every: 1, scenario: { ...QUIET, player: { carried: 10 }, shades: [{ id: 'S1', pos: [4.9, 0, 0] }, { id: 'S2', pos: [-30, 0, 0] }] },
      frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 100, pulse: true }, { tick: 101, pulse: false }, { tick: 180, pulse: true }],
    });
    expect(r.events('pulse').map((e) => e.tick)).toEqual([1, 181]);
    expect(r.events('pulse')[0]!.data).toEqual({ stunned_ids: ['S1'] });
    expect(r.at(1).player.carried).toBe(7);
    expect(r.at(15).shades[0]!.pos[0]).toBeCloseTo(8.9, 3);
    expect(r.at(16).shades[0]!.pos[0]).toBeCloseTo(8.9, 3);
    expect(r.at(120).shades[0]!.state).toBe('stunned');
    expect(r.at(121).shades[0]!.state).not.toBe('stunned');
    // 3D radius boundary: 5.01 m away is not hit
    const edge = run({ ticks: 1, scenario: sc([5.01, 0, 0]), frames: [{ tick: 0, pulse: true }] });
    expect(edge.events('pulse')[0]!.data).toEqual({ stunned_ids: [] });
  });
  it('re-pulsing a stunned shade refreshes the stun and still scores', () => {
    const r = run({ ticks: 200, scenario: sc([3, 0, 0]), frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 180, pulse: true }] });
    expect(r.events('pulse').flatMap((e) => e.data!.stunned_ids as string[])).toEqual(['S1', 'S1']);
    expect(r.end.score).toBe(10);
  });
  it('does nothing with fewer than 3 motes', () => {
    expect(run({ ticks: 2, scenario: sc([3, 0, 0], 2), frames: [{ tick: 0, pulse: true }] }).events('pulse')).toHaveLength(0);
  });
});

describe('P8 shades', () => {
  it('spawn 2 at tick 300 then 1 every 480 ticks on Night 1, starting in `spawning`', () => {
    const r = run({ ticks: 800, every: 1, scenario: { random_motes: false } });
    expect(r.events('shade_spawned').map((e) => [e.tick, e.data!.id])).toEqual([[300, 'S1'], [300, 'S2'], [780, 'S3']]);
    expect(r.at(300).shades.every((s) => s.state === 'spawning')).toBe(true);
    for (const s of r.at(300).shades) expect(Math.hypot(s.pos[0]!, s.pos[2]!)).toBeCloseTo(37, 2);
  });
  it('detects at 12 m (wander -> chase)', () => {
    const far = run({ ticks: 1, scenario: { ...QUIET, shades: [{ pos: [12.5, 0, 0] }] } });
    expect(far.last.shades[0]!.state).toBe('wander');
    const close = run({ ticks: 1, scenario: { ...QUIET, shades: [{ pos: [11.5, 0, 0] }] } });
    expect(close.last.shades[0]!.state).toBe('chase');
  });
  it('chases at 4 m/s on Night 1 and 4.5 m/s on Night 3', () => {
    const n1 = run({ ticks: 60, scenario: { ...QUIET, shades: [{ pos: [10, 0, 0] }] } });
    expect(n1.last.shades[0]!.pos[0]).toBeCloseTo(6, 3);
    const n3 = run({ night: 3, ticks: 60, scenario: { ...QUIET, player: { pos: [0, 0, -30] }, shades: [{ pos: [10, 0, -30] }] } });
    expect(n3.last.shades[0]!.pos[0]).toBeCloseTo(5.5, 3);
  });
});

describe('P9 getting hit', () => {
  it('-1 flame, drops floor(n/2) dropped motes in a 1.5-2.5 m ring (ttl 8 s), invuln 90, shade recoils', () => {
    const r = run({ ticks: 200, every: 1, scenario: { ...QUIET, player: { carried: 5 }, shades: [{ id: 'S1', pos: [2, 0, 0] }] } });
    const hits = r.events('player_hit');
    const t0 = hits[0]!.tick!;
    expect(hits[0]!.data).toEqual({ by: 'shade', flames: 2, dropped: 2 });
    const s = r.at(t0);
    expect(s.player.invuln).toBe(true);
    expect(s.shades[0]!.state).toBe('recoil');
    const dropped = s.motes.filter((m) => m.kind === 'dropped');
    expect(dropped).toHaveLength(2);
    for (const m of dropped) {
      const d = hdist(m.pos as Vec3, s.player.pos as Vec3);
      expect(d).toBeGreaterThanOrEqual(1.5 - 1e-3);
      expect(d).toBeLessThanOrEqual(2.5 + 1e-3);
      expect(m.ttl_s).toBe(8);
    }
    expect(hits[1]!.tick! - t0).toBeGreaterThanOrEqual(90);
  });
  it('at most one flame per tick even with two shades touching', () => {
    const r = run({ ticks: 1, scenario: { ...QUIET, shades: [{ id: 'S1', pos: [0.5, 0, 0] }, { id: 'S2', pos: [-0.5, 0, 0] }] } });
    expect(r.events('player_hit')).toHaveLength(1);
    expect(r.last.player.flames).toBe(2);
  });
  it('dropped motes expire after 480 ticks', () => {
    const r = run({ ticks: 2, scenario: { ...QUIET, motes: [{ pos: [20, 0, 0], kind: 'dropped', ttl_ticks: 1 }] } });
    expect(r.last.motes_active).toBe(0);
  });
});

describe('P10 falling off', () => {
  it('-1 flame, loses all motes, waits 60 ticks, respawns at start with 90 ticks invuln', () => {
    const r = run({ ticks: 200, every: 1, scenario: { ...QUIET, player: { pos: [39, 0, 0], carried: 4 } }, frames: [{ tick: 0, move: [1, 0] }] });
    const hit = r.events('player_hit')[0]!;
    expect(hit.data).toEqual({ by: 'fall', flames: 2, dropped: 0, lost: 4 });
    const t = hit.tick!;
    expect(r.at(t + 59).player.pos[1]).toBeLessThan(-10);
    expect(r.at(t + 60).player).toMatchObject({ pos: [0, 0, 0], vel: [0, 0, 0], carried: 0, invuln: true });
  });
  it('falling with the last flame loses immediately', () => {
    const r = run({ ticks: 300, scenario: { ...QUIET, player: { pos: [39, 0, 0], flames: 1 } }, frames: [{ tick: 0, move: [1, 0] }] });
    expect(r.events('game_over')[0]!.data).toEqual({ result: 'lost', reason: 'no_flames' });
  });
});

describe('P11 win / lose', () => {
  const allButL1 = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  it('lighting the last lantern wins; bonus floor(s left) x2 + 50 x flames', () => {
    const r = run({ ticks: 10, scenario: { ...QUIET, player: { pos: [0, 0, 23.5], carried: 10 }, lanterns: allButL1 }, frames: [{ tick: 0, interact: true }] });
    expect(r.events('game_over')[0]).toMatchObject({ tick: 1, data: { result: 'won', reason: 'all_lit' } });
    expect(r.end).toMatchObject({ ticks: 1, state: 'won', score: 100 + 100 + 299 * 2 + 150 });
  });
  it('winning on the exact time-out tick still wins', () => {
    const r = run({ ticks: 100, scenario: { ...QUIET, time_left_s: 1 / 60, player: { pos: [0, 0, 23.5], carried: 10 }, lanterns: allButL1 }, frames: [{ tick: 0, interact: true }] });
    expect(r.events('game_over')[0]!.data).toEqual({ result: 'won', reason: 'all_lit' });
  });
  it('dawn when time runs out', () => {
    const r = run({ ticks: 1000, scenario: { ...QUIET, time_left_s: 2 } });
    expect(r.events('game_over')[0]).toMatchObject({ tick: 120, data: { result: 'lost', reason: 'dawn' } });
  });
});

describe('P12 Night 2 and 3 maps', () => {
  it('Night 2: the bridge holds, beside it you fall', () => {
    const bridge = run({ night: 2, ticks: 200, scenario: { ...QUIET, player: { pos: [25, 0, 0] } }, frames: [{ tick: 0, move: [1, 0] }] });
    expect(bridge.events('player_hit')).toHaveLength(0);
    expect(bridge.last.player.pos[0]).toBeGreaterThan(44);
    const off = run({ night: 2, ticks: 200, scenario: { ...QUIET, player: { pos: [35, 0, 0] } }, frames: [{ tick: 0, move: [0, 1] }] });
    expect(off.events('player_hit')[0]!.data).toMatchObject({ by: 'fall' });
  });
  it('Night 2: launch pad throws Mây to the other island in ~1.4 s', () => {
    const r = run({ night: 2, ticks: 120, every: 1, scenario: { ...QUIET, player: { pos: [20, 0, 18] } } });
    expect(r.at(1).player.vel[1]).toBe(14);
    const landed = r.snaps.find((s) => s.tick! > 1 && s.player.grounded)!;
    expect(landed.tick).toBeGreaterThanOrEqual(80);
    expect(landed.tick).toBeLessThanOrEqual(90);
    expect(hdist(landed.player.pos as Vec3, [70, 0, 0])).toBeLessThan(28);
    expect(r.events('player_hit')).toHaveLength(0);
  });
  it('Night 3: tier walls block, ramps climb, pad reaches tier 2, the tower blocks', () => {
    const wall = run({ night: 3, ticks: 120, scenario: { ...QUIET, player: { pos: [0, 0, 30] } }, frames: [{ tick: 0, move: [0, -1] }] });
    expect(wall.last.player.pos[1]).toBe(0);
    expect(wall.last.player.pos[2]).toBeGreaterThan(24);
    const a = Math.PI / 6;
    const ramp = run({ night: 3, ticks: 120, scenario: { ...QUIET, player: { pos: [31 * Math.cos(a), 0, 31 * Math.sin(a)] } }, frames: [{ tick: 0, move: [-Math.cos(a), -Math.sin(a)] }] });
    expect(ramp.last.player.pos[1]).toBe(3);
    const pad = run({ night: 3, ticks: 120, scenario: { ...QUIET, player: { pos: [0, 3, 13] } } });
    expect(pad.last.player).toMatchObject({ grounded: true });
    expect(pad.last.player.pos[1]).toBe(6);
    const tower = run({ night: 3, ticks: 120, scenario: { ...QUIET, player: { pos: [0, 6, -6] } }, frames: [{ tick: 0, move: [0, 1] }] });
    expect(Math.hypot(tower.last.player.pos[0]!, tower.last.player.pos[2]!)).toBeGreaterThanOrEqual(2);
  });
});

describe('P13 drifters', () => {
  const base = { ...QUIET, player: { carried: 6 } };
  it('idle -> chase (carry >= 5, <= 15 m) -> steal min(3, n) -> flee 240 ticks -> removed', () => {
    const r = run({ night: 2, ticks: 400, every: 1, scenario: { ...base, drifters: [{ id: 'D1', pos: [5, 0, 0] }] } });
    expect(r.at(1).drifters[0]!.state).toBe('chase');
    const steal = r.events('drifter_steal')[0]!;
    expect(steal.data).toEqual({ drifter_id: 'D1', amount: 3, carried: 3 });
    expect(r.at(steal.tick!).drifters[0]).toMatchObject({ state: 'flee', stolen: 3 });
    expect(r.at(steal.tick! + 240).drifters[0]!.state).toBe('removed');
    expect(r.events('drifter_steal')).toHaveLength(1);
  });
  it('stays idle when Mây carries fewer than 5', () => {
    const r = run({ night: 2, ticks: 5, scenario: { ...QUIET, player: { carried: 4 }, drifters: [{ pos: [5, 0, 0] }] } });
    expect(r.last.drifters[0]!.state).toBe('idle');
  });
  it('pulse on a chasing drifter makes it flee empty-handed; on a fleeing thief it drops the loot', () => {
    const chase = run({ night: 2, ticks: 3, scenario: { ...base, drifters: [{ pos: [4, 0, 0], state: 'chase' }] }, frames: [{ tick: 0, pulse: true }] });
    expect(chase.last.drifters[0]).toMatchObject({ state: 'flee', stolen: 0 });
    const thief = run({ night: 2, ticks: 3, scenario: { ...base, drifters: [{ id: 'D1', pos: [3, 0, 0], state: 'flee', stolen: 3 }] }, frames: [{ tick: 0, pulse: true }] });
    expect(thief.events('drifter_drop')[0]!.data).toEqual({ drifter_id: 'D1', amount: 3 });
    expect(thief.last.motes.filter((m) => m.kind === 'dropped')).toHaveLength(3);
  });
});

describe('P14 wind charm', () => {
  it('pick-up gives 600 ticks of 7.2 m/s and cooldown-free dash; respawns after 2700 ticks', () => {
    const r = run({
      night: 2, ticks: 60, every: 1, scenario: { ...QUIET, player: { pos: [34.5, 0, 0] } },
      frames: [{ tick: 1, move: [-1, 0] }],
    });
    expect(r.events('charm_picked')[0]).toMatchObject({ tick: 1, data: { charm_id: 'C1', charm_ticks: 600 } });
    expect(r.at(1).charms[0]).toEqual({ id: 'C1', available: false, respawn_s: 45 });
    expect(r.at(2).player.vel).toEqual([-7.2, 0, 0]);
    const dash = run({
      night: 2, ticks: 40, scenario: { ...QUIET, player: { charm_ticks: 600 } },
      frames: [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 5, dash: true }, { tick: 6, dash: false }, { tick: 14, dash: true }],
    });
    expect(dash.events('dash').map((e) => e.tick)).toEqual([1, 15]); // press at 5 is mid-dash: ignored
  });
});

describe('P15 wind (Night 3)', () => {
  it('a 300-tick gust every 1800 ticks pushes the player 2 m/s', () => {
    const r = run({ night: 3, ticks: 2101, every: 1, scenario: { ...QUIET, wind_enabled: true } });
    expect(r.at(1799).wind.active).toBe(false);
    const g = r.at(1800);
    expect(g.wind.active).toBe(true);
    expect(Math.hypot(g.player.vel[0]!, g.player.vel[2]!)).toBeCloseTo(2, 2); // snapshot rounds to 3 dp
    expect(r.at(2099).wind.active).toBe(true);
    expect(r.at(2100).wind.active).toBe(false);
  });
});

describe('P16 pause', () => {
  it('tick advances, sim_tick and time freeze, state paused, paused/resumed events', () => {
    const r = run({
      ticks: 40, every: 1, scenario: QUIET,
      frames: [{ tick: 0, move: [0, 1] }, { tick: 10, pause: true }, { tick: 11, pause: false }, { tick: 30, pause: true }],
    });
    expect(r.events('paused')[0]!.tick).toBe(11);
    expect(r.events('resumed')[0]!.tick).toBe(31);
    expect(r.at(20)).toMatchObject({ tick: 20, sim_tick: 10, state: 'paused' });
    expect(r.at(20).player.pos).toEqual(r.at(10).player.pos);
    expect(r.at(20).time_left_s).toBe(r.at(10).time_left_s);
    expect(r.at(31)).toMatchObject({ sim_tick: 11, state: 'playing' });
  });
});

describe('P17 determinism', () => {
  it.each([1, 2, 3] as const)('night %i: same seed -> identical output', (night) => {
    const frames = [{ tick: 0, move: [0.3, 1] as [number, number] }, { tick: 300, pulse: true }];
    const a = JSON.stringify(run({ night, seed: 7, ticks: 4000, frames }).lines);
    expect(JSON.stringify(run({ night, seed: 7, ticks: 4000, frames }).lines)).toBe(a);
    expect(JSON.stringify(run({ night, seed: 8, ticks: 4000, frames }).lines)).not.toBe(a);
  });
  it('drifters spawn at tick 1200 on Night 2', () => {
    const r = run({ night: 2, ticks: 1200, every: 1200, scenario: { random_shades: false, random_motes: false } });
    expect(r.last.drifters.map((d) => d.id)).toEqual(['D1']);
    expect(near(r.at(0).player.pos, [0, 0, 0])).toBe(true);
  });
});
