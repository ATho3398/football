// C.75i 확인 캡처 (지시 카드): 첫 경기 뒤 받은 지시 카드 3장을 덱에 넣고, 직접 모드 결정 순간의 지시 카드 4번째 선택지·경기 결과. 세로 폰 390×844 기본 · PC 1280×800 (W H PREFIX).
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c75a-capture.mjs [playwright 모듈 경로] [저장 폴더]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/c75i-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const P = process.env.PREFIX ?? '';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (k) => !ONLY || ONLY.includes(k);
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: W < 1024 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.stack); });
const has = async (sel) => (await page.locator(sel).count()) > 0;
// 가로 넘침 · 레일에 가려진 버튼 · 화면 밖 버튼(세로는 스크롤로 닿으면 됨) 검사
const check = () => page.evaluate(() => {
  const vw = innerWidth;
  const rail = [...document.querySelectorAll('.dock-bar')].find((x) => x.offsetParent || getComputedStyle(x).position === 'fixed');
  const rr = rail && getComputedStyle(rail).display !== 'none' ? rail.getBoundingClientRect() : null;
  const hidden = [];
  for (const b of document.querySelectorAll('main button, main [data-act], .po-overlay button')) {
    if (!b.offsetParent) continue;
    const r = b.getBoundingClientRect();
    if (r.width === 0) continue;
    const off = r.right > vw + 1 && !b.closest('[class*="scroll"], .mo-cards, .gc-pick, .po-tabs, .tabs, .chips, .px-tiles, .ca-row, [style*="overflow"]');
    let under = false;
    if (rr && rr.right > 0 && !b.closest('.dock-bar') && r.left < rr.right - 1 && r.right > rr.left) {
      const el = document.elementFromPoint(Math.max(r.left + 2, 0), r.top + r.height / 2);
      under = !!el && !!el.closest('.dock-bar');
    }
    if (off || under) hidden.push(`${off ? 'off' : 'rail'}:${(b.textContent || b.getAttribute('aria-label') || b.dataset.act || '').trim().slice(0, 20)}`);
  }
  return { wide: document.documentElement.scrollWidth - vw, hidden: hidden.slice(0, 8) };
});
const report = { W, H, errors, screens: {} };
const shot = async (name) => {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${P}${name}.png` });
  report.screens[name] = await check();
  console.log('saved', name, JSON.stringify(report.screens[name]));
};
async function dismiss() {
  for (let k = 0; k < 4; k++) {
    if (await has('[data-act="intro-ok"]')) await page.locator('[data-act="intro-ok"]').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]')) await page.locator('[data-act="tip-close"]').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const act = async (a, extra = '') => { if (!['intro-ok', 'tip-close', 'tips-off'].includes(a)) await dismiss(); return page.locator(`[data-act="${a}"]${extra}:visible`).first().click(); };
const top = () => page.evaluate(() => window.scrollTo(0, 0));
const tab = async (v) => {
  if (!(await has(`[data-act="go-tab"][data-v="${v}"]:visible`)) && (await has('[data-act="dock-more"]:visible'))) { await act('dock-more'); await page.waitForTimeout(200); }
  if (!(await has(`[data-act="go-tab"][data-v="${v}"]:visible`))) { await page.evaluate((x) => document.querySelector(`[data-act="go-tab"][data-v="${x}"]`)?.click(), v); } else await act('go-tab', `[data-v="${v}"]`); await page.waitForTimeout(400); await dismiss(); await top(); };
const SKIN = process.env.SKIN ?? 'b';
const start = async (mode, id, seed, shotNew = false) => {
  await page.goto(process.env.URL ?? 'http://localhost:4173/');
  await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
  if (SKIN === 'a') await page.evaluate(() => localStorage.setItem('po-skin', 'a'));
  await page.reload();
  await act('go', '[data-to="new"]');
  await page.waitForTimeout(300);
  if (await has('#f-seed')) { await page.fill('#f-seed', seed); await page.locator('#f-seed').dispatchEvent('change'); }
  if (mode === 'real') {
    await act('form', '[data-k="mode"][data-v="real"]');
    await page.waitForTimeout(300);
    if (!(await has(`[data-act="form"][data-k="realId"][data-v="${id}"]`))) { await page.fill('#f-rq', '손흥민'); await page.locator('#f-rq').dispatchEvent('change'); await page.waitForTimeout(600); }
    await page.locator(`[data-act="form"][data-k="realId"][data-v="${id}"]`).first().click();
  }
  await page.waitForTimeout(200);
  if (shotNew) { await top(); await shot('새게임'); }
  await act('start');
  await page.waitForTimeout(800);
  for (const sel of ['[data-act="tips-off"]', '[data-act="opt-quick"][data-v="quick"]']) {
    await page.locator(`${sel}:visible`).first().click({ timeout: 1500 }).catch(() => null);
    await page.waitForTimeout(250);
    await dismiss();
  }
  await dismiss();
  return true;
};



const info = () => page.evaluate(() => ({
  opts: [...document.querySelectorAll('.mo-opts .po-choice')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50)),
  hand: [...document.querySelectorAll('.mo-cards [data-act="mo-card"]')].map((c) => ({ v: c.getAttribute('data-v'), t: (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30), off: c.matches('.is-disabled, [aria-disabled="true"]') })),
}));
const toPrep = async () => {
  await tab('home');
  for (let k = 0; k < 10 && !(await has('[data-act="play"]')); k++) {
    if (await has('[data-act="day-continue"]')) { await act('day-continue'); await page.waitForTimeout(1500); } else break;
  }
  await act('play');
  await page.waitForSelector('main.screen-prep', { timeout: 60_000 });
  await page.waitForTimeout(300); await dismiss();
};
const waitEnd = async (direct) => {
  for (let loop = 0; loop < 120; loop++) {
    await page.waitForSelector('[data-act="mo-confirm"], [data-act="oc-skip"], main.screen-match', { timeout: 180_000 });
    if (await page.evaluate(() => !!document.querySelector('main.screen-match'))) return;
    await page.waitForTimeout(1200);
    await dismiss();
    if (!(await has('[data-act="mo-confirm"]'))) { if (await has('[data-act="oc-skip"]')) await act('oc-skip'); await page.waitForTimeout(300); continue; }
    if (await has('.mo-react')) { await act('mo-pick-confirm', '[data-v="0"]'); continue; }
    await direct();
  }
};
const PLAYER = process.env.PLAYER ?? 'son';
report.moments = [];
if (await start('real', PLAYER, process.env.SEED ?? 'c75i-check')) {
  // 1) 첫 경기 (자동): 지시 카드 3장 받기
  await toPrep();
  if (await has('[data-act="ctl-mode"][data-v="auto"]')) await act('ctl-mode', '[data-v="auto"]');
  await act('prep-start');
  await waitEnd(async () => { await act('mo-delegate'); });
  await page.waitForTimeout(500);
  // 2) 덱에 지시 카드 넣기
  await tab('deck');
  await shot('덱-지시카드');
  for (const id of ['dirFollow', 'dirSolo', 'dirTrust']) {
    const sel = `[data-act="card-open"][data-v="${id}"]`;
    if (!(await has(sel))) { console.log('no card', id); continue; }
    await page.locator(sel).first().scrollIntoViewIfNeeded();
    await page.locator(sel).first().click();
    await page.waitForTimeout(300);
    if (id === 'dirSolo') await shot('카드상세-독단');
    if (await has('[data-act="deck-add"]:not([disabled])')) await act('deck-add');
    await page.waitForTimeout(300);
    if (await has('[data-act="card-close"]')) await act('card-close');
    await page.waitForTimeout(200);
  }
  // 3) 다음 경기 직접 모드: 지시 카드 선택지 캡처, 독단·이행이 열리면 그 선택지로
  await toPrep();
  if (await has('[data-act="ctl-mode"][data-v="direct"]')) await act('ctl-mode', '[data-v="direct"]');
  if (await has('[data-act="ctl-stop"][data-v="all"]')) await act('ctl-stop', '[data-v="all"]');
  await act('prep-start');
  let saved = 0;
  await waitEnd(async () => {
    const m = await info();
    report.moments.push(m);
    const dir = m.hand.find((c) => /독단|지시 이행|감독의 신뢰/.test(c.t) && !c.off);
    if (dir) {
      await page.locator(`.mo-cards [data-act="mo-card"][data-v="${dir.v}"]`).first().click();
      await page.waitForTimeout(250);
      const m2 = await info();
      const k = m2.opts.length - 1;
      await act('mo-pick', `[data-v="${k}"]`); await page.waitForTimeout(250);
      if (await has('[data-act="mo-confirm"][disabled]')) { await act('mo-pick', `[data-v="${k}"]`); await page.waitForTimeout(250); }
      if (await has('[data-act="mo-confirm"][disabled]')) { await act('mo-pick', '[data-v="0"]'); await page.waitForTimeout(250); }
      if (saved < 3) { saved++; await top(); await shot(`결정순간-${dir.t.slice(0, 6).replace(/\s/g, '')}-${saved}`); }
    } else {
      await act('mo-pick', '[data-v="0"]'); await page.waitForTimeout(250);
      if (await has('[data-act="mo-confirm"][disabled]')) { await act('mo-pick', '[data-v="0"]'); await page.waitForTimeout(250); }
    }
    await act('mo-confirm');
    await page.waitForSelector('.po-splash', { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(400);
    if (await has('[data-act="oc-skip"]')) await act('oc-skip').catch(() => {});
  });
  await page.waitForTimeout(600); await top();
  await shot('경기결과');
}
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ errors: report.errors, n: report.moments.length, dir: report.moments.filter((m) => m.hand.some((c) => /독단|지시/.test(c.t))).length, kinds: Object.keys(report.screens) }, null, 1));
await browser.close();
