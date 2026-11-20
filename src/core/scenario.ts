import { FormatError, isNum, isObj } from './errors';
import type { Game } from './game';
import type { Vec3 } from './types';

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

/**
 * Contract D. Applied to a freshly constructed Game (before tick 0).
 * Emits no events and adds no score.
 */
export function applyScenario(game: Game, raw: unknown): void {
  if (!isObj(raw)) throw new FormatError('scenario: expected a JSON object');

  if (raw.player !== undefined) {
    const p = raw.player;
    if (!isObj(p)) throw new FormatError('scenario.player: expected object');
    if (p.pos !== undefined) game.player.pos = vec3(p.pos, 'scenario.player.pos');
    if (p.carried !== undefined) game.player.carried = count(p.carried, 'scenario.player.carried');
    if (p.flames !== undefined) game.player.flames = count(p.flames, 'scenario.player.flames');
  }

  if (raw.random_motes !== undefined) game.randomMotes = bool(raw.random_motes, 'scenario.random_motes');
  if (raw.random_shades !== undefined) game.randomShades = bool(raw.random_shades, 'scenario.random_shades');

  if (raw.lanterns !== undefined) {
    if (!Array.isArray(raw.lanterns)) throw new FormatError('scenario.lanterns: expected array');
    for (const [i, l] of raw.lanterns.entries()) {
      const where = `scenario.lanterns[${i}]`;
      if (!isObj(l) || typeof l.id !== 'string') throw new FormatError(`${where}: expected { id, ... }`);
      const target = game.lanterns.find((x) => x.id === l.id);
      if (!target) throw new FormatError(`${where}: unknown lantern id ${l.id}`);
      if (l.pos !== undefined) target.pos = vec3(l.pos, `${where}.pos`);
      if (l.deposited !== undefined) target.deposited = count(l.deposited, `${where}.deposited`);
      if (l.lit !== undefined) target.lit = bool(l.lit, `${where}.lit`);
    }
  }

  // motes / shades: listed => replace; random_* false and not listed => none.
  if (raw.motes !== undefined) {
    if (!Array.isArray(raw.motes)) throw new FormatError('scenario.motes: expected array');
    game.motes = raw.motes.map((m, i) => {
      const v = vec3(m, `scenario.motes[${i}]`);
      return [v[0], 0, v[2]] as Vec3;
    });
  } else if (!game.randomMotes) game.motes = [];

  if (raw.shades !== undefined) {
    if (!Array.isArray(raw.shades)) throw new FormatError('scenario.shades: expected array');
    game.shadeSerial = 0;
    const list = raw.shades.map((s, i) => {
      const where = `scenario.shades[${i}]`;
      if (!isObj(s)) throw new FormatError(`${where}: expected object`);
      if (s.id !== undefined && typeof s.id !== 'string') throw new FormatError(`${where}.id: expected string`);
      return { id: (s.id as string | undefined) ?? `S${i + 1}`, pos: vec3(s.pos, `${where}.pos`) };
    });
    for (const s of list) {
      const n = /^S(\d+)$/.exec(s.id);
      if (n) game.shadeSerial = Math.max(game.shadeSerial, Number(n[1]));
    }
    game.shades = list.map((s) => game.newShade(s.pos, s.id));
  } else if (!game.randomShades) game.shades = [];

  if (raw.time_left_s !== undefined) {
    if (!isNum(raw.time_left_s) || raw.time_left_s <= 0) throw new FormatError('scenario.time_left_s: expected number > 0');
    game.durationS = raw.time_left_s;
  }
}
