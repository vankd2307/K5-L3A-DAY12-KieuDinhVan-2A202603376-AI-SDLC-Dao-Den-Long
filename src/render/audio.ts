/**
 * All sound is synthesised with WebAudio at runtime (no external audio files, nothing to license).
 */
export type Sfx =
  | 'pickup' | 'lit' | 'pulse' | 'hit' | 'jump' | 'dash' | 'win' | 'lose' | 'spawn' | 'tick' | 'wind' | 'charm' | 'steal' | 'click';

const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33];

export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private musicTimer = 0;
  private volume = 0.7;

  /** Must be called from a user gesture (browsers block autoplay). */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.18;
    this.musicGain.connect(this.master);
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  /** Gentle night music: a slow pentatonic arpeggio over a low drone. */
  startMusic(): void {
    if (!this.ctx || this.musicTimer) return;
    let step = 0;
    const drone = this.ctx.createOscillator();
    const dg = this.ctx.createGain();
    drone.type = 'sine';
    drone.frequency.value = 65.4;
    dg.gain.value = 0.25;
    drone.connect(dg).connect(this.musicGain);
    drone.start();
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx) return;
      const seq = [0, 2, 4, 3, 1, 4, 5, 2];
      const f = PENTA[seq[step % seq.length]!]! / (step % 16 < 8 ? 1 : 2);
      this.tone(f, 1.6, 'triangle', 0.22, undefined, this.musicGain);
      step++;
    }, 650);
  }

  stopMusic(): void {
    window.clearInterval(this.musicTimer);
    this.musicTimer = 0;
  }

  play(s: Sfx): void {
    if (!this.ctx) return;
    switch (s) {
      case 'pickup': return this.tone(880, 0.12, 'sine', 0.25, 1320);
      case 'charm': [660, 880, 1320].forEach((f, i) => this.tone(f, 0.18, 'square', 0.08, undefined, undefined, i * 0.06)); return;
      case 'lit': [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.9, 'triangle', 0.22, undefined, undefined, i * 0.07)); return;
      case 'pulse': this.tone(220, 0.5, 'sine', 0.35, 880); return this.noise(0.4, 1800, 0.15);
      case 'hit': this.tone(110, 0.35, 'sawtooth', 0.3, 55); return this.noise(0.2, 600, 0.25);
      case 'jump': return this.tone(330, 0.15, 'square', 0.08, 660);
      case 'dash': return this.noise(0.22, 3000, 0.22);
      case 'spawn': return this.tone(70, 0.8, 'sawtooth', 0.18, 45);
      case 'tick': return this.tone(1200, 0.05, 'square', 0.12);
      case 'wind': return this.noise(2.2, 700, 0.18, true);
      case 'steal': return this.tone(700, 0.3, 'triangle', 0.18, 300);
      case 'click': return this.tone(600, 0.05, 'sine', 0.12);
      case 'win': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.6, 'triangle', 0.25, undefined, undefined, i * 0.15)); return;
      case 'lose': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.6, 'sine', 0.25, undefined, undefined, i * 0.2)); return;
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number, out?: AudioNode, delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out ?? this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, cutoff: number, gain: number, swell = false): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + (swell ? dur * 0.6 : 0.02));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }
}
