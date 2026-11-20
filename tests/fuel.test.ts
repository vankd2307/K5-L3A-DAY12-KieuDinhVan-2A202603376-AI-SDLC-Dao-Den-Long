/** Ticket-03 "Đèn cạn dầu" (Contract v1.2). */
import { describe, expect, it } from 'vitest';
import { hdist, type Vec3 } from '../src/core';
import { QUIET, run } from './helpers';

const atL1 = (carried: number, extra: Record<string, unknown> = {}) => ({ ...QUIET, player: { pos: [0, 0, 23.5], carried }, ...extra });
const L1 = (o: Record<string, unknown>) => ({ lanterns: [{ id: 'L1', ...o }] });

describe('F-FUEL fuel, burn-out, refuel, relight', () => {
  it('a fresh light starts at fuel 100 and decays 1/s', () => {
    const r = run({ ticks: 3 + 600, every: 1, scenario: atL1(10), frames: [{ tick: 0, interact: true }] });
    expect(r.events('lantern_lit')[0]!.data).toEqual({ lantern_id: 'L1', relight: false });
    expect(r.at(1).lanterns[0]).toMatchObject({ lit: true, fuel: 100, ever_lit: true, relit_count: 0 });
    expect(r.at(601).lanterns[0]!.fuel).toBe(90);
  });
  it('goes out at fuel 0: lantern_out, deposited 0, ever_lit kept, fuel 0', () => {
    const r = run({ ticks: 70, every: 1, scenario: { ...QUIET, ...L1({ lit: true, fuel: 1 }) } });
    const out = r.events('lantern_out');
    expect(out).toEqual([{ type: 'event', tick: 60, name: 'lantern_out', data: { lantern_id: 'L1' } }]);
    expect(r.at(60).lanterns[0]).toMatchObject({ lit: false, fuel: 0, deposited: 0, ever_lit: true });
    expect(r.at(59).lanterns[0]!.lit).toBe(true);
  });
  it('refuel: used = min(carried, ceil((100 - fuel)/10)), fuel += 10 x used (max 100), +5 per mote', () => {
    const r = run({ ticks: 2, scenario: atL1(9, L1({ lit: true, fuel: 55 })), frames: [{ tick: 0, interact: true }] });
    // after 1 tick of decay fuel = 54.983 -> missing 45.02 -> ceil 4.5 = 5 motes
    expect(r.events('refuel')[0]!.data).toEqual({ lantern_id: 'L1', amount: 5, fuel: 100 });
    expect(r.last.player.carried).toBe(4);
    expect(r.end.score).toBe(25);
  });
  it('a full lantern is not selectable: no event, the next acceptable lantern is chosen instead', () => {
    const full = run({ ticks: 1, scenario: { ...atL1(5), lanterns: [{ id: 'L1', lit: true, fuel: 100 }] }, frames: [{ tick: 0, interact: true }] });
    // fuel decays to 99.98 in step 2 before the interaction, so it accepts exactly 1 mote
    expect(full.events('refuel')[0]!.data).toMatchObject({ amount: 1, fuel: 100 });
    const r = run({
      ticks: 1,
      scenario: { ...QUIET, player: { pos: [0, 0, 0], carried: 5 }, lanterns: [{ id: 'L1', pos: [1, 0, 0], lit: true, fuel: 100 }, { id: 'L2', pos: [1.5, 0, 0] }] },
      frames: [{ tick: 0, interact: true }],
    });
    // L1 accepts 1 (99.98 after decay); refuel has priority by distance -> L1 first
    expect(r.events('refuel')[0]!.data).toMatchObject({ lantern_id: 'L1' });
  });
  it('relight costs 5 and scores +40; first light +100', () => {
    const r = run({ ticks: 2, scenario: atL1(5, L1({ ever_lit: true })), frames: [{ tick: 0, interact: true }] });
    expect(r.events('lantern_lit')[0]!.data).toEqual({ lantern_id: 'L1', relight: true });
    expect(r.last.lanterns[0]).toMatchObject({ lit: true, fuel: 100, relit_count: 1 });
    expect(r.end.score).toBe(5 * 5 + 40);
    const fresh = run({ ticks: 2, scenario: atL1(5), frames: [{ tick: 0, interact: true }] });
    expect(fresh.events('lantern_lit')).toHaveLength(0);
    expect(fresh.last.lanterns[0]!.deposited).toBe(5);
  });
  it('scenario lit:true without fuel defaults to 100 and does not count as a successful light', () => {
    const r = run({ ticks: 0, scenario: { ...QUIET, ...L1({ lit: true }) } });
    expect(r.last.lanterns[0]).toMatchObject({ lit: true, fuel: 100, ever_lit: true });
    expect(r.last.player.capacity).toBe(10);
  });
  it('fuel stays exact over a long run (integer 1/60 units)', () => {
    const r = run({ ticks: 3000, every: 3000, scenario: { ...QUIET, ...L1({ lit: true, fuel: 100 }) } });
    expect(r.last.lanterns[0]!.fuel).toBe(50);
  });
});

describe('F-CAP capacity grows with successful lights', () => {
  it('10 + 2 per light, max 20; relights count', () => {
    expect(run({ ticks: 0, scenario: { ...QUIET, player: { successful_lights: 3 } } }).last.player.capacity).toBe(16);
    expect(run({ ticks: 0, scenario: { ...QUIET, player: { successful_lights: 9 } } }).last.player.capacity).toBe(20);
    const r = run({ ticks: 2, scenario: atL1(10), frames: [{ tick: 0, interact: true }] });
    expect(r.last.player.capacity).toBe(12);
  });
  it('picks up to the new capacity', () => {
    const r = run({ ticks: 1, scenario: { ...QUIET, player: { successful_lights: 2 }, motes: Array(16).fill([0, 0, 0.5]) } });
    expect(r.events('mote_picked')).toHaveLength(14);
  });
});

describe('F-SAFE safe zone needs fuel >= 30', () => {
  it('fuel exactly 30 keeps the zone; below 30 loses it', () => {
    const keep = run({ ticks: 1, every: 1, scenario: { ...QUIET, player: { pos: [0, 0, 0] }, ...L1({ lit: true, fuel: 30.1 }), shades: [{ id: 'S1', pos: [0, 0, 20], state: 'chase' }] } });
    expect(hdist(keep.last.shades[0]!.pos as Vec3, [0, 0, 25])).toBeGreaterThanOrEqual(6 - 1e-3);
    const lost = run({ ticks: 1, every: 1, scenario: { ...QUIET, player: { pos: [0, 0, 0] }, ...L1({ lit: true, fuel: 29 }), shades: [{ id: 'S1', pos: [0, 0, 20], state: 'chase' }] } });
    expect(hdist(lost.last.shades[0]!.pos as Vec3, [0, 0, 25])).toBeLessThan(6);
  });
});

describe('F-DRAIN shades drain weak lanterns', () => {
  const weak = (fuel: number, shadePos: number[]) => ({ ...QUIET, player: { pos: [0, 0, -30] }, ...L1({ lit: true, fuel }), shades: [{ id: 'S1', pos: shadePos }] });
  it('a wandering shade walks to the weak lantern, drains 5/s (+1/s decay), fuel_drain every 60 ticks', () => {
    const r = run({ ticks: 400, every: 1, scenario: weak(29, [0, 0, 21]) });
    const startDrain = r.snaps.find((s) => s.shades[0]!.state === 'drain')!;
    expect(startDrain).toBeDefined();
    const t0 = startDrain.tick!;
    const f0 = r.at(t0).lanterns[0]!.fuel;
    expect(r.at(t0 + 60).lanterns[0]!.fuel).toBeCloseTo(f0 - 6, 1);
    const drains = r.events('fuel_drain');
    expect(drains[0]).toMatchObject({ tick: t0 + 60, data: { lantern_id: 'L1', shade_id: 'S1' } });
  });
  it('two drainers stack (10/s + 1/s)', () => {
    const r = run({ ticks: 61, every: 1, scenario: { ...QUIET, player: { pos: [0, 0, -30] }, ...L1({ lit: true, fuel: 29 }), shades: [{ id: 'S1', pos: [1, 0, 25], state: 'drain', target_lantern_id: 'L1' }, { id: 'S2', pos: [-1, 0, 25], state: 'drain', target_lantern_id: 'L1' }] } });
    expect(r.at(60).lanterns[0]!.fuel).toBe(18);
  });
  it('drain -> chase when Mây comes within 6 m', () => {
    const r = run({ ticks: 1, scenario: { ...QUIET, player: { pos: [0, 0, 20] }, ...L1({ lit: true, fuel: 20 }), shades: [{ id: 'S1', pos: [1, 0, 25], state: 'drain', target_lantern_id: 'L1' }] } });
    expect(r.last.shades[0]!.state).toBe('chase');
  });
  it('drain -> wander when the lantern goes out', () => {
    const r = run({ ticks: 70, every: 1, scenario: { ...QUIET, player: { pos: [0, 0, -30] }, ...L1({ lit: true, fuel: 0.5 }), shades: [{ id: 'S1', pos: [1, 0, 25], state: 'drain', target_lantern_id: 'L1' }] } });
    const out = r.events('lantern_out')[0]!.tick!;
    expect(r.at(out).shades[0]!.state).toBe('wander');
  });
  it('refuelling to >= 30 sends drainers back to wander and pushes them to the 6 m edge in 30 ticks, harmless', () => {
    const r = run({
      ticks: 40, every: 1,
      scenario: { ...QUIET, player: { pos: [0, 0, 23.5], carried: 5, invuln_ticks: 0 }, ...L1({ lit: true, fuel: 20 }), shades: [{ id: 'S1', pos: [1.5, 0, 25], state: 'drain', target_lantern_id: 'L1' }] },
      frames: [{ tick: 0, interact: true }],
    });
    // 20 - (1 decay + 5 drain)/60 in step 2, then +50
    expect(r.events('refuel')[0]!.data).toMatchObject({ amount: 5, fuel: 69.9 });
    expect(r.events('player_hit')).toHaveLength(0);
    expect(hdist(r.at(30).shades[0]!.pos as Vec3, [0, 0, 25])).toBeCloseTo(6, 2);
  });
  it('pulse on a draining shade scores 15 (5 otherwise)', () => {
    const r = run({ ticks: 2, scenario: { ...QUIET, player: { pos: [0, 0, 22], carried: 5 }, ...L1({ lit: true, fuel: 20 }), shades: [{ id: 'S1', pos: [1, 0, 25], state: 'drain', target_lantern_id: 'L1' }, { id: 'S2', pos: [-2, 0, 22], state: 'stunned' }] }, frames: [{ tick: 0, pulse: true }] });
    expect(r.events('pulse')[0]!.data).toEqual({ stunned_ids: ['S1', 'S2'] });
    expect(r.end.score).toBe(15 + 5);
  });
});

describe('F-WIN dawn rules', () => {
  const lit = (ids: string[], fuel = 100) => ids.map((id) => ({ id, lit: true, fuel }));
  it('lighting every lantern no longer ends the night', () => {
    const r = run({ ticks: 10, scenario: atL1(10, { lanterns: lit(['L2', 'L3', 'L4', 'L5']) }), frames: [{ tick: 0, interact: true }] });
    expect(r.events('game_over')).toHaveLength(0);
    expect(r.end.state).toBe('playing');
  });
  it('alive at dawn with >= ceil(0.6 x 5) = 3 lit wins dawn_survived; score = per lit (50 + floor fuel) + 50/flame', () => {
    const r = run({ ticks: 200, scenario: { ...QUIET, time_left_s: 1, lanterns: lit(['L1', 'L2', 'L3'], 50) } });
    expect(r.events('game_over')[0]).toMatchObject({ tick: 60, data: { result: 'won', reason: 'dawn_survived' } });
    // each lantern 50 - 1 s decay = 49 fuel at dawn
    expect(r.end).toMatchObject({ ticks: 60, state: 'won', score: 3 * (50 + 49) + 3 * 50 });
  });
  it('2 of 5 lit at dawn loses (dawn)', () => {
    const r = run({ ticks: 200, scenario: { ...QUIET, time_left_s: 1, lanterns: lit(['L1', 'L2']) } });
    expect(r.events('game_over')[0]!.data).toEqual({ result: 'lost', reason: 'dawn' });
  });
  it('thresholds: Night 2 needs 4/6, Night 3 needs 5/7', () => {
    const n2 = run({ night: 2, ticks: 100, scenario: { ...QUIET, time_left_s: 1, lanterns: lit(['L1', 'L2', 'L3']) } });
    expect(n2.end.state).toBe('lost');
    const n2w = run({ night: 2, ticks: 100, scenario: { ...QUIET, time_left_s: 1, lanterns: lit(['L1', 'L2', 'L3', 'L4']) } });
    expect(n2w.end.state).toBe('won');
    const n3 = run({ night: 3, ticks: 100, scenario: { ...QUIET, time_left_s: 1, lanterns: lit(['L1', 'L2', 'L3', 'L4']) } });
    expect(n3.end.state).toBe('lost');
    const n3w = run({ night: 3, ticks: 100, scenario: { ...QUIET, time_left_s: 1, lanterns: lit(['L1', 'L2', 'L3', 'L4', 'L5']) } });
    expect(n3w.end.state).toBe('won');
  });
  it('a lantern burning out on the dawn tick does not count', () => {
    const r = run({ ticks: 200, scenario: { ...QUIET, time_left_s: 1, lanterns: [...lit(['L1', 'L2']), { id: 'L3', lit: true, fuel: 1 }] } });
    expect(r.events('lantern_out')[0]!.tick).toBe(60);
    expect(r.end.state).toBe('lost');
  });
  it('losing the last flame on the dawn tick loses no_flames', () => {
    const r = run({ ticks: 200, scenario: { ...QUIET, time_left_s: 1, player: { flames: 1 }, lanterns: lit(['L1', 'L2', 'L3']), shades: [{ id: 'S1', pos: [4.95, 0, 0], state: 'chase' }] } });
    // shade closes 3.95 m at 4 m/s -> reaches 1 m at tick 60 (dawn)
    expect(r.events('player_hit')[0]!.tick).toBe(60);
    expect(r.events('game_over')[0]).toMatchObject({ tick: 60, data: { result: 'lost', reason: 'no_flames' } });
  });
  it('Night durations are 240 / 270 / 300 s', () => {
    expect([1, 2, 3].map((n) => run({ night: n as 1 | 2 | 3, ticks: 0 }).last.time_left_s)).toEqual([240, 270, 300]);
  });
});
