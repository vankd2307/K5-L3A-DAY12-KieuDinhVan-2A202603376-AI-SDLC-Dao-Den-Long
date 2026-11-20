/**
 * Greedy bot that plays Night 1 through the real Game and records its inputs as a contract
 * inputs file. Replaying that file with the headless CLI must reproduce the same result,
 * which is the evidence that the game is playable from start to win.
 *   npx tsx scripts/autoplay.ts <seed> <out-inputs.json>
 */
import { writeFileSync } from 'node:fs';
import { Game, hdist, type FrameInput, type InputFrame, type Vec3 } from '../src/core';

const seed = Number(process.argv[2] ?? 1);
const out = process.argv[3] ?? 'inputs.json';
const game = new Game(seed);
const t = game.tuning;
const frames: InputFrame[] = [];
let prev: FrameInput | null = null;

function toward(target: Vec3): [number, number] {
  const dx = target[0] - game.player.pos[0];
  const dz = target[2] - game.player.pos[2];
  const len = Math.hypot(dx, dz) || 1;
  return [dx / len, dz / len]; // yaw 0: move [x,z] == world [x,z]
}

function nearest<T>(items: T[], pos: (x: T) => Vec3): T | undefined {
  let best: T | undefined;
  let bd = Infinity;
  for (const it of items) {
    const d = hdist(pos(it), game.player.pos);
    if (d < bd) [best, bd] = [it, d];
  }
  return best;
}

for (let k = 0; k < 60 * 400 && game.status === 'playing'; k++) {
  const p = game.player;
  const unlit = game.lanterns.filter((l) => !l.lit);
  const target = nearest(unlit, (l) => l.pos)!;
  const need = t.lantern_cost - target.deposited;
  const threat = game.shades.some((s) => s.state === 'chase' && hdist(s.pos, p.pos) < 3);

  let move: [number, number] = [0, 0];
  let interact = false;
  if (p.carried >= Math.min(need, t.carry_capacity) || game.motes.length === 0) {
    if (game.lanternInReach()) interact = k % 2 === 0;
    else move = toward(target.pos);
  } else {
    const m = nearest(game.motes, (x) => x);
    if (m) move = toward(m);
  }
  const input: FrameInput = { move, camYawDeg: 0, jump: false, interact, pulse: threat && k % 2 === 0 };

  const f: InputFrame = { tick: k };
  if (!prev || prev.move[0] !== move[0] || prev.move[1] !== move[1]) f.move = move;
  if (!prev || prev.interact !== input.interact) f.interact = input.interact;
  if (!prev || prev.pulse !== input.pulse) f.pulse = input.pulse;
  if (Object.keys(f).length > 1) frames.push(f);
  prev = input;
  game.step(input);
}

writeFileSync(out, JSON.stringify({ frames }));
console.log(JSON.stringify({ seed, ticks: game.tick, state: game.status, score: game.score, frames: frames.length }));
