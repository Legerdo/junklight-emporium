import { describe, expect, it } from 'vitest';
import { DT } from '../src/core/bench';
import { CURIOS, JUNK, MACHINES, REQUESTS, SITES, TOOLS } from '../src/core/data';
import { Game } from '../src/core/game';
import { normalize, newState } from '../src/core/state';
import { serialize } from '../src/core/save';
import { CURIO_SPRITES, JUNK_SPRITES, MACHINE_SPRITES, TOOL_SPRITES } from '../src/view/sprites';
import type { GameState } from '../src/core/types';

function runUntilReady(g: Game, max = 20) {
  let t = 0;
  while (g.bench && g.bench.phase !== 'ready' && t < max) {
    g.step(DT);
    t += DT;
  }
}
function runUntilQuiet(g: Game, max = 60) {
  let t = 0;
  while (g.bench && !g.bench.isQuiet() && t < max) {
    g.step(DT);
    t += DT;
  }
  return t;
}
function lateState(): GameState {
  const s = newState(777);
  s.lamps = 4;
  s.site = 'attic';
  s.tools = ['mallet', 'key', 'fork', 'magnet', 'poker'];
  s.tool = 'key';
  s.upgrades = { power: 8, cart: 12, strikes: 4, slots: 5, sockets: 5, combo: 8 };
  const cur = ['cuckoofeather', 'wetrope', 'coil', 'gearnecklace', 'prism', 'dewdrop'];
  s.curios = [...cur, 'endless', 'stareye'];
  s.equipped = [...cur];
  s.machines = { thumper: 2, winder: 1, bell: 1, brazier: 1 };
  s.sockets = ['thumper', 'winder', 'bell', 'brazier', 'thumper'];
  return s;
}

describe('작업대 연쇄', () => {
  it('같은 시드와 같은 입력이면 결과가 같다(연출 속도와 무관)', () => {
    const play = () => {
      const g = new Game(newState(42));
      g.startCart();
      runUntilReady(g);
      g.strike(240, 220);
      runUntilQuiet(g);
      return { coins: g.s.coins, breaks: g.s.stats.breaks, left: g.bench?.leftovers().length };
    };
    expect(play()).toEqual(play());
  });

  it('최대 연쇄 조합에서도 반응이 유한 시간에 끝나고 물건 수가 제한된다', () => {
    const s = lateState();
    s.equipped = ['cuckoofeather', 'wetrope', 'coil', 'gearnecklace', 'endless', 'stareye'];
    const g = new Game(s);
    for (let c = 0; c < 5; c++) {
      g.startCart();
      runUntilReady(g);
      const p = g.bench!.bestStrikePoint()!;
      g.strike(p.x, p.y);
      let maxItems = 0;
      let t = 0;
      while (g.bench && !g.bench.isQuiet() && t < 60) {
        g.step(DT);
        t += DT;
        maxItems = Math.max(maxItems, g.bench?.items.length ?? 0);
      }
      expect(t).toBeLessThan(30);
      expect(maxItems).toBeLessThanOrEqual(110);
      g.finishCart();
    }
  });

  it('부서진 물건마다 보상은 정확히 한 번 들어온다', () => {
    const g = new Game(lateState());
    g.startCart();
    runUntilReady(g);
    const ids = new Set<number>();
    let sum = 0;
    const before = g.s.coins;
    g.strike(240, 220);
    for (let i = 0; i < 60 * 20; i++) {
      g.step(DT);
      for (const e of g.bench?.events ?? []) void e;
    }
    for (const e of g.out) {
      if (e.k === 'break') {
        expect(ids.has(e.id)).toBe(false);
        ids.add(e.id);
        sum += e.coins;
      }
    }
    // 동전 증가량 = 파괴 보상 + 중복 골동품 감정 + 의뢰 보상 + 정산(처분·싹쓸이)
    let extra = 0;
    for (const e of g.out) {
      if (e.k === 'curio') extra += e.bonus;
      if (e.k === 'request') extra += REQUESTS.find((r) => r.id === e.id)?.reward.coins ?? 0;
      if (e.k === 'cartDone') extra += e.salvage + e.sweep;
    }
    expect(ids.size).toBeGreaterThan(0);
    expect(g.s.coins - before).toBe(sum + extra);
  });
});

describe('저장과 복구', () => {
  it('처리 도중 저장 후 다시 열어도 보상이 중복되거나 남은 물건이 사라지지 않는다', () => {
    const g = new Game(newState(9));
    g.s.upgrades.cart = 6;
    g.recompute();
    g.startCart();
    runUntilReady(g);
    g.strike(240, 220);
    for (let i = 0; i < 20; i++) g.step(DT); // 연쇄 도중
    const json = serialize(g);
    const coinsAtSave = g.s.coins;
    const alive = g.bench!.leftovers().length;
    const g2 = new Game(normalize(JSON.parse(json))!);
    expect(g2.s.coins).toBe(coinsAtSave);
    expect(g2.bench).not.toBeNull();
    expect(g2.bench!.leftovers().length + (g2.bench!.snapshot().pending.length ?? 0)).toBeGreaterThanOrEqual(alive);
    // 다시 열자마자 새로 들어오는 보상은 없다
    runUntilReady(g2);
    const gained = g2.out.filter((e) => e.k === 'break').length;
    expect(gained).toBe(0);
  });

  it('별의 심장은 수레가 끝나도 사라지지 않고 체력이 저장된다', () => {
    const s = lateState();
    s.lamps = 5;
    s.site = 'crater';
    s.heart = { hp: 8000, max: 8000, phase: 0 };
    s.tool = 'mallet';
    const g = new Game(s);
    for (let c = 0; c < 3; c++) {
      g.startCart();
      runUntilReady(g);
      expect(g.bench!.items.some((i) => i.heart)).toBe(true);
      const p = g.bench!.bestStrikePoint()!;
      g.strike(p.x, p.y);
      runUntilQuiet(g);
      g.finishCart();
    }
    expect(g.s.heart!.hp).toBeLessThan(8000);
    const g2 = new Game(normalize(JSON.parse(serialize(g)))!);
    expect(g2.s.heart!.hp).toBe(g.s.heart!.hp);
  });

  it('다음 밤은 골동품·도감·배지를 남기고 나머지는 초기화한다', () => {
    const g = new Game(lateState());
    g.s.ended = true;
    g.s.badges = ['first'];
    g.s.coins = 999999;
    g.newGamePlus('glass');
    expect(g.s.coins).toBe(0);
    expect(g.s.curios.length).toBeGreaterThan(0);
    expect(g.s.badges).toContain('first');
    expect(g.s.constellation).toBe('glass');
    expect(g.s.lamps).toBe(0);
  });
});

describe('콘텐츠 무결성', () => {
  it('모든 골동품은 정상 획득 경로가 있다', () => {
    const fromSites = new Set(SITES.flatMap((s) => s.curios));
    const fromReq = new Set(REQUESTS.map((r) => r.reward.curio).filter(Boolean));
    for (const c of CURIOS) {
      const ok = fromSites.has(c.id) || fromReq.has(c.id) || c.id === 'stareye';
      expect(ok, c.id).toBe(true);
    }
  });
  it('모든 잡동사니·도구·장치·골동품에 스프라이트가 있다', () => {
    for (const id of Object.keys(JUNK)) if (id !== 'heart') expect(JUNK_SPRITES[id], id).toBeTruthy();
    for (const t of TOOLS) expect(TOOL_SPRITES[t.id], t.id).toBeTruthy();
    for (const m of MACHINES) expect(MACHINE_SPRITES[m.id], m.id).toBeTruthy();
    for (const c of CURIOS) expect(CURIO_SPRITES[c.id], c.id).toBeTruthy();
  });
  it('내용물 풀과 지역 풀의 id가 모두 존재한다', () => {
    for (const j of Object.values(JUNK)) for (const c of j.contents?.pool ?? []) expect(JUNK[c], `${j.id}->${c}`).toBeTruthy();
    for (const s of SITES) for (const id of Object.keys(s.pool)) expect(JUNK[id], id).toBeTruthy();
  });
  it('첫 수레부터 기본 조작 → 보상 → 첫 구매가 이어진다', () => {
    const g = new Game(newState(1));
    let bought = false;
    for (let c = 0; c < 6 && !bought; c++) {
      g.startCart();
      runUntilReady(g);
      while (g.bench && g.bench.totalStrikes > 0 && g.bench.leftovers().length) {
        const p = g.bench.bestStrikePoint();
        if (!p) break;
        g.strike(p.x, p.y);
        for (let i = 0; i < 70; i++) g.step(DT);
      }
      runUntilQuiet(g);
      if (g.bench) g.finishCart();
      bought = g.buyUpgrade('power') || g.buyUpgrade('cart');
    }
    expect(g.s.stats.breaks).toBeGreaterThan(0);
    expect(bought).toBe(true);
  });
});
