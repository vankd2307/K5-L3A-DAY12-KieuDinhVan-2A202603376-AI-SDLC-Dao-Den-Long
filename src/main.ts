import { applyScenario, Game, TICK_RATE, type TimedEvent } from './core';
import { isoWithOffset, nameError, normalizeName, type Entry } from './leaderboard';
import { Sound, type Sfx } from './render/audio';
import { runBench } from './render/bench';
import { Hud } from './render/hud';
import { createControls } from './render/input';
import { loadBoard, saveEntry } from './render/leaderboard-store';
import { SceneView } from './render/scene';
import { ACTION_LABEL, ACTIONS, DEFAULT_KEYS, keyLabel, loadSettings, rebind, saveSettings, type Action } from './render/settings';

const $ = (id: string) => document.getElementById(id)!;
const params = new URLSearchParams(location.search);

const INTRO: Record<1 | 2 | 3, string[]> = {
  1: [
    'Ông Đăng: "Mây à, sương đen đã nuốt hết ánh sáng của Đảo Bến rồi."',
    '"Đom đóm vẫn còn lẩn trong cỏ. Gom chúng lại, mang về thắp năm Đèn Lồng Lớn."',
    '"Bóng Mực sợ đèn. Khi bị đuổi, hãy tỏa sáng, nhưng nhớ là mỗi lần như vậy tốn đom đóm đấy."',
    '"Đèn cạn dầu thì tắt, Bóng Mực còn hút dầu đèn yếu. Giữ ít nhất 3 đèn cháy tới bình minh nhé."',
  ],
  2: [
    'Ông Đăng: "Đảo Cau có hai hòn, nối nhau bằng cây cầu tre cũ. Bước cho cẩn thận."',
    '"Bục nhảy sẽ bắn con sang đảo bên kia. Coi chừng Gió Lạc: chúng thích cướp đom đóm của người mang nhiều."',
    '"Lá Bùa Gió đỏ sẽ giúp con chạy nhanh hơn."',
  ],
  3: [
    'Ông Đăng: "Đảo Chuông là đêm cuối. Tháp chuông ở đỉnh đảo, có ba tầng."',
    '"Leo dốc lên tầng giữa, rồi nhờ bục nhảy lên tới đỉnh. Gió mạnh nổi lên liên tục, nghe tiếng lá bay thì đứng vững."',
    '"Giữ năm trong bảy đèn cháy tới khi trời sáng, bình minh sẽ trở về."',
  ],
};

const settings = loadSettings();
// URL switches for screenshots / demos, this page load only (not saved): &cb &motion &large
if (params.has('cb')) settings.colorblind = true;
if (params.has('motion')) settings.reducedMotion = true;
if (params.has('large')) settings.largeText = true;
const sound = new Sound();
sound.setVolume(settings.volume);
const view = new SceneView($('app'));
const hud = new Hud();
hud.keys = () => settings.keys;
const controls = createControls(
  view.renderer.domElement,
  { yaw: () => view.camYawDeg, setYaw: (d) => (view.camYawDeg = d), sensitivity: () => settings.sensitivity },
  () => settings.keys,
);

type Screen = 'menu' | 'intro' | 'play' | 'result' | 'dawn';
let screen: Screen = 'menu';
let night: 1 | 2 | 3 = 1;
// one "run" = Start → Night 1..3 (with retries); the leaderboard stores its total and seed
let runSeed = 0;
let attempt = 0;
let total = 0; // sum of the scores of the Nights won
let nightsWon = 0;
let game = new Game(1, 1);
view.load(game);
let lastSecond = -1;
let resultTimer = 0;
let settingsBack: () => void = () => show('menu');

function show(id: string | null): void {
  for (const el of document.querySelectorAll<HTMLElement>('.screen')) el.classList.toggle('show', el.id === id);
}

function newRun(): void {
  runSeed = (Date.now() ^ (Math.random() * 2 ** 31)) >>> 0;
  attempt = 0;
  total = 0;
  nightsWon = 0;
}

function startNight(n: 1 | 2 | 3, intro = true): void {
  night = n;
  game = new Game((runSeed + n * 1000 + attempt++) >>> 0, n);
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
  if (won) {
    total += game.score;
    nightsWon = Math.min(3, nightsWon + 1);
  }
  if (won && night === 3) {
    screen = 'dawn';
    $('dawn-score').textContent = String(total);
    offerSave('save-slot-dawn');
    show('dawn');
    return;
  }
  $('result-title').textContent = won ? `Đêm ${night} đã sáng!` : 'Ánh sáng đã tắt...';
  $('result-text').textContent = won
    ? `Điểm đêm này: ${game.score} · Tổng: ${total}`
    : game.player.flames <= 0 ? 'Mây đã hết Ngọn Lửa.' : `Trời sáng nhưng chỉ còn ${game.lanterns.filter((l) => l.lit).length}/${game.litNeeded} đèn cần thiết.`;
  $('btn-next').style.display = won ? '' : 'none';
  $('btn-retry').style.display = won ? 'none' : '';
  if (won) $('save-slot-result').replaceChildren();
  else offerSave('save-slot-result'); // Phase 4 §3: after losing any Night
  show('result');
}

// ------------------------------------------------------------ leaderboard (Phase 4 §3)
const LAST_NAME = 'dao-den-long.last-name';
const saveName = $('save-name') as HTMLInputElement;
let saved = false;

function offerSave(slotId: string): void {
  saved = false;
  $(slotId).replaceChildren($('save-form'));
  saveName.value = localStorage.getItem(LAST_NAME) ?? '';
  ($('btn-save') as HTMLButtonElement).disabled = false;
  setMsg('save-msg', `Tổng điểm ${total} · ${nightsWon} đêm đã thắng`);
}

function setMsg(id: string, text: string, err = false): void {
  $(id).textContent = text;
  $(id).classList.toggle('err', err);
}

async function doSave(): Promise<void> {
  if (saved) return;
  const err = nameError(saveName.value);
  if (err) return setMsg('save-msg', err, true);
  const entry: Entry = { name: normalizeName(saveName.value), score: total, nights_won: nightsWon, achieved_at: isoWithOffset(new Date()), seed: runSeed };
  saved = true;
  ($('btn-save') as HTMLButtonElement).disabled = true;
  localStorage.setItem(LAST_NAME, entry.name);
  const board = await saveEntry(entry);
  const pos = board.findIndex((e) => e.name === entry.name && e.achieved_at === entry.achieved_at && e.score === entry.score);
  setMsg('save-msg', pos >= 0 ? `Đã lưu! ${entry.name} đứng hạng ${pos + 1}.` : `Đã lưu, nhưng ${total} điểm chưa vào top 10.`);
}

async function showBoard(highlight?: Entry): Promise<void> {
  show('board');
  const board = await loadBoard();
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  $('board-rows').innerHTML = board
    .map((e, i) => {
      const me = highlight && e.achieved_at === highlight.achieved_at && e.name === highlight.name;
      const when = new Date(e.achieved_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
      return `<tr class="${me ? 'me' : ''}"><td>${i + 1}</td><td>${esc(e.name)}</td><td>${e.score}</td><td>${e.nights_won}/3</td><td>${when}</td></tr>`;
    })
    .join('');
  $('board-empty').style.display = board.length ? 'none' : '';
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
  newRun();
  startNight(1);
});
on('btn-board', () => void showBoard());
on('btn-board-back', () => show('menu'));
on('btn-settings', () => {
  settingsBack = () => show('menu');
  show('settings');
});
on('btn-go', beginPlay);
on('btn-next', () => startNight((night + 1) as 1 | 2 | 3));
on('btn-retry', () => startNight(night));
on('btn-menu2', () => [show('menu'), (screen = 'menu')]);
on('btn-dawn-menu', () => [show('menu'), (screen = 'menu')]);
on('btn-save', () => void doSave());
saveName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') void doSave();
});
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
on('btn-settings-back', () => {
  controls.cancelCapture();
  settingsBack();
});

// ------------------------------------------------------------ settings
const vol = $('set-volume') as HTMLInputElement;
const sens = $('set-sens') as HTMLInputElement;
const checks: Array<[string, 'colorblind' | 'reducedMotion' | 'largeText']> = [['set-cb', 'colorblind'], ['set-motion', 'reducedMotion'], ['set-large', 'largeText']];
function applySettings(): void {
  document.body.classList.toggle('cb', settings.colorblind);
  view.setColorblind(settings.colorblind);
  hud.colorblind = settings.colorblind;
  view.reducedMotion = settings.reducedMotion;
  hud.reducedMotion = settings.reducedMotion;
  document.documentElement.classList.toggle('large', settings.largeText);
  renderKeys();
}
for (const [id, key] of checks) {
  const box = $(id) as HTMLInputElement;
  box.checked = settings[key];
  box.addEventListener('change', () => {
    settings[key] = box.checked;
    applySettings();
    saveSettings(settings);
  });
}
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

// key rebinding (Phase 4 §4): duplicates are refused and reported; saved; reset to defaults
let waiting: Action | null = null;
function renderKeys(): void {
  const k = (a: Action) => keyLabel(settings.keys[a]);
  $('keymap').innerHTML = ACTIONS.map(
    (a) => `<span>${ACTION_LABEL[a]}</span><button data-action="${a}" class="${waiting === a ? 'wait' : ''}">${waiting === a ? 'Nhấn phím…' : k(a)}</button>`,
  ).join('');
  $('menu-keys').textContent =
    `${k('up')}/${k('left')}/${k('down')}/${k('right')}: đi · ${k('jump')}: nhảy · ${k('dash')}: lướt · ${k('interact')}: nạp đèn · ` +
    `${k('pulse')}: tỏa sáng · ${k('pause')}: tạm dừng · kéo chuột hoặc ${k('camLeft')}/${k('camRight')}: xoay camera`;
}
$('keymap').addEventListener('click', (ev) => {
  const btn = (ev.target as HTMLElement).closest('button');
  const action = btn?.dataset.action as Action | undefined;
  if (!action) return;
  waiting = action;
  setMsg('key-msg', `Nhấn phím mới cho "${ACTION_LABEL[action]}" (Esc để hủy)`);
  renderKeys();
  controls.captureNextKey((code) => {
    waiting = null;
    if (code === 'Escape' && action !== 'pause') {
      setMsg('key-msg', 'Đã hủy.');
    } else {
      const r = rebind(settings.keys, action, code);
      if (r.ok) {
        settings.keys = r.keys;
        saveSettings(settings);
        setMsg('key-msg', `"${ACTION_LABEL[action]}" → ${keyLabel(code)}`);
      } else {
        setMsg('key-msg', `Trùng phím: ${keyLabel(code)} đang dùng cho "${ACTION_LABEL[r.conflict]}". Đổi phím đó trước hoặc chọn phím khác.`, true);
      }
    }
    renderKeys();
  });
});
on('btn-keys-reset', () => {
  controls.cancelCapture();
  waiting = null;
  settings.keys = { ...DEFAULT_KEYS };
  saveSettings(settings);
  setMsg('key-msg', 'Đã khôi phục phím mặc định.');
  renderKeys();
});
applySettings();

// ------------------------------------------------------------ sound from events
const SFX: Partial<Record<TimedEvent['name'], Sfx>> = {
  mote_picked: 'pickup', lantern_lit: 'lit', pulse: 'pulse', player_hit: 'hit', dash: 'dash',
  shade_spawned: 'spawn', charm_picked: 'charm', drifter_steal: 'steal', refuel: 'pickup', lantern_out: 'out',
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
const RESULT_DELAY = params.has('instant') ? 0 : 1.5;
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

if (params.has('bench')) {
  // Phase 4 §1 benchmark scene, driven by scripts/bench.ts: ?bench&seed=42&duration=30
  show(null);
  runBench(view, hud, Number(params.get('seed') ?? 42), Number(params.get('duration') ?? 30));
} else {
  // Testing / demo hooks: ?night=2 jumps straight into a night; &scenario=<contract-D JSON> sets it up;
  // ?screen=board|settings opens that screen; &total=N&won=K&result=lost|dawn shows the save form.
  const direct = Number(params.get('night'));
  newRun();
  if (direct === 1 || direct === 2 || direct === 3) {
    startNight(direct, false);
    const sc = params.get('scenario');
    if (sc) {
      applyScenario(game, JSON.parse(sc));
      view.load(game);
    }
  }
  const scr = params.get('screen');
  if (scr === 'board') void showBoard();
  if (scr === 'settings') show('settings');
  const res = params.get('result');
  if (res === 'lost' || res === 'dawn') {
    total = Number(params.get('total') ?? 0);
    nightsWon = Number(params.get('won') ?? 0);
    if (res === 'dawn') {
      $('dawn-score').textContent = String(total);
      offerSave('save-slot-dawn');
      show('dawn');
    } else {
      $('result-title').textContent = 'Ánh sáng đã tắt...';
      $('result-text').textContent = 'Mây đã hết Ngọn Lửa.';
      $('btn-next').style.display = 'none';
      offerSave('save-slot-result');
      show('result');
    }
  }
  requestAnimationFrame(frame);
}
