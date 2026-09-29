// 빠른 확인용: 브라우저를 띄워 시나리오를 실행하고 스크린샷을 남긴다.
// 사용: npx tsx tools/shot.ts <scenario> [url]
import { chromium, type Page } from 'playwright';
import { mkdirSync } from 'node:fs';

const scenario = process.argv[2] ?? 'basic';
const base = process.argv[3] ?? 'http://localhost:5287/';
const OUT = 'tools/out';
mkdirSync(OUT, { recursive: true });

const W = 1440;
const H = 810;
const S = 3; // 480x270 → 1440x810

async function gameClick(page: Page, x: number, y: number) {
  await page.mouse.move(x * S, y * S);
  await page.mouse.down();
  await page.mouse.up();
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(base + '?debug', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const shot = (n: string) => page.screenshot({ path: `${OUT}/${scenario}-${n}.png` });

  if (scenario === 'basic') {
    await shot('0-intro');
    await page.click('.modal button');
    await page.waitForTimeout(200);
    await page.click('#bell');
    await page.waitForTimeout(700);
    await shot('1-dump');
    await page.waitForTimeout(1800);
    await shot('2-settled');
    const pts: [number, number][] = [
      [240, 220],
      [180, 222],
      [300, 222],
    ];
    for (const [x, y] of pts) {
      await gameClick(page, x, y);
      await page.waitForTimeout(90);
      await shot(`3-strike-${x}`);
      await page.waitForTimeout(1000);
    }
    await page.waitForTimeout(2500);
    await shot('4-done');
    await page.click('#btn-shop');
    await page.waitForTimeout(200);
    await shot('5-shop');
  }
  if (scenario === 'late') {
    await page.click('.modal button');
    await page.evaluate(() => {
      const jl = (window as any).__jl;
      jl.unlockAll({ lamps: 3, site: 'attic', coins: 5e6, star: 100, upgrades: { power: 6, cart: 8, strikes: 3, slots: 4, sockets: 4, magpie: 1, magpieEye: 1, combo: 4, appraise: 5 }, tools: ['mallet', 'poker', 'magnet', 'fork', 'key'], tool: 'key', curios: ['cuckoofeather', 'sheetmusic', 'wetrope', 'coil', 'gearnecklace'], equipped: ['cuckoofeather', 'sheetmusic', 'wetrope', 'coil', 'gearnecklace'], machines: { thumper: 1, winder: 1, bell: 1, magnetpole: 1 }, sockets: ['thumper', 'winder', 'bell', 'magnetpole'] });
    });
    await page.waitForTimeout(300);
    await page.click('#bell');
    await page.waitForFunction(() => (window as any).__jl.core.bench?.phase === 'ready', null, { timeout: 8000 });
    await page.waitForTimeout(1600);
    await shot('1-settled');
    const p = await page.evaluate(() => (window as any).__jl.core.bench.bestStrikePoint());
    await gameClick(page, p.x, p.y);
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(150);
      await shot(`2-chain-${i}`);
    }
    await page.waitForTimeout(3000);
    await shot('3-after');
  }
  if (scenario === 'heart') {
    await page.click('.modal button');
    await page.evaluate(() => {
      const jl = (window as any).__jl;
      jl.unlockAll({ lamps: 5, site: 'crater', heart: { hp: 5000, max: 5000, phase: 0 }, coins: 5e7, upgrades: { power: 8, cart: 10, strikes: 4, slots: 5, sockets: 5, magpie: 1, magpieEye: 1, combo: 6, appraise: 8 }, tools: ['mallet', 'poker', 'magnet', 'fork', 'key', 'star'], tool: 'star', curios: ['cuckoofeather', 'sheetmusic', 'wetrope', 'coil', 'stardust', 'lens'], equipped: ['cuckoofeather', 'sheetmusic', 'wetrope', 'coil', 'stardust', 'lens'], machines: { thumper: 1, winder: 1, bell: 1, antenna: 1, brazier: 1 }, sockets: ['thumper', 'winder', 'bell', 'antenna', 'brazier'] });
    });
    await page.waitForTimeout(300);
    await page.click('.modal button').catch(() => {});
    await page.click('#bell');
    await page.waitForFunction(() => (window as any).__jl.core.bench?.phase === 'ready', null, { timeout: 8000 });
    await page.waitForTimeout(300);
    await shot('1-settled');
    const p = await page.evaluate(() => (window as any).__jl.core.bench.bestStrikePoint());
    await gameClick(page, p.x, p.y);
    await page.waitForTimeout(350);
    await shot('2-chain');
    await page.waitForTimeout(3000);
    await shot('3-after');
  }
  if (scenario === 'panels') {
    await page.click('.modal button');
    await page.evaluate(() => {
      const jl = (window as any).__jl;
      jl.unlockAll({ lamps: 2, site: 'greenhouse', coins: 80000, star: 900, upgrades: { power: 4, cart: 4, strikes: 2, slots: 2, sockets: 2, magpie: 1 }, tools: ['mallet', 'crowbar', 'magnet'], curios: ['coil', 'prism', 'purse', 'lens'], equipped: ['coil', 'prism', 'purse'], machines: { thumper: 1, magnetpole: 1 }, sockets: ['thumper', 'magnetpole'], seen: ['crate', 'bottle', 'can', 'rag', 'pane', 'pot'] });
    });
    for (const p of ['shop', 'workshop', 'curios', 'requests', 'map', 'codex', 'settings']) {
      await page.click(`#menu [data-open="${p}"]`);
      await page.waitForTimeout(150);
      await shot(p);
      await page.keyboard.press('Escape');
    }
    // 상점 탭
    await page.click('#menu [data-open="shop"]');
    await page.click('[data-act="tab"][data-id="peddler"]');
    await shot('shop-peddler');
    await page.click('[data-act="tab"][data-id="machines"]');
    await shot('shop-machines');
    await page.keyboard.press('Escape');
  }
  if (scenario === 'ending') {
    await page.click('.modal button');
    await page.evaluate(() => {
      const jl = (window as any).__jl;
      jl.unlockAll({ lamps: 5, site: 'crater', heart: { hp: 30, max: 8000, phase: 2 }, coins: 5e7, upgrades: { power: 8, cart: 10, strikes: 4, slots: 3, sockets: 2 }, tools: ['mallet', 'star'], tool: 'star', curios: ['stardust', 'lens', 'coil'], equipped: ['stardust', 'lens', 'coil'], machines: { thumper: 1, antenna: 1 }, sockets: ['thumper', 'antenna'] });
    });
    await page.click('#bell');
    await page.waitForFunction(() => (window as any).__jl.core.bench?.phase === 'ready', null, { timeout: 8000 });
    await shot('0-heart');
    for (let i = 0; i < 6; i++) {
      const p = await page.evaluate(() => (window as any).__jl.core.bench?.bestStrikePoint());
      if (!p) break;
      await gameClick(page, p.x, p.y);
      await page.waitForTimeout(700);
      if (await page.evaluate(() => (window as any).__jl.core.s.ended)) break;
    }
    await page.waitForTimeout(1200);
    await shot('1-rise');
    await page.waitForTimeout(3500);
    await shot('2-modal');
    await page.click('[data-act="endingNext"]').catch(() => {});
    await page.waitForTimeout(300);
    await shot('3-map');
  }
  if (scenario === 'ngplus') {
    await page.click('.modal button');
    await page.evaluate(`window.__jl.unlockAll({ ended: true, lamps: 5, site: 'crater', badges: ['first'], curios: ['coil','prism','purse','lens','stardust'], equipped: [null], coins: 123456 })`);
    await page.click('#menu [data-open="map"]');
    await page.evaluate(`document.getElementById('pbody').scrollTop = 99999`);
    await page.waitForTimeout(150);
    await shot('0-map');
    await page.click('[data-act="ngplus"][data-id="hands"]');
    await page.waitForTimeout(100);
    await shot('1-confirm');
    await page.click('.modal #yes');
    await page.waitForTimeout(400);
    await shot('2-newnight');
    console.log('state', await page.evaluate(`JSON.stringify({ ng: window.__jl.core.s.ngPlus, c: window.__jl.core.s.constellation, coins: window.__jl.core.s.coins, curios: window.__jl.core.s.curios.length, sockets: window.__jl.core.s.sockets, strikes: window.__jl.core.mods.strikes })`));
    await page.click('#bell');
    await page.waitForFunction(() => (window as any).__jl.core.bench?.phase === 'ready', null, { timeout: 8000 });
    await gameClick(page, 240, 222);
    await page.waitForTimeout(600);
    await shot('3-play');
  }
  if (scenario === 'reload') {
    await page.click('.modal button');
    await page.click('#bell');
    await page.waitForFunction(() => (window as any).__jl.core.bench?.phase === 'ready', null, { timeout: 8000 });
    const p = await page.evaluate(() => (window as any).__jl.core.bench.bestStrikePoint());
    await gameClick(page, p.x, p.y);
    await page.waitForTimeout(160);
    const before = await page.evaluate(() => {
      const jl = (window as any).__jl;
      jl.save();
      return { coins: jl.core.s.coins, left: jl.core.bench?.leftovers().length ?? 0, strikes: jl.core.bench?.totalStrikes, breaks: jl.core.s.stats.breaks };
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const after = await page.evaluate(() => {
      const jl = (window as any).__jl;
      return { coins: jl.core.s.coins, left: jl.core.bench?.leftovers().length ?? 0, strikes: jl.core.bench?.totalStrikes, breaks: jl.core.s.stats.breaks, intro: !!document.querySelector('.modal') };
    });
    console.log('before', JSON.stringify(before), 'after', JSON.stringify(after));
    await shot('after-reload');
  }
  if (scenario === 'perf') {
    await page.click('.modal button');
    await page.evaluate(() => {
      const jl = (window as any).__jl;
      jl.unlockAll({ lamps: 4, site: 'attic', coins: 5e7, upgrades: { power: 10, cart: 12, strikes: 4, slots: 5, sockets: 5, magpie: 1, magpieEye: 1, combo: 8 }, tools: ['mallet', 'key'], tool: 'key', curios: ['cuckoofeather', 'wetrope', 'coil', 'gearnecklace', 'endless', 'stareye'], equipped: ['cuckoofeather', 'wetrope', 'coil', 'gearnecklace', 'endless', 'stareye'], machines: { thumper: 2, winder: 1, bell: 1, brazier: 1 }, sockets: ['thumper', 'winder', 'bell', 'brazier', 'thumper'] });
    });
    // tsx의 __name 헬퍼가 브라우저에 없으므로 문자열로 넘긴다.
    const res = await page.evaluate(`(async () => {
      const jl = window.__jl;
      const frames = [];
      let last = performance.now();
      let maxItems = 0;
      let running = true;
      function loop() {
        const now = performance.now();
        frames.push(now - last);
        last = now;
        maxItems = Math.max(maxItems, jl.core.bench ? jl.core.bench.items.length : 0);
        if (running) requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);
      for (let c = 0; c < 4; c++) {
        if (!jl.core.bench) jl.core.startCart();
        await new Promise((r) => setTimeout(r, 1800));
        const p = jl.core.bench && jl.core.bench.bestStrikePoint();
        if (p) jl.core.strike(p.x, p.y);
        await new Promise((r) => setTimeout(r, 3500));
      }
      running = false;
      frames.sort((a, b) => a - b);
      const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
      return { frames: frames.length, avgMs: avg.toFixed(2), p95: frames[Math.floor(frames.length * 0.95)].toFixed(2), max: frames[frames.length - 1].toFixed(1), maxItems };
    })()`);
    console.log('perf', JSON.stringify(res));
    await shot('end');
  }
  console.log('errors:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
}
main();
