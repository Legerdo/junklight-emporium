// 작업대 시뮬레이션: 결정적 고정 스텝 물리 + 재질 반응 + 연쇄.
// 화면 연출과 분리되어 있으며, 뷰는 items/shards 상태와 events만 읽는다.
import { HEART_PHASES, JUNK, SOCKET_X } from './data';
import type { Mods } from './mods';
import { Rng } from './rng';
import type {
  BenchSnapshot,
  DamageSrc,
  JunkDef,
  MachineKind,
  Material,
  SiteDef,
  ToolDef,
  ToolKind,
} from './types';

export const TRAY = { L: 140, R: 350, F: 232, TOP: 112 };
export const HEART_X = (TRAY.L + TRAY.R) / 2;
export const DT = 1 / 60;
const MAX_ITEMS = 110;

export interface Item {
  id: number;
  def: JunkDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  m: number;
  hp: number;
  maxHp: number;
  vuln: number;
  burning: boolean;
  burnT: number;
  burnOrigin: number;
  fuse: number;
  fuseOrigin: number;
  keyBoost: boolean;
  shiny: boolean;
  depth: number;
  dead: boolean;
  heart: boolean;
  landCd: number;
  hitFlash: number;
}

export interface Shard {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  bounces: number;
  origin: number;
  src: number;
  lastHit: number;
}

export type BenchEvent =
  | { k: 'spawn'; id: number }
  | { k: 'aim'; x: number; y: number; tool: ToolKind; r: number; auto: boolean }
  | { k: 'impact'; x: number; y: number; tool: ToolKind; r: number; hits: number; auto: boolean }
  | { k: 'hit'; id: number; x: number; y: number; dmg: number; src: DamageSrc; mat: Material }
  | {
      k: 'break';
      id: number;
      x: number;
      y: number;
      def: string;
      mat: Material;
      coins: number;
      star: number;
      curioChance: number;
      shiny: boolean;
      combo: number;
      mult: number;
      origin: number;
      src: DamageSrc;
    }
  | { k: 'spark'; x1: number; y1: number; x2: number; y2: number; origin: number; len: number }
  | { k: 'blast'; x: number; y: number; r: number; origin: number }
  | { k: 'pulse'; x: number; y: number; r: number; small: boolean }
  | { k: 'dust'; x: number; y: number; r: number }
  | { k: 'ignite'; id: number }
  | { k: 'arm'; id: number }
  | { k: 'resonance'; x: number; y: number }
  | { k: 'magnet'; x: number; y: number; pulled: number }
  | { k: 'machine'; socket: number; kind: MachineKind; x: number; y: number }
  | { k: 'comboEnd'; n: number }
  | { k: 'freeStrike' }
  | { k: 'heartHit'; dmg: number; weak: boolean; x: number; y: number; src: DamageSrc }
  | { k: 'land'; id: number; speed: number; mat: Material }
  | { k: 'absorb'; x: number; y: number }
  | { k: 'settled' }
  | { k: 'spill'; x: number; y: number; n: number };

interface Timer {
  t: number;
  fn: () => void;
}

export interface BenchOpts {
  site: SiteDef;
  mods: Mods;
  tool: ToolDef;
  sockets: (MachineKind | null)[];
  seed: number;
  heart: { hp: number; phase: number } | null;
}

export class Bench {
  site: SiteDef;
  mods: Mods;
  tool: ToolDef;
  sockets: (MachineKind | null)[];
  rng: Rng;
  items: Item[] = [];
  shards: Shard[] = [];
  events: BenchEvent[] = [];
  time = 0;
  phase: 'dump' | 'ready' = 'dump';
  strikesLeft: number;
  extraStrikes = 0;
  freeGiven = 0;
  firstStrikeUsed = false;
  machinesFired = false;
  bellsRung = 0;
  combo = 0;
  comboTimer = 0;
  bestCombo = 0;
  loadCount = 0;
  heartPhase = 0;
  heartAlive: boolean;
  cartValueStart = 0;

  private nextId = 1;
  private nextOrigin = 1;
  private timers: Timer[] = [];
  private spawnQueue: { t: number; def: string; shiny: boolean }[] = [];
  private settleT = 0;
  private lastSpawnT = 0;
  private windup = 0;
  private pendingStrike: { x: number; y: number; auto: boolean } | null = null;
  private pull: { x: number; y: number; t: number; ids: Set<number>; origin: number } | null = null;
  private calmT = 0;
  originTool = new Map<number, ToolKind | 'machine' | 'dump'>();

  constructor(o: BenchOpts) {
    this.site = o.site;
    this.mods = o.mods;
    this.tool = o.tool;
    this.sockets = o.sockets;
    this.rng = new Rng(o.seed);
    this.strikesLeft = o.mods.strikes;
    this.heartAlive = !!o.heart && o.heart.hp > 0;
    this.heartPhase = o.heart?.phase ?? 0;
    this.originTool.set(0, 'dump');
    if (this.heartAlive) this.addHeart();
  }

  // ---------- 수레 생성/복원 ----------
  generateCart(): string[] {
    const m = this.mods;
    const entries: { w: number; v: string }[] = [];
    let hasClock = false;
    for (const [id, w] of Object.entries(this.site.pool)) {
      const mat = JUNK[id].mat;
      if (mat === 'clock') hasClock = true;
      entries.push({ w: w * (m.poolBias[mat] ?? 1), v: id });
    }
    if (!hasClock && m.poolBias.clock) entries.push({ w: 6 * m.poolBias.clock, v: 'windup' });
    const out: string[] = [];
    for (let i = 0; i < m.cartSize; i++) out.push(this.rng.pickWeighted(entries));
    return out;
  }

  loadCart(defs: string[]) {
    this.loadCount = defs.length;
    let t = 0.25;
    for (const d of defs) {
      this.spawnQueue.push({ t, def: d, shiny: this.rng.chance(this.mods.shinyChance) });
      t += 0.055;
    }
    this.cartValueStart = defs.reduce((a, d) => a + JUNK[d].coins, 0);
  }

  private addHeart() {
    const def = JUNK.heart;
    const it = this.makeItem(def, HEART_X, TRAY.F - def.r, false, 0);
    it.heart = true;
    it.m = 1e9;
    this.items.push(it);
  }

  private makeItem(def: JunkDef, x: number, y: number, shiny: boolean, depth: number): Item {
    let hp = def.hp;
    if (def.mat === 'glass') hp += this.mods.glassHpBonus;
    if (def.id === 'safe') hp = Math.max(1, Math.round(hp * this.mods.safeHpMult));
    return {
      id: this.nextId++,
      def,
      x,
      y,
      vx: 0,
      vy: 0,
      r: def.r,
      m: def.r * def.r,
      hp,
      maxHp: hp,
      vuln: 0,
      burning: false,
      burnT: 0,
      burnOrigin: 0,
      fuse: -1,
      fuseOrigin: 0,
      keyBoost: false,
      shiny,
      depth,
      dead: false,
      heart: false,
      landCd: 0,
      hitFlash: 0,
    };
  }

  private spawn(defId: string, x: number, y: number, vx: number, vy: number, shiny: boolean, depth: number) {
    if (this.items.length >= MAX_ITEMS) return null;
    const it = this.makeItem(JUNK[defId], x, y, shiny, depth);
    it.vx = vx;
    it.vy = vy;
    this.items.push(it);
    this.events.push({ k: 'spawn', id: it.id });
    return it;
  }

  snapshot(): BenchSnapshot {
    return {
      site: this.site.id,
      strikesLeft: this.strikesLeft,
      extraStrikes: this.extraStrikes,
      firstStrikeUsed: this.firstStrikeUsed,
      items: this.items
        .filter((i) => !i.dead && !i.heart)
        .map((i) => {
          const s: BenchSnapshot['items'][number] = { d: i.def.id, x: Math.round(i.x), y: Math.round(i.y), hp: i.hp };
          if (i.shiny) s.s = 1;
          if (i.depth) s.dp = i.depth;
          if (i.burning) s.b = 1;
          if (i.fuse >= 0) s.f = Math.round(i.fuse * 100) / 100;
          if (i.vuln) s.v = i.vuln;
          return s;
        }),
      rng: this.rng.s,
      cartValueStart: this.cartValueStart,
      pending: this.spawnQueue.map((q) => q.def),
      machinesFired: this.machinesFired,
      freeGiven: this.freeGiven,
      bellsRung: this.bellsRung,
      loadCount: this.loadCount,
    };
  }

  restore(s: BenchSnapshot) {
    this.strikesLeft = s.strikesLeft;
    this.extraStrikes = s.extraStrikes;
    this.firstStrikeUsed = s.firstStrikeUsed;
    this.rng.s = s.rng;
    this.cartValueStart = s.cartValueStart;
    this.machinesFired = s.machinesFired;
    this.freeGiven = s.freeGiven ?? 0;
    this.bellsRung = s.bellsRung ?? 0;
    this.loadCount = s.loadCount ?? s.items.length;
    for (const si of s.items) {
      const def = JUNK[si.d];
      if (!def) continue;
      const it = this.makeItem(def, clamp(si.x, TRAY.L + def.r, TRAY.R - def.r), Math.min(si.y, TRAY.F - def.r), !!si.s, si.dp ?? 0);
      it.hp = Math.min(si.hp, it.maxHp);
      it.burning = !!si.b;
      it.fuse = si.f ?? -1;
      it.vuln = si.v ?? 0;
      this.items.push(it);
    }
    let t = 0.2;
    for (const d of s.pending ?? []) {
      if (!JUNK[d]) continue;
      this.spawnQueue.push({ t, def: d, shiny: false });
      t += 0.055;
    }
    this.phase = 'dump';
  }

  // ---------- 입력 ----------
  get totalStrikes() {
    return this.strikesLeft + this.extraStrikes;
  }
  canStrike() {
    return this.phase === 'ready' && this.totalStrikes > 0 && this.windup <= 0 && !this.pendingStrike && !this.pull;
  }

  strike(x: number, y: number, auto = false): boolean {
    if (!this.canStrike()) return false;
    x = clamp(x, TRAY.L, TRAY.R);
    y = clamp(y, TRAY.TOP - 20, TRAY.F);
    if (this.extraStrikes > 0) this.extraStrikes--;
    else this.strikesLeft--;
    this.windup = 0.11;
    this.calmT = 0;
    this.pendingStrike = { x, y, auto };
    this.events.push({ k: 'aim', x, y, tool: this.tool.id, r: this.toolRadius(), auto });
    return true;
  }

  toolRadius() {
    return this.tool.radius * this.mods.radiusMult;
  }

  // 까치/봇용: 가장 가치 있는 타격 지점을 찾는다.
  bestStrikePoint(tool: ToolDef = this.tool): { x: number; y: number; score: number } | null {
    const r = tool.radius * this.mods.radiusMult;
    let best: { x: number; y: number; score: number } | null = null;
    const glassAll = tool.id === 'fork' ? this.items.filter((i) => !i.dead && i.def.mat === 'glass').reduce((a, i) => a + (i.def.coins + 1) * 1.5, 0) : 0;
    const live = this.items.filter((i) => !i.dead && !i.heart);
    if (!live.length) {
      if (this.heartAlive) {
        const h = this.items.find((i) => i.heart)!;
        return { x: h.x, y: h.y - h.r, score: 1 };
      }
      return null;
    }
    for (const c of live) {
      const cx = c.x;
      const cy = c.y;
      let score = glassAll;
      for (const it of live) {
        const d = Math.hypot(it.x - cx, it.y - cy) - it.r;
        const mat = it.def.mat;
        let reach = r;
        if (tool.id === 'magnet') reach = mat === 'metal' ? 100 : 18;
        if (tool.id === 'key' && mat !== 'clock') reach = 12;
        if (d > reach) continue;
        let v = it.def.coins + 1;
        if (tool.id === 'key' && mat === 'clock') v *= 4;
        if (tool.id === 'key' && mat !== 'clock') v *= 0.4;
        if (tool.id === 'poker' && (mat === 'wood' || mat === 'cloth')) v *= 3;
        if (tool.id === 'magnet' && mat === 'metal') v *= 1.6;
        if (tool.id === 'fork') v *= mat === 'glass' ? 0 : 0.5;
        if (mat === 'clock' || mat === 'star') v *= 2.5;
        if (mat === 'glass') v *= 1.5;
        if (mat === 'metal') v *= 1.3;
        if (it.hp <= tool.dmg + this.mods.power) v *= 1.8;
        score += v;
      }
      if (this.heartAlive) {
        const h = this.items.find((i) => i.heart)!;
        const d = Math.hypot(h.x - cx, h.y - cy);
        if (d < 70) score *= 1.5;
      }
      if (!best || score > best.score) best = { x: cx, y: cy, score };
    }
    return best;
  }

  // ---------- 스텝 ----------
  step(dt = DT) {
    this.time += dt;
    // 쏟기
    while (this.spawnQueue.length && this.spawnQueue[0].t <= this.time) {
      const q = this.spawnQueue.shift()!;
      const r = this.rng;
      this.spawn(q.def, TRAY.R - 16 + r.range(-6, 6), TRAY.TOP - 14 + r.range(-6, 6), r.range(-170, -30), r.range(-80, 10), q.shiny, 0);
      this.lastSpawnT = this.time;
    }
    this.applyPulls(dt);
    this.physics(dt);
    this.updateShards(dt);
    this.runTimers();
    this.updateBurning(dt);
    this.updateFuses(dt);
    if (this.windup > 0) {
      this.windup -= dt;
      if (this.windup <= 0 && this.pendingStrike) {
        const p = this.pendingStrike;
        this.pendingStrike = null;
        this.resolveStrike(p.x, p.y, p.auto);
        this.windup = 0;
      }
    }
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.events.push({ k: 'comboEnd', n: this.combo });
        this.combo = 0;
      }
    }
    if (this.phase === 'dump' && !this.spawnQueue.length) {
      const moving = this.items.some((i) => !i.dead && !i.heart && Math.abs(i.vx) + Math.abs(i.vy) > 24);
      this.settleT = moving ? 0 : this.settleT + dt;
      if (this.settleT > 0.15 || this.time - this.lastSpawnT > 1.3) {
        this.phase = 'ready';
        this.events.push({ k: 'settled' });
      }
    }
    this.calmT = this.isBusy() ? 0 : this.calmT + dt;
    if (this.items.some((i) => i.dead)) this.items = this.items.filter((i) => !i.dead);
  }

  isBusy() {
    return (
      this.spawnQueue.length > 0 ||
      this.timers.length > 0 ||
      this.shards.length > 0 ||
      this.windup > 0 ||
      !!this.pendingStrike ||
      !!this.pull ||
      this.comboTimer > 0 ||
      this.items.some((i) => !i.dead && (i.burning || i.fuse >= 0))
    );
  }
  isQuiet() {
    return this.phase === 'ready' && this.calmT > 0.35;
  }

  private schedule(delay: number, fn: () => void) {
    this.timers.push({ t: this.time + delay, fn });
  }
  private runTimers() {
    if (!this.timers.length) return;
    // 실행 도중 새 타이머가 추가될 수 있으므로 복사 후 처리
    const due = this.timers.filter((t) => t.t <= this.time);
    if (!due.length) return;
    this.timers = this.timers.filter((t) => t.t > this.time);
    due.sort((a, b) => a.t - b.t);
    for (const t of due) t.fn();
  }

  private newOrigin(kind: ToolKind | 'machine' | 'dump') {
    const o = this.nextOrigin++;
    this.originTool.set(o, kind);
    return o;
  }

  // ---------- 물리 ----------
  private physics(dt: number) {
    const g = this.site.gravity;
    const items = this.items;
    for (const it of items) {
      if (it.dead || it.heart) continue;
      it.vy += g * dt;
      it.vx *= 0.998;
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      if (it.landCd > 0) it.landCd -= dt;
      if (it.hitFlash > 0) it.hitFlash -= dt;
      if (it.x - it.r < TRAY.L) {
        it.x = TRAY.L + it.r;
        it.vx = Math.abs(it.vx) * 0.3;
      } else if (it.x + it.r > TRAY.R) {
        it.x = TRAY.R - it.r;
        it.vx = -Math.abs(it.vx) * 0.3;
      }
      if (it.y + it.r > TRAY.F) {
        if (it.vy > 120) this.events.push({ k: 'land', id: it.id, speed: it.vy, mat: it.def.mat });
        it.y = TRAY.F - it.r;
        if (it.vy > 0) it.vy *= this.site.gravity < 400 ? -0.35 : -0.15;
        it.vx *= 0.9;
      }
      if (it.y < -60) it.y = -60;
    }
    // 격자 기반 충돌
    const cell = 28;
    const grid = new Map<number, Item[]>();
    for (const it of items) {
      if (it.dead) continue;
      const cx = Math.floor(it.x / cell);
      const cy = Math.floor((it.y + 80) / cell);
      const span = it.heart ? 1 : 0;
      for (let ox = -span; ox <= span; ox++)
        for (let oy = -span; oy <= span; oy++) {
          const key = (cx + ox) * 1000 + (cy + oy);
          let arr = grid.get(key);
          if (!arr) grid.set(key, (arr = []));
          arr.push(it);
        }
    }
    for (let iter = 0; iter < 3; iter++) {
      for (const a of items) {
        if (a.dead) continue;
        const cx = Math.floor(a.x / cell);
        const cy = Math.floor((a.y + 80) / cell);
        for (let ox = -1; ox <= 1; ox++)
          for (let oy = -1; oy <= 1; oy++) {
            const arr = grid.get((cx + ox) * 1000 + (cy + oy));
            if (!arr) continue;
            for (const b of arr) {
              if (b.id <= a.id || b.dead) continue;
              this.collide(a, b, iter === 0);
            }
          }
      }
    }
    for (const it of items) {
      if (it.dead || it.heart) continue;
      const sp = Math.abs(it.vx) + Math.abs(it.vy);
      if (sp < 16) {
        it.vx *= 0.8;
        it.vy *= 0.85;
      }
      if (!Number.isFinite(it.x) || !Number.isFinite(it.y)) {
        it.x = HEART_X;
        it.y = TRAY.TOP;
        it.vx = it.vy = 0;
      }
    }
  }

  private collide(a: Item, b: Item, first: boolean) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const rr = a.r + b.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) return;
    const d = Math.sqrt(d2) || 0.01;
    const nx = dx / d;
    const ny = dy / d;
    const overlap = rr - d;
    const ia = a.heart ? 0 : 1 / a.m;
    const ib = b.heart ? 0 : 1 / b.m;
    const sum = ia + ib;
    if (sum === 0) return;
    const corr = (overlap * 0.8) / sum;
    a.x -= nx * corr * ia;
    a.y -= ny * corr * ia;
    b.x += nx * corr * ib;
    b.y += ny * corr * ib;
    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      if (first && this.mods.landing && -vn > 150) this.landingHit(a, b, ny);
      const j = (-(1 + 0.12) * vn) / sum;
      a.vx -= j * nx * ia;
      a.vy -= j * ny * ia;
      b.vx += j * nx * ib;
      b.vy += j * ny * ib;
      // 접선 마찰
      const tx = -ny;
      const ty = nx;
      const vt = rvx * tx + rvy * ty;
      const f = (vt * 0.12) / sum;
      a.vx += f * tx * ia;
      a.vy += f * ty * ia;
      b.vx -= f * tx * ib;
      b.vy -= f * ty * ib;
    }
  }

  private landingHit(a: Item, b: Item, ny: number) {
    // ny > 0 이면 a가 위, b가 아래
    const top = ny > 0 ? a : b;
    const bottom = ny > 0 ? b : a;
    if (top.def.mat !== 'metal' || top.landCd > 0 || top.heart) return;
    top.landCd = 0.35;
    this.schedule(0, () => this.damage(bottom, 1, 'landing', 0));
  }

  private applyPulls(dt: number) {
    if (this.pull) {
      const p = this.pull;
      p.t -= dt;
      for (const it of this.items) {
        if (it.dead || !p.ids.has(it.id)) continue;
        const dx = p.x - it.x;
        const dy = p.y - it.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > 6) {
          it.vx += (dx / d) * 1400 * dt;
          it.vy += (dy / d) * 1400 * dt - this.site.gravity * dt * 0.8;
          const sp = Math.hypot(it.vx, it.vy);
          if (sp > 260) {
            it.vx *= 260 / sp;
            it.vy *= 260 / sp;
          }
        } else {
          it.vx *= 0.5;
          it.vy *= 0.5;
        }
      }
      if (p.t <= 0) {
        this.pull = null;
        this.magnetShock(p.x, p.y, p.origin, p.ids);
      }
    }
    if (this.phase === 'dump') {
      this.sockets.forEach((k, i) => {
        if (k !== 'magnetpole') return;
        const sx = SOCKET_X[i];
        for (const it of this.items) {
          if (it.dead || it.heart || it.def.mat !== 'metal') continue;
          const dx = sx - it.x;
          if (Math.abs(dx) < 120 && Math.abs(dx) > 3) it.vx += Math.sign(dx) * 520 * dt;
        }
      });
    }
  }

  // ---------- 타격 ----------
  private resolveStrike(x: number, y: number, auto: boolean) {
    const tool = this.tool;
    const origin = this.newOrigin(tool.id);
    let bonus = 0;
    if (!this.firstStrikeUsed) {
      this.firstStrikeUsed = true;
      bonus = this.mods.firstStrikeBonus;
    }
    const dmg = tool.dmg + this.mods.power + bonus;
    const r = this.toolRadius();
    let hits = 0;
    const inR = (rad: number) => this.items.filter((i) => !i.dead && Math.hypot(i.x - x, i.y - y) - i.r < rad);

    switch (tool.id) {
      case 'crowbar': {
        // 한 물건을 강하게 비틀고, 맞닿은 물건들을 벌려 절반 피해를 준다.
        const c = inR(r).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
        if (c) {
          hits = 1;
          const cx = c.x;
          const cy = c.y;
          const cr = c.r;
          const around = this.items.filter((o) => o !== c && !o.dead && Math.hypot(o.x - cx, o.y - cy) - o.r - cr < 3);
          this.damage(c, c.def.id === 'safe' ? dmg * 2 : dmg, 'strike', origin);
          this.push(c, x, y - 10, 90);
          for (const o of around) {
            hits++;
            this.damage(o, Math.max(1, Math.floor(dmg / 2)), 'strike', origin);
            this.push(o, cx, cy, 80);
          }
        }
        break;
      }
      case 'magnet': {
        const ids = new Set(
          this.items.filter((i) => !i.dead && !i.heart && i.def.mat === 'metal' && Math.hypot(i.x - x, i.y - y) < 100).map((i) => i.id),
        );
        this.pull = { x, y, t: 0.42, ids, origin };
        hits = ids.size;
        // 자석 자체도 묵직해서, 끝으로 누른 자리의 물건은 눌린다.
        for (const it of inR(14)) {
          if (it.def.mat === 'metal') continue;
          hits++;
          this.damage(it, dmg, 'strike', origin);
        }
        this.events.push({ k: 'magnet', x, y, pulled: ids.size });
        break;
      }
      case 'fork': {
        for (const it of inR(r)) {
          hits++;
          this.damage(it, tool.dmg + Math.floor(this.mods.power / 2) + bonus, 'strike', origin);
        }
        this.resonance(x, y, 2 + this.mods.power, origin);
        break;
      }
      case 'poker': {
        for (const it of inR(r)) {
          hits++;
          this.damage(it, dmg, 'strike', origin);
        }
        for (const it of inR(r + 6)) if (!it.dead) this.ignite(it, origin, true);
        break;
      }
      case 'key': {
        for (const it of inR(r)) {
          if (it.def.mat === 'clock' && it.fuse < 0 && !it.dead) {
            it.keyBoost = true;
            this.arm(it, origin, this.mods.fuse * 0.8);
            hits++;
          }
        }
        for (const it of inR(12)) {
          if (it.def.mat !== 'clock') {
            hits++;
            this.damage(it, dmg, 'strike', origin);
          }
        }
        break;
      }
      default: {
        for (const it of inR(r)) {
          hits++;
          this.damage(it, dmg, 'strike', origin);
          this.push(it, x, y - 6, 70);
        }
      }
    }
    this.events.push({ k: 'impact', x, y, tool: tool.id, r, hits, auto });
    // 장치는 그 수레의 첫 타격 소리에 맞춰 움직인다.
    if (!this.machinesFired) {
      this.machinesFired = true;
      this.fireMachines();
    }
  }

  private push(it: Item, x: number, y: number, power: number) {
    if (it.dead || it.heart) return;
    const dx = it.x - x;
    const dy = it.y - y;
    const d = Math.hypot(dx, dy) || 1;
    it.vx += (dx / d) * power;
    it.vy += (dy / d) * power;
  }

  // 끌어모은 금속 전체(와 중심 근처의 금속)에 전기를 흘린다.
  private magnetShock(x: number, y: number, origin: number, pulled: Set<number>) {
    const dmg = this.tool.dmg + this.mods.power;
    const near = this.items
      .filter((i) => !i.dead && (pulled.has(i.id) || ((i.def.mat === 'metal' || i.heart) && Math.hypot(i.x - x, i.y - y) - i.r < 26)))
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
    near.forEach((it, i) => {
      this.schedule(i * 0.04, () => {
        if (it.dead) return;
        this.events.push({ k: 'spark', x1: x, y1: y, x2: it.x, y2: it.y, origin, len: 1 });
        this.damage(it, dmg, 'spark', origin);
      });
    });
    const first = near.find((i) => !i.heart);
    if (first) this.schedule(0.1, () => this.sparkFrom(first.x, first.y, first.id, this.mods.sparkJumps, origin, new Set([first.id]), { len: 0 }));
  }

  // ---------- 장치 ----------
  private fireMachines() {
    let bellIdx = 0;
    this.sockets.forEach((k, i) => {
      if (!k) return;
      const sx = SOCKET_X[i];
      if (k === 'bell') {
        bellIdx++;
        return;
      }
      this.schedule(0.3 + i * 0.3, () => {
        const origin = this.newOrigin('machine');
        const col = this.items
          .filter((it) => !it.dead && Math.abs(it.x - sx) < it.r + 7)
          .sort((a, b) => a.y - a.r - (b.y - b.r))[0];
        const y = col ? col.y - col.r * 0.3 : TRAY.F - 4;
        this.events.push({ k: 'machine', socket: i, kind: k, x: sx, y });
        const power = this.mods.power;
        switch (k) {
          case 'thumper': {
            for (const it of this.items) {
              if (it.dead || Math.hypot(it.x - sx, it.y - y) - it.r > 14) continue;
              this.damage(it, 2 + power, 'machine', origin);
              this.push(it, sx, y - 8, 60);
            }
            break;
          }
          case 'magnetpole': {
            const t = this.nearest(sx, TRAY.F - 10, 90, (it) => it.def.mat === 'metal');
            if (t) {
              this.events.push({ k: 'spark', x1: sx, y1: TRAY.TOP - 8, x2: t.x, y2: t.y, origin, len: 1 });
              this.damage(t, this.mods.sparkDmg + Math.floor(power / 2), 'spark', origin);
              this.sparkFrom(t.x, t.y, t.id, this.mods.sparkJumps, origin, new Set([t.id]), { len: 1 });
            }
            break;
          }
          case 'brazier': {
            const burn = this.items
              .filter((it) => !it.dead && !it.burning && (it.def.mat === 'wood' || it.def.mat === 'cloth'))
              .sort((a, b) => Math.abs(a.x - sx) - Math.abs(b.x - sx))
              .slice(0, 2);
            for (const it of burn) this.ignite(it, origin, true);
            break;
          }
          case 'winder': {
            const cl = this.items
              .filter((it) => !it.dead && it.fuse < 0 && it.def.mat === 'clock')
              .sort((a, b) => Math.abs(a.x - sx) - Math.abs(b.x - sx))
              .slice(0, 2);
            for (const it of cl) {
              it.keyBoost = true;
              this.arm(it, origin, this.mods.fuse);
            }
            break;
          }
          case 'antenna': {
            this.pulse(sx, y, 30, 2 + Math.floor(power / 3), origin, false);
            break;
          }
        }
      });
    });
    void bellIdx;
  }

  private checkBells() {
    const bells = this.sockets.map((k, i) => (k === 'bell' ? i : -1)).filter((i) => i >= 0);
    if (this.bellsRung >= bells.length) return;
    const need = 6 + this.bellsRung * 10;
    if (this.combo >= need) {
      const i = bells[this.bellsRung];
      this.bellsRung++;
      const origin = this.newOrigin('machine');
      this.events.push({ k: 'machine', socket: i, kind: 'bell', x: SOCKET_X[i], y: TRAY.TOP - 10 });
      this.resonance(SOCKET_X[i], TRAY.TOP - 10, 1 + Math.floor(this.mods.power / 3), origin);
    }
  }

  // ---------- 반응 ----------
  damage(it: Item, amt: number, src: DamageSrc, origin: number) {
    if (it.dead || amt <= 0) return;
    if (it.heart) {
      this.heartDamage(it, amt, src);
      return;
    }
    const mat = it.def.mat;
    if (src === 'shard' && mat === 'cloth') {
      this.events.push({ k: 'absorb', x: it.x, y: it.y });
      return;
    }
    if (src === 'fire' && (mat === 'metal' || mat === 'glass' || mat === 'star')) return;
    const d = amt + it.vuln;
    it.hp -= d;
    it.hitFlash = 0.12;
    this.events.push({ k: 'hit', id: it.id, x: it.x, y: it.y, dmg: d, src, mat });
    if (it.hp <= 0) {
      this.breakItem(it, src, origin);
    } else if (mat === 'clock' && it.fuse < 0) {
      this.arm(it, origin, src === 'blast' ? 0.22 : this.mods.fuse);
    }
  }

  private heartDamage(it: Item, amt: number, src: DamageSrc) {
    const phase = HEART_PHASES[Math.min(2, this.heartPhase)];
    let dmg: number;
    let weak = false;
    if (src === 'strike' || src === 'machine') dmg = 1;
    else {
      weak = phase.weak.includes(src);
      dmg = amt * (weak ? 4 : 0.7) * this.mods.heartMult * (1 + Math.min(this.combo, 60) * 0.04);
    }
    dmg = Math.round(dmg * 10) / 10;
    it.hitFlash = 0.12;
    this.events.push({ k: 'heartHit', dmg, weak, x: it.x, y: it.y, src });
  }

  private arm(it: Item, origin: number, fuse: number) {
    if (it.dead || it.fuse >= 0) return;
    it.fuse = fuse;
    it.fuseOrigin = origin;
    this.events.push({ k: 'arm', id: it.id });
  }

  private ignite(it: Item, origin: number, force: boolean) {
    if (it.dead || it.burning || it.heart) return;
    const mat = it.def.mat;
    const ok = mat === 'wood' || (mat === 'cloth' && (this.mods.fireCloth || force));
    if (!ok) return;
    it.burning = true;
    it.burnT = 0.45;
    it.burnOrigin = origin;
    this.events.push({ k: 'ignite', id: it.id });
  }

  private updateBurning(dt: number) {
    for (const it of this.items) {
      if (it.dead || !it.burning) continue;
      it.burnT -= dt;
      if (it.burnT > 0) continue;
      it.burnT = 0.5;
      // 주변으로 번짐 + 심장 가열
      for (const o of this.items) {
        if (o === it || o.dead) continue;
        const d = Math.hypot(o.x - it.x, o.y - it.y) - o.r - it.r;
        if (d > 7) continue;
        if (o.heart) this.damage(o, this.mods.fireDmg * 2, 'fire', it.burnOrigin);
        else if (!o.burning && this.rng.chance(this.mods.fireSpread)) this.ignite(o, it.burnOrigin, false);
      }
      this.damage(it, this.mods.fireDmg, 'fire', it.burnOrigin);
    }
  }

  private updateFuses(dt: number) {
    for (const it of this.items) {
      if (it.dead || it.fuse < 0) continue;
      it.fuse -= dt;
      if (it.fuse <= 0) {
        it.fuse = -1;
        it.hp = 0;
        this.breakItem(it, 'blast', it.fuseOrigin);
      }
    }
  }

  private breakItem(it: Item, src: DamageSrc, origin: number) {
    if (it.dead) return;
    it.dead = true;
    it.burning = false;
    const m = this.mods;
    const def = it.def;
    this.combo++;
    this.comboTimer = m.comboWindow;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    const mult = Math.min(m.comboCap, 1 + m.comboStep * (this.combo - 1));
    let coins = def.coins * this.site.coinMult * m.matCoin[def.mat] * m.coinMult * mult;
    if (def.id === 'safe') coins *= m.safeCoinMult;
    if (src === 'fire') coins *= 1.5; // 불로 태우면 재 속의 녹은 동전까지 건진다
    if (it.shiny) coins *= 5;
    let star = 0;
    if (def.star) star = (def.star + m.starBonus) * this.site.starMult * m.starMult;
    if (it.shiny) star += this.site.starMult;
    star = Math.round(star);
    const curioChance = (def.curio ?? 0.002) * m.curioMult * (it.shiny ? 4 : 1);
    this.events.push({
      k: 'break',
      id: it.id,
      x: it.x,
      y: it.y,
      def: def.id,
      mat: def.mat,
      coins: Math.max(1, Math.round(coins)),
      star,
      curioChance,
      shiny: it.shiny,
      combo: this.combo,
      mult,
      origin,
      src,
    });

    if (m.freeStrikeEvery > 0 && this.combo % m.freeStrikeEvery === 0 && this.freeGiven < m.freeStrikeMax) {
      this.freeGiven++;
      this.extraStrikes++;
      this.events.push({ k: 'freeStrike' });
    }
    this.checkBells();

    const x = it.x;
    const y = it.y;
    const tool = this.originTool.get(origin);
    switch (def.mat) {
      case 'wood': {
        this.schedule(0.05, () => {
          for (const o of this.items) {
            if (o.dead || o.heart) continue;
            if (Math.hypot(o.x - x, o.y - y) - o.r - it.r < 4) this.damage(o, 1, 'splinter', origin);
          }
        });
        break;
      }
      case 'glass': {
        const n = (def.shards ?? 2) + m.shardBonus;
        this.spawnShards(x, y, n, origin, it.id);
        break;
      }
      case 'metal': {
        this.schedule(0.06, () => this.sparkFrom(x, y, it.id, m.sparkJumps, origin, new Set([it.id]), { len: 0 }));
        break;
      }
      case 'cloth': {
        const r = m.dustRadius;
        this.events.push({ k: 'dust', x, y, r });
        for (const o of this.items) {
          if (o.dead || o.heart) continue;
          if (Math.hypot(o.x - x, o.y - y) - o.r < r) o.vuln = Math.min(3, o.vuln + m.dustVuln);
        }
        break;
      }
      case 'clock': {
        const scale = (def.bigBlast ?? 1) * (it.keyBoost ? 1.5 : 1);
        this.blast(x, y, m.blastRadius * scale, m.blastDmg + (it.keyBoost ? 1 : 0), origin);
        if (m.clockRearm) this.schedule(0.45, () => this.blast(x, y, m.blastRadius * scale * 0.8, m.blastDmg, origin));
        break;
      }
      case 'star': {
        this.pulse(x, y, m.pulseRadius * (def.bigBlast ?? 1), m.pulseDmg, origin, false);
        break;
      }
    }
    if (def.mat !== 'star' && (m.pulseOnBreak || (tool === 'star' && src === 'strike'))) {
      this.schedule(0.08, () => this.pulse(x, y, 18, 1, origin, true));
    }
    // 내용물 쏟기
    if (def.contents && it.depth < 2) {
      let n = def.contents.n + m.crateExtra;
      if (tool === 'crowbar' && src === 'strike') n += 2;
      for (let i = 0; i < n; i++) {
        const cid = def.contents.pool[this.rng.int(0, def.contents.pool.length - 1)];
        const cdef = JUNK[cid];
        const depth = cdef.container ? 2 : it.depth + 1;
        this.spawn(cid, x + this.rng.range(-4, 4), y - 2, this.rng.range(-120, 120), this.rng.range(-240, -130), this.rng.chance(m.shinyChance), depth);
      }
      this.events.push({ k: 'spill', x, y, n });
    }
    if (m.meteorChance > 0 && def.id !== 'starbit' && this.rng.chance(m.meteorChance)) {
      this.spawn('starbit', x, y - 2, this.rng.range(-60, 60), -180, false, 2);
    }
  }

  private spawnShards(x: number, y: number, n: number, origin: number, src: number) {
    const base = this.rng.next() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = base + (i / n) * Math.PI * 2 + this.rng.range(-0.25, 0.25);
      const sp = this.rng.range(200, 280);
      this.shards.push({
        id: this.nextId++,
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: 0.42,
        bounces: this.mods.shardBounce,
        origin,
        src,
        lastHit: src,
      });
    }
  }

  private updateShards(dt: number) {
    if (!this.shards.length) return;
    const keep: Shard[] = [];
    for (const s of this.shards) {
      s.life -= dt;
      s.vy += 300 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      let alive = s.life > 0;
      if (s.x < TRAY.L || s.x > TRAY.R) {
        s.vx = -s.vx * 0.6;
        s.x = clamp(s.x, TRAY.L, TRAY.R);
      }
      if (s.y > TRAY.F) alive = false;
      if (alive) {
        for (const it of this.items) {
          if (it.dead || it.id === s.lastHit) continue;
          const dx = it.x - s.x;
          const dy = it.y - s.y;
          if (dx * dx + dy * dy > (it.r + 2) * (it.r + 2)) continue;
          s.lastHit = it.id;
          this.damage(it, 1, 'shard', s.origin);
          if (this.mods.prism && it.def.mat === 'metal' && !it.heart) {
            const t = it;
            this.schedule(0.03, () => this.sparkFrom(t.x, t.y, t.id, 1, s.origin, new Set([t.id]), { len: 0 }));
          }
          if (s.bounces > 0 && it.def.mat !== 'cloth') {
            s.bounces--;
            const d = Math.hypot(dx, dy) || 1;
            const nx = dx / d;
            const ny = dy / d;
            const vn = s.vx * nx + s.vy * ny;
            s.vx -= 2 * vn * nx;
            s.vy -= 2 * vn * ny;
            s.life = Math.max(s.life, 0.25);
          } else alive = false;
          break;
        }
      }
      if (alive) keep.push(s);
    }
    this.shards = keep;
  }

  private sparkTarget(it: Item, visited: Set<number>) {
    if (it.dead || visited.has(it.id)) return false;
    if (it.heart) return true;
    if (this.mods.sparkAny) return true;
    if (it.def.mat === 'metal') return true;
    if (this.mods.sparkClock && it.def.mat === 'clock') return true;
    return false;
  }

  private sparkFrom(x: number, y: number, fromId: number, jumps: number, origin: number, visited: Set<number>, chain: { len: number }) {
    if (jumps <= 0) return;
    const range = this.mods.sparkRange;
    let best: Item | null = null;
    let bd = Infinity;
    for (const it of this.items) {
      if (it.id === fromId || !this.sparkTarget(it, visited)) continue;
      const d = Math.hypot(it.x - x, it.y - y) - it.r;
      if (d < range && d < bd) {
        bd = d;
        best = it;
      }
    }
    if (!best) return;
    const t = best;
    visited.add(t.id);
    this.schedule(0.07, () => {
      if (t.dead) return;
      chain.len++;
      this.events.push({ k: 'spark', x1: x, y1: y, x2: t.x, y2: t.y, origin, len: chain.len });
      const tx = t.x;
      const ty = t.y;
      this.damage(t, this.mods.sparkDmg, 'spark', origin);
      this.sparkFrom(tx, ty, t.id, jumps - 1, origin, visited, chain);
    });
  }

  private blast(x: number, y: number, r: number, dmg: number, origin: number) {
    this.events.push({ k: 'blast', x, y, r, origin });
    for (const it of this.items) {
      if (it.dead) continue;
      const d = Math.hypot(it.x - x, it.y - y) - it.r;
      if (d > r) continue;
      this.push(it, x, y + 6, 200 * (1 - Math.max(0, d) / r) + 40);
      const t = it;
      this.schedule(0.02 + Math.max(0, d) / 900, () => {
        this.damage(t, dmg, 'blast', origin);
        if (this.mods.blastIgnite && !t.dead) this.ignite(t, origin, true);
      });
    }
  }

  private pulse(x: number, y: number, r: number, dmg: number, origin: number, small: boolean) {
    this.events.push({ k: 'pulse', x, y, r, small });
    for (const it of this.items) {
      if (it.dead) continue;
      const d = Math.hypot(it.x - x, it.y - y) - it.r;
      if (d > r) continue;
      const t = it;
      this.schedule(0.03 + Math.max(0, d) / 500, () => this.damage(t, dmg, 'pulse', origin));
    }
  }

  private resonance(x: number, y: number, dmg: number, origin: number) {
    this.events.push({ k: 'resonance', x, y });
    for (const it of this.items) {
      if (it.dead || (it.def.mat !== 'glass' && !it.heart)) continue;
      const d = Math.hypot(it.x - x, it.y - y);
      const t = it;
      this.schedule(0.05 + d / 320, () => this.damage(t, dmg, 'resonance', origin));
    }
  }

  private nearest(x: number, y: number, range: number, pred: (i: Item) => boolean) {
    let best: Item | null = null;
    let bd = range;
    for (const it of this.items) {
      if (it.dead || it.heart || !pred(it)) continue;
      const d = Math.hypot(it.x - x, it.y - y);
      if (d < bd) {
        bd = d;
        best = it;
      }
    }
    return best;
  }

  // ---------- 정산 ----------
  leftovers() {
    return this.items.filter((i) => !i.dead && !i.heart);
  }
  salvageValue() {
    const m = this.mods;
    let v = 0;
    for (const it of this.leftovers()) v += it.def.coins * this.site.coinMult * m.matCoin[it.def.mat] * m.coinMult * m.salvage * (it.shiny ? 5 : 1);
    return Math.round(v);
  }
  cleanup() {
    this.items = this.items.filter((i) => !i.dead);
  }
}

export function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}
