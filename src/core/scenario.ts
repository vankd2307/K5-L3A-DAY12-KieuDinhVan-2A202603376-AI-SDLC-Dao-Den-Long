import { FormatError, isNum, isObj } from './errors';
import type { Game } from './game';
import { FUEL_UNIT } from './tuning';
import type { DrifterState, ShadeState, Vec3 } from './types';

function vec3(v: unknown, where: string): Vec3 {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isNum)) throw new FormatError(`${where}: expected [x, y, z]`);
  return [v[0]!, v[1]!, v[2]!];
}
function count(v: unknown, where: string): number {
  if (!isNum(v) || !Number.isInteger(v) || v < 0) throw new FormatError(`${where}: expected integer >= 0`);
  return v;
}
function bool(v: unknown, where: string): boolean {
  if (typeof v !== 'boolean') throw new FormatError(`${where}: expected boolean`);
  return v;
}
function oneOf<T extends string>(v: unknown, allowed: readonly T[], where: string): T {
  if (typeof v !== 'string' || !allowed.includes(v as T)) throw new FormatError(`${where}: expected one of ${allowed.join(', ')}`);
  return v as T;
}
function list(v: unknown, where: string): unknown[] {
  if (!Array.isArray(v)) throw new FormatError(`${where}: expected array`);
  return v;
}
function obj(v: unknown, where: string): Record<string, unknown> {
  if (!isObj(v)) throw new FormatError(`${where}: expected object`);
  return v;
}
function optId(v: unknown, where: string): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'string') throw new FormatError(`${where}.id: expected string`);
  return v;
}
const serial = (ids: string[]) => Math.max(0, ...ids.map((id) => Number(/^\D+(\d+)$/.exec(id)?.[1] ?? 0)));

const SHADE_STATES: readonly ShadeState[] = ['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'];
const DRIFTER_STATES: readonly DrifterState[] = ['idle', 'chase', 'flee', 'removed'];

/**
 * Contract D (v1.1). Applied to a freshly constructed Game, before tick 0.
 * Emits no events and adds no score. Listed arrays replace the defaults.
 */
export function applyScenario(game: Game, raw: unknown): void {
  const sc = obj(raw, 'scenario');

  if (sc.random_motes !== undefined) game.randomMotes = bool(sc.random_motes, 'scenario.random_motes');
  if (sc.random_shades !== undefined) game.randomShades = bool(sc.random_shades, 'scenario.random_shades');
  if (sc.random_drifters !== undefined) game.randomDrifters = bool(sc.random_drifters, 'scenario.random_drifters');
  if (sc.wind_enabled !== undefined) game.windEnabled = bool(sc.wind_enabled, 'scenario.wind_enabled');

  if (sc.player !== undefined) {
    const p = obj(sc.player, 'scenario.player');
    const pl = game.player;
    if (p.pos !== undefined) {
      pl.pos = vec3(p.pos, 'scenario.player.pos');
      const g = game.map.ground(pl.pos[0], pl.pos[2]);
      pl.grounded = g !== null && Math.abs(pl.pos[1] - g) < 1e-6;
    }
    if (p.carried !== undefined) pl.carried = count(p.carried, 'scenario.player.carried');
    if (p.flames !== undefined) pl.flames = count(p.flames, 'scenario.player.flames');
    if (p.invuln_ticks !== undefined) pl.invulnTicks = count(p.invuln_ticks, 'scenario.player.invuln_ticks');
    if (p.dash_cd_ticks !== undefined) pl.dashCdTicks = count(p.dash_cd_ticks, 'scenario.player.dash_cd_ticks');
    if (p.pulse_cd_ticks !== undefined) pl.pulseCdTicks = count(p.pulse_cd_ticks, 'scenario.player.pulse_cd_ticks');
    if (p.charm_ticks !== undefined) pl.charmTicks = count(p.charm_ticks, 'scenario.player.charm_ticks');
    if (p.successful_lights !== undefined) pl.successfulLights = count(p.successful_lights, 'scenario.player.successful_lights');
  }

  if (sc.lanterns !== undefined) {
    for (const [i, raw] of list(sc.lanterns, 'scenario.lanterns').entries()) {
      const where = `scenario.lanterns[${i}]`;
      const l = obj(raw, where);
      const target = game.lanterns.find((x) => x.id === l.id);
      if (!target) throw new FormatError(`${where}: unknown lantern id ${String(l.id)}`);
      if (l.pos !== undefined) target.pos = vec3(l.pos, `${where}.pos`);
      if (l.deposited !== undefined) target.deposited = count(l.deposited, `${where}.deposited`);
      if (l.lit !== undefined) target.lit = bool(l.lit, `${where}.lit`);
      if (l.ever_lit !== undefined) target.everLit = bool(l.ever_lit, `${where}.ever_lit`);
      else if (target.lit) target.everLit = true;
      if (l.fuel !== undefined) {
        if (!isNum(l.fuel) || l.fuel < 0 || l.fuel > game.tuning.fuel_max) throw new FormatError(`${where}.fuel: expected 0..${game.tuning.fuel_max}`);
        target.fuelUnits = Math.round(l.fuel * FUEL_UNIT);
      } else if (target.lit) target.fuelUnits = game.fuelMaxUnits; // lit without fuel => 100
      if (!target.lit) target.fuelUnits = 0;
    }
  }

  if (sc.motes !== undefined) {
    game.moteSerial = 0;
    game.motes = list(sc.motes, 'scenario.motes').map((m, i) => {
      const where = `scenario.motes[${i}]`;
      if (Array.isArray(m)) return game.makeMote(vec3(m, where), 'random');
      const o = obj(m, where);
      const kind = o.kind === undefined ? 'random' : oneOf(o.kind, ['random', 'dropped'] as const, `${where}.kind`);
      const ttl = o.ttl_ticks === undefined ? 480 : count(o.ttl_ticks, `${where}.ttl_ticks`);
      const mote = game.makeMote(vec3(o.pos, `${where}.pos`), kind, kind === 'dropped' ? ttl : 0);
      const id = optId(o.id, where);
      if (id) mote.id = id;
      return mote;
    });
    game.motes.forEach((m) => (m.bornSim = -1));
  } else if (!game.randomMotes) game.motes = [];

  if (sc.shades !== undefined) {
    const shades = list(sc.shades, 'scenario.shades').map((s, i) => {
      const where = `scenario.shades[${i}]`;
      const o = obj(s, where);
      const shade = game.makeShade(vec3(o.pos, `${where}.pos`), optId(o.id, where) ?? `S${i + 1}`);
      if (o.state !== undefined) shade.state = oneOf(o.state, SHADE_STATES, `${where}.state`);
      if (o.state_ticks_left !== undefined) shade.stateTicks = count(o.state_ticks_left, `${where}.state_ticks_left`);
      if (shade.state === 'spawning' && o.state_ticks_left === undefined) shade.stateTicks = 60;
      if (shade.state === 'recoil' && o.state_ticks_left === undefined) shade.stateTicks = 60;
      if (shade.state === 'stunned' && o.state_ticks_left === undefined) shade.stateTicks = 120;
      if (o.target_lantern_id !== undefined) {
        if (typeof o.target_lantern_id !== 'string' || !game.lanterns.some((l) => l.id === o.target_lantern_id)) {
          throw new FormatError(`${where}.target_lantern_id: unknown lantern`);
        }
        shade.targetLanternId = o.target_lantern_id;
      }
      return shade;
    });
    game.shades = shades;
    game.shadeSerial = serial(shades.map((s) => s.id));
  } else if (!game.randomShades) game.shades = [];

  if (sc.drifters !== undefined) {
    const drifters = list(sc.drifters, 'scenario.drifters').map((d, i) => {
      const where = `scenario.drifters[${i}]`;
      const o = obj(d, where);
      const dr = game.makeDrifter(vec3(o.pos, `${where}.pos`), optId(o.id, where) ?? `D${i + 1}`);
      if (o.state !== undefined) dr.state = oneOf(o.state, DRIFTER_STATES, `${where}.state`);
      if (o.stolen !== undefined) dr.stolen = count(o.stolen, `${where}.stolen`);
      if (dr.state === 'flee') dr.fleeTicks = o.state_ticks_left === undefined ? 240 : count(o.state_ticks_left, `${where}.state_ticks_left`);
      return dr;
    });
    game.drifters = drifters;
    game.drifterSerial = serial(drifters.map((d) => d.id));
  }

  if (sc.charms !== undefined) {
    game.charms = list(sc.charms, 'scenario.charms').map((c, i) => {
      const where = `scenario.charms[${i}]`;
      const o = obj(c, where);
      const id = optId(o.id, where) ?? `C${i + 1}`;
      const def = game.charms.find((x) => x.id === id);
      const pos = o.pos !== undefined ? vec3(o.pos, `${where}.pos`) : def?.pos;
      if (!pos) throw new FormatError(`${where}.pos: required for a new charm`);
      const available = o.available === undefined ? true : bool(o.available, `${where}.available`);
      const respawnTicks = o.respawn_ticks !== undefined ? count(o.respawn_ticks, `${where}.respawn_ticks`) : available ? 0 : 2700;
      return { id, pos: [...pos] as Vec3, available, respawnTicks };
    });
  }

  if (sc.time_left_s !== undefined) {
    if (!isNum(sc.time_left_s) || sc.time_left_s <= 0) throw new FormatError('scenario.time_left_s: expected number > 0');
    game.durationS = sc.time_left_s;
  }
}
