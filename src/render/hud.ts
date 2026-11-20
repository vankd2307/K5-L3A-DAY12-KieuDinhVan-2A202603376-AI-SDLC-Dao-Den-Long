import { TICK_RATE, type Game, type TimedEvent } from '../core';
import type { SceneView } from './scene';

const $ = (id: string) => document.getElementById(id)!;

/** Ticket-02 HUD layout (Part 3 item 7). */
export class Hud {
  private flash = 0;
  private cells: HTMLElement[] = [];

  constructor() {
    const bar = $('motebar');
    for (let i = 0; i < 10; i++) {
      const c = document.createElement('i');
      bar.appendChild(c);
      this.cells.push(c);
    }
  }

  onEvents(events: TimedEvent[]): void {
    for (const e of events) if (e.name === 'player_hit') this.flash = 0.5;
  }

  show(on: boolean): void {
    $('hud').style.display = on ? '' : 'none';
  }

  update(game: Game, view: SceneView, dt: number, time: number): void {
    const t = game.tuning;
    const p = game.player;
    // top-left flames
    $('flames').innerHTML = Array.from({ length: t.flames }, (_, i) => `<span class="${i < p.flames ? 'on' : 'off'}">🔥</span>`).join('');
    // top-centre timer, red + blinking at <= 30 s
    const s = Math.ceil(game.timeLeftS);
    const timer = $('timer');
    timer.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    timer.classList.toggle('danger', s <= 30);
    timer.classList.toggle('blink', s <= 30 && Math.floor(time * 2) % 2 === 0);
    // top-right lanterns k/n + score
    const lit = game.lanterns.filter((l) => l.lit).length;
    $('lit').textContent = `${lit}/${game.lanterns.length}`;
    $('score').textContent = String(game.score);
    $('nightname').textContent = `Đêm ${game.night} · ${game.map.name}`;
    // bottom-centre mote bar (10 cells)
    this.cells.forEach((c, i) => c.classList.toggle('full', i < p.carried));
    // bottom-right cooldown icons
    const cd = (el: HTMLElement, left: number, total: number, ready: boolean) => {
      const frac = total > 0 ? left / total : 0;
      el.style.setProperty('--p', String(Math.max(0, Math.min(1, frac))));
      el.classList.toggle('ready', ready);
    };
    cd($('cd-dash'), p.charmTicks > 0 ? 0 : p.dashCdTicks, t.dash_cooldown_s * TICK_RATE, game.dashReady());
    cd($('cd-pulse'), p.pulseCdTicks, t.pulse_cooldown_s * TICK_RATE, game.pulseReady());
    $('charm').textContent = p.charmTicks > 0 ? `Bùa Gió ${Math.ceil(p.charmTicks / TICK_RATE)}s` : '';
    // interact prompt
    const near = game.lanternInReach();
    $('hint').textContent = near ? `E — Nạp ánh sáng (${near.deposited}/${t.lantern_cost})` : '';
    // wind warning
    $('windwarn').textContent = game.windWarning() > 0 ? 'Gió sắp nổi!' : game.wind.active ? 'Gió mạnh' : '';
    // arrow to nearest unlit lantern when it is off-screen
    this.arrow(game, view);

    this.flash = Math.max(0, this.flash - dt);
    $('hit').style.opacity = String(this.flash * 1.6);
  }

  private arrow(game: Game, view: SceneView): void {
    const el = $('arrow');
    let best: { pos: readonly number[]; d: number } | null = null;
    for (const l of game.lanterns) {
      if (l.lit) continue;
      const d = Math.hypot(l.pos[0] - game.player.pos[0], l.pos[2] - game.player.pos[2]);
      if (!best || d < best.d) best = { pos: l.pos, d };
    }
    if (!best) return void (el.style.display = 'none');
    const pr = view.project(best.pos);
    const onScreen = pr.front && Math.abs(pr.x) < 0.95 && Math.abs(pr.y) < 0.9;
    if (onScreen) return void (el.style.display = 'none');
    let { x, y } = pr;
    if (!pr.front) [x, y] = [-x, -y];
    const ang = Math.atan2(y, x);
    const k = 0.85 / Math.max(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang)));
    el.style.display = 'block';
    el.style.left = `${50 + Math.cos(ang) * k * 50}%`;
    el.style.top = `${50 - Math.sin(ang) * k * 50}%`;
    el.style.transform = `translate(-50%, -50%) rotate(${-ang}rad)`;
  }
}
