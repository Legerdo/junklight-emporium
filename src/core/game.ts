// 게임 컨트롤러: 상태(GameState)와 작업대(Bench)를 묶고, 보상·의뢰·구매·자동화를 처리한다.
// DOM/Phaser에 의존하지 않으므로 헤드리스 시뮬레이션과 테스트에서도 그대로 쓴다.
import { Bench, type BenchEvent } from './bench';
import {
  CONSTELLATION,
  CURIO,
  CURIOS,
  HEART_HP,
  HEART_PHASES,
  LAMPS,
  MACHINE,
  REQUESTS,
  RARITY_WEIGHT,
  SITE,
  SITES,
  TOOL,
  UPGRADE,
  machineCost,
} from './data';
import { baseMods, type Mods } from './mods';
import { Rng, hashSeed } from './rng';
import { newState } from './state';
import type { GameState, MachineKind, Material, RequestDef, SiteId, ToolKind } from './types';

export type GameEvent =
  | BenchEvent
  | { k: 'cartStart' }
  | { k: 'cartDone'; coins: number; star: number; breaks: number; best: number; salvage: number; sweep: number; unused: number; leftovers: number[]; cleared: boolean }
  | { k: 'curio'; id: string; isNew: boolean; bonus: number }
  | { k: 'request'; id: string }
  | { k: 'lamp'; index: number }
  | { k: 'site'; id: SiteId }
  | { k: 'heartPhase'; phase: number }
  | { k: 'heartBreak'; x: number; y: number }
  | { k: 'ending' }
  | { k: 'toast'; text: string };

export function computeMods(s: GameState): Mods {
  const m = baseMods();
  for (const [id, lvl] of Object.entries(s.upgrades)) UPGRADE[id]?.apply(m, lvl);
  for (const id of s.equipped) if (id) CURIO[id]?.apply(m);
  if (s.constellation) CONSTELLATION[s.constellation]?.apply(m);
  if (s.site === 'docks') m.sparkRange *= 1.3;
  if (s.site === 'greenhouse') m.shardBonus += 1;
  if (s.site === 'attic') m.fuse *= 0.8;
  const antennas = s.sockets.filter((k) => k === 'antenna').length;
  m.starMult *= 1 + 0.1 * antennas;
  m.strikes = Math.max(1, m.strikes);
  m.power = Math.max(0, m.power);
  m.fireDmg *= 1 + Math.floor(m.power / 3) * 0.5;
  return m;
}

interface CartTally {
  coins: number;
  star: number;
  breaks: number;
  mat: Partial<Record<Material, number>>;
  origin: Map<number, { glass: number; blasts: number }>;
}

export class Game {
  s: GameState;
  mods: Mods;
  bench: Bench | null = null;
  out: GameEvent[] = [];
  cart: CartTally = this.freshTally();
  idle = 0;
  autoNext = -1;
  pendingEnding = false;
  private rng: Rng;

  constructor(state?: GameState) {
    this.s = state ?? newState();
    this.rng = new Rng(hashSeed(this.s.seed, 77, this.s.cartSeq));
    this.fixArrays();
    this.mods = computeMods(this.s);
    if (!this.s.peddler.stock.length) this.refreshPeddler();
    if (this.s.bench && SITE[this.s.bench.site]) {
      this.bench = this.makeBench(hashSeed(this.s.seed, this.s.cartSeq, 991), this.s.bench.site);
      this.bench.restore(this.s.bench);
      const c = this.s.bench.cart;
      if (c) Object.assign(this.cart, { coins: c.coins, star: c.star, breaks: c.breaks });
    }
    this.s.bench = null;
  }

  private freshTally(): CartTally {
    return { coins: 0, star: 0, breaks: 0, mat: {}, origin: new Map() };
  }

  lvl(id: string) {
    return this.s.upgrades[id] ?? 0;
  }
  slotsCount() {
    return 1 + this.lvl('slots');
  }
  socketsCount() {
    return Math.min(5, this.lvl('sockets') + (this.s.constellation === 'hands' ? 2 : 0));
  }
  fixArrays() {
    const s = this.s;
    const n = this.slotsCount();
    while (s.equipped.length < n) s.equipped.push(null);
    s.equipped.length = n;
    const k = this.socketsCount();
    while (s.sockets.length < k) s.sockets.push(null);
    s.sockets.length = k;
  }
  recompute() {
    this.fixArrays();
    this.mods = computeMods(this.s);
    if (this.bench) {
      this.bench.mods = this.mods;
      this.bench.tool = TOOL[this.s.tool];
      this.bench.sockets = this.s.sockets;
    }
  }
  siteUnlocked(id: SiteId) {
    return SITE[id].lampToUnlock <= this.s.lamps;
  }
  mark(name: string) {
    if (this.s.milestones[name] === undefined) this.s.milestones[name] = Math.round(this.s.stats.playTime);
  }

  private makeBench(seed: number, site: SiteId = this.s.site) {
    const s = this.s;
    return new Bench({
      site: SITE[site],
      mods: this.mods,
      tool: TOOL[s.tool],
      sockets: s.sockets,
      seed,
      heart: s.heart && site === 'crater' ? s.heart : null,
    });
  }

  // ---------- 수레 ----------
  startCart(): boolean {
    if (this.bench) return false;
    this.recompute();
    const b = this.makeBench(hashSeed(this.s.seed, this.s.cartSeq, 991));
    b.loadCart(b.generateCart());
    this.bench = b;
    this.s.cartSeq++;
    this.cart = this.freshTally();
    this.idle = 0;
    this.autoNext = -1;
    if (this.s.cartSeq >= this.s.peddler.refreshAt) this.refreshPeddler();
    this.out.push({ k: 'cartStart' });
    return true;
  }

  strike(x: number, y: number): boolean {
    if (!this.bench) return false;
    const ok = this.bench.strike(x, y, false);
    if (ok) {
      this.idle = 0;
      this.mark('firstStrike');
    }
    return ok;
  }

  canEndEarly() {
    const b = this.bench;
    return !!b && b.phase === 'ready' && b.isQuiet() && b.totalStrikes > 0;
  }

  // 종: 수레가 없으면 부르고, 조용한 수레가 있으면 정산한다.
  ringBell(): 'start' | 'finish' | 'none' {
    if (!this.bench) return this.startCart() ? 'start' : 'none';
    if (this.canEndEarly()) {
      this.finishCart();
      return 'finish';
    }
    return 'none';
  }

  step(dt: number) {
    this.s.stats.playTime += dt;
    const b = this.bench;
    if (b) {
      b.step(dt);
      if (b.events.length) {
        const evs = b.events;
        b.events = [];
        for (const e of evs) this.handle(e);
      }
      if (b.phase === 'ready') {
        if (b.totalStrikes > 0 && this.lvl('magpieEye') && !this.s.prefs.eyeOff && b.isQuiet()) {
          this.idle += dt;
          if (this.idle > 2.4) {
            const p = b.bestStrikePoint();
            if (p) b.strike(p.x, p.y, true);
            this.idle = 0;
          }
        }
        if ((b.totalStrikes === 0 || b.leftovers().length === 0) && b.isQuiet()) this.finishCart();
      }
    } else if (this.autoNext >= 0) {
      this.autoNext -= dt;
      if (this.autoNext < 0) {
        if (this.lvl('magpie') && !this.s.prefs.magpieOff) this.startCart();
      }
    }
  }

  private handle(e: BenchEvent) {
    const s = this.s;
    switch (e.k) {
      case 'break': {
        s.coins += e.coins;
        s.totalCoins += e.coins;
        s.star += e.star;
        s.totalStar += e.star;
        this.cart.coins += e.coins;
        this.cart.star += e.star;
        this.cart.breaks++;
        s.stats.breaks++;
        if (e.shiny) s.stats.shinies++;
        if (!s.seen.includes(e.def)) s.seen.push(e.def);
        this.mark('firstBreak');
        this.cart.mat[e.mat] = (this.cart.mat[e.mat] ?? 0) + 1;
        let o = this.cart.origin.get(e.origin);
        if (!o) this.cart.origin.set(e.origin, (o = { glass: 0, blasts: 0 }));
        if (e.mat === 'glass') o.glass++;
        if (e.combo > s.stats.bestCombo) s.stats.bestCombo = e.combo;
        this.progress('breakIds', 1, 'add', (r) => !!r.ids?.includes(e.def));
        this.progress('cartMat', this.cart.mat[e.mat]!, 'max', (r) => r.mat === e.mat);
        this.progress('combo', e.combo, 'max');
        this.progress('oneOriginMat', o.glass, 'max', (r) => r.mat === e.mat && e.mat === 'glass');
        if (e.src === 'fire') this.progress('fireBreaks', 1, 'add');
        if (e.src === 'resonance') this.progress('resonanceBreaks', 1, 'add');
        this.rollCurio(e.curioChance);
        break;
      }
      case 'spark':
        this.progress('sparkChain', e.len, 'max');
        break;
      case 'magnet':
        this.progress('magnetPull', e.pulled, 'max');
        break;
      case 'blast': {
        let o = this.cart.origin.get(e.origin);
        if (!o) this.cart.origin.set(e.origin, (o = { glass: 0, blasts: 0 }));
        o.blasts++;
        if (e.origin !== 0) this.progress('blastChain', o.blasts, 'max');
        break;
      }
      case 'heartHit': {
        const h = s.heart;
        if (!h || h.hp <= 0) break;
        h.hp = Math.max(0, h.hp - e.dmg);
        const phase = Math.min(2, Math.floor((1 - h.hp / h.max) * 3));
        if (phase !== h.phase && h.hp > 0) {
          h.phase = phase;
          if (this.bench) this.bench.heartPhase = phase;
          this.out.push({ k: 'heartPhase', phase });
        }
        if (h.hp <= 0 && this.bench) {
          this.bench.heartAlive = false;
          const hi = this.bench.items.find((i) => i.heart);
          if (hi) hi.dead = true;
          this.pendingEnding = true;
          this.out.push({ k: 'heartBreak', x: e.x, y: e.y });
        }
        break;
      }
    }
    this.out.push(e);
  }

  finishCart() {
    const b = this.bench;
    if (!b) return;
    const salvage = b.salvageValue();
    const left = b.leftovers();
    this.s.coins += salvage;
    this.s.totalCoins += salvage;
    const cleared = left.length === 0;
    if (cleared) this.progress('clearCart', b.loadCount, 'max');
    // 싹쓸이 보너스: 수레를 다 비우고 남긴 타격 하나마다 이번 수레 동전의 12%.
    const unused = cleared ? b.totalStrikes : 0;
    const sweep = Math.round(this.cart.coins * 0.12 * unused);
    if (sweep > 0) {
      this.s.coins += sweep;
      this.s.totalCoins += sweep;
    }
    this.s.stats.carts++;
    this.out.push({
      k: 'cartDone',
      coins: this.cart.coins + salvage + sweep,
      star: this.cart.star,
      breaks: this.cart.breaks,
      best: b.bestCombo,
      salvage,
      sweep,
      unused,
      leftovers: left.map((i) => i.id),
      cleared,
    });
    this.bench = null;
    if (this.pendingEnding) {
      this.pendingEnding = false;
      this.triggerEnding();
      return;
    }
    this.autoNext = this.lvl('magpie') && !this.s.prefs.magpieOff ? 0.9 : -1;
  }

  // ---------- 골동품 ----------
  private rollCurio(chance: number) {
    const s = this.s;
    s.breaksSinceCurio++;
    let hit = false;
    if (s.stats.curiosFound === 0 && s.cartSeq >= 3 && s.curios.length === 0) hit = true;
    else hit = this.rng.next() < chance + Math.max(0, s.breaksSinceCurio - 250) * 0.0004;
    if (!hit) return;
    s.breaksSinceCurio = 0;
    const id = this.pickCurio();
    this.grantCurio(id);
  }

  private pickCurio(): string | null {
    const s = this.s;
    const own = new Set(s.curios);
    const w = (id: string) => ({ w: RARITY_WEIGHT[CURIO[id].rarity], v: id });
    let cands: { w: number; v: string }[] = SITE[s.site].curios.filter((id) => !own.has(id)).map(w);
    if (s.ended && s.site === 'crater' && !own.has('stareye')) cands.push({ w: 1.5, v: 'stareye' });
    if (!cands.length)
      cands = SITES.filter((x) => this.siteUnlocked(x.id))
        .flatMap((x) => x.curios)
        .filter((id) => !own.has(id))
        .map(w);
    if (!cands.length) return null;
    return this.rng.pickWeighted(cands);
  }

  grantCurio(id: string | null) {
    const s = this.s;
    if (!id || s.curios.includes(id)) {
      const bonus = Math.round(40 * SITE[s.site].coinMult);
      s.coins += bonus;
      s.totalCoins += bonus;
      this.out.push({ k: 'curio', id: id ?? '', isNew: false, bonus });
      return;
    }
    s.curios.push(id);
    s.stats.curiosFound++;
    this.mark('firstCurio');
    const empty = s.equipped.indexOf(null);
    if (empty >= 0) {
      s.equipped[empty] = id;
      this.recompute();
    }
    this.out.push({ k: 'curio', id, isNew: true, bonus: 0 });
  }

  equip(slot: number, id: string | null) {
    const s = this.s;
    if (slot < 0 || slot >= s.equipped.length) return false;
    if (id && !s.curios.includes(id)) return false;
    if (id) {
      const prev = s.equipped.indexOf(id);
      if (prev >= 0) s.equipped[prev] = s.equipped[slot];
    }
    s.equipped[slot] = id;
    this.recompute();
    return true;
  }

  // ---------- 떠돌이 상인 ----------
  refreshPeddler() {
    const s = this.s;
    const own = new Set(s.curios);
    const pool = SITES.filter((x) => this.siteUnlocked(x.id))
      .flatMap((x) => x.curios)
      .filter((id) => !own.has(id));
    const stock: string[] = [];
    while (stock.length < 3 && pool.length) {
      const i = this.rng.int(0, pool.length - 1);
      stock.push(pool.splice(i, 1)[0]);
    }
    s.peddler = { stock, refreshAt: s.cartSeq + 10 };
  }
  peddlerPrice(id: string) {
    const c = CURIO[id];
    const base = { common: 150, uncommon: 400, rare: 1000, legend: 1e9 }[c.rarity];
    const site = c.site === 'legend' ? SITE.crater : SITE[c.site];
    return Math.round(base * site.coinMult);
  }
  buyPeddler(id: string) {
    const s = this.s;
    if (!s.peddler.stock.includes(id) || s.curios.includes(id)) return false;
    const p = this.peddlerPrice(id);
    if (s.coins < p) return false;
    s.coins -= p;
    s.peddler.stock = s.peddler.stock.filter((x) => x !== id);
    this.grantCurio(id);
    return true;
  }
  rerollCost() {
    const top = [...SITES].reverse().find((x) => this.siteUnlocked(x.id))!;
    return Math.round(25 * top.coinMult);
  }
  rerollPeddler() {
    const c = this.rerollCost();
    if (this.s.coins < c) return false;
    this.s.coins -= c;
    this.refreshPeddler();
    return true;
  }

  // ---------- 강화·도구·장치 ----------
  upgradeCost(id: string) {
    return UPGRADE[id].cost(this.lvl(id));
  }
  upgradeAvailable(id: string) {
    const u = UPGRADE[id];
    return this.siteUnlocked(u.site) && this.lvl(id) < u.max;
  }
  buyUpgrade(id: string) {
    if (!this.upgradeAvailable(id)) return false;
    const c = this.upgradeCost(id);
    if (this.s.coins < c) return false;
    this.s.coins -= c;
    this.s.upgrades[id] = this.lvl(id) + 1;
    this.mark('firstBuy');
    if (id === 'strikes' && this.bench) this.bench.strikesLeft++;
    this.recompute();
    return true;
  }
  buyTool(id: ToolKind) {
    const t = TOOL[id];
    if (this.s.tools.includes(id) || !this.siteUnlocked(t.site) || this.s.coins < t.cost) return false;
    this.s.coins -= t.cost;
    this.s.tools.push(id);
    this.s.tool = id;
    this.mark('firstBuy');
    this.recompute();
    return true;
  }
  setTool(id: ToolKind) {
    if (!this.s.tools.includes(id)) return false;
    this.s.tool = id;
    this.recompute();
    return true;
  }
  machineCost(id: MachineKind) {
    return machineCost(id, this.s.machines[id] ?? 0);
  }
  buyMachine(id: MachineKind) {
    if (!this.siteUnlocked(MACHINE[id].site)) return false;
    const c = this.machineCost(id);
    if (this.s.coins < c) return false;
    this.s.coins -= c;
    this.s.machines[id] = (this.s.machines[id] ?? 0) + 1;
    const empty = this.s.sockets.indexOf(null);
    if (empty >= 0) this.s.sockets[empty] = id;
    this.recompute();
    return true;
  }
  placedCount(id: MachineKind) {
    return this.s.sockets.filter((k) => k === id).length;
  }
  setSocket(i: number, id: MachineKind | null) {
    const s = this.s;
    if (i < 0 || i >= s.sockets.length) return false;
    if (id && this.placedCount(id) - (s.sockets[i] === id ? 1 : 0) >= (s.machines[id] ?? 0)) return false;
    s.sockets[i] = id;
    this.recompute();
    return true;
  }

  // ---------- 등불·지역 ----------
  nextLamp() {
    return LAMPS[this.s.lamps] ?? null;
  }
  lightLamp() {
    const l = this.nextLamp();
    if (!l || this.s.star < l.cost) return false;
    this.s.star -= l.cost;
    this.s.lamps++;
    this.mark('lamp' + this.s.lamps);
    this.out.push({ k: 'lamp', index: this.s.lamps - 1 });
    if (l.unlocks) this.out.push({ k: 'site', id: l.unlocks });
    if (this.s.lamps === LAMPS.length) {
      this.s.heart = { hp: HEART_HP, max: HEART_HP, phase: 0 };
      this.s.site = 'crater';
      this.mark('heart');
    }
    this.refreshPeddler();
    this.recompute();
    return true;
  }
  setSite(id: SiteId) {
    if (!this.siteUnlocked(id)) return false;
    this.s.site = id;
    this.recompute();
    return true;
  }

  // ---------- 의뢰 ----------
  requestVisible(r: RequestDef) {
    if (r.site === 'post') return this.s.ended;
    return this.siteUnlocked(r.site);
  }
  requestProgress(id: string) {
    return this.s.requests[id] ?? 0;
  }
  private progress(kind: RequestDef['kind'], value: number, mode: 'add' | 'max', pred?: (r: RequestDef) => boolean) {
    for (const r of REQUESTS) {
      if (r.kind !== kind || !this.requestVisible(r)) continue;
      const cur = this.s.requests[r.id] ?? 0;
      if (cur < 0) continue;
      if (pred && !pred(r)) continue;
      const nv = mode === 'add' ? cur + value : Math.max(cur, value);
      this.s.requests[r.id] = nv;
      if (nv >= r.target) this.completeRequest(r);
    }
  }
  private completeRequest(r: RequestDef) {
    const s = this.s;
    s.requests[r.id] = -1;
    if (r.reward.coins) {
      s.coins += r.reward.coins;
      s.totalCoins += r.reward.coins;
    }
    if (r.reward.star) {
      s.star += r.reward.star;
      s.totalStar += r.reward.star;
    }
    this.out.push({ k: 'request', id: r.id });
    if (r.reward.curio) this.grantCurio(r.reward.curio);
  }

  // ---------- 엔딩·다음 밤 ----------
  private triggerEnding() {
    const s = this.s;
    s.ended = true;
    s.endedAt = Math.round(s.stats.playTime);
    s.heart = null;
    this.mark('ending');
    const badge = s.constellation ?? 'first';
    if (!s.badges.includes(badge)) s.badges.push(badge);
    const c2 = REQUESTS.find((r) => r.id === 'c2')!;
    if ((s.requests.c2 ?? 0) >= 0) this.completeRequest(c2);
    this.out.push({ k: 'ending' });
  }

  newGamePlus(constellation: string | null) {
    const old = this.s;
    const s = newState((old.seed + 7919 * (old.ngPlus + 1)) >>> 0);
    s.curios = [...old.curios];
    s.stats.curiosFound = old.stats.curiosFound;
    s.stats.bestCombo = old.stats.bestCombo;
    s.badges = [...old.badges];
    s.seen = [...old.seen];
    s.ngPlus = old.ngPlus + 1;
    s.constellation = constellation;
    s.prefs = { ...old.prefs };
    s.equipped = [old.curios[0] ?? null];
    if (constellation === 'hands') {
      s.machines = { thumper: 1 };
      s.sockets = ['thumper', null];
    }
    this.s = s;
    this.bench = null;
    this.autoNext = -1;
    this.pendingEnding = false;
    this.recompute();
    this.refreshPeddler();
  }

  // ---------- 안내 ----------
  nextGoal(): string {
    const s = this.s;
    if (s.stats.carts === 0 && !this.bench) return '종을 눌러 첫 수레를 받자.';
    if (s.stats.breaks === 0) return '작업대의 고물을 클릭해 망치로 두드리자.';
    if (!s.milestones.firstBuy && s.coins >= 22) return '상점에서 첫 강화를 사 보자.';
    if (s.heart) return `별의 심장 ${Math.ceil(s.heart.hp)}/${s.heart.max} · ${HEART_PHASES[s.heart.phase].hint}`;
    if (s.ended) return '엔딩 이후: 전설 골동품과 연쇄 기록, 다음 밤에 도전.';
    const l = this.nextLamp();
    if (l) {
      const gate = LAMPS.indexOf(l);
      return `별빛 ${Math.floor(s.star)}/${l.cost} — ${l.name} 밝히기` + (gate === 0 && s.star < 4 ? ' (전구와 별부스러기에 별빛이 있다)' : '');
    }
    return '';
  }
}

export function allCurioIds() {
  return CURIOS.map((c) => c.id);
}
