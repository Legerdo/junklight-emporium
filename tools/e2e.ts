// 브라우저 전체 완주 검증(가속): 실제 빌드를 열고, 신규 저장에서 엔딩까지 페이지 안의 봇이 플레이한다.
// - 규칙/경제는 정상(강제 해금 없음). 연출 속도만 12배로 올린다(결과는 같고 진행만 빠름).
// - 중간(두 번째 등불 이후)에 페이지를 새로고침해 저장 복구를 확인한다.
// 사용: npm run build && npx vite preview (포트 4287) 후 npx tsx tools/e2e.ts [url]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4287/';
const OUT = 'tools/out';
mkdirSync(OUT, { recursive: true });

const BOT = `(() => {
  if (window.__bot) return;
  const jl = window.__jl;
  const core = () => jl.core;
  const W = { strikes: 2.2, cart: 1.6, power: 1.3, appraise: 1.1, slots: 1.6, combo: 1, sockets: 1.8, magpie: 4, magpieEye: 4, lucky: 0.4 };
  const TOOL_FOR = { alley: ['poker','crowbar'], docks: ['magnet'], greenhouse: ['fork'], attic: ['key'], crater: ['star'] };
  const MACH_FOR = { alley: ['thumper'], docks: ['magnetpole','thumper'], greenhouse: ['bell','brazier','thumper'], attic: ['winder','bell','thumper'], crater: ['antenna','winder','bell','thumper'] };
  const PRI = { alley: ['falsebottom','purse','matchbox','glove','marbles'], docks: ['coil','compass','lens','falsebottom','wetrope'], greenhouse: ['moss','dewdrop','prism','butterfly','marbles','lens'], attic: ['cuckoofeather','sheetmusic','pocketwatch','wetrope','gearnecklace','lens'], crater: ['stardust','lens','sheetmusic','pocketwatch','cuckoofeather','lodestone'] };
  let cool = 0, last = performance.now(), lastCart = -1;
  function shop() {
    const g = core(); const s = g.s;
    while (g.lightLamp()) { const l = jl.data.LAMPS[s.lamps - 1]; if (l.unlocks) g.setSite(l.unlocks); }
    for (const t of TOOL_FOR[s.site]) if (!s.tools.includes(t)) g.buyTool(t);
    if (s.sockets.includes(null)) for (const m of MACH_FOR[s.site]) if (g.buyMachine(m)) break;
    for (let k = 0; k < 20; k++) {
      let best = null, bs = Infinity;
      for (const u of jl.data.UPGRADES) {
        if (!g.upgradeAvailable(u.id)) continue;
        if (u.id === 'slots' && s.curios.length <= g.slotsCount()) continue;
        const sc = g.upgradeCost(u.id) / (W[u.id] || 1);
        if (sc < bs) { bs = sc; best = u.id; }
      }
      if (!best || !g.buyUpgrade(best)) break;
    }
    for (const id of [...s.peddler.stock]) if (g.peddlerPrice(id) < s.coins * 0.35) g.buyPeddler(id);
    const pri = PRI[s.site].filter((id) => s.curios.includes(id));
    const want = [...pri, ...s.curios.filter((id) => !pri.includes(id))].slice(0, g.slotsCount());
    for (let i = 0; i < g.slotsCount(); i++) g.equip(i, want[i] || null);
    jl.scene.refresh();
  }
  function tick() {
    const now = performance.now(); const dt = (now - last) / 1000; last = now;
    const g = core();
    if (document.querySelector('.modal')) {
      const b = document.querySelector('.modal [data-act="endingContinue"]') || document.querySelector('.modal button');
      if (b && !g.s.ended) b.click();
    }
    if (g.s.ended) return;
    if (g.s.stats.carts !== lastCart) { lastCart = g.s.stats.carts; shop(); }
    if (!g.bench) { if (g.autoNext < 0) g.ringBell(); }
    else {
      cool -= dt * window.__speed;
      const b = g.bench;
      if (b.canStrike() && cool <= 0) {
        let best = null;
        for (const t of g.s.tools) { const p = b.bestStrikePoint(jl.data.TOOLS.find((x) => x.id === t)); if (p && (!best || p.score > best.p.score)) best = { t, p }; }
        if (best) { g.setTool(best.t); g.strike(best.p.x, best.p.y); }
        cool = 1.1;
      }
    }
    requestAnimationFrame(tick);
  }
  window.__bot = true;
  requestAnimationFrame(tick);
})()`;

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const SPEED = 12;
  await page.addInitScript((sp) => {
    localStorage.setItem('junklight.settings.v1', JSON.stringify({ speed: sp, master: 0, music: 0, sfx: 0 }));
    (window as unknown as { __speed: number }).__speed = sp;
  }, SPEED);
  await page.goto(base + '?debug', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.evaluate(BOT);
  const t0 = Date.now();
  let reloaded = false;
  let lastShot = -1;
  const snap = () => page.evaluate(`(() => { const s = window.__jl.core.s; return { t: Math.round(s.stats.playTime), lamps: s.lamps, site: s.site, carts: s.stats.carts, coins: Math.round(s.coins), star: Math.round(s.star), ended: s.ended, heart: s.heart && Math.round(s.heart.hp) }; })()`) as Promise<{ t: number; lamps: number; site: string; carts: number; coins: number; star: number; ended: boolean; heart: number | null }>;
  for (;;) {
    await page.waitForTimeout(3000);
    const st = await snap();
    if (st.lamps !== lastShot) {
      lastShot = st.lamps;
      await page.screenshot({ path: `${OUT}/e2e-lamp${st.lamps}.png` });
      console.log(`[real ${Math.round((Date.now() - t0) / 1000)}s] 게임 ${Math.floor(st.t / 60)}분 · 등불 ${st.lamps} · ${st.site} · 수레 ${st.carts} · 동전 ${st.coins} · 별빛 ${st.star}${st.heart !== null ? ' · 심장 ' + st.heart : ''}`);
    }
    if (!reloaded && st.lamps >= 2) {
      reloaded = true;
      const before = await page.evaluate(`(() => { window.__jl.save(); const s = window.__jl.core.s; return JSON.stringify({ coins: s.coins, star: s.star, carts: s.stats.carts, lamps: s.lamps, curios: s.curios.length, bench: !!window.__jl.core.bench }); })()`);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const after = await page.evaluate(`(() => { const s = window.__jl.core.s; return JSON.stringify({ coins: s.coins, star: s.star, carts: s.stats.carts, lamps: s.lamps, curios: s.curios.length, bench: !!window.__jl.core.bench }); })()`);
      console.log('새로고침 전', before);
      console.log('새로고침 후', after);
      await page.evaluate(BOT);
    }
    if (st.ended) {
      await page.waitForTimeout(5000);
      await page.screenshot({ path: `${OUT}/e2e-ending.png` });
      console.log(`엔딩 도달: 게임 시간 ${Math.floor(st.t / 60)}분, 수레 ${st.carts}, 실제 ${Math.round((Date.now() - t0) / 1000)}초`);
      break;
    }
    if (Date.now() - t0 > 25 * 60 * 1000) {
      console.log('시간 초과', JSON.stringify(st));
      break;
    }
  }
  const ms = await page.evaluate(`JSON.stringify(window.__jl.core.s.milestones)`);
  console.log('마일스톤', ms);
  console.log('오류:', errors.length ? errors.join('\n') : '없음');
  await browser.close();
}
main();
