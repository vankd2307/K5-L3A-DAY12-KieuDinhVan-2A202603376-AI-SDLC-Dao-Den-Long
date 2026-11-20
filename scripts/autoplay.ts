/**
 * Greedy bot that plays a Night through the real Game and records its inputs as a contract
 * inputs file. Replaying that file with the headless CLI must reproduce the same result:
 * evidence that each Night is playable from start to finish.
 *   npx tsx scripts/autoplay.ts <seed> <out-inputs.json> [night=1]
 */
import { writeFileSync } from 'node:fs';
import { Game, hdist, type FrameInput, type InputFrame, type Vec3 } from '../src/core';

const seed = Number(process.argv[2] ?? 1);
const out = process.argv[3] ?? 'inputs.json';
const night = Number(process.argv[4] ?? 1) as 1 | 2 | 3;
const game = new Game(seed, night);
const t = game.tuning;

// ---------------------------------------------------------------- waypoint graph per night
type XZ = [number, number];
interface Node { p: XZ; region: string }
const nodes: Node[] = [];
const edges = new Map<number, number[]>();
const add = (p: XZ, region: string) => nodes.push({ p, region }) - 1;
const link = (a: number, b: number, both = true) => {
  edges.set(a, [...(edges.get(a) ?? []), b]);
  if (both) link(b, a, false);
};
const pol = (r: number, deg: number): XZ => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180)];

let region: (p: Vec3) => string = () => 'all';
if (night === 2) {
  region = (p) => (p[0] < 35 ? 'A' : 'B');
  link(add([24, 0], 'A'), add([46, 0], 'B'));
} else if (night === 3) {
  region = (p) => (p[1] > 4.5 ? 't2' : p[1] > 2.9 ? 't1' : p[1] > 0.1 ? 'ramp' : 't0');
  const ring = Array.from({ length: 12 }, (_, i) => add(pol(33, i * 30), 't0'));
  ring.forEach((n, i) => link(n, ring[(i + 1) % 12]!));
  const t1 = Array.from({ length: 8 }, (_, i) => add(pol(18, 20 + i * 20), 't1'));
  t1.forEach((n, i) => i < 7 && link(n, t1[i + 1]!));
  for (const [deg, ringIdx, t1a, t1b] of [[30, 1, 0, 1], [150, 5, 6, 7]] as const) {
    const bottom = add(pol(31, deg), 't0');
    const top = add(pol(22, deg), 't1');
    link(ring[ringIdx]!, bottom);
    const mid = add(pol(27, deg), 'ramp');
    link(bottom, mid);
    link(mid, top);
    link(top, t1[t1a]!);
    link(top, t1[t1b]!);
  }
  link(t1[0]!, ring[0]!, false); // walk off tier 1 outward
  link(t1[7]!, ring[6]!, false);
  const pad = add([0, 13], 't1');
  link(t1[3]!, pad);
  link(t1[4]!, pad);
  const top2 = add([0, 6.4], 't2');
  link(pad, top2, false); // launch
  const a = add([5, 3], 't2');
  const b = add([5, -5], 't2');
  const below = add([0, -11], 't0');
  link(top2, a);
  link(a, b);
  link(b, below, false); // walk off tier 2
  link(below, ring[9]!);
}

function bfs(from: number, goal: number): number[] {
  const prev = new Map<number, number>([[from, -1]]);
  const q = [from];
  while (q.length) {
    const n = q.shift()!;
    if (n === goal) break;
    for (const m of edges.get(n) ?? []) if (!prev.has(m)) [prev.set(m, n), q.push(m)];
  }
  if (!prev.has(goal)) return [];
  const path: number[] = [];
  for (let n = goal; n !== -1; n = prev.get(n)!) path.unshift(n);
  return path;
}

const nearestNode = (p: Vec3, reg: string) => {
  let best = -1;
  let bd = Infinity;
  nodes.forEach((n, i) => {
    const d = Math.hypot(n.p[0] - p[0], n.p[1] - p[2]);
    if (n.region === reg && d < bd) [best, bd] = [i, d];
  });
  return best;
};

let plan: { target: string; path: number[] } = { target: '', path: [] };
let lastPos: Vec3 = [...game.player.pos];
let unstick = 0;
/** Next XZ point to walk to on the way to `to`. */
function route(to: Vec3): XZ {
  const p = game.player.pos;
  const key = `${to.join()}|${region(p)}`;
  if (plan.target !== key) {
    plan = { target: key, path: [] };
    const sameRegion = region(p) === region(to);
    if (nodes.length && !(sameRegion && (night !== 3 || hdist(p, to) < 6))) {
      const a = nearestNode(p, region(p));
      const b = nearestNode(to, region(to));
      if (a >= 0 && b >= 0) plan.path = bfs(a, b);
    }
  }
  while (plan.path.length && Math.hypot(nodes[plan.path[0]!]!.p[0] - p[0], nodes[plan.path[0]!]!.p[1] - p[2]) < 0.8) plan.path.shift();
  return plan.path.length ? nodes[plan.path[0]!]!.p : [to[0], to[2]];
}

const costTo = (pos: Vec3) => hdist(pos, game.player.pos) + (region(pos) === region(game.player.pos) ? 0 : 40);
function cheapest<T>(items: T[], pos: (x: T) => Vec3): T | undefined {
  let best: T | undefined;
  let bc = Infinity;
  for (const it of items) {
    const c = costTo(pos(it));
    if (c < bc) [best, bc] = [it, c];
  }
  return best;
}

// ---------------------------------------------------------------- play
const frames: InputFrame[] = [];
let prev: FrameInput | null = null;
const LIMIT = 60 * (game.durationS + 5);

for (let k = 0; k < LIMIT && !game.over; k++) {
  const p = game.player;
  const target = cheapest(game.lanterns.filter((l) => !l.lit), (l) => l.pos)!;
  const need = Math.min(t.lantern_cost - target.deposited, t.carry_capacity);
  const dangerous = game.shades.filter((s) => (s.state === 'chase' || s.state === 'wander') && Math.abs(s.pos[1] - p.pos[1]) < 2);
  const closest = Math.min(Infinity, ...dangerous.map((s) => hdist(s.pos, p.pos)));

  let goal: Vec3 | undefined;
  let interact = false;
  if (p.carried >= need || game.motes.length === 0) {
    if (game.lanternInReach()) interact = k % 2 === 0;
    else goal = target.pos;
  } else goal = cheapest(game.motes, (m) => m.pos)?.pos;

  // stuck detection: no progress for 90 ticks -> walk to the nearest waypoint of any region for 45 ticks
  if (k % 90 === 0) {
    if (goal && hdist(lastPos, p.pos) < 1 && p.respawnTicks === 0) {
      unstick = 45;
      plan = { target: '', path: [] };
    }
    lastPos = [...p.pos];
  }
  let move: [number, number] = [0, 0];
  if (goal) {
    let [wx, wz] = route(goal);
    if (unstick > 0 && nodes.length) {
      unstick--;
      const n = nodes.reduce((b, x) => (Math.hypot(x.p[0] - p.pos[0], x.p[1] - p.pos[2]) < Math.hypot(b.p[0] - p.pos[0], b.p[1] - p.pos[2]) ? x : b));
      [wx, wz] = Math.hypot(n.p[0] - p.pos[0], n.p[1] - p.pos[2]) > 0.5 ? n.p : [wx, wz];
    }
    let dx = wx - p.pos[0];
    let dz = wz - p.pos[2];
    const len = Math.hypot(dx, dz) || 1;
    [dx, dz] = [dx / len, dz / len];
    // steer away from nearby shades (not while walking a ramp/bridge/pad segment)
    if (plan.path.length === 0 || night === 1) {
      for (const sh of dangerous) {
        const d = hdist(sh.pos, p.pos);
        if (d > 7 || d < 1e-6) continue;
        const w = ((7 - d) / 7) * 2.5;
        dx += ((p.pos[0] - sh.pos[0]) / d) * w;
        dz += ((p.pos[2] - sh.pos[2]) / d) * w;
      }
    }
    const l2 = Math.hypot(dx, dz) || 1;
    move = [dx / l2, dz / l2]; // yaw 0: move [x, z] == world [x, z]
  }
  const dash = closest < 2.5 && game.dashReady() && k % 2 === 0;
  const pulse = closest < 1.8 && !game.dashReady() && game.pulseReady() && k % 2 === 0;
  const input: FrameInput = { move, camYawDeg: 0, jump: false, interact, pulse, dash, pause: false };

  const f: InputFrame = { tick: k };
  if (!prev || prev.move[0] !== move[0] || prev.move[1] !== move[1]) f.move = move;
  if (!prev || prev.interact !== input.interact) f.interact = input.interact;
  if (!prev || prev.pulse !== input.pulse) f.pulse = input.pulse;
  if (!prev || prev.dash !== input.dash) f.dash = input.dash;
  if (Object.keys(f).length > 1) frames.push(f);
  prev = input;
  game.step(input);
}

writeFileSync(out, JSON.stringify({ frames }));
const lit = game.lanterns.filter((l) => l.lit).length;
console.log(JSON.stringify({ night, seed, ticks: game.tick, state: game.status, score: game.score, lit: `${lit}/${game.lanterns.length}`, flames: game.player.flames }));
