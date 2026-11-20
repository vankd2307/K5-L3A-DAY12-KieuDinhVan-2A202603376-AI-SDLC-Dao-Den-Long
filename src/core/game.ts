import { NIGHTS, type NightMap } from './maps';
import { createRng, type Rng } from './rng';
import { OWN, STD, TICK_RATE, TUNING, type Tuning } from './tuning';
import type {
  Charm, Drifter, FrameInput, GameEvent, GameStatus, Lantern, Mote, Player, Shade, TimedEvent, Vec3,
} from './types';

export const IDLE_INPUT: FrameInput = {
  move: [0, 0], camYawDeg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false,
};

export const secToTicks = (s: number): number => Math.round(s * TICK_RATE);
export const round3 = (v: number): number => Math.round(v * 1000) / 1000 + 0; // +0 turns -0 into 0
/** Horizontal (XZ) distance. */
export const hdist = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[2] - b[2]);
const dist3 = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const unit = (x: number, z: number): [number, number] => {
  const l = Math.hypot(x, z);
  return l < 1e-9 ? [1, 0] : [x / l, z / l];
};
const idNum = (id: string): number => Number(id.replace(/^\D+/, '')) || 0;
const DT = 1 / TICK_RATE;

type Buttons = { jump: boolean; interact: boolean; pulse: boolean; dash: boolean; pause: boolean };

/**
 * One Night, simulated deterministically (fixed 1/60 s, seeded rng only).
 * step() follows the mandatory 12-step tick order of Ticket-02.
 */
export class Game {
  readonly tuning: Tuning;
  readonly map: NightMap;
  readonly rng: Rng;
  randomMotes = true;
  randomShades = true;
  randomDrifters: boolean;
  windEnabled: boolean;

  tick = 0; // steps executed (keeps counting while paused)
  simTick = 0; // simulated steps
  status: GameStatus = 'playing';
  result: 'won' | 'lost' | null = null;
  score = 0;
  durationS: number;
  player: Player;
  lanterns: Lantern[];
  shades: Shade[] = [];
  motes: Mote[] = [];
  drifters: Drifter[] = [];
  charms: Charm[];
  wind = { active: false, dirDeg: 0, ticks: 0 };
  shadeSerial = 0;
  moteSerial = 0;
  drifterSerial = 0;

  private prev: Buttons = { jump: false, interact: false, pulse: false, dash: false, pause: false };
  private events: TimedEvent[] = [];
  private litThisTick: Lantern[] = [];

  constructor(seed: number, night: 1 | 2 | 3 = 1, tuning: Tuning = TUNING) {
    this.tuning = tuning;
    this.map = NIGHTS[night];
    this.rng = createRng(seed);
    this.durationS = this.map.durationS;
    this.randomDrifters = this.map.drifters;
    this.windEnabled = this.map.wind;
    this.player = this.freshPlayer();
    this.lanterns = this.map.lanterns.map((l) => ({ id: l.id, pos: [...l.pos], deposited: 0, lit: false }));
    this.charms = this.map.charms.map((p, i) => ({ id: `C${i + 1}`, pos: [...p], available: true, respawnTicks: 0 }));
    // 20 random motes at 20 distinct spawn points
    const idx = this.map.motePoints.map((_, i) => i);
    for (let i = 0; i < Math.min(STD.moteInitial, idx.length); i++) {
      const j = i + Math.floor(this.rng.next() * (idx.length - i));
      [idx[i], idx[j]] = [idx[j]!, idx[i]!];
      this.addRandomMote(idx[i]!);
    }
  }

  get night(): 1 | 2 | 3 {
    return this.map.night;
  }

  get timeLeftS(): number {
    return Math.max(0, this.durationS - this.simTick / TICK_RATE);
  }

  get over(): boolean {
    return this.result !== null;
  }

  pulseReady(): boolean {
    const p = this.player;
    return p.pulseCdTicks === 0 && p.carried >= this.tuning.pulse_cost && p.respawnTicks === 0;
  }

  dashReady(): boolean {
    const p = this.player;
    return p.dashTicks === 0 && (p.dashCdTicks === 0 || p.charmTicks > 0) && p.respawnTicks === 0;
  }

  /** Nearest unlit lantern within interact_radius (ties: smaller id). */
  lanternInReach(): Lantern | null {
    let best: Lantern | null = null;
    let bestD = Infinity;
    const p = this.player.pos;
    for (const l of this.lanterns) {
      if (l.lit || Math.abs(l.pos[1] - p[1]) > STD.pickupHeight) continue;
      const d = hdist(l.pos, p);
      if (d <= this.tuning.interact_radius && d < bestD - 1e-9) {
        best = l;
        bestD = d;
      }
    }
    return best;
  }

  /** Wind warning for the renderer: ticks until the next gust, or -1 if none soon. */
  windWarning(): number {
    if (!this.windEnabled || this.wind.active) return -1;
    const left = STD.windEvery - (this.simTick % STD.windEvery);
    return left <= STD.windWarnTicks ? left : -1;
  }

  step(input: FrameInput): TimedEvent[] {
    if (this.over) return [];
    this.events = [];
    this.tick += 1;
    const edge = (k: keyof Buttons) => input[k] && !this.prev[k];
    const e: Buttons = { jump: edge('jump'), interact: edge('interact'), pulse: edge('pulse'), dash: edge('dash'), pause: edge('pause') };
    this.prev = { jump: input.jump, interact: input.interact, pulse: input.pulse, dash: input.dash, pause: input.pause };

    // 1. input / pause
    if (e.pause) {
      const pausing = this.status !== 'paused';
      this.status = pausing ? 'paused' : 'playing';
      this.emit(pausing ? { name: 'paused', data: {} } : { name: 'resumed', data: {} });
      if (pausing) return this.events;
    } else if (this.status === 'paused') return this.events;

    // 2. timers
    this.simTick += 1;
    this.timers();
    // 3. player movement, falling
    this.movePlayer(input, e.jump, e.dash);
    // 4. pickups
    this.pickups();
    // 5. lanterns
    if (e.interact) this.deposit();
    // 6. safe zones
    this.updateSafeZones();
    // 7. pulse
    if (e.pulse) this.doPulse();
    // 8. shades and drifters move
    this.moveShades();
    this.moveDrifters();
    // 9. contacts: drifters steal first, then shades hit (ascending id)
    this.drifterContacts();
    this.shadeContacts();
    // 10. scheduled spawns
    this.spawns();
    // 11. win / lose
    this.checkEnd();
    return this.events;
  }

  snapshot(): Record<string, unknown> {
    const v = (a: readonly number[]) => a.map(round3);
    const s = (ticks: number) => round3(ticks / TICK_RATE);
    const p = this.player;
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      state: this.status,
      night: this.night,
      time_left_s: round3(this.timeLeftS),
      wind: { active: this.wind.active, dir_deg: this.wind.active ? round3(this.wind.dirDeg) : null },
      player: {
        pos: v(p.pos), vel: v(p.vel), grounded: p.grounded, invuln: p.invulnTicks > 0,
        flames: p.flames, carried: p.carried,
        dash_cd_s: s(p.dashCdTicks), pulse_cd_s: s(p.pulseCdTicks), charm_s: s(p.charmTicks),
      },
      lanterns: this.lanterns.map((l) => ({ id: l.id, pos: v(l.pos), lit: l.lit, deposited: l.deposited })),
      shades: this.shades.map((x) => ({ id: x.id, pos: v(x.pos), state: x.state })),
      motes: this.motes.map((m) => ({ id: m.id, pos: v(m.pos), kind: m.kind, ttl_s: m.kind === 'dropped' ? s(m.ttl) : null })),
      motes_active: this.motes.length,
      drifters: this.drifters.map((d) => ({ id: d.id, pos: v(d.pos), state: d.state, stolen: d.stolen })),
      charms: this.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: s(c.respawnTicks) })),
      score: this.score,
    };
  }

  // ------------------------------------------------------------ factories (also used by scenario)

  freshPlayer(): Player {
    return {
      pos: [...this.map.start], vel: [0, 0, 0], grounded: true, facing: [0, 1],
      flames: this.tuning.flames, carried: 0, invulnTicks: 0, dashCdTicks: 0, dashTicks: 0, dashDir: [0, 1],
      pulseCdTicks: 0, charmTicks: 0, launch: null, respawnTicks: 0,
    };
  }

  makeShade(pos: Vec3, id?: string): Shade {
    const g = this.map.ground(pos[0], pos[2]);
    return {
      id: id ?? `S${++this.shadeSerial}`, pos: [pos[0], (g ?? pos[1] - OWN.shadeY) + OWN.shadeY, pos[2]],
      state: 'wander', stateTicks: 0, pushTicks: 0, dir: [1, 0], evictTicks: 0, evictStep: [0, 0], target: null,
    };
  }

  makeDrifter(pos: Vec3, id?: string): Drifter {
    const g = this.map.ground(pos[0], pos[2]);
    return { id: id ?? `D${++this.drifterSerial}`, pos: [pos[0], (g ?? 0) + OWN.drifterY, pos[2]], state: 'idle', stolen: 0, fleeTicks: 0, target: null };
  }

  makeMote(pos: Vec3, kind: Mote['kind'], ttl = 0, point = -1): Mote {
    return { id: `M${++this.moteSerial}`, pos: [...pos], kind, ttl, bornSim: this.simTick, point };
  }

  // ------------------------------------------------------------ steps

  private emit(e: GameEvent): void {
    this.events.push({ ...e, tick: this.tick } as TimedEvent);
  }

  private timers(): void {
    const p = this.player;
    if (p.invulnTicks > 0) p.invulnTicks--;
    if (p.dashCdTicks > 0) p.dashCdTicks--;
    if (p.pulseCdTicks > 0) p.pulseCdTicks--;
    if (p.charmTicks > 0) p.charmTicks--;
    for (const s of this.shades) {
      if (s.state !== 'wander' && s.state !== 'chase' && s.stateTicks > 0 && --s.stateTicks === 0) {
        s.state = 'wander';
        s.pushTicks = 0;
      }
    }
    for (const m of this.motes) if (m.kind === 'dropped') m.ttl--;
    this.motes = this.motes.filter((m) => m.kind !== 'dropped' || m.ttl > 0);
    for (const c of this.charms) if (!c.available && --c.respawnTicks <= 0) [c.available, c.respawnTicks] = [true, 0];
    for (const d of this.drifters) if (d.state === 'flee' && --d.fleeTicks <= 0) [d.state, d.stolen] = ['removed', 0];
    if (this.wind.active && --this.wind.ticks <= 0) this.wind.active = false;
    if (this.windEnabled && this.simTick % STD.windEvery === 0) {
      this.wind = { active: true, dirDeg: round3(this.rng.next() * 360), ticks: STD.windTicks };
    }
  }

  private movePlayer(input: FrameInput, jump: boolean, dash: boolean): void {
    const p = this.player;
    const t = this.tuning;
    const map = this.map;
    if (p.respawnTicks > 0) {
      if (--p.respawnTicks === 0) {
        const keep = { flames: p.flames, carried: 0 };
        this.player = { ...this.freshPlayer(), ...keep, invulnTicks: secToTicks(t.invuln_s) };
      } else p.vel = [0, 0, 0];
      return;
    }

    let [mx, mz] = input.move;
    const len = Math.hypot(mx, mz);
    if (len > 1) [mx, mz] = [mx / len, mz / len];
    const th = (input.camYawDeg * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    const moving = Math.hypot(wx, wz) > 1e-9;
    if (moving) p.facing = unit(wx, wz);

    if (dash && this.dashReady()) {
      p.dashDir = p.launch ? unit(...p.launch) : moving ? unit(wx, wz) : [...p.facing];
      p.dashTicks = secToTicks(t.dash_duration_s);
      p.dashCdTicks = p.charmTicks > 0 ? 0 : secToTicks(t.dash_cooldown_s);
      this.emit({ name: 'dash', data: {} });
    }

    // horizontal velocity
    let hx: number;
    let hz: number;
    const dashing = p.dashTicks > 0;
    if (dashing) {
      [hx, hz] = [p.dashDir[0] * t.dash_speed, p.dashDir[1] * t.dash_speed];
      p.dashTicks--;
    } else if (p.launch) [hx, hz] = p.launch;
    else {
      const speed = p.charmTicks > 0 ? STD.charmSpeed : t.player_speed;
      [hx, hz] = [wx * speed, wz * speed];
    }
    if (this.wind.active) {
      const a = (this.wind.dirDeg * Math.PI) / 180;
      hx += Math.cos(a) * STD.windSpeed;
      hz += Math.sin(a) * STD.windSpeed;
    }

    // vertical velocity
    let vy = p.vel[1];
    if (dashing) vy = 0; // dash keeps altitude
    else {
      if (jump && p.grounded) {
        vy = STD.jumpSpeed;
        p.grounded = false;
      }
      if (!p.grounded) vy -= STD.gravity * DT;
    }

    // horizontal move with walls (ledges higher than stepUp, the tower)
    const canStand = (x: number, z: number) => {
      if (map.solid(x, z)) return false;
      const g = map.ground(x, z);
      return g === null || g <= p.pos[1] + OWN.stepUp;
    };
    const nx = p.pos[0] + hx * DT;
    const nz = p.pos[2] + hz * DT;
    if (canStand(nx, nz)) [p.pos[0], p.pos[2]] = [nx, nz];
    else if (canStand(nx, p.pos[2])) p.pos[0] = nx;
    else if (canStand(p.pos[0], nz)) p.pos[2] = nz;

    // vertical move, landing, walking off ledges
    p.pos[1] += vy * DT;
    const g = map.ground(p.pos[0], p.pos[2]);
    if (g !== null && p.pos[1] <= g && vy <= 0) {
      p.pos[1] = g;
      vy = 0;
      p.grounded = true;
      p.launch = null;
    } else if (p.grounded) {
      if (g !== null && p.pos[1] - g <= OWN.snapDown) p.pos[1] = g;
      else p.grounded = false;
    }
    p.vel = [hx, vy, hz];

    // launch pads
    if (p.grounded) {
      for (const pad of map.pads) {
        if (hdist(pad.pos, p.pos) <= pad.radius && Math.abs(p.pos[1] - pad.pos[1]) < 1e-6) {
          p.vel[1] = pad.vy;
          p.launch = [...pad.hv];
          p.grounded = false;
          break;
        }
      }
    }

    // fell off the island: once, ignores invulnerability
    if (p.pos[1] < STD.fallY) {
      const lost = p.carried;
      p.flames -= 1;
      p.carried = 0;
      p.respawnTicks = STD.respawnWait;
      p.dashTicks = 0;
      p.launch = null;
      p.vel = [0, 0, 0];
      this.emit({ name: 'player_hit', data: { by: 'fall', flames: p.flames, dropped: 0, lost } });
    }
  }

  private pickups(): void {
    const p = this.player;
    if (p.respawnTicks > 0) return;
    const r = this.tuning.pickup_radius;
    const near = (pos: Vec3) => hdist(pos, p.pos) <= r && Math.abs(pos[1] - p.pos[1]) <= STD.pickupHeight;
    this.motes = this.motes.filter((m) => {
      if (p.carried >= this.tuning.carry_capacity || m.bornSim >= this.simTick || !near(m.pos)) return true;
      p.carried++;
      this.emit({ name: 'mote_picked', data: { carried: p.carried } });
      return false;
    });
    for (const c of this.charms) {
      if (!c.available || !near(c.pos)) continue;
      c.available = false;
      c.respawnTicks = STD.charmRespawn;
      p.charmTicks = STD.charmTicks;
      this.emit({ name: 'charm_picked', data: { charm_id: c.id, charm_ticks: STD.charmTicks } });
    }
  }

  private deposit(): void {
    const p = this.player;
    if (p.carried <= 0 || p.respawnTicks > 0) return;
    const l = this.lanternInReach();
    if (!l) return;
    const amount = Math.min(p.carried, this.tuning.lantern_cost - l.deposited);
    if (amount <= 0) return;
    p.carried -= amount;
    l.deposited += amount;
    this.score += amount * this.tuning.score.per_mote;
    this.emit({ name: 'deposit', data: { lantern_id: l.id, amount, deposited: l.deposited } });
    if (l.deposited >= this.tuning.lantern_cost) {
      l.lit = true;
      this.score += this.tuning.score.per_lantern;
      this.litThisTick.push(l);
      this.emit({ name: 'lantern_lit', data: { lantern_id: l.id } });
    }
  }

  private updateSafeZones(): void {
    const safe = this.tuning.safe_radius;
    for (const l of this.litThisTick) {
      for (const s of this.shades) {
        const d = hdist(s.pos, l.pos);
        if (d >= safe) continue;
        const [ux, uz] = unit(s.pos[0] - l.pos[0], s.pos[2] - l.pos[2]);
        s.evictTicks = STD.evictTicks;
        s.evictStep = [(ux * (safe - d)) / STD.evictTicks, (uz * (safe - d)) / STD.evictTicks];
      }
    }
    this.litThisTick = [];
    for (const s of this.shades) {
      if (s.evictTicks <= 0) continue;
      s.pos[0] += s.evictStep[0];
      s.pos[2] += s.evictStep[1];
      s.evictTicks--;
      this.setShadeY(s);
    }
  }

  private doPulse(): void {
    const t = this.tuning;
    const p = this.player;
    if (!this.pulseReady()) return;
    p.carried -= t.pulse_cost;
    p.pulseCdTicks = secToTicks(t.pulse_cooldown_s);
    const c: Vec3 = [p.pos[0], p.pos[1] + STD.pulseCenterY, p.pos[2]];
    const ids: string[] = [];
    for (const s of this.shades) {
      if (dist3(c, s.pos) > t.pulse_radius) continue;
      s.state = 'stunned';
      s.stateTicks = secToTicks(t.pulse_stun_s);
      s.pushTicks = STD.pulsePushTicks;
      s.dir = unit(s.pos[0] - p.pos[0], s.pos[2] - p.pos[2]);
      ids.push(s.id);
    }
    this.score += ids.length * t.score.per_stun;
    for (const d of this.drifters) {
      if (dist3(c, d.pos) > t.pulse_radius) continue;
      if (d.state === 'chase') {
        d.state = 'flee';
        d.fleeTicks = STD.drifterFleeTicks;
      } else if (d.state === 'flee' && d.stolen > 0) {
        const amount = d.stolen;
        for (let i = 0; i < amount; i++) this.dropMote(d.pos, 0, 0.6);
        d.stolen = 0;
        d.fleeTicks = STD.drifterDropRemoveTicks;
        this.emit({ name: 'drifter_drop', data: { drifter_id: d.id, amount } });
      }
    }
    this.emit({ name: 'pulse', data: { stunned_ids: ids } });
  }

  private moveShades(): void {
    const p = this.player;
    const here = p.respawnTicks === 0;
    for (const s of this.shades) {
      if (s.evictTicks > 0) continue;
      const d = hdist(s.pos, p.pos);
      switch (s.state) {
        case 'spawning':
          continue;
        case 'stunned':
          if (s.pushTicks > 0) {
            const step = this.tuning.pulse_push_m / STD.pulsePushTicks;
            s.pushTicks = this.moveShade(s, s.dir[0] * step, s.dir[1] * step) ? s.pushTicks - 1 : 0;
          }
          continue;
        case 'recoil': {
          const step = STD.recoilDist / STD.recoilTicks;
          this.moveShade(s, s.dir[0] * step, s.dir[1] * step);
          continue;
        }
        case 'wander':
          if (here && d <= STD.shadeDetect) s.state = 'chase';
          break;
        case 'chase':
          if (!here || d > STD.shadeLose) s.state = 'wander';
          break;
      }
      if (s.state === 'chase') {
        const step = Math.min(this.map.shadeSpeed * DT, d);
        const [ux, uz] = unit(p.pos[0] - s.pos[0], p.pos[2] - s.pos[2]);
        if (!this.moveShade(s, ux * step, uz * step)) {
          if (!this.moveShade(s, ux * step, 0)) this.moveShade(s, 0, uz * step);
        }
      } else this.wanderStep(s, OWN.shadeWanderSpeed, (x, z) => this.moveShade(s, x, z));
    }
  }

  /** Move a shade if the target is land, not the tower; then keep it out of lit safe zones. */
  private moveShade(s: Shade, dx: number, dz: number): boolean {
    const nx = s.pos[0] + dx;
    const nz = s.pos[2] + dz;
    if (this.map.ground(nx, nz) === null || this.map.solid(nx, nz)) return false;
    let pos: [number, number] = [nx, nz];
    const safe = this.tuning.safe_radius;
    for (const l of this.lanterns) {
      if (!l.lit) continue;
      const d = Math.hypot(pos[0] - l.pos[0], pos[1] - l.pos[2]);
      if (d >= safe) continue;
      const [ux, uz] = unit(pos[0] - l.pos[0], pos[1] - l.pos[2]);
      pos = [l.pos[0] + ux * safe, l.pos[2] + uz * safe];
    }
    if (this.map.ground(pos[0], pos[1]) === null || this.map.solid(pos[0], pos[1])) return false;
    const moved = Math.hypot(pos[0] - s.pos[0], pos[1] - s.pos[2]) > 1e-9;
    [s.pos[0], s.pos[2]] = pos;
    this.setShadeY(s);
    return moved;
  }

  private setShadeY(s: Shade): void {
    const g = this.map.ground(s.pos[0], s.pos[2]);
    if (g !== null) s.pos[1] = g + OWN.shadeY;
  }

  private wanderStep(e: { pos: Vec3; target: [number, number] | null }, speed: number, move: (dx: number, dz: number) => boolean): void {
    if (!e.target || Math.hypot(e.target[0] - e.pos[0], e.target[1] - e.pos[2]) < 0.2) {
      e.target = null;
      for (let i = 0; i < 4 && !e.target; i++) {
        const a = this.rng.next() * 2 * Math.PI;
        const r = this.rng.next() * OWN.wanderRange;
        const tx = e.pos[0] + Math.cos(a) * r;
        const tz = e.pos[2] + Math.sin(a) * r;
        if (this.map.ground(tx, tz) !== null && !this.map.solid(tx, tz)) e.target = [tx, tz];
      }
      if (!e.target) return;
    }
    const d = Math.hypot(e.target[0] - e.pos[0], e.target[1] - e.pos[2]);
    const step = Math.min(speed * DT, d);
    const [ux, uz] = unit(e.target[0] - e.pos[0], e.target[1] - e.pos[2]);
    if (!move(ux * step, uz * step)) e.target = null;
  }

  private moveDrifters(): void {
    const p = this.player;
    for (const d of this.drifters) {
      if (d.state === 'removed') continue;
      const dist = hdist(d.pos, p.pos);
      const tempted = p.respawnTicks === 0 && p.carried >= STD.drifterTriggerCarry && dist <= STD.drifterDetect;
      if (d.state === 'idle' && tempted) d.state = 'chase';
      else if (d.state === 'chase' && !tempted) d.state = 'idle';
      const fly = (dx: number, dz: number) => {
        d.pos[0] += dx;
        d.pos[2] += dz;
        const g = this.map.ground(d.pos[0], d.pos[2]);
        if (g !== null) d.pos[1] = g + OWN.drifterY;
        return true;
      };
      const step = STD.drifterSpeed * DT;
      if (d.state === 'chase') {
        const [ux, uz] = unit(p.pos[0] - d.pos[0], p.pos[2] - d.pos[2]);
        fly(ux * Math.min(step, dist), uz * Math.min(step, dist));
      } else if (d.state === 'flee') {
        const [ux, uz] = unit(d.pos[0] - p.pos[0], d.pos[2] - p.pos[2]);
        fly(ux * step, uz * step);
      } else this.wanderStep(d, STD.drifterIdleSpeed, fly);
    }
  }

  private drifterContacts(): void {
    const p = this.player;
    if (p.respawnTicks > 0) return;
    for (const d of [...this.drifters].sort((a, b) => idNum(a.id) - idNum(b.id))) {
      if (d.state !== 'chase' || hdist(d.pos, p.pos) > STD.drifterHit) continue;
      const amount = Math.min(STD.drifterStealMax, p.carried);
      if (amount <= 0) continue;
      p.carried -= amount;
      d.stolen = amount;
      d.state = 'flee';
      d.fleeTicks = STD.drifterFleeTicks;
      this.emit({ name: 'drifter_steal', data: { drifter_id: d.id, amount, carried: p.carried } });
    }
  }

  private shadeContacts(): void {
    const p = this.player;
    if (p.respawnTicks > 0) return;
    for (const s of [...this.shades].sort((a, b) => idNum(a.id) - idNum(b.id))) {
      if ((s.state !== 'chase' && s.state !== 'wander') || s.evictTicks > 0) continue;
      if (hdist(s.pos, p.pos) > this.tuning.shade_hit_radius || Math.abs(s.pos[1] - p.pos[1]) > STD.hitHeight) continue;
      if (p.invulnTicks > 0) return; // touching while invulnerable does nothing
      p.flames -= 1;
      const dropped = Math.floor(p.carried * this.tuning.hit_drop_ratio);
      p.carried -= dropped;
      for (let i = 0; i < dropped; i++) this.dropMote(p.pos, STD.dropRingMin, STD.dropRingMax);
      p.invulnTicks = secToTicks(this.tuning.invuln_s);
      s.state = 'recoil';
      s.stateTicks = STD.recoilTicks;
      s.dir = unit(s.pos[0] - p.pos[0], s.pos[2] - p.pos[2]);
      this.emit({ name: 'player_hit', data: { by: 'shade', flames: p.flames, dropped } });
      return; // at most one flame lost per tick
    }
  }

  /** Drop a mote on land in a ring [rMin, rMax] around `at`; lost if no land is found. */
  private dropMote(at: Vec3, rMin: number, rMax: number): void {
    for (let i = 0; i < 8; i++) {
      const a = this.rng.next() * 2 * Math.PI;
      const r = rMin + this.rng.next() * (rMax - rMin);
      const x = round3(at[0] + Math.cos(a) * r);
      const z = round3(at[2] + Math.sin(a) * r);
      const g = this.map.ground(x, z);
      if (g === null || this.map.solid(x, z)) continue;
      this.motes.push(this.makeMote([x, g, z], 'dropped', STD.droppedTtl));
      return;
    }
  }

  private addRandomMote(point: number): void {
    this.motes.push(this.makeMote(this.map.motePoints[point]!, 'random', 0, point));
  }

  private spawns(): void {
    const st = this.simTick;
    const p = this.player;
    if (this.randomMotes && st % STD.moteSpawnEvery === 0 && this.motes.length < STD.moteCap) {
      const used = new Set(this.motes.filter((m) => m.kind === 'random').map((m) => m.point));
      const free = this.map.motePoints.map((_, i) => i).filter((i) => !used.has(i));
      if (free.length) this.addRandomMote(free[Math.floor(this.rng.next() * free.length)]!);
    }
    if (this.randomShades) {
      let n = 0;
      if (st === STD.shadeFirstSpawn) n = 2;
      else if (st > STD.shadeFirstSpawn && (st - STD.shadeFirstSpawn) % this.map.shadeInterval === 0) n = 1;
      for (let i = 0; i < n && this.shades.length < this.map.maxShades; i++) {
        const valid = this.map.shadePoints.filter((pt) => hdist(pt, p.pos) >= STD.shadeMinSpawnDist);
        if (!valid.length) break;
        const s = this.makeShade(valid[Math.floor(this.rng.next() * valid.length)]!);
        s.state = 'spawning';
        s.stateTicks = OWN.shadeSpawningTicks;
        this.shades.push(s);
        this.emit({ name: 'shade_spawned', data: { id: s.id } });
      }
    }
    if (this.randomDrifters && st % STD.drifterSpawnEvery === 0) {
      const alive = this.drifters.filter((d) => d.state !== 'removed').length;
      if (alive < STD.drifterMax) {
        const pts = this.map.shadePoints;
        this.drifters.push(this.makeDrifter(pts[Math.floor(this.rng.next() * pts.length)]!));
      }
    }
  }

  private checkEnd(): void {
    if (this.player.flames <= 0) this.finish('lost', 'no_flames');
    else if (this.lanterns.every((l) => l.lit)) this.finish('won', 'all_lit');
    else if (this.durationS - this.simTick / TICK_RATE <= 1e-9) this.finish('lost', 'dawn');
  }

  private finish(result: 'won' | 'lost', reason: 'all_lit' | 'dawn' | 'no_flames'): void {
    this.result = result;
    this.status = result;
    if (result === 'won') {
      const sc = this.tuning.score;
      this.score += Math.floor(this.timeLeftS + 1e-9) * sc.per_second_left + this.player.flames * sc.per_flame_left;
    }
    this.emit({ name: 'game_over', data: { result, reason } });
  }
}
