import { createRng, type Rng } from './rng';
import type { GameConfig, GameState, TickInput } from './types';

/**
 * Pure game simulation: fixed timestep, no DOM / three / Node APIs, no wall-clock time.
 * The browser renderer and the headless CLI both drive this same class.
 */
export class Game {
  readonly config: GameConfig;
  readonly rng: Rng;
  state: GameState;

  constructor(config: GameConfig, seed: number) {
    this.config = config;
    this.rng = createRng(seed);
    this.state = { tick: 0, player: { pos: { x: 0, y: 0, z: 0 } } };
  }

  get dt(): number {
    return 1 / this.config.tickRate;
  }

  step(input: TickInput): void {
    const { player } = this.state;
    const len = Math.hypot(input.moveX, input.moveZ);
    if (len > 0) {
      const k = (this.config.playerSpeed * this.dt) / Math.max(1, len);
      player.pos.x += input.moveX * k;
      player.pos.z += input.moveZ * k;
    }
    this.state.tick += 1;
  }
}
