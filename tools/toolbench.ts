// 도구·장치 조합별로 같은 조건에서 수레 N대를 돌려 평균 수익을 비교한다(빌드 차이 검증용).
import { DT } from '../src/core/bench';
import { Game } from '../src/core/game';
import { TOOL } from '../src/core/data';
import { newState } from '../src/core/state';
import type { MachineKind, SiteId, ToolKind } from '../src/core/types';

const N = Number(process.argv[2] ?? 40);
function run(site: SiteId, tool: ToolKind | ToolKind[], curios: string[], sockets: (MachineKind | null)[], lvl: number) {
  const s = newState(4242);
  s.lamps = 4;
  s.site = site;
  s.tools = ['mallet', 'crowbar', 'poker', 'magnet', 'fork', 'key', 'star'];
  const pick = Array.isArray(tool) ? tool : [tool];
  s.tool = pick[0];
  s.upgrades = { power: lvl, cart: lvl, strikes: Math.min(4, Math.floor(lvl / 2)), slots: 5, sockets: 5, combo: Math.floor(lvl / 2) };
  s.curios = [...curios];
  s.equipped = [...curios];
  s.machines = {};
  for (const k of sockets) if (k) s.machines[k] = (s.machines[k] ?? 0) + 1;
  s.sockets = [...sockets];
  s.stats.curiosFound = 99;
  const g = new Game(s);
  let t = 0;
  let cool = 0;
  let coins = 0;
  let star = 0;
  let carts = 0;
  while (carts < N) {
    if (!g.bench) g.startCart();
    const b = g.bench!;
    cool -= DT;
    if (b.canStrike() && cool <= 0) {
      let best: { t: ToolKind; p: { x: number; y: number; score: number } } | null = null;
      for (const tk of pick) {
        const p = b.bestStrikePoint(TOOL[tk]);
        if (p && (!best || p.score > best.p.score)) best = { t: tk, p };
      }
      if (best) {
        g.setTool(best.t);
        g.strike(best.p.x, best.p.y);
      }
      cool = 1.1;
    }
    g.step(DT);
    t += DT;
    for (const e of g.out) {
      if (e.k === 'cartDone') {
        carts++;
        coins += e.coins;
        star += e.star;
      }
    }
    g.out.length = 0;
    g.s.stats.curiosFound = 99;
  }
  return { coinsPerMin: (coins / t) * 60, starPerMin: (star / t) * 60, secPerCart: t / N };
}

const cases: [string, SiteId, ToolKind | ToolKind[], string[], (MachineKind | null)[]][] = [
  ['골목 망치', 'alley', 'mallet', [], []],
  ['골목 쇠지레', 'alley', 'crowbar', [], []],
  ['골목 부지깽이', 'alley', 'poker', [], []],
  ['골목 부지깽이+성냥', 'alley', 'poker', ['matchbox'], []],
  ['골목 지레/망치 교체', 'alley', ['crowbar', 'mallet'], [], []],
  ['부두 망치', 'docks', 'mallet', ['coil'], ['thumper']],
  ['부두 자석', 'docks', 'magnet', ['coil'], ['thumper']],
  ['부두 자석+기둥', 'docks', 'magnet', ['coil'], ['magnetpole']],
  ['부두 자석/망치 교체', 'docks', ['magnet', 'mallet'], ['coil'], ['thumper']],
  ['온실 망치', 'greenhouse', 'mallet', ['moss', 'dewdrop'], ['thumper', 'bell']],
  ['온실 소리굽쇠', 'greenhouse', 'fork', ['moss', 'dewdrop'], ['thumper', 'bell']],
  ['온실 자석+프리즘', 'greenhouse', 'magnet', ['prism', 'coil'], ['thumper', 'magnetpole']],
  ['온실 굽쇠/망치 교체', 'greenhouse', ['fork', 'mallet'], ['moss', 'dewdrop'], ['thumper', 'bell']],
  ['다락 망치', 'attic', 'mallet', ['cuckoofeather', 'sheetmusic'], ['thumper', 'winder']],
  ['다락 태엽열쇠', 'attic', 'key', ['cuckoofeather', 'sheetmusic'], ['thumper', 'winder']],
  ['다락 열쇠/망치 교체', 'attic', ['key', 'mallet'], ['cuckoofeather', 'sheetmusic'], ['thumper', 'winder']],
  ['다락 부지깽이+톱니', 'attic', 'poker', ['gearnecklace', 'bellows', 'matchbox'], ['brazier', 'thumper']],
  ['낙하지 망치', 'crater', 'mallet', ['stardust', 'lens'], ['thumper', 'antenna']],
  ['낙하지 별망치', 'crater', 'star', ['stardust', 'lens'], ['thumper', 'antenna']],
  ['낙하지 열쇠', 'crater', 'key', ['stardust', 'lens', 'cuckoofeather'], ['thumper', 'winder']],
];
if (process.argv[3] === 'heart') {
  // 심장 단계별로 도구·골동품 조합의 심장 피해량 비교
  const combos: [string, ToolKind[], string[], (MachineKind | null)[]][] = [
    ['망치', ['mallet'], ['stardust', 'lens', 'sheetmusic'], ['thumper', 'thumper']],
    ['열쇠+뻐꾸기', ['key', 'mallet'], ['cuckoofeather', 'sheetmusic', 'gearnecklace'], ['thumper', 'winder']],
    ['부지깽이+불', ['poker', 'mallet'], ['bellows', 'matchbox', 'gearnecklace'], ['thumper', 'brazier']],
    ['굽쇠+유리', ['fork', 'mallet'], ['dewdrop', 'marbles', 'moss'], ['thumper', 'bell']],
    ['자석+전기', ['magnet', 'mallet'], ['coil', 'lodestone', 'wetrope'], ['magnetpole', 'thumper']],
    ['별망치+별', ['star', 'mallet'], ['stardust', 'meteorite', 'lodestone'], ['antenna', 'thumper']],
  ];
  for (let phase = 0; phase < 3; phase++) {
    const line: string[] = [];
    for (const [name, tools, cur, sock] of combos) {
      const s = newState(99);
      s.lamps = 5;
      s.site = 'crater';
      s.heart = { hp: 1e9, max: 1e9, phase };
      s.tools = ['mallet', 'crowbar', 'poker', 'magnet', 'fork', 'key', 'star'];
      s.tool = tools[0];
      s.upgrades = { power: 8, cart: 9, strikes: 4, slots: 5, sockets: 5, combo: 5 };
      s.curios = [...cur];
      s.equipped = [...cur];
      s.machines = {};
      for (const k of sock) if (k) s.machines[k] = (s.machines[k] ?? 0) + 1;
      s.sockets = [...sock];
      const g = new Game(s);
      let t = 0;
      let cool = 0;
      let dmg = 0;
      let carts = 0;
      while (carts < 20) {
        if (!g.bench) g.startCart();
        const b = g.bench!;
        cool -= DT;
        if (b.canStrike() && cool <= 0) {
          let best: { t: ToolKind; p: { x: number; y: number; score: number } } | null = null;
          for (const tk of tools) {
            const p = b.bestStrikePoint(TOOL[tk]);
            if (p && (!best || p.score > best.p.score)) best = { t: tk, p };
          }
          if (best) {
            g.setTool(best.t);
            g.strike(best.p.x, best.p.y);
          }
          cool = 1.1;
        }
        g.step(DT);
        t += DT;
        for (const e of g.out) {
          if (e.k === 'heartHit') dmg += e.dmg;
          if (e.k === 'cartDone') carts++;
        }
        g.out.length = 0;
        g.s.heart!.phase = phase;
        if (g.bench) g.bench.heartPhase = phase;
      }
      line.push(`${name} ${Math.round((dmg / t) * 60)}`);
    }
    console.log(`단계 ${phase}: ${line.join(' | ')}`);
  }
  process.exit(0);
}
for (const [name, site, tool, cur, sock] of cases) {
  const r = run(site, tool, cur, sock, site === 'alley' ? 2 : site === 'docks' ? 4 : site === 'greenhouse' ? 6 : 8);
  console.log(`${name.padEnd(16)} 동전/분 ${Math.round(r.coinsPerMin).toString().padStart(9)}  별빛/분 ${r.starPerMin.toFixed(1).padStart(7)}  수레당 ${r.secPerCart.toFixed(1)}초`);
}
