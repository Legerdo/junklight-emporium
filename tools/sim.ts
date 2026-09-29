// 가속 시뮬레이션: 사람 속도(타격 간격·클릭 지연)를 흉내 내는 봇으로 신규 저장부터 엔딩까지 플레이한다.
// 실제 규칙 코드(Game/Bench)를 그대로 사용하므로 경제·페이싱 검증용이다. (정상 사람 플레이와는 구분해 기록)
import { DT } from '../src/core/bench';
import { CURIO, LAMPS, MACHINE, SITE, TOOL, UPGRADES } from '../src/core/data';
import { Game } from '../src/core/game';
import { newState } from '../src/core/state';
import type { MachineKind, SiteId, ToolKind } from '../src/core/types';

const args = process.argv.slice(2);
const seed = Number(args.find((a) => a.startsWith('--seed='))?.split('=')[1] ?? 12345);
const verbose = args.includes('-v');
const strategy = args.find((a) => a.startsWith('--build='))?.split('=')[1] ?? 'auto';
const constellation = args.find((a) => a.startsWith('--ng='))?.split('=')[1] ?? null;

const STRIKE_GAP = 1.1; // 사람의 조준 시간(초)
const BELL_DELAY = 0.7;
const SHOP_TIME = 1.2; // 구매 1건당 사람 소요 시간

const g = new Game(newState(seed));
if (constellation) {
  g.s.curios = [];
  g.newGamePlus(constellation);
}
let t = 0;
let cool = 0;
let wait = 0;
let heartCarts = 0;
const siteTime: Record<string, number> = {};
const log: string[] = [];
const fmt = (sec: number) => `${Math.floor(sec / 60)}m${String(Math.floor(sec % 60)).padStart(2, '0')}s`;
const note = (s: string) => {
  log.push(`[${fmt(t)}] ${s}`);
  if (verbose) console.log(`[${fmt(t)}] ${s}`);
};

const TOOL_FOR: Record<SiteId, ToolKind[]> = {
  alley: ['poker', 'mallet'],
  docks: ['magnet', 'mallet'],
  greenhouse: ['fork', 'magnet', 'mallet'],
  attic: ['key', 'fork', 'magnet'],
  crater: ['star', 'key', 'fork'],
};
const MACH_FOR: Record<SiteId, MachineKind[]> = {
  alley: ['thumper'],
  docks: ['magnetpole', 'thumper'],
  greenhouse: ['bell', 'brazier', 'magnetpole', 'thumper'],
  attic: ['winder', 'bell', 'brazier', 'thumper'],
  crater: ['antenna', 'winder', 'bell', 'magnetpole', 'thumper'],
};
const CURIO_PRI: Record<SiteId, string[]> = {
  alley: ['falsebottom', 'purse', 'matchbox', 'glove', 'marbles', 'crowfeather', 'duster'],
  docks: ['coil', 'compass', 'lens', 'falsebottom', 'wetrope', 'anchor', 'purse', 'marbles'],
  greenhouse: ['moss', 'dewdrop', 'prism', 'butterfly', 'marbles', 'lens', 'coil', 'falsebottom'],
  attic: ['cuckoofeather', 'sheetmusic', 'pocketwatch', 'wetrope', 'gearnecklace', 'lens', 'loupe', 'coil', 'moss'],
  crater: ['stardust', 'lens', 'sheetmusic', 'pocketwatch', 'cuckoofeather', 'lodestone', 'coil', 'meteorite', 'dewdrop'],
};

function shop() {
  let n = 0;
  const s = g.s;
  while (g.lightLamp()) {
    n++;
    note(`등불 점등: ${LAMPS[s.lamps - 1].name} (별빛 누적 ${Math.round(s.totalStar)})`);
    const l = LAMPS[s.lamps - 1];
    if (l.unlocks) g.setSite(l.unlocks);
  }
  // 도구
  for (const tk of TOOL_FOR[s.site]) {
    if (!s.tools.includes(tk) && g.buyTool(tk)) {
      n++;
      note(`도구 구매: ${tk}`);
    }
  }
  const tl = TOOL_FOR[s.site].find((tk) => s.tools.includes(tk));
  if (tl && strategy === 'auto') g.setTool(tl);
  if (strategy !== 'auto') g.setTool(strategy as ToolKind);
  // 장치
  if (s.sockets.includes(null)) {
    for (const mk of MACH_FOR[s.site]) {
      if (g.siteUnlocked(MACHINE[mk].site) && g.buyMachine(mk)) {
        n++;
        note(`장치 구매: ${mk}`);
        break;
      }
    }
  }
  // 강화
  const W: Record<string, number> = { strikes: 2.2, cart: 1.6, power: 1.3, appraise: 1.1, slots: 1.6, combo: 1, sockets: 1.8, magpie: 4, magpieEye: 4, lucky: 0.4 };
  for (let k = 0; k < 20; k++) {
    let best: string | null = null;
    let bs = Infinity;
    for (const u of UPGRADES) {
      if (!g.upgradeAvailable(u.id)) continue;
      if (u.id === 'slots' && s.curios.length <= g.slotsCount()) continue;
      const score = g.upgradeCost(u.id) / (W[u.id] ?? 1);
      if (score < bs) {
        bs = score;
        best = u.id;
      }
    }
    if (!best || !g.buyUpgrade(best)) break;
    n++;
    buys[Math.floor(t / 300)] = (buys[Math.floor(t / 300)] ?? 0) + 1;
    if (verbose) note(`강화: ${best} → ${g.lvl(best)}`);
  }
  // 상인
  for (const id of [...s.peddler.stock]) {
    if (g.peddlerPrice(id) < s.coins * 0.35 && g.buyPeddler(id)) {
      n++;
      note(`상인에게서 구매: ${CURIO[id].name}`);
    }
  }
  // 진열
  const pri = CURIO_PRI[s.site];
  const owned = pri.filter((id) => s.curios.includes(id));
  const rest = s.curios.filter((id) => !owned.includes(id));
  const want = [...owned, ...rest].slice(0, g.slotsCount());
  for (let i = 0; i < g.slotsCount(); i++) g.equip(i, want[i] ?? null);
  return n;
}

let stuckReported = false;
const buys: number[] = [];
let perfMax = 0;
let perfSum = 0;
let perfN = 0;
const LIMIT = 3 * 3600;
while (t < LIMIT && !g.s.ended) {
  if (!g.bench) {
    if (g.autoNext < 0) {
      wait += DT;
      if (wait > BELL_DELAY) {
        wait = 0;
        g.ringBell();
        if (g.s.heart) heartCarts++;
      }
    } else if (g.autoNext - DT < 0 && g.s.heart) heartCarts++;
  } else {
    const b = g.bench;
    cool -= DT;
    if (b.canStrike() && cool <= 0 && !(g.lvl('magpieEye') && Math.random() < 0.0)) {
      let best: { t: ToolKind; p: { x: number; y: number; score: number } } | null = null;
      const pool = strategy === 'auto' ? g.s.tools : [g.s.tool];
      for (const tk of pool) {
        const p = b.bestStrikePoint(TOOL[tk]);
        if (p && (!best || p.score > best.p.score)) best = { t: tk, p };
      }
      if (best) {
        g.setTool(best.t);
        g.strike(best.p.x, best.p.y);
        cool = STRIKE_GAP;
      }
    }
  }
  if (g.bench && g.bench.time > 90 && !stuckReported) {
    stuckReported = true;
    const b = g.bench as any;
    console.log('STUCK', {
      phase: b.phase,
      strikes: b.totalStrikes,
      timers: b.timers.length,
      shards: b.shards.length,
      spawnQ: b.spawnQueue.length,
      windup: b.windup,
      pending: b.pendingStrike,
      pull: b.pull,
      combo: b.comboTimer,
      burning: b.items.filter((i: any) => i.burning).map((i: any) => [i.def.id, i.hp, i.x, i.y]),
      fuse: b.items.filter((i: any) => i.fuse >= 0).map((i: any) => [i.def.id, i.fuse]),
    });
  }
  const t0 = performance.now();
  g.step(DT);
  const dtp = performance.now() - t0;
  perfMax = Math.max(perfMax, dtp);
  perfSum += dtp;
  perfN++;
  t += DT;
  siteTime[g.s.site] = (siteTime[g.s.site] ?? 0) + DT;
  for (const e of g.out) {
    if (e.k === 'cartDone') {
      const n = shop();
      t += n * SHOP_TIME;
      if (verbose && (g.s.stats.carts % 25 === 0 || args.includes('--carts')))
        note(`수레 ${g.s.stats.carts} @${g.s.site}: 동전 ${Math.round(g.s.coins)} 별빛 ${Math.round(g.s.star)} 이번 수레 +${e.coins} 연쇄 ${e.best}`);
    } else if (e.k === 'curio' && e.isNew) note(`골동품 발견: ${CURIO[e.id].name}`);
    else if (e.k === 'request') note(`의뢰 완료: ${e.id}`);
    else if (e.k === 'heartPhase') note(`심장 단계 → ${e.phase}`);
    else if (e.k === 'ending') note('엔딩!');
  }
  g.out.length = 0;
}

const s = g.s;
console.log(log.filter((l) => !l.includes('강화:')).join('\n'));
console.log('---');
console.log(`seed=${seed} build=${strategy} ng=${constellation ?? '-'}`);
console.log(`종료: ${s.ended ? '엔딩 도달' : '미도달'}  시뮬 시간 ${fmt(t)}  수레 ${s.stats.carts}  심장 수레 ${heartCarts}`);
console.log(`마일스톤: ${Object.entries(s.milestones).map(([k, v]) => `${k}=${fmt(v)}`).join(' ')}`);
console.log(`지역별 체류: ${Object.entries(siteTime).map(([k, v]) => `${SITE[k as SiteId].name}=${fmt(v)}`).join(', ')}`);
console.log(`최고 연쇄 ${s.stats.bestCombo}, 골동품 ${s.curios.length}개, 반짝이 ${s.stats.shinies}, 파괴 ${s.stats.breaks}`);
console.log(`강화: ${JSON.stringify(s.upgrades)}  도구: ${s.tools.join(',')}  장치: ${JSON.stringify(s.machines)}`);
console.log(`의뢰 완료: ${Object.entries(s.requests).filter(([, v]) => v < 0).map(([k]) => k).join(',')}`);
console.log(`5분 구간별 강화 구매 수: ${Array.from({ length: buys.length }, (_, i) => buys[i] ?? 0).join(' ')}`);
console.log(`스텝 성능: 평균 ${(perfSum / perfN).toFixed(3)}ms, 최대 ${perfMax.toFixed(2)}ms`);
