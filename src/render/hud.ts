import type { Game, TimedEvent } from '../core';

const $ = (id: string) => document.getElementById(id)!;

export class Hud {
  private flash = 0;

  onEvents(events: TimedEvent[]): void {
    for (const e of events) if (e.name === 'player_hit') this.flash = 0.4;
  }

  update(game: Game, dt: number): void {
    const t = game.tuning;
    const p = game.player;
    const lit = game.lanterns.filter((l) => l.lit).length;
    const s = Math.ceil(game.timeLeftS);
    $('flames').textContent = '🔥'.repeat(p.flames) + '·'.repeat(Math.max(0, t.flames - p.flames));
    $('carried').textContent = `${p.carried}/${t.carry_capacity}`;
    $('lit').textContent = `${lit}/${game.lanterns.length}`;
    $('time').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    $('score').textContent = String(game.score);
    $('pulse').textContent = game.pulseReady ? 'F: Tỏa sáng ✓' : `F: Tỏa sáng (cần ${t.pulse_cost} đom đóm)`;
    $('pulse').classList.toggle('dim', !game.pulseReady);

    const near = game.lanternInReach();
    $('hint').textContent = near
      ? p.carried > 0
        ? `E: nạp ánh sáng vào đèn ${near.id} (${near.deposited}/${t.lantern_cost})`
        : `Đèn ${near.id} cần ${t.lantern_cost - near.deposited} đom đóm`
      : '';

    this.flash = Math.max(0, this.flash - dt);
    $('hit').style.opacity = String(this.flash * 1.5);

    const over = game.status !== 'playing';
    $('overlay').classList.toggle('show', over);
    if (over) {
      $('result').textContent = game.status === 'won' ? 'Đảo đã sáng trở lại!' : 'Ánh sáng đã tắt...';
      $('final').textContent = `Điểm: ${game.score}`;
    }
  }
}
