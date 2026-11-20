import { Game, TICK_RATE } from './core';
import { Hud } from './render/hud';
import { createControls } from './render/input';
import { SceneView } from './render/scene';

const view = new SceneView(document.getElementById('app')!);
const hud = new Hud();
const controls = createControls(
  view.renderer.domElement,
  () => view.camYawDeg,
  (d) => (view.camYawDeg = d),
);

let game: Game;
function newGame(): void {
  game = new Game((Date.now() ^ (Math.random() * 2 ** 31)) >>> 0);
  view.reset(game);
}
controls.handlers.restart = newGame;
newGame();

// Fixed 60 Hz logic, rendering at display rate.
const DT = 1 / TICK_RATE;
let acc = 0;
let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;
  acc += dt;
  controls.updateCamera(dt);
  while (acc >= DT) {
    const events = game.step(controls.sample());
    view.onEvents(events);
    hud.onEvents(events);
    acc -= DT;
  }
  view.render(game, dt, now / 1000);
  hud.update(game, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
