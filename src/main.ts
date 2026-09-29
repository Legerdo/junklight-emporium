import Phaser from 'phaser';
import g11 from 'galmuri/dist/Galmuri11.woff2?url';
import g11b from 'galmuri/dist/Galmuri11-Bold.woff2?url';
import g7 from 'galmuri/dist/Galmuri7.woff2?url';
import { Game } from './core/game';
import { SAVE_KEY, loadState, saveGame, serialize } from './core/save';
import { newState } from './core/state';
import { LAMPS, SITE, TOOLS, UPGRADES, CURIOS, MACHINES } from './core/data';
import type { GameState } from './core/types';
import { loadSettings, settings } from './settings';
import { UI } from './ui/ui';
import { audio } from './view/audio';
import { BenchScene } from './view/BenchScene';
import { buildAll } from './view/icons';
import { H, W } from './view/bg';
import './style.css';

async function loadFonts() {
  const faces = [new FontFace('Galmuri11', `url(${g11})`), new FontFace('Galmuri11', `url(${g11b})`, { weight: '700' }), new FontFace('Galmuri7', `url(${g7})`)];
  await Promise.all(
    faces.map((f) =>
      f.load().then(
        (ff) => document.fonts.add(ff),
        () => undefined,
      ),
    ),
  );
}

async function boot() {
  loadSettings();
  await loadFonts();
  audio.setVolumes(settings.master, settings.sfx, settings.music);

  const params = new URLSearchParams(location.search);
  const debug = params.has('debug');
  const loaded = loadState(localStorage);
  const core = new Game(loaded ?? newState());
  const isNew = !loaded;

  buildAll();
  const uiRoot = document.getElementById('ui')!;
  const scene = new BenchScene();
  let lastFrame = performance.now();
  const doSave = () => saveGame(core, localStorage);
  const ui = new UI(uiRoot, core, {
    save: doSave,
    reset: () => {
      localStorage.removeItem(SAVE_KEY);
      location.reload();
    },
    newGamePlus: (c) => {
      core.newGamePlus(c);
      scene.clearAll();
      ui.close();
      doSave();
      ui.toast(`<b>${core.s.ngPlus + 1}번째 밤</b><small>모아 둔 골동품이 진열장에서 기다린다.</small>`, 'gold', 6000);
    },
    sceneRefresh: () => scene.refresh(),
    endEndingFreeze: () => scene.endEndingFreeze(),
    exportSave: () => serialize(core),
  });
  scene.core = core;
  scene.hooks = {
    onEvent: (e) => {
      ui.onEvent(e);
      if (e.k === 'cartDone' || e.k === 'lamp' || e.k === 'curio' || e.k === 'ending') doSave();
      if (e.k === 'site' || e.k === 'lamp' || e.k === 'ending') scene.refresh();
    },
    modalOpen: () => ui.modalOpen(),
    open: (p) => ui.open(p),
    coinTarget: () => ui.coinTarget(),
    starTarget: () => ui.starTarget(),
    frame: () => {
      const now = performance.now();
      ui.frame(Math.min(0.1, (now - lastFrame) / 1000));
      lastFrame = now;
    },
    bell: () => ui.bell(),
  };

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'stage',
    width: W,
    height: H,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#16111c',
    scale: { mode: Phaser.Scale.NONE },
    fps: { target: 60 },
    audio: { noAudio: true },
    scene,
    banner: false,
  });

  const resize = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const fit = Math.min(vw / W, vh / H);
    const int = Math.floor(fit);
    const s = int >= 1 && int / fit >= 0.8 ? int : fit;
    const cw = Math.floor(W * s);
    const ch = Math.floor(H * s);
    const left = Math.floor((vw - cw) / 2);
    const top = Math.floor((vh - ch) / 2);
    const canvas = game.canvas;
    if (canvas) {
      canvas.style.width = cw + 'px';
      canvas.style.height = ch + 'px';
      canvas.style.left = left + 'px';
      canvas.style.top = top + 'px';
    }
    Object.assign(uiRoot.style, { width: cw + 'px', height: ch + 'px', left: left + 'px', top: top + 'px' });
    uiRoot.style.setProperty('--s', String(s));
    game.scale.refresh();
    requestAnimationFrame(() => ui.layout(s, left, top));
  };
  game.events.once('ready', () => {
    resize();
    document.getElementById('boot')?.remove();
    if (isNew) ui.intro();
  });
  window.addEventListener('resize', resize);

  setInterval(doSave, 5000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') doSave();
  });
  window.addEventListener('pagehide', doSave);

  if (debug) {
    // 개발·검증용 도구. 정상 플레이에는 노출되지 않는다(?debug).
    (window as unknown as Record<string, unknown>).__jl = {
      core,
      ui,
      scene,
      save: doSave,
      data: { LAMPS, SITE, TOOLS, UPGRADES, CURIOS, MACHINES },
      grant(coins: number, star: number) {
        core.s.coins += coins;
        core.s.star += star;
      },
      unlockAll(state?: Partial<GameState>) {
        Object.assign(core.s, state ?? {});
        core.recompute();
        scene.refresh();
      },
    };
  }
}

void boot();
