import { createRng, type Rng } from './rng';
import {
  GRAVITY, INITIAL_MOTES, INITIAL_SHADES, ISLAND_RADIUS, JUMP_SPEED, LANTERN_RING_RADIUS,
  MAX_SHADES, MOTE_RESPAWN_S, SHADE_SPAWN_S, SHADE_Y, TICK_RATE, TUNING, type Tuning,
} from './tuning';
import type { FrameInput, GameEvent, GameStatus, Lantern, Player, Shade, TimedEvent, Vec3 } from './types';

export const IDLE_INPUT: FrameInput = { move: [0, 0], camYawDeg: 0, jump: false, interact: false, pulse: false };

export const secToTicks = (s: number): number => Math.round(s * TICK_RATE);
export const round3 = (v: number): number => Math.round(v * 1000) / 1000 + 0; // +0 turns -0 into 0
/** Horizontal (XZ) distance, as the contract defines all radii. */
export const hdist = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[2] - b[2]);

/**
 * Night 1 simulation. Pure and deterministic: fixed 1/60 s steps, randomness only via the seeded rng.
 * Tick model (contract B): state after construction (+ scenario) is tick 0; each step() reads the
 * input of tick k and produces tick k+1; events are stamped with k+1.
 */
export class Game {
  readonly tuning: Tuning;
  readonly rng: Rng;
  randomMotes = true;
  randomShades = true;
  tick = 0;
  status: GameStatus = 'playing';
  score = 0;
  durationS: number; // time_left_s at tick 0
  player: Player;
  lanterns: Lantern[];
  shades: Shade[] = [];
  motes: Vec3[] = [];
  shadeSerial = 0;

  private prev = { jump: false, interact: false, pulse: false };
  private pulseCooldown = 0;
  private moteTimer = 0;
  private shadeTimer = 0;
  private events: TimedEvent[] = [];

  constructor(seed: number, tuning: Tuning = TUNING) {
    this.tuning = tuning;
    this.rng = createRng(seed);
    this.durationS = tuning.night1_duration_s;
    this.player = { pos: [0, 0, 0], vy: 0, flames: tuning.flames, carried: 0, invulnTicks: 0 };
    const n = tuning.lantern_count_night1;
    this.lanterns = Array.from({ length: n }, (_, i) => {
      const a = (i * 2 * Math.PI) / n;
      return {
        id: `L${i + 1}`,
        pos: [round3(LANTERN_RING_RADIUS * Math.sin(a)), 0, round3(LANTERN_RING_RADIUS * Math.cos(a))],
        deposited: 0,
        lit: false,
      };
    });
    for (let i = 0; i < INITIAL_MOTES; i++) this.motes.push(this.randomMotePos());
    for (let i = 0; i < INITIAL_SHADES; i++) this.shades.push(this.newShade(this.randomShadePos()));
  }

  get timeLeftS(): number {
    return Math.max(0, this.durationS - this.tick / TICK_RATE);
  }

  get pulseReady(): boolean {
    return this.pulseCooldown === 0 && this.player.carried >= this.tuning.pulse_cost;
  }

  /** Nearest unlit lantern within interact_radius, or null. */
  lanternInReach(): Lantern | null {
    let best: Lantern | null = null;
    let bestD = Infinity;
    for (const l of this.lanterns) {
      if (l.lit) continue;
      const d = hdist(l.pos, this.player.pos);
      if (d <= this.tuning.interact_radius && d < bestD) {
        best = l;
        bestD = d;
      }
    }
    return best;
  }

  step(input: FrameInput): TimedEvent[] {
    if (this.status !== 'playing') return [];
    this.events = [];
    this.tick += 1;

    const jump = input.jump && !this.prev.jump;
    const interact = input.interact && !this.prev.interact;
    const pulse = input.pulse && !this.prev.pulse;
    this.prev = { jump: input.jump, interact: input.interact, pulse: input.pulse };

    const p = this.player;
    if (p.invulnTicks > 0) p.invulnTicks--;
    if (this.pulseCooldown > 0) this.pulseCooldown--;
    for (const s of this.shades) {
      if (s.state === 'stunned' && --s.stunTicks <= 0) {
        s.state = 'chase';
        s.stunTicks = 0;
      }
    }

    this.movePlayer(input, jump);
    this.pickMotes();
    if (interact) this.deposit();
    if (this.status !== 'playing') return this.events;
    if (pulse) this.doPulse();
    this.moveShades();
    this.checkHits();
    if (this.status !== 'playing') return this.events;
    this.spawn();
    if (this.durationS - this.tick / TICK_RATE <= 1e-9) this.finish('lost', 'dawn');
    return this.events;
  }

  /** Contract E snapshot (coordinates rounded to 3 decimals). `score` is an extra field. */
  snapshot(): Record<string, unknown> {
    const v = (a: Vec3) => a.map(round3);
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.tick,
      state: this.status,
      time_left_s: round3(this.timeLeftS),
      player: { pos: v(this.player.pos), flames: this.player.flames, carried: this.player.carried },
      lanterns: this.lanterns.map((l) => ({ id: l.id, pos: v(l.pos), lit: l.lit, deposited: l.deposited })),
      shades: this.shades.map((s) => ({ id: s.id, pos: v(s.pos), state: s.state })),
      motes_active: this.motes.length,
      score: this.score,
    };
  }

  newShade(pos: Vec3, id?: string): Shade {
    const sid = id ?? `S${++this.shadeSerial}`;
    const s: Shade = { id: sid, pos: [pos[0], SHADE_Y, pos[2]], state: 'chase', stunTicks: 0 };
    this.constrainShade(s);
    return s;
  }

  // ---------------------------------------------------------------- internals

  private emit(e: GameEvent): void {
    this.events.push({ ...e, tick: this.tick } as TimedEvent);
  }

  private finish(result: 'won' | 'lost', reason: 'all_lit' | 'dawn' | 'no_flames'): void {
    this.status = result;
    if (result === 'won') {
      const sc = this.tuning.score;
      this.score += Math.floor(this.timeLeftS + 1e-9) * sc.per_second_left + this.player.flames * sc.per_flame_left;
    }
    this.emit({ name: 'game_over', data: { result, reason } });
  }

  private movePlayer(input: FrameInput, jump: boolean): void {
    const p = this.player;
    let [mx, mz] = input.move;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const th = (input.camYawDeg * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    const d = this.tuning.player_speed / TICK_RATE;
    p.pos[0] += wx * d;
    p.pos[2] += wz * d;
    // fall_enabled = false: the island edge is a soft wall.
    const r = Math.hypot(p.pos[0], p.pos[2]);
    if (r > ISLAND_RADIUS) {
      p.pos[0] *= ISLAND_RADIUS / r;
      p.pos[2] *= ISLAND_RADIUS / r;
    }

    if (jump && p.pos[1] === 0 && p.vy === 0) p.vy = JUMP_SPEED;
    if (p.pos[1] > 0 || p.vy > 0) {
      p.vy -= GRAVITY / TICK_RATE;
      p.pos[1] += p.vy / TICK_RATE;
      if (p.pos[1] <= 0) {
        p.pos[1] = 0;
        p.vy = 0;
      }
    }
  }

  private pickMotes(): void {
    const p = this.player;
    for (let i = 0; i < this.motes.length && p.carried < this.tuning.carry_capacity; ) {
      if (hdist(this.motes[i]!, p.pos) <= this.tuning.pickup_radius) {
        this.motes.splice(i, 1);
        p.carried++;
        this.score += this.tuning.score.per_mote;
        this.emit({ name: 'mote_picked', data: { carried: p.carried } });
      } else i++;
    }
  }

  private deposit(): void {
    const p = this.player;
    if (p.carried <= 0) return;
    const l = this.lanternInReach();
    if (!l) return;
    const amount = Math.min(p.carried, this.tuning.lantern_cost - l.deposited);
    if (amount <= 0) return;
    p.carried -= amount;
    l.deposited += amount;
    this.emit({ name: 'deposit', data: { lantern_id: l.id, amount, deposited: l.deposited } });
    if (l.deposited >= this.tuning.lantern_cost) {
      l.lit = true;
      this.score += this.tuning.score.per_lantern;
      this.emit({ name: 'lantern_lit', data: { lantern_id: l.id } });
      if (this.lanterns.every((x) => x.lit)) this.finish('won', 'all_lit');
    }
  }

  private doPulse(): void {
    const t = this.tuning;
    const p = this.player;
    if (!this.pulseReady) return;
    p.carried -= t.pulse_cost;
    this.pulseCooldown = secToTicks(t.pulse_cooldown_s);
    const ids: string[] = [];
    for (const s of this.shades) {
      if (hdist(s.pos, p.pos) > t.pulse_radius) continue;
      s.state = 'stunned';
      s.stunTicks = secToTicks(t.pulse_stun_s);
      let dx = s.pos[0] - p.pos[0];
      let dz = s.pos[2] - p.pos[2];
      const len = Math.hypot(dx, dz);
      if (len < 1e-9) [dx, dz] = [1, 0];
      else [dx, dz] = [dx / len, dz / len];
      s.pos[0] += dx * t.pulse_push_m;
      s.pos[2] += dz * t.pulse_push_m;
      this.constrainShade(s);
      ids.push(s.id);
    }
    this.score += ids.length * t.score.per_stun;
    this.emit({ name: 'pulse', data: { stunned_ids: ids } });
  }

  private moveShades(): void {
    const step = this.tuning.shade_speed / TICK_RATE;
    const p = this.player.pos;
    for (const s of this.shades) {
      if (s.state !== 'chase') continue;
      const dx = p[0] - s.pos[0];
      const dz = p[2] - s.pos[2];
      const len = Math.hypot(dx, dz);
      if (len > 1e-9) {
        const k = Math.min(step, len) / len;
        s.pos[0] += dx * k;
        s.pos[2] += dz * k;
      }
      this.constrainShade(s);
    }
  }

  /** Keep shades on the island and out of every lantern's safe_radius. */
  private constrainShade(s: Shade): void {
    s.pos[1] = SHADE_Y;
    const r = Math.hypot(s.pos[0], s.pos[2]);
    if (r > ISLAND_RADIUS) {
      s.pos[0] *= ISLAND_RADIUS / r;
      s.pos[2] *= ISLAND_RADIUS / r;
    }
    const safe = this.tuning.safe_radius;
    for (const l of this.lanterns) {
      let dx = s.pos[0] - l.pos[0];
      let dz = s.pos[2] - l.pos[2];
      const d = Math.hypot(dx, dz);
      if (d >= safe) continue;
      if (d < 1e-9) [dx, dz] = [1, 0];
      else [dx, dz] = [dx / d, dz / d];
      s.pos[0] = l.pos[0] + dx * safe;
      s.pos[2] = l.pos[2] + dz * safe;
    }
  }

  private checkHits(): void {
    const p = this.player;
    const t = this.tuning;
    if (p.invulnTicks > 0) return;
    for (const s of this.shades) {
      if (s.state !== 'chase' || hdist(s.pos, p.pos) > t.shade_hit_radius) continue;
      p.flames -= 1;
      const dropped = Math.floor(p.carried * t.hit_drop_ratio);
      p.carried -= dropped;
      p.invulnTicks = secToTicks(t.invuln_s);
      this.emit({ name: 'player_hit', data: { by: 'shade', flames: p.flames, dropped } });
      if (p.flames <= 0) this.finish('lost', 'no_flames');
      return; // at most one hit per tick
    }
  }

  private spawn(): void {
    if (this.randomMotes && ++this.moteTimer >= secToTicks(MOTE_RESPAWN_S)) {
      this.moteTimer = 0;
      if (this.motes.length < INITIAL_MOTES) this.motes.push(this.randomMotePos());
    }
    if (this.randomShades && this.shades.length < MAX_SHADES && ++this.shadeTimer >= secToTicks(SHADE_SPAWN_S)) {
      this.shadeTimer = 0;
      const s = this.newShade(this.randomShadePos());
      this.shades.push(s);
      this.emit({ name: 'shade_spawned', data: { id: s.id } });
    }
  }

  private randomMotePos(): Vec3 {
    const rMin = 3;
    const rMax = ISLAND_RADIUS - 2;
    const r = Math.sqrt(this.rng.next() * (rMax * rMax - rMin * rMin) + rMin * rMin);
    const a = this.rng.next() * 2 * Math.PI;
    return [round3(r * Math.sin(a)), 0, round3(r * Math.cos(a))];
  }

  private randomShadePos(): Vec3 {
    let pos: Vec3 = [0, SHADE_Y, ISLAND_RADIUS - 4];
    for (let i = 0; i < 20; i++) {
      const r = 32 + this.rng.next() * 6;
      const a = this.rng.next() * 2 * Math.PI;
      pos = [round3(r * Math.sin(a)), SHADE_Y, round3(r * Math.cos(a))];
      const farFromPlayer = hdist(pos, this.player.pos) >= 15;
      const outsideSafe = this.lanterns.every((l) => hdist(pos, l.pos) >= this.tuning.safe_radius);
      if (farFromPlayer && outsideSafe) break;
    }
    return pos;
  }
}
