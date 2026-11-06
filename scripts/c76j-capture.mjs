// C.76j 확인 캡처 (U8-e 시즌·월드·기록, 적용 명세 docs/ui-requests/7-13-part2-apply.md).
// 실행: npx vite-node scripts/c76j-saves.ts -- <세이브 폴더> → npm run build && npx vite preview --port 4173 &
//       node scripts/c76j-capture.mjs <playwright 모듈 경로> <세이브 폴더> [저장 폴더]. 환경: W H PREFIX ONLY(쉼표 목록)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const SAVES = process.argv[3];
const OUT = process.argv[4] ?? new URL('../docs/design/c76j-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const P = process.env.PREFIX ?? '';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const report = { W, H, shots: {}, errors: [] };

async function session(save, steps) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: W < 1024 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.errors.push(e.message));
  const has = async (s) => (await page.locator(s).count()) > 0;
  const wait = (ms) => page.waitForTimeout(ms);
  const dismiss = async () => { for (let k = 0; k < 5; k++) { if (await has('[data-act="intro-ok"]:visible')) await page.locator('[data-act="intro-ok"]:visible').first().click(); else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click(); else if (await has('[data-act="tip-close"]:visible')) await page.locator('[data-act="tip-close"]:visible').first().click(); else break; await wait(150); } };
  const clk = async (sel) => { await page.evaluate((s) => document.querySelector(s)?.click(), sel); await wait(400); await dismiss(); };
  const h = {
    page, has, wait, dismiss, clk,
    tab: (v) => clk(`[data-act="go-tab"][data-v="${v}"]`),
    scroll: (sel) => page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'start' }), sel),
    shot: async (name, full = false) => {
      if (ONLY && !ONLY.some((o) => name.startsWith(o))) return;
      await wait(400);
      await page.screenshot({ path: `${OUT}/${P}${name}.png`, fullPage: full });
      report.shots[name] = { wide: await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) };
      console.log('saved', name, JSON.stringify(report.shots[name]));
    },
    toPrep: async () => {
      for (let k = 0; k < 30 && !(await has('[data-act="play"]')); k++) await clk('[data-act="day-one"]');
      await clk('[data-act="play"]'); await page.waitForSelector('main.screen-prep', { timeout: 60000 }); await dismiss();
    },
  };
  await page.goto(process.env.URL ?? 'http://localhost:4173/');
  const s = readFileSync(`${SAVES}/${save}.json`, 'utf8');
  await page.evaluate((s1) => { localStorage.clear(); localStorage.setItem('football-career:1', s1); localStorage.setItem('po-tips-off', '1'); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); }, s);
  await page.reload(); await wait(600);
  if (!(await has('[data-act="load"][data-slot="1"]'))) await page.evaluate(() => document.querySelector('[data-act="go"][data-to="saves"]')?.click());
  await page.waitForSelector('[data-act="load"][data-slot="1"]', { state: 'attached', timeout: 10000 });
  await page.evaluate(() => document.querySelector('[data-act="load"][data-slot="1"]')?.click());
  await wait(1200); await dismiss();
  await page.evaluate(() => document.fonts.ready);
  await steps(h);
  await ctx.close();
}

const wide = W >= 1024;
const pre = wide ? 'PC_' : '';
// 205 컵·챔스 (조별 · 녹아웃 · 국내 컵)
await session('2018-09-20', async (h) => { await h.tab('world'); await h.clk('[data-act="world-tab"][data-v="cups"]'); await h.shot(`${pre}01_월드_컵챔스_조별`); });
if (!wide) {
  await session('2019-03-20', async (h) => {
    await h.tab('world'); await h.clk('[data-act="world-tab"][data-v="cups"]'); await h.shot('02_월드_컵챔스_녹아웃');
    await h.clk('[data-act="cup-sub"][data-v="fa"]'); await h.shot('03_월드_컵챔스_FA컵');
  });
  // 211 홈 할 일 · 이번 시즌 대회 칸 (카드 선택권 1장 넣어서)
  await session('2018-09-20', async (h) => {
    await h.page.evaluate(() => { const g = globalThis.__game(); if (!g.cards.picks.length) g.cards.picks.push({ label: '2018 시즌 목표 · 감독(보통) 달성', options: [], key: 'cap' }); });
    await h.tab('player'); await h.tab('home'); await h.scroll('.next-card'); await h.shot('04_홈_할일_대회칸');
  });
  // 214 대회 배너 → 207 우승 축하 (결승 승리를 넣어 띄움)
  await session('2018-09-20', async (h) => {
    await h.toPrep();
    if (await h.has('[data-act="ctl-mode"][data-v="auto"]')) await h.clk('[data-act="ctl-mode"][data-v="auto"]');
    await h.clk('[data-act="prep-start"]');
    await h.page.waitForSelector('main.screen-match', { timeout: 120000 }); await h.wait(800); await h.dismiss();
    await h.page.evaluate(() => { const g = globalThis.__game(); delete g.lastMatch.nat; if (!g.lastMatch.cup) g.lastMatch.cup = { comp: 'ucl', stage: '조별 2차전', decisive: false, through: false }; });
    const rerender = () => h.page.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'more'; b.dataset.v = 'zz'; document.querySelector('#app')?.appendChild(b); b.click(); });
    await rerender(); await h.wait(400); await h.scroll('.cup-banner'); await h.page.evaluate(() => window.scrollBy(0, -120)); await h.shot('05_경기결과_대회배너');
    await h.page.evaluate(() => { const g = globalThis.__game(); g.lastMatch.cup = { comp: 'ucl', stage: '결승', through: true, won: true }; });
    await rerender(); await h.wait(400); await h.shot('06_우승축하_챔스');
  });
}
// 212 · 231 경기 준비 (대회 배지 · 상대 분석)
await session('2018-09-20', async (h) => { await h.toPrep(); await h.shot(`${pre}${wide ? '02' : '07'}_경기준비_상대분석`); });
if (!wide) {
  // 224 · 210 시즌 요약 하이라이트 3장 · 목표 결과
  await session('end', async (h) => { await h.clk('[data-act="go"][data-to="season"]'); await h.scroll('.shl'); await h.page.evaluate(() => window.scrollBy(0, -60)); await h.shot('08_시즌요약_하이라이트_목표'); });
}
writeFileSync(`${OUT}/${P}report${wide ? '-pc' : ''}.json`, JSON.stringify(report, null, 1));
console.log('errors', JSON.stringify(report.errors));
await browser.close();
