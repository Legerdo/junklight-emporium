// README용 스크린샷 촬영. 후보를 tools/out/readme/에 여러 장 찍고, 고른 것을 docs/screenshots/로 옮긴다.
// 사용: npm run build && npm run preview 실행 중에 npx tsx tools/readme-shots.ts
import { chromium, type Page } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4287/';
const OUT = 'tools/out/readme';
mkdirSync(OUT, { recursive: true });
const S = 3;

async function click(page: Page, x: number, y: number) {
  await page.mouse.move(x * S, y * S);
  await page.mouse.down();
  await page.mouse.up();
}
async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__jl.core.bench?.phase === 'ready', null, { timeout: 10000 });
}
async function bestClick(page: Page) {
  const p = (await page.evaluate('window.__jl.core.bench && window.__jl.core.bench.bestStrikePoint()')) as { x: number; y: number } | null;
  if (p) await click(page, p.x, p.y);
}
let browserRef: import('playwright').Browser;
async function fresh(_old: Page): Promise<Page> {
  await _old.context().close();
  const ctx = await browserRef.newContext({ viewport: { width: 1440, height: 810 } });
  await ctx.addInitScript(() => localStorage.setItem('junklight.settings.v1', JSON.stringify({ master: 0, shake: 0, flash: false })));
  const page = await ctx.newPage();
  await page.goto(base + '?debug', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  return page;
}
async function burst(page: Page, name: string, n: number, gap: number) {
  for (let i = 0; i < n; i++) {
    await page.waitForTimeout(gap);
    await page.screenshot({ path: `${OUT}/${name}-${i}.png` });
  }
}

const LATE = `window.__jl.unlockAll({ lamps: 4, site: 'attic', coins: 3.2e6, star: 3100, upgrades: { power: 8, cart: 10, strikes: 3, slots: 4, sockets: 4, magpie: 1, magpieEye: 1, combo: 5, appraise: 6 }, tools: ['mallet','poker','magnet','fork','key'], tool: 'key', curios: ['cuckoofeather','sheetmusic','wetrope','coil','gearnecklace','prism','lens','moss'], equipped: ['cuckoofeather','sheetmusic','wetrope','gearnecklace','coil'], machines: { thumper: 1, winder: 1, bell: 1, brazier: 1 }, sockets: ['thumper','winder','bell','brazier'], seen: ['crate','bottle','can','rag','bulb','paper','teddy','drawer','purse','chain','plate','safe','net','buoy','lantern','windup','cuckoo','gearbox','trunk','musicbox','frame','pot','pane'] })`;
const HEART = `window.__jl.unlockAll({ lamps: 5, site: 'crater', heart: { hp: 4200, max: 8000, phase: 1 }, coins: 4e7, star: 800, upgrades: { power: 10, cart: 12, strikes: 4, slots: 5, sockets: 5, magpie: 1, magpieEye: 1, combo: 7, appraise: 9 }, tools: ['mallet','poker','magnet','fork','key','star'], tool: 'fork', curios: ['dewdrop','marbles','moss','stardust','lens','sheetmusic'], equipped: ['dewdrop','marbles','moss','stardust','lens','sheetmusic'], machines: { thumper: 1, bell: 1, antenna: 1, winder: 1, magnetpole: 1 }, sockets: ['thumper','bell','antenna','winder','magnetpole'] })`;

async function main() {
  const browser = await chromium.launch();
  browserRef = browser;
  let page = await (await browser.newContext({ viewport: { width: 1440, height: 810 } })).newPage();
  await page.context().addInitScript(() => localStorage.setItem('junklight.settings.v1', JSON.stringify({ master: 0, shake: 0, flash: false })));
  await page.goto(base + '?debug', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // 1. 인트로
  await page.screenshot({ path: `${OUT}/intro.png` });
  await page.click('.modal button');

  // 2. 초반 첫 타격
  await page.click('#bell');
  await ready(page);
  await page.waitForTimeout(300);
  await bestClick(page);
  await burst(page, 'early', 5, 90);

  // 3. 부두 자석
  page = await fresh(page);
  await page.click('.modal button');
  await page.evaluate(`window.__jl.unlockAll({ lamps: 1, site: 'docks', coins: 5200, star: 90, upgrades: { power: 3, cart: 5, strikes: 1, slots: 2, sockets: 2, magpie: 1 }, tools: ['mallet','crowbar','magnet'], tool: 'magnet', curios: ['coil','compass','purse'], equipped: ['coil','compass'], machines: { thumper: 1, magnetpole: 1 }, sockets: ['thumper','magnetpole'] })`);
  await page.click('#bell');
  await ready(page);
  await page.waitForTimeout(300);
  await bestClick(page);
  await burst(page, 'docks', 8, 90);

  // 4. 다락 태엽 연쇄
  page = await fresh(page);
  await page.click('.modal button');
  await page.evaluate(LATE);
  await page.click('#bell');
  await ready(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/attic-before.png` });
  await bestClick(page);
  await burst(page, 'attic', 10, 110);
  await page.waitForTimeout(2500);

  // 5. 패널
  await page.keyboard.press('Escape');
  await page.click('#menu [data-open="curios"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/panel-curios.png` });
  await page.keyboard.press('Escape');
  await page.click('#menu [data-open="shop"]');
  await page.click('[data-act="tab"][data-id="tools"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/panel-tools.png` });
  await page.keyboard.press('Escape');

  // 6. 별의 심장
  page = await fresh(page);
  await page.click('.modal button');
  await page.evaluate(HEART);
  await page.waitForTimeout(200);
  await page.click('.modal button').catch(() => {});
  await page.click('#bell');
  await ready(page);
  await page.waitForTimeout(300);
  await bestClick(page);
  await burst(page, 'heart', 10, 120);

  // 7. 엔딩 후 하늘
  page = await fresh(page);
  await page.click('.modal button');
  await page.evaluate(`window.__jl.unlockAll({ lamps: 5, site: 'crater', heart: { hp: 20, max: 8000, phase: 2 }, coins: 5e7, upgrades: { power: 10, cart: 10, strikes: 4, slots: 3, sockets: 2 }, tools: ['mallet','star'], tool: 'star', curios: ['stardust','lens','coil'], equipped: ['stardust','lens','coil'], machines: { thumper: 1, antenna: 1 }, sockets: ['thumper','antenna'] })`);
  await page.click('.modal button').catch(() => {});
  await page.click('#bell');
  await ready(page);
  for (let i = 0; i < 6; i++) {
    await bestClick(page);
    await page.waitForTimeout(700);
    if (await page.evaluate('window.__jl.core.s.ended')) break;
  }
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${OUT}/ending-rise.png` });
  await page.waitForTimeout(3600);
  await page.screenshot({ path: `${OUT}/ending-modal.png` });
  await page.click('[data-act="endingContinue"]').catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/ending-after.png` });

  await browser.close();
  console.log('done');
}
main();
