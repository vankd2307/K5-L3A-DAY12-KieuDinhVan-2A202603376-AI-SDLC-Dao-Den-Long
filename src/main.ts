import { DEFAULT_CONFIG, Game } from './core';
import { createKeyboardInput } from './render/input';
import { SceneView } from './render/scene';

const game = new Game(DEFAULT_CONFIG, Date.now() >>> 0);
const view = new SceneView(document.body);
const readInput = createKeyboardInput();
const hud = document.getElementById('hud')!;

// Fixed-timestep loop: logic advances in game.dt steps, rendering runs at display rate.
let acc = 0;
let last = performance.now();
function frame(now: number): void {
  acc += Math.min((now - last) / 1000, 0.25);
  last = now;
  while (acc >= game.dt) {
    game.step(readInput());
    acc -= game.dt;
  }
  view.render(game.state);
  hud.textContent = `tick ${game.state.tick}`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
