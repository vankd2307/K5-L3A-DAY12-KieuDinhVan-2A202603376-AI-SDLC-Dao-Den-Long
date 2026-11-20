import { applyScenario, Game, TICK_RATE, type TimedEvent } from './core';
import { Sound, type Sfx } from './render/audio';
import { Hud } from './render/hud';
import { createControls } from './render/input';
import { SceneView } from './render/scene';
import { loadSettings, saveSettings } from './render/settings';

const $ = (id: string) => document.getElementById(id)!;

const INTRO: Record<1 | 2 | 3, string[]> = {
  1: [
    'Ông Đăng: "Mây à, sương đen đã nuốt hết ánh sáng của Đảo Bến rồi."',
    '"Đom đóm vẫn còn lẩn trong cỏ. Gom chúng lại, mang về thắp năm Đèn Lồng Lớn."',
    '"Bóng Mực sợ đèn. Khi bị đuổi, hãy tỏa sáng, nhưng nhớ là mỗi lần như vậy tốn đom đóm đấy."',
  ],
  2: [
    'Ông Đăng: "Đảo Cau có hai hòn, nối nhau bằng cây cầu tre cũ. Bước cho cẩn thận."',
    '"Bục nhảy sẽ bắn con sang đảo bên kia. Coi chừng Gió Lạc: chúng thích cướp đom đóm của người mang nhiều."',
    '"Lá Bùa Gió đỏ sẽ giúp con chạy nhanh hơn."',
  ],
  3: [
    'Ông Đăng: "Đảo Chuông là đêm cuối. Tháp chuông ở đỉnh đảo, có ba tầng."',
    '"Leo dốc lên tầng giữa, rồi nhờ bục nhảy lên tới đỉnh. Gió mạnh nổi lên liên tục, nghe tiếng lá bay thì đứng vững."',
    '"Thắp đủ bảy đèn, bình minh sẽ trở về."',
  ],
};

const settings = loadSettings();
const sound = new Sound();
sound.setVolume(settings.volume);
const view = new SceneView($('app'));
const hud = new Hud();
const controls = createControls(view.renderer.domElement, {
  yaw: () => view.camYawDeg,
  setYaw: (d) => (view.camYawDeg = d),
  sensitivity: () => settings.sensitivity,
});

type Screen = 'menu' | 'intro' | 'play' | 'result' | 'dawn';
let screen: Screen = 'menu';
let night: 1 | 2 | 3 = 1;
let total = 0; // sum of won nights
let game = new Game(1, 1);
view.load(game);
let lastSecond = -1;
let resultTimer = 0;
let settingsBack: () => void = () => show('menu');

function show(id: string | null): void {
  for (const el of document.querySelectorAll<HTMLElement>('.screen')) el.classList.toggle('show', el.id === id);
}

function startNight(n: 1 | 2 | 3, intro = true): void {
  night = n;
  game = new Game((Date.now() ^ (Math.random() * 2 ** 31)) >>> 0, n);
  view.load(game);
  view.camYawDeg = 0;
  lastSecond = -1;
  if (intro) {
    screen = 'intro';
    $('intro-title').textContent = `Đêm ${n} · ${game.map.name}`;
    $('intro-text').innerHTML = INTRO[n].map((l) => `<p>${l}</p>`).join('');
    show('intro');
    hud.show(false);
  } else beginPlay();
}

function beginPlay(): void {
  screen = 'play';
  show(null);
  hud.show(true);
  controls.clear();
}

function finishNight(): void {
  screen = 'result';
  hud.show(false);
  const won = game.result === 'won';
  if (won) total += game.score;
  if (won && night === 3) {
    screen = 'dawn';
    $('dawn-score').textContent = String(total);
    show('dawn');
    return;
  }
  $('result-title').textContent = won ? `Đêm ${night} đã sáng!` : 'Ánh sáng đã tắt...';
  $('result-text').textContent = won
    ? `Điểm đêm này: ${game.score} · Tổng: ${total}`
    : game.player.flames <= 0 ? 'Mây đã hết Ngọn Lửa.' : 'Trời sáng trước khi kịp thắp hết đèn.';
  $('btn-next').style.display = won ? '' : 'none';
  $('btn-retry').style.display = won ? 'none' : '';
  show('result');
}

// ------------------------------------------------------------ buttons
const on = (id: string, fn: () => void) =>
  $(id).addEventListener('click', () => {
    sound.unlock();
    sound.startMusic();
    sound.play('click');
    fn();
  });
on('btn-start', () => {
  total = 0;
  startNight(1);
});
on('btn-settings', () => {
  settingsBack = () => show('menu');
  show('settings');
});
on('btn-go', beginPlay);
on('btn-next', () => startNight((night + 1) as 1 | 2 | 3));
on('btn-retry', () => startNight(night));
on('btn-menu2', () => [show('menu'), (screen = 'menu')]);
on('btn-dawn-menu', () => [show('menu'), (screen = 'menu')]);
on('btn-resume', () => controls.togglePause());
on('btn-restart', () => startNight(night, false));
on('btn-pause-settings', () => {
  settingsBack = () => show('pause');
  show('settings');
});
on('btn-quit', () => {
  screen = 'menu';
  hud.show(false);
  show('menu');
});
on('btn-settings-back', () => settingsBack());

const vol = $('set-volume') as HTMLInputElement;
const sens = $('set-sens') as HTMLInputElement;
vol.value = String(settings.volume);
sens.value = String(settings.sensitivity);
vol.addEventListener('input', () => {
  settings.volume = Number(vol.value);
  sound.setVolume(settings.volume);
  saveSettings(settings);
});
sens.addEventListener('input', () => {
  settings.sensitivity = Number(sens.value);
  saveSettings(settings);
});
window.addEventListener('keydown', () => sound.unlock(), { once: true });

// ------------------------------------------------------------ sound from events
const SFX: Partial<Record<TimedEvent['name'], Sfx>> = {
  mote_picked: 'pickup', lantern_lit: 'lit', pulse: 'pulse', player_hit: 'hit', dash: 'dash',
  shade_spawned: 'spawn', charm_picked: 'charm', drifter_steal: 'steal',
};
function playEvents(events: TimedEvent[]): void {
  for (const e of events) {
    const s = SFX[e.name];
    if (s) sound.play(s);
    if (e.name === 'game_over') sound.play(e.data.result === 'won' ? 'win' : 'lose');
  }
}

// ------------------------------------------------------------ loop: fixed 60 Hz logic, render at display rate
const DT = 1 / TICK_RATE;
// &instant shows the result screen without the 1.5 s pause (headless screenshots run only a few frames)
const RESULT_DELAY = new URLSearchParams(location.search).has('instant') ? 0 : 1.5;
let acc = 0;
let last = performance.now();
let wasPaused = false;
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;
  if (screen === 'play') {
    acc += dt;
    controls.updateCamera(dt);
    while (acc >= DT && !game.over) {
      const wasGrounded = game.player.grounded;
      const events = game.step(controls.sample());
      if (wasGrounded && game.player.vel[1] > 6 && !game.player.launch) sound.play('jump');
      view.onEvents(events);
      hud.onEvents(events);
      playEvents(events);
      if (game.windWarning() === 120) sound.play('wind');
      acc -= DT;
    }
    const sec = Math.ceil(game.timeLeftS);
    if (sec <= 10 && sec !== lastSecond && game.status === 'playing') sound.play('tick');
    lastSecond = sec;
    const paused = game.status === 'paused';
    if (paused !== wasPaused) show(paused ? 'pause' : null);
    wasPaused = paused;
    if (game.over) {
      resultTimer += dt;
      if (resultTimer > RESULT_DELAY) {
        resultTimer = 0;
        finishNight();
      }
    }
  } else {
    acc = 0;
    view.camYawDeg += dt * 6; // idle orbit behind menus
  }
  view.render(game, dt, now / 1000);
  if (screen === 'play') hud.update(game, view, dt, now / 1000);
  requestAnimationFrame(frame);
}
hud.show(false);
show('menu');
// Testing / demo hooks: ?night=2 jumps straight into a night; &scenario=<contract-D JSON> sets it up.
const params = new URLSearchParams(location.search);
const direct = Number(params.get('night'));
if (direct === 1 || direct === 2 || direct === 3) {
  startNight(direct, false);
  const sc = params.get('scenario');
  if (sc) {
    applyScenario(game, JSON.parse(sc));
    view.load(game);
  }
}
requestAnimationFrame(frame);
