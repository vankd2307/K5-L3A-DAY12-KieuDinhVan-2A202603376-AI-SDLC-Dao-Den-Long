import { TICK_RATE, type Game, type TimedEvent } from '../core';
import type { SceneView } from './scene';
import { keyLabel, type KeyMap } from './settings';

const $ = (id: string) => document.getElementById(id)!;
// Only write the DOM when a value changes: identical writes still cost style/layout every frame.
const last = new Map<string, string>();
const put = (id: string, v: string, prop: 'textContent' | 'innerHTML' = 'textContent') => {
  const k = `${id}.${prop}`;
  if (last.get(k) === v) return;
  last.set(k, v);
  $(id)[prop] = v;
};
const css = (el: HTMLElement, name: string, v: string) => {
  const k = `${el.id}.${name}`;
  if (last.get(k) === v) return;
  last.set(k, v);
  if (name.startsWith('--')) el.style.setProperty(name, v);
  else (el.style as unknown as Record<string, string>)[name] = v;
};
const SHADE_CUE_S = 4; // how long the "shade appeared" caption + arrow stay up

/** Ticket-02 HUD layout (Part 3 item 7) + Phase 4 captions / visual cues. */
export class Hud {
  private flash = 0;
  private cells: HTMLElement[] = [];
  private shadeCue: { id: string; until: number } | null = null;
  private now = 0;
  colorblind = false;
  /** Phase 4 "Giảm chuyển động": no hit flash, no blinking timer. */
  reducedMotion = false;
  keys: () => KeyMap = () => ({}) as KeyMap;

  constructor() {
    const bar = $('motebar');
    for (let i = 0; i < 20; i++) {
      const c = document.createElement('i');
      bar.appendChild(c);
      this.cells.push(c);
    }
  }

  onEvents(events: TimedEvent[]): void {
    for (const e of events) {
      if (e.name === 'player_hit') this.flash = 0.5;
      if (e.name === 'shade_spawned') this.shadeCue = { id: e.data.id, until: this.now + SHADE_CUE_S };
    }
  }

  show(on: boolean): void {
    $('hud').style.display = on ? '' : 'none';
  }

  update(game: Game, view: SceneView, dt: number, time: number): void {
    this.now = time;
    const t = game.tuning;
    const p = game.player;
    const k = (a: keyof KeyMap) => keyLabel(this.keys()[a] ?? '');
    // top-left flames
    put('flames', Array.from({ length: t.flames }, (_, i) => `<span class="${i < p.flames ? 'on' : 'off'}">🔥</span>`).join(''), 'innerHTML');
    // top-centre timer, red + blinking at <= 30 s
    const s = Math.ceil(game.timeLeftS);
    const timer = $('timer');
    const mmss = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    put('timer', s <= 30 && this.colorblind ? `⚠ ${mmss}` : mmss);
    timer.classList.toggle('danger', s <= 30);
    timer.classList.toggle('blink', s <= 30 && !this.reducedMotion && Math.floor(time * 2) % 2 === 0);
    // top-right lanterns k/n + score
    const lit = game.lanterns.filter((l) => l.lit).length;
    put('lit', `${lit}/${game.lanterns.length}`);
    put('need', `cần ${game.litNeeded} lúc bình minh`);
    put('score', String(game.score));
    put('nightname', `Đêm ${game.night} · ${game.map.name}`);
    // bottom-centre mote bar
    const cap = game.capacity;
    const cellKey = `${cap}/${p.carried}`;
    if (last.get('cells') !== cellKey) {
      last.set('cells', cellKey);
      this.cells.forEach((c, i) => {
        c.style.display = i < cap ? '' : 'none';
        c.classList.toggle('full', i < p.carried);
      });
    }
    put('carry', `${p.carried} / ${cap}`);
    // bottom-right cooldown icons
    const cd = (el: HTMLElement, left: number, total: number, ready: boolean) => {
      const frac = total > 0 ? left / total : 0;
      css(el, '--p', (Math.round(Math.max(0, Math.min(1, frac)) * 100) / 100).toString());
      el.classList.toggle('ready', ready);
    };
    cd($('cd-dash'), p.charmTicks > 0 ? 0 : p.dashCdTicks, t.dash_cooldown_s * TICK_RATE, game.dashReady());
    cd($('cd-pulse'), p.pulseCdTicks, t.pulse_cooldown_s * TICK_RATE, game.pulseReady());
    put('cd-dash-key', k('dash'));
    put('cd-pulse-key', k('pulse'));
    put('charm', p.charmTicks > 0 ? `Bùa Gió ${Math.ceil(p.charmTicks / TICK_RATE)}s` : '');
    // interact prompt
    const near = game.lanternInReach();
    put('hint', !near
      ? ''
      : near.lit
        ? `${k('interact')} — Châm dầu (${Math.floor(game.fuelOf(near))}/${t.fuel_max})`
        : `${k('interact')} — ${near.everLit ? 'Thắp lại' : 'Nạp ánh sáng'} (${near.deposited}/${game.lightCost(near)})`);
    this.captions(game);
    // arrow to nearest unlit lantern when it is off-screen
    let best: { pos: readonly number[]; d: number } | null = null;
    for (const l of game.lanterns) {
      if (l.lit) continue;
      const d = Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]);
      if (!best || d < best.d) best = { pos: l.pos, d };
    }
    this.edgeArrow($('arrow'), view, best?.pos ?? null, false);
    // arrow to the shade that just appeared (on screen: marker above it)
    const cue = this.shadeCue && time < this.shadeCue.until ? game.shades.find((x) => x.id === this.shadeCue!.id) : undefined;
    this.edgeArrow($('shade-arrow'), view, cue?.pos ?? null, true);

    this.flash = Math.max(0, this.flash - dt);
    css($('hit'), 'opacity', this.reducedMotion ? '0' : String(Math.round(this.flash * 160) / 100));
  }

  /** Phase 4 §4 subtitles for things otherwise only heard or seen briefly. */
  private captions(game: Game): void {
    const lines: Array<[string, string]> = [];
    if (this.shadeCue && this.now < this.shadeCue.until) lines.push(['shade', '👁 Bóng Mực xuất hiện — xem mũi tên tím']);
    const warn = game.windWarning();
    if (warn > 0) lines.push(['wind', `🍃 Gió sắp nổi! (${Math.ceil(warn / TICK_RATE)} s)`]);
    else if (game.wind.active) lines.push(['wind', '🍃 Gió mạnh đang thổi']);
    const left = game.timeLeftS;
    if (left <= 10 && left > 0) lines.push(['time', `⏳ 10 giây cuối: còn ${Math.ceil(left)} s`]);
    for (const l of game.lanterns) {
      if (game.isWeak(l)) lines.push(['fuel', `⚠ Đèn ${l.id} sắp cạn dầu (${Math.floor(game.fuelOf(l))}/${game.tuning.fuel_max})`]);
    }
    const html = lines.map(([cls, text]) => `<div class="cap ${cls}">${text}</div>`).join('');
    put('captions', html, 'innerHTML');
  }

  /** Arrow at the screen edge pointing at `pos`; if `markOnScreen` and it is visible, a marker above it instead. */
  private edgeArrow(el: HTMLElement, view: SceneView, pos: readonly number[] | null, markOnScreen: boolean): void {
    if (!pos) return css(el, 'display', 'none');
    const pr = view.project(pos);
    const onScreen = pr.front && Math.abs(pr.x) < 0.95 && Math.abs(pr.y) < 0.9;
    if (onScreen) {
      if (!markOnScreen) return css(el, 'display', 'none');
      css(el, 'display', 'block');
      css(el, 'left', `${(50 + pr.x * 50).toFixed(1)}%`);
      css(el, 'top', `${(50 - pr.y * 50).toFixed(1)}%`);
      css(el, 'transform', 'translate(-50%, -100%) rotate(90deg)');
      return;
    }
    let { x, y } = pr;
    if (!pr.front) [x, y] = [-x, -y];
    const ang = Math.atan2(y, x);
    const k = 0.85 / Math.max(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang)));
    css(el, 'display', 'block');
    css(el, 'left', `${(50 + Math.cos(ang) * k * 50).toFixed(1)}%`);
    css(el, 'top', `${(50 - Math.sin(ang) * k * 50).toFixed(1)}%`);
    css(el, 'transform', `translate(-50%, -50%) rotate(${(-ang).toFixed(3)}rad)`);
  }
}
