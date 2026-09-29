// 작업대 화면: 코어 상태를 읽어 그리고, 이벤트를 연출·소리로 바꾼다.
// 연출은 규칙 결과를 바꾸지 않는다(보상은 코어에서 이미 확정됨).
import Phaser from 'phaser';
import { DT, HEART_X, TRAY, type Item } from '../core/bench';
import { JUNK, SOCKET_X, TOOL } from '../core/data';
import type { Game, GameEvent } from '../core/game';
import type { Material } from '../core/types';
import { particleScale, settings, shakeScale } from '../settings';
import { audio } from './audio';
import { DOOR, H, RAIL_Y, SHELF, W, WINDOW, paintBackground, paintForeground } from './bg';
import { CANVASES, JUNK_COLORS, buildAll } from './icons';
import { HEX, MAT_COLOR, PAL } from './palette';

export interface SceneHooks {
  onEvent(e: GameEvent): void;
  modalOpen(): boolean;
  open(panel: 'curios' | 'map' | 'workshop' | 'shop'): void;
  coinTarget(): { x: number; y: number };
  starTarget(): { x: number; y: number };
  frame(): void;
  bell(): void;
}

interface ItemView {
  img: Phaser.GameObjects.Image;
  crack: Phaser.GameObjects.Image;
  flame: Phaser.GameObjects.Image | null;
  key: string;
  yOff: number;
  flashT: number;
  lastHp: number;
  heart: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: number;
  size: number;
  g: number;
}

interface Fx {
  kind: 'ring' | 'spark' | 'beam';
  x: number;
  y: number;
  r: number;
  r2: number;
  life: number;
  max: number;
  color: number;
  pts?: number[];
  width: number;
}

interface Flyer {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  target: 'coin' | 'star';
}

export class BenchScene extends Phaser.Scene {
  core!: Game;
  hooks!: SceneHooks;
  private acc = 0;
  private views = new Map<number, ItemView>();
  private dying: { v: ItemView; t: number }[] = [];
  private particles: Particle[] = [];
  private fx: Fx[] = [];
  private flyers: Flyer[] = [];
  private pg!: Phaser.GameObjects.Graphics;
  private eg!: Phaser.GameObjects.Graphics;
  private rg!: Phaser.GameObjects.Graphics;
  private bgTex!: Phaser.Textures.CanvasTexture;
  private toolImg!: Phaser.GameObjects.Image;
  private toolAnim: { x: number; y: number; t: number; phase: 'down' | 'up'; auto: boolean } | null = null;
  private keeper!: Phaser.GameObjects.Image;
  private keeperCheer = 0;
  private magpie!: Phaser.GameObjects.Image;
  private magpieFly: { x: number; y: number; t: number } | null = null;
  private cart!: Phaser.GameObjects.Container;
  private cartT = -1;
  private machines: { body: Phaser.GameObjects.Image; head: Phaser.GameObjects.Image | null; kind: string | null; fire: number; ty: number }[] = [];
  private shelf: Phaser.GameObjects.Image[] = [];
  private texts: Phaser.GameObjects.Text[] = [];
  private textPool: Phaser.GameObjects.Text[] = [];
  private bgKey = '';
  private heartCore: Phaser.GameObjects.Image | null = null;
  private endingT = -1;
  private pointer = { x: -1, y: -1, inside: false };
  private time0 = 0;
  private heartDmgShown = 0;
  private heartHitT = 0;
  private heartText: Phaser.GameObjects.Text | null = null;
  frozen = false;

  constructor() {
    super('bench');
  }

  create() {
    buildAll();
    for (const [k, cv] of CANVASES) if (!this.textures.exists(k)) this.textures.addCanvas(k, cv);
    const bgc = document.createElement('canvas');
    bgc.width = W;
    bgc.height = H;
    this.bgTex = this.textures.addCanvas('bg', bgc)!;
    this.add.image(0, 0, 'bg').setOrigin(0).setDepth(0);
    const fgc = document.createElement('canvas');
    fgc.width = W;
    fgc.height = H;
    paintForeground(fgc.getContext('2d')!);
    this.textures.addCanvas('fg', fgc);
    this.add.image(0, 0, 'fg').setOrigin(0).setDepth(9);

    this.eg = this.add.graphics().setDepth(7);
    this.pg = this.add.graphics().setDepth(8);
    this.rg = this.add.graphics().setDepth(11);
    this.toolImg = this.add.image(0, 0, 't_mallet').setDepth(12).setVisible(false);

    this.keeper = this.add.image(114, 0, 'x_keeper').setDepth(6);
    this.keeper.y = 240 - this.keeper.height / 2;
    this.magpie = this.add.image(378, RAIL_Y - 5, 'x_magpie').setDepth(12).setVisible(false);

    // 수레(문 안쪽에만 보이도록 마스크)
    const cartImg = this.add.image(0, 0, 'x_cart');
    const w0 = this.add.image(-9, 6, 'x_wheel0');
    const w1 = this.add.image(9, 6, 'x_wheel0');
    this.cart = this.add.container(DOOR.x + DOOR.w + 40, DOOR.y + DOOR.h - 12, [cartImg, w0, w1]).setDepth(1);
    const mg = this.make.graphics({}, false);
    mg.fillStyle(0xffffff).fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
    this.cart.setMask(mg.createGeometryMask());

    for (let i = 0; i < SOCKET_X.length; i++) {
      const body = this.add.image(SOCKET_X[i], RAIL_Y + 10, 'm_thumper').setDepth(10).setVisible(false);
      const head = this.add.image(SOCKET_X[i], RAIL_Y + 20, 'm_thumperHead').setDepth(10).setVisible(false);
      this.machines.push({ body, head, kind: null, fire: 0, ty: 0 });
    }
    for (let i = 0; i < 6; i++) this.shelf.push(this.add.image(0, 0, 'c_purse').setDepth(3).setVisible(false));

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.setPointer(p));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('gameout', () => (this.pointer.inside = false));
    this.refresh();
  }

  // ---------- 상태 반영 ----------
  refresh() {
    const s = this.core.s;
    const key = `${s.lamps}|${s.site}|${s.ended}|${this.core.socketsCount()}`;
    if (key !== this.bgKey) {
      this.bgKey = key;
      paintBackground(this.bgTex.getContext(), { lamps: s.lamps, site: s.site, ended: s.ended, sockets: this.core.socketsCount() });
      this.bgTex.refresh();
      audio.layers = s.lamps;
      audio.site = s.site;
    }
    // 진열장
    const slots = this.core.slotsCount();
    for (let i = 0; i < 6; i++) {
      const img = this.shelf[i];
      const id = s.equipped[i];
      const row = Math.floor(i / 2);
      const x = SHELF.x + (i % 2 ? 60 : 22);
      const boardY = SHELF.y + 40 + row * 44;
      if (i < slots && id && this.textures.exists(`c_${id}`)) {
        img.setTexture(`c_${id}`).setVisible(true).setAlpha(1);
        img.setPosition(x, boardY - Math.ceil(img.height / 2));
      } else if (i < slots) {
        img.setTexture('x_mote').setVisible(true).setAlpha(0.35);
        img.setPosition(x, boardY - 3);
      } else img.setVisible(false);
    }
    // 장치
    this.machines.forEach((m, i) => {
      const kind = s.sockets[i] ?? null;
      m.kind = kind;
      if (!kind) {
        m.body.setVisible(false);
        m.head?.setVisible(false);
        return;
      }
      m.body.setTexture(`m_${kind}`).setVisible(true);
      m.body.setPosition(SOCKET_X[i], RAIL_Y + 4 + Math.ceil(m.body.height / 2));
      m.head?.setVisible(kind === 'thumper');
      if (m.head) m.head.setPosition(SOCKET_X[i], m.body.y + m.body.height / 2 + 2);
    });
    this.magpie.setVisible(!!this.core.lvl('magpie'));
  }

  private setPointer(p: Phaser.Input.Pointer) {
    this.pointer.x = p.worldX;
    this.pointer.y = p.worldY;
    this.pointer.inside = true;
  }

  private onDown(p: Phaser.Input.Pointer) {
    this.setPointer(p);
    audio.ensure();
    if (this.hooks.modalOpen() || this.frozen) return;
    const x = p.worldX;
    const y = p.worldY;
    if (x >= TRAY.L && x <= TRAY.R && y >= TRAY.TOP - 16 && y <= TRAY.F + 6) {
      if (!this.core.bench) {
        this.hooks.bell();
        return;
      }
      if (!this.core.strike(x, y)) audio.deny();
      return;
    }
    if (x >= SHELF.x && x < SHELF.x + SHELF.w && y >= SHELF.y && y < SHELF.y + SHELF.h) return this.hooks.open('curios');
    if (x >= WINDOW.x - 4 && x < WINDOW.x + WINDOW.w + 4 && y >= WINDOW.y - 4 && y < WINDOW.y + WINDOW.h + 4) return this.hooks.open('map');
    if (x >= TRAY.L && x <= TRAY.R && y >= RAIL_Y - 6 && y < TRAY.TOP - 16) return this.hooks.open('workshop');
    if (x >= DOOR.x - 4 && x < DOOR.x + DOOR.w + 4 && y >= DOOR.y - 4 && y < DOOR.y + DOOR.h + 4) return this.hooks.bell();
    if (x > 100 && x < 130 && y > 200) this.cheer();
  }

  cheer() {
    this.keeperCheer = 0.7;
  }

  // ---------- 루프 ----------
  update(_t: number, deltaMs: number) {
    const real = Math.min(deltaMs, 100) / 1000;
    const dt = real * settings.speed;
    if (!this.frozen) {
      this.acc += dt;
      let n = 0;
      while (this.acc >= DT && n < 24) {
        this.core.step(DT);
        this.acc -= DT;
        n++;
        this.drain();
      }
      if (n >= 24) this.acc = 0;
    }
    this.drain();
    this.time0 += dt;
    this.syncItems(dt);
    this.updateTool(dt);
    this.updateMachines(dt);
    this.updateParticles(dt);
    this.updateFlyers(real);
    this.updateTexts(dt);
    this.updateCharacters(dt);
    this.updateCart(dt);
    this.updateEnding(real);
    this.drawReticle();
    this.drawHeartBar(dt);
    audio.updateMusic();
    this.hooks.frame();
  }

  private drain() {
    const out = this.core.out;
    if (!out.length) return;
    this.core.out = [];
    for (const e of out) {
      this.onEvent(e);
      this.hooks.onEvent(e);
    }
  }

  // ---------- 아이템 동기화 ----------
  private syncItems(dt: number) {
    const b = this.core.bench;
    const alive = new Set<number>();
    if (b) {
      for (const it of b.items) {
        if (it.dead) continue;
        alive.add(it.id);
        let v = this.views.get(it.id);
        if (!v) v = this.makeView(it);
        this.placeView(v, it, dt);
      }
    }
    for (const [id, v] of this.views) {
      if (!alive.has(id)) {
        this.destroyView(v);
        this.views.delete(id);
      }
    }
    // 정산 때 치워지는 물건
    this.dying = this.dying.filter((d) => {
      d.t += dt;
      d.v.img.y -= dt * 60;
      d.v.img.x += dt * 90;
      d.v.img.setAlpha(Math.max(0, 1 - d.t * 2.2));
      d.v.crack.setAlpha(0);
      if (d.v.flame) d.v.flame.setVisible(false);
      if (d.t > 0.5) {
        this.destroyView(d.v);
        return false;
      }
      return true;
    });
    // 파편
    this.eg.clear();
    if (b) {
      for (const s of b.shards) {
        this.eg.fillStyle(HEX('f'));
        this.eg.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
        this.eg.fillStyle(HEX('d'), 0.8);
        this.eg.fillRect(Math.round(s.x - s.vx * 0.012), Math.round(s.y - s.vy * 0.012), 1, 1);
      }
    }
    this.drawFx(dt);
  }

  private makeView(it: Item): ItemView {
    let key: string;
    if (it.heart) key = `heart_${Math.min(2, this.core.s.heart?.phase ?? 0)}`;
    else key = `j_${it.def.id}${it.shiny ? '_g' : ''}`;
    if (!this.textures.exists(key)) key = 'j_crate';
    const img = this.add.image(it.x, it.y, key).setDepth(it.heart ? 4 : 5);
    const crack = this.add.image(it.x, it.y, it.heart ? key : `j_${it.def.id}_c1`).setDepth(5).setVisible(false);
    const v: ItemView = { img, crack, flame: null, key, yOff: it.heart ? 0 : (it.r - img.height / 2) * 0.7, flashT: 0, lastHp: it.hp, heart: it.heart };
    this.views.set(it.id, v);
    return v;
  }

  private placeView(v: ItemView, it: Item, dt: number) {
    let x = Math.round(it.x);
    const y = Math.round(it.y + v.yOff);
    if (it.fuse >= 0) {
      x += Math.floor(this.time0 * 30) % 2 ? 1 : -1;
      v.img.setTint(Math.floor(it.fuse * 8) % 2 ? 0xff8866 : 0xffffff);
      if (Math.random() < dt * 6) audio.tick();
    } else if (!v.heart) v.img.clearTint();
    if (v.heart) {
      const ph = Math.min(2, this.core.s.heart?.phase ?? 0);
      const k = `heart_${ph}${v.flashT > 0 ? '_w' : ''}`;
      if (v.img.texture.key !== k) v.img.setTexture(k);
      const glow = 0.85 + Math.sin(this.time0 * 3) * 0.15;
      v.img.setAlpha(glow);
    }
    if (v.flashT > 0) {
      v.flashT -= dt;
      if (!v.heart) {
        const wk = `j_${it.def.id}_w`;
        if (v.img.texture.key !== wk) v.img.setTexture(wk);
      }
    } else if (!v.heart && v.img.texture.key !== v.key) v.img.setTexture(v.key);
    v.img.setPosition(x, y);
    // 금
    if (!v.heart) {
      const ratio = it.hp / it.maxHp;
      if (ratio < 0.99 && it.maxHp > 1) {
        v.crack.setTexture(`j_${it.def.id}_c${ratio < 0.5 ? 2 : 1}`).setVisible(true).setPosition(x, y);
      } else v.crack.setVisible(false);
    }
    // 불
    if (it.burning) {
      if (!v.flame) v.flame = this.add.image(x, y, 'x_flame0').setDepth(6);
      v.flame.setTexture(Math.floor(this.time0 * 9) % 2 ? 'x_flame0' : 'x_flame1');
      v.flame.setPosition(x, y - Math.floor(v.img.height / 2) + 1);
      if (Math.random() < dt * 8 * particleScale()) this.spawnParticle(x + (Math.random() - 0.5) * 6, y - 4, (Math.random() - 0.5) * 10, -30 - Math.random() * 20, Math.random() < 0.5 ? HEX('a') : HEX('9'), 0.5, 1, -20);
      if (Math.random() < dt * 5) audio.crackle();
    } else if (v.flame) {
      v.flame.destroy();
      v.flame = null;
    }
    v.lastHp = it.hp;
  }

  private destroyView(v: ItemView) {
    v.img.destroy();
    v.crack.destroy();
    v.flame?.destroy();
  }

  // ---------- 이벤트 → 연출 ----------
  private onEvent(e: GameEvent) {
    const ps = particleScale();
    switch (e.k) {
      case 'cartStart':
        this.cartT = 0;
        audio.cart();
        break;
      case 'spawn':
        audio.pour();
        break;
      case 'aim': {
        this.toolImg.setTexture(`t_${e.tool}`).setVisible(true).setAlpha(1);
        this.toolAnim = { x: e.x, y: e.y, t: 0, phase: 'down', auto: e.auto };
        if (e.auto) this.magpieFly = { x: e.x, y: e.y - 20, t: 0 };
        audio.whoosh();
        break;
      }
      case 'impact': {
        if (this.toolAnim) {
          this.toolAnim.phase = 'up';
          this.toolAnim.t = 0;
        }
        this.ring(e.x, e.y, 2, e.r, 0.18, HEX('7'), 1);
        for (let i = 0; i < 6 * ps; i++) this.spawnParticle(e.x, e.y, (Math.random() - 0.5) * 80, -Math.random() * 60, HEX('6'), 0.3, 1, 200);
        if (e.hits) this.shake(60, 0.003);
        audio.impact(e.tool, e.hits);
        break;
      }
      case 'hit': {
        const v = this.views.get(e.id);
        if (v) v.flashT = 0.06;
        for (let i = 0; i < 2 * ps; i++) this.spawnParticle(e.x, e.y, (Math.random() - 0.5) * 70, -Math.random() * 70, MAT_COLOR[e.mat], 0.35, 1, 300);
        audio.hit(e.mat);
        break;
      }
      case 'break': {
        const v = this.views.get(e.id);
        const cols = JUNK_COLORS[e.def] ?? [PAL['5']];
        const n = Math.round((e.shiny ? 16 : 9) * ps);
        for (let i = 0; i < n; i++) {
          const c = parseInt((e.shiny ? PAL[Math.random() < 0.5 ? 'b' : 'v'] : cols[i % cols.length]).slice(1), 16);
          this.spawnParticle(e.x, e.y, (Math.random() - 0.5) * 160, -40 - Math.random() * 120, c, 0.5 + Math.random() * 0.4, Math.random() < 0.3 ? 2 : 1, 380);
        }
        if (v) {
          this.destroyView(v);
          this.views.delete(e.id);
        }
        this.coinBurst(e.x, e.y, e.coins, e.star, e.combo);
        if (settings.popups && (e.shiny || e.star || this.texts.length < 8)) {
          const txt = `+${fmtShort(e.coins)}`;
          this.popText(e.x, e.y - 8, txt, e.shiny ? '#fff4a8' : '#ffd76a', e.shiny);
          if (e.star && this.texts.length < 10) this.popText(e.x + 6, e.y - 16, `+${e.star}★`, '#fffdf0', false);
        }
        audio.breakSnd(e.mat, e.shiny);
        audio.coin(e.combo);
        if (e.shiny) {
          this.ring(e.x, e.y, 2, 22, 0.35, HEX('b'), 1);
          this.cheer();
        }
        if (e.combo === 25 || e.combo === 50 || e.combo === 100) {
          this.cheer();
          this.shake(120, 0.004);
        }
        break;
      }
      case 'spark': {
        const pts: number[] = [];
        const segs = 5;
        for (let i = 0; i <= segs; i++) {
          const t = i / segs;
          const j = i === 0 || i === segs ? 0 : (Math.random() - 0.5) * 8;
          pts.push(e.x1 + (e.x2 - e.x1) * t + j, e.y1 + (e.y2 - e.y1) * t + j * 0.6);
        }
        this.fx.push({ kind: 'spark', x: 0, y: 0, r: 0, r2: 0, life: 0.16, max: 0.16, color: HEX('w'), pts, width: 1 });
        for (let i = 0; i < 3 * ps; i++) this.spawnParticle(e.x2, e.y2, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120, HEX('p'), 0.2, 1, 0);
        audio.spark();
        break;
      }
      case 'blast': {
        this.ring(e.x, e.y, 3, e.r, 0.3, HEX('a'), 2);
        this.ring(e.x, e.y, 1, e.r * 0.6, 0.22, HEX('v'), 1);
        for (let i = 0; i < 14 * ps; i++) this.spawnParticle(e.x, e.y, (Math.random() - 0.5) * 240, (Math.random() - 0.7) * 200, Math.random() < 0.5 ? HEX('a') : HEX('9'), 0.4, 2, 250);
        this.shake(140, 0.006);
        if (settings.flash && !settings.reducedMotion && e.r > 40) this.cameras.main.flash(60, 255, 200, 120, false);
        audio.blast(e.r > 40);
        break;
      }
      case 'pulse': {
        this.ring(e.x, e.y, 2, e.r, e.small ? 0.2 : 0.45, HEX('v'), e.small ? 1 : 2);
        if (!e.small) this.ring(e.x, e.y, 1, e.r * 0.7, 0.35, HEX('w'), 1);
        audio.pulse();
        break;
      }
      case 'dust': {
        for (let i = 0; i < 12 * ps; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = Math.random() * e.r * 2;
          this.spawnParticle(e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp - 10, Math.random() < 0.5 ? HEX('s') : HEX('7'), 0.7, 2, -10);
        }
        this.ring(e.x, e.y, 2, e.r, 0.4, HEX('s'), 1);
        audio.dust();
        break;
      }
      case 'ignite':
        audio.ignite();
        break;
      case 'arm':
        audio.tick();
        break;
      case 'resonance':
        this.ring(e.x, e.y, 4, 150, 0.7, HEX('e'), 1);
        audio.resonance();
        break;
      case 'magnet':
        this.ring(e.x, e.y, 100, 6, 0.42, HEX('8'), 1);
        break;
      case 'machine': {
        const m = this.machines[e.socket];
        if (m) {
          m.fire = 0.3;
          m.ty = e.y;
        }
        if (e.kind === 'thumper') {
          this.time.delayedCall(80 / settings.speed, () => {
            this.ring(e.x, e.y, 2, 14, 0.18, HEX('7'), 1);
            this.shake(50, 0.002);
            audio.thump();
          });
        } else if (e.kind === 'bell') {
          this.ring(e.x, e.y, 4, 140, 0.6, HEX('b'), 1);
          audio.bell();
        } else if (e.kind === 'brazier') {
          for (let i = 0; i < 8 * ps; i++) this.spawnParticle(e.x, RAIL_Y + 20, (Math.random() - 0.5) * 60, 40 + Math.random() * 60, HEX('a'), 0.5, 1, 100);
          audio.ignite();
        } else if (e.kind === 'antenna') {
          this.fx.push({ kind: 'beam', x: e.x, y: RAIL_Y + 12, r: 0, r2: e.y, life: 0.3, max: 0.3, color: HEX('v'), width: 3 });
        } else if (e.kind === 'winder') audio.tick();
        break;
      }
      case 'land':
        if (e.speed > 200) audio.land();
        break;
      case 'absorb':
        this.spawnParticle(e.x, e.y, 0, -10, HEX('s'), 0.3, 1, 0);
        break;
      case 'heartHit': {
        for (const v of this.views.values()) if (v.heart) v.flashT = e.weak ? 0.08 : 0.04;
        // 개별 숫자 대신 심장 위에 누적 피해를 보여 준다.
        this.heartDmgShown += e.dmg;
        this.heartHitT = 1.4;
        for (let i = 0; i < (e.weak ? 3 : 1) * ps; i++) this.spawnParticle(e.x + (Math.random() - 0.5) * 30, e.y + (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 60, -40 - Math.random() * 40, HEX('v'), 0.6, 1, 60);
        audio.heartHit(e.weak);
        break;
      }
      case 'heartPhase': {
        this.shake(300, 0.01);
        if (settings.flash && !settings.reducedMotion) this.cameras.main.flash(200, 255, 250, 220, false);
        this.ring(HEART_X, TRAY.F - 22, 10, 120, 0.8, HEX('w'), 2);
        audio.heartPhase();
        this.cheer();
        break;
      }
      case 'heartBreak': {
        this.shake(500, 0.012);
        if (settings.flash && !settings.reducedMotion) this.cameras.main.flash(400, 255, 255, 230, false);
        for (let i = 0; i < 60 * ps; i++) this.spawnParticle(e.x, e.y, (Math.random() - 0.5) * 300, -Math.random() * 300, Math.random() < 0.5 ? HEX('v') : HEX('w'), 1.2, 2, 150);
        this.ring(e.x, e.y, 10, 200, 1.2, HEX('v'), 3);
        this.heartCore = this.add.image(e.x, e.y, 'x_starcore').setDepth(13);
        audio.heartPhase();
        break;
      }
      case 'cartDone': {
        for (const id of e.leftovers) {
          const v = this.views.get(id);
          if (v) {
            this.views.delete(id);
            this.dying.push({ v, t: 0 });
          }
        }
        break;
      }
      case 'curio':
        this.cheer();
        audio.curio(e.isNew);
        this.refresh();
        break;
      case 'request':
        audio.request();
        break;
      case 'lamp':
        audio.lamp();
        this.refresh();
        break;
      case 'ending':
        this.startEnding();
        break;
    }
  }

  // ---------- 연출 요소 ----------
  private shake(ms: number, intensity: number) {
    const s = shakeScale();
    if (s <= 0) return;
    this.cameras.main.shake(ms, intensity * s, false);
  }

  private ring(x: number, y: number, r: number, r2: number, life: number, color: number, width: number) {
    if (settings.reducedMotion && r2 > 100) life *= 0.6;
    // 큰 연쇄에서도 원인이 읽히도록 동시에 보이는 고리 수를 제한한다.
    const rings = this.fx.reduce((n, f) => n + (f.kind === 'ring' ? 1 : 0), 0);
    if (rings > 14) return;
    if (rings > 8) life *= 0.6;
    this.fx.push({ kind: 'ring', x, y, r, r2, life, max: life, color, width });
  }

  private drawFx(dt: number) {
    const g = this.eg;
    this.fx = this.fx.filter((f) => {
      f.life -= dt;
      if (f.life <= 0) return false;
      const t = 1 - f.life / f.max;
      const a = Math.min(1, (f.life / f.max) * 1.5);
      if (f.kind === 'ring') {
        const r = f.r + (f.r2 - f.r) * easeOut(t);
        g.lineStyle(f.width, f.color, a);
        g.strokeCircle(Math.round(f.x), Math.round(f.y), Math.max(1, Math.round(r)));
      } else if (f.kind === 'spark' && f.pts) {
        g.lineStyle(f.width, f.color, a);
        g.beginPath();
        g.moveTo(Math.round(f.pts[0]), Math.round(f.pts[1]));
        for (let i = 2; i < f.pts.length; i += 2) g.lineTo(Math.round(f.pts[i]), Math.round(f.pts[i + 1]));
        g.strokePath();
        g.lineStyle(1, HEX('p'), a * 0.6);
        g.beginPath();
        g.moveTo(Math.round(f.pts[0]) + 1, Math.round(f.pts[1]));
        for (let i = 2; i < f.pts.length; i += 2) g.lineTo(Math.round(f.pts[i]) + 1, Math.round(f.pts[i + 1]));
        g.strokePath();
      } else if (f.kind === 'beam') {
        g.fillStyle(f.color, a);
        g.fillRect(Math.round(f.x) - 1, Math.round(f.y), f.width, Math.round(f.r2 - f.y));
      }
      return true;
    });
  }

  private spawnParticle(x: number, y: number, vx: number, vy: number, color: number, life: number, size: number, g: number) {
    if (this.particles.length > 700) return;
    this.particles.push({ x, y, vx, vy, life, max: life, color, size, g });
  }

  private updateParticles(dt: number) {
    const g = this.pg;
    g.clear();
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      if (p.life <= 0) return false;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y > TRAY.F && p.g > 0) {
        p.y = TRAY.F;
        p.vy *= -0.3;
        p.vx *= 0.6;
      }
      g.fillStyle(p.color, Math.min(1, (p.life / p.max) * 2));
      g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      return true;
    });
  }

  private coinBurst(x: number, y: number, coins: number, star: number, combo: number) {
    // 연쇄가 길수록 동전 수를 줄여 화면이 읽히게 한다(값은 이미 정산됨).
    const busy = this.flyers.length;
    const n = busy > 30 ? (Math.random() < 0.3 ? 1 : 0) : combo > 12 ? 1 : Math.min(3, 1 + Math.floor(Math.log10(Math.max(1, coins)) * 0.7));
    const scale = particleScale();
    for (let i = 0; i < Math.round(n * scale); i++) this.addFlyer(x, y, 'coin');
    if (star) for (let i = 0; i < Math.min(busy > 30 ? 1 : 3, star); i++) this.addFlyer(x, y, 'star');
    void combo;
  }

  private addFlyer(x: number, y: number, target: 'coin' | 'star') {
    if (this.flyers.length > 45) return;
    const img = this.add.image(x, y, target === 'coin' ? 'x_coin' : 'x_mote').setDepth(13);
    this.flyers.push({ img, x, y, vx: (Math.random() - 0.5) * 120, vy: -80 - Math.random() * 80, t: 0, target });
  }

  private updateFlyers(dt: number) {
    const ct = this.hooks.coinTarget();
    const st = this.hooks.starTarget();
    this.flyers = this.flyers.filter((f) => {
      f.t += dt;
      const tg = f.target === 'coin' ? ct : st;
      if (f.t < 0.3) {
        f.vy += 400 * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
      } else {
        const k = Math.min(1, (f.t - 0.3) * 3.2);
        f.x += (tg.x - f.x) * k * 0.35;
        f.y += (tg.y - f.y) * k * 0.35;
      }
      f.img.setPosition(Math.round(f.x), Math.round(f.y));
      if (f.t > 0.3 && Math.hypot(tg.x - f.x, tg.y - f.y) < 4) {
        f.img.destroy();
        return false;
      }
      if (f.t > 2) {
        f.img.destroy();
        return false;
      }
      return true;
    });
  }

  private popText(x: number, y: number, text: string, color: string, big: boolean) {
    if (this.texts.length > 14) {
      const old = this.texts.shift()!;
      old.setVisible(false);
      this.textPool.push(old);
    }
    let t = this.textPool.pop();
    if (!t) t = this.add.text(0, 0, '', { fontFamily: 'Galmuri7', fontSize: '8px', color: '#fff', stroke: '#16111c', strokeThickness: 2 }).setDepth(14).setResolution(1);
    t.setText(text).setColor(color).setVisible(true).setAlpha(1).setOrigin(0.5);
    t.setFontSize(big ? '16px' : '8px');
    t.setPosition(Math.round(Phaser.Math.Clamp(x, 20, W - 20)), Math.round(y));
    t.setData('life', big ? 1.0 : 0.7);
    this.texts.push(t);
  }

  private updateTexts(dt: number) {
    this.texts = this.texts.filter((t) => {
      const life = (t.getData('life') as number) - dt;
      t.setData('life', life);
      t.y -= dt * 18;
      t.setAlpha(Math.min(1, life * 3));
      t.setY(Math.round(t.y * 1));
      if (life <= 0) {
        t.setVisible(false);
        this.textPool.push(t);
        return false;
      }
      return true;
    });
  }

  private updateTool(dt: number) {
    const a = this.toolAnim;
    if (!a) return;
    a.t += dt;
    const h = this.toolImg.height;
    if (a.phase === 'down') {
      const k = Math.min(1, a.t / 0.11);
      const y = a.y - 34 + 34 * k * k - h / 2 + 3;
      this.toolImg.setPosition(Math.round(a.x), Math.round(y));
    } else {
      const k = Math.min(1, a.t / 0.2);
      this.toolImg.setPosition(Math.round(a.x), Math.round(a.y - h / 2 + 3 - 10 * k));
      this.toolImg.setAlpha(1 - k);
      if (k >= 1) {
        this.toolImg.setVisible(false);
        this.toolAnim = null;
      }
    }
  }

  private updateMachines(dt: number) {
    for (const m of this.machines) {
      if (!m.kind) continue;
      if (m.fire > 0) m.fire -= dt;
      const f = Math.max(0, m.fire);
      if (m.kind === 'thumper' && m.head) {
        const restY = m.body.y + m.body.height / 2 + 2;
        const ext = f > 0.2 ? 1 - (f - 0.2) / 0.1 : f / 0.2;
        const hy = restY + (Math.max(restY, m.ty - 4) - restY) * Math.max(0, Math.min(1, ext));
        m.head.setY(Math.round(hy));
        this.eg.fillStyle(HEX('k'));
        this.eg.fillRect(Math.round(m.body.x) - 1, Math.round(restY - 3), 2, Math.round(hy - restY) + 2);
      } else if (m.kind === 'bell') {
        m.body.setAngle(f > 0 ? Math.sin(f * 40) * 12 : 0);
      } else if (m.kind === 'winder') {
        m.body.setFlipX(f > 0 && Math.floor(f * 20) % 2 === 0);
      } else if (m.kind === 'brazier') {
        m.body.setTint(f > 0 ? 0xffddaa : 0xffffff);
      }
    }
  }

  private updateCharacters(dt: number) {
    if (this.keeperCheer > 0) {
      this.keeperCheer -= dt;
      this.keeper.setTexture('x_keeperCheer');
    } else this.keeper.setTexture('x_keeper');
    const bob = Math.floor(this.time0 * 1.6) % 2;
    this.keeper.y = 240 - Math.ceil(this.keeper.height / 2) - bob;
    if (this.magpie.visible) {
      if (this.magpieFly) {
        const f = this.magpieFly;
        f.t += dt;
        const k = f.t < 0.3 ? f.t / 0.3 : Math.max(0, 1 - (f.t - 0.5) / 0.4);
        const hx = 378;
        const hy = RAIL_Y - 5;
        this.magpie.setPosition(Math.round(hx + (f.x - hx) * k), Math.round(hy + (f.y - hy) * k - Math.sin(k * Math.PI) * 10));
        this.magpie.setTexture(Math.floor(f.t * 12) % 2 ? 'x_magpieFly' : 'x_magpie');
        this.magpie.setFlipX(f.x < hx);
        if (f.t > 0.9) {
          this.magpieFly = null;
          this.magpie.setPosition(hx, hy).setTexture('x_magpie').setFlipX(true);
        }
      } else {
        this.magpie.setFlipX(true);
        this.magpie.y = RAIL_Y - 5 - (Math.floor(this.time0 * 0.8) % 5 === 0 ? 1 : 0);
      }
    }
  }

  private updateCart(dt: number) {
    if (this.cartT < 0) return;
    this.cartT += dt;
    const t = this.cartT;
    const inX = DOOR.x + 34;
    const outX = DOOR.x + DOOR.w + 40;
    let x = outX;
    let ang = 0;
    if (t < 0.25) x = outX + (inX - outX) * easeOut(t / 0.25);
    else if (t < 1.3) {
      x = inX;
      ang = -Math.min(1, (t - 0.25) / 0.15) * 18;
      if (t > 1.1) ang *= (1.3 - t) / 0.2;
    } else if (t < 1.7) x = inX + (outX - inX) * ((t - 1.3) / 0.4);
    else {
      this.cartT = -1;
      x = outX;
    }
    this.cart.setPosition(Math.round(x), DOOR.y + DOOR.h - 12);
    this.cart.setAngle(ang);
    const wheelKey = Math.floor(x / 3) % 2 ? 'x_wheel0' : 'x_wheel1';
    (this.cart.list[1] as Phaser.GameObjects.Image).setTexture(wheelKey);
    (this.cart.list[2] as Phaser.GameObjects.Image).setTexture(wheelKey);
  }

  private drawReticle() {
    const g = this.rg;
    g.clear();
    const p = this.pointer;
    if (!p.inside || this.hooks.modalOpen() || this.frozen) return;
    if (p.x < TRAY.L || p.x > TRAY.R || p.y < TRAY.TOP - 16 || p.y > TRAY.F + 6) return;
    const b = this.core.bench;
    const tool = TOOL[this.core.s.tool];
    const ready = !!b && b.canStrike();
    const r = Math.round(tool.radius * this.core.mods.radiusMult);
    const col = ready ? HEX('w') : HEX('k');
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    // 점선 원
    const n = Math.max(12, Math.round(r * 1.2));
    g.fillStyle(col, ready ? 0.9 : 0.5);
    for (let i = 0; i < n; i++) {
      if (i % 2) continue;
      const a = (i / n) * Math.PI * 2;
      g.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 1, 1);
    }
    g.fillRect(x - 1, y, 3, 1);
    g.fillRect(x, y - 1, 1, 3);
    if (b && ready) {
      // 영향권 표시
      const reach = tool.id === 'magnet' ? 100 : r;
      for (const it of b.items) {
        if (it.dead || it.heart) continue;
        const d = Math.hypot(it.x - x, it.y - y) - it.r;
        if (d > reach) continue;
        if (tool.id === 'magnet' && it.def.mat !== 'metal') continue;
        if (tool.id === 'key' && it.def.mat !== 'clock') continue;
        g.fillStyle(MAT_COLOR[it.def.mat as Material], 0.9);
        g.fillRect(Math.round(it.x) - 1, Math.round(it.y - it.r) - 4, 3, 1);
        g.fillRect(Math.round(it.x), Math.round(it.y - it.r) - 5, 1, 3);
      }
      if (tool.id === 'fork') {
        g.fillStyle(HEX('e'), 0.7);
        for (const it of b.items) if (!it.dead && it.def.mat === 'glass') g.fillRect(Math.round(it.x), Math.round(it.y - it.r) - 4, 1, 1);
      }
      if (tool.id === 'magnet') {
        g.lineStyle(1, HEX('8'), 0.25);
        g.strokeCircle(x, y, 100);
      }
    }
  }

  private drawHeartBar(dt: number) {
    const h = this.core.s.heart;
    const onBench = !!this.core.bench?.heartAlive && this.core.bench.site.id === 'crater';
    if (!h || !onBench) {
      this.heartText?.setVisible(false);
      return;
    }
    const g = this.rg;
    const x = HEART_X - 26;
    const y = TRAY.F - 54;
    g.fillStyle(HEX('0'));
    g.fillRect(x - 1, y - 1, 54, 5);
    g.fillStyle(HEX('2'));
    g.fillRect(x, y, 52, 3);
    const colors = [HEX('a'), HEX('e'), HEX('v')];
    g.fillStyle(colors[Math.min(2, h.phase)]);
    g.fillRect(x, y, Math.max(0, Math.round((52 * h.hp) / h.max)), 3);
    for (const k of [1 / 3, 2 / 3]) {
      g.fillStyle(HEX('0'));
      g.fillRect(x + Math.round(52 * k), y, 1, 3);
    }
    if (!this.heartText) this.heartText = this.add.text(0, 0, '', { fontFamily: 'Galmuri7', fontSize: '8px', color: '#fff4a8', stroke: '#16111c', strokeThickness: 2 }).setOrigin(0.5, 1).setDepth(14).setResolution(1);
    this.heartHitT -= dt;
    if (this.heartHitT > 0 && this.heartDmgShown > 0) {
      this.heartText.setVisible(true).setText(`-${fmtShort(this.heartDmgShown)}`).setPosition(HEART_X, y - 2).setAlpha(Math.min(1, this.heartHitT * 2));
    } else {
      this.heartDmgShown = 0;
      this.heartText.setVisible(false);
    }
  }

  // ---------- 엔딩 ----------
  private startEnding() {
    this.frozen = true;
    this.endingT = 0;
    if (!this.heartCore) this.heartCore = this.add.image(HEART_X, TRAY.F - 22, 'x_starcore').setDepth(13);
    audio.ending();
  }
  private updateEnding(dt: number) {
    if (this.endingT < 0 || !this.heartCore) return;
    this.endingT += dt;
    const t = this.endingT;
    const sx = HEART_X;
    const sy = TRAY.F - 22;
    const tx = WINDOW.x + 44;
    const ty = WINDOW.y + 10;
    const k = Math.min(1, t / 3);
    const e = easeInOut(k);
    this.heartCore.setPosition(Math.round(sx + (tx - sx) * e), Math.round(sy + (ty - sy) * e - Math.sin(e * Math.PI) * 30));
    if (Math.random() < 0.6) this.spawnParticle(this.heartCore.x, this.heartCore.y, (Math.random() - 0.5) * 30, 20, HEX('v'), 0.8, 1, 0);
    if (t > 3 && t - dt <= 3) {
      if (settings.flash && !settings.reducedMotion) this.cameras.main.flash(800, 255, 255, 240, false);
      this.heartCore.destroy();
      this.heartCore = null;
      this.endingT = -1;
      this.bgKey = '';
      this.refresh();
      this.cheer();
    }
  }
  endEndingFreeze() {
    this.frozen = false;
  }

  clearAll() {
    for (const v of this.views.values()) this.destroyView(v);
    this.views.clear();
    this.bgKey = '';
    this.refresh();
  }
}

function easeOut(t: number) {
  return 1 - (1 - t) * (1 - t);
}
function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
export function fmtShort(n: number) {
  n = Math.round(n);
  if (n < 10000) return String(n);
  if (n < 1e8) return (n / 1e4).toFixed(n < 1e5 ? 1 : 0) + '만';
  if (n < 1e12) return (n / 1e8).toFixed(n < 1e9 ? 1 : 0) + '억';
  return (n / 1e12).toFixed(1) + '조';
}
void JUNK;
