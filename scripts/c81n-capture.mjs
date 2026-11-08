// C.81n 확인 캡처 (실제 게임 흐름): 홈 선수 카드·선수 화면 잠재력 범위 · 결정 순간 위험 등급 칩·기대 평점 (화면 숫자로 다시 센 값과 비교). W H PREFIX 로 폰·PC.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c81n-capture.mjs [playwright 모듈 경로] [저장 폴더]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/captures/c81n/', import.meta.url).pathname;
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
    if (!(await has(`[data-act="form"][data-k="realId"][data-v="${id}"]`))) { await page.fill('#f-rq', process.env.Q ?? '손흥민'); await page.locator('#f-rq').dispatchEvent('change'); await page.waitForTimeout(600); }
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




const PLAYER = process.env.PLAYER ?? 'son';
await start('real', PLAYER, process.env.SEED ?? 'c81n-check');
await tab('home');
const potHome = await page.evaluate(() => document.querySelector('.po-pcard__pot')?.textContent || '');
await page.locator('.po-pcard').first().scrollIntoViewIfNeeded().catch(() => null);
await shot('홈-선수카드-잠재력');
await tab('player');
const potPlayer = await page.evaluate(() => document.querySelector('.pl-pot b')?.textContent || '');
await shot('선수-잠재력');
report.potential = { home: potHome.trim(), player: potPlayer.trim() };
await tab('home');
for (let k = 0; k < 8 && !(await has('[data-act="play"]')); k++) {
  if (await has('[data-act="day-continue"]')) { await act('day-continue'); await page.waitForTimeout(1500); }
}
for (let k = 0; k < 4 && !(await has('main.screen-prep')); k++) { await act('play'); await page.waitForSelector('main.screen-prep', { timeout: 60_000 }).catch(() => null); await dismiss(); }
await page.waitForSelector('main.screen-prep', { timeout: 60_000 });
await page.waitForTimeout(300); await dismiss();
if (await has('[data-act="ctl-mode"][data-v="direct"]')) await act('ctl-mode', '[data-v="direct"]');
if (await has('[data-act="ctl-stop"][data-v="all"]')) await act('ctl-stop', '[data-v="all"]');
await act('prep-start');
// 화면 줄에서 숫자 읽기 → 기대 평점 다시 세기
const readRows = () => page.evaluate(() => [...document.querySelectorAll('.mo-opts .po-choice')].map((b) => {
  const n = (s) => (s == null ? null : Number(s.replace('−', '-').replace('+', '').replace('±', '')));
  const outs = [...b.querySelectorAll('.po-out')];
  const ok = outs.find((o) => o.classList.contains('po-out--ok'))?.querySelector('b')?.textContent;
  const bad = outs.find((o) => o.classList.contains('po-out--bad'))?.querySelector('b')?.textContent ?? '';
  const ev = outs.find((o) => o.classList.contains('po-out--ev'))?.querySelector('b')?.textContent;
  const big = b.querySelector('.po-choice__prob b')?.textContent?.replace('%', '');
  const pas = bad.match(/소극적 ([+−±-]?[\d.]+)/);
  return { name: b.querySelector('.po-choice__name')?.textContent, chain: (b.querySelector('.po-choice__name')?.textContent || '').includes('→'), chance: big && /\d/.test(big) ? Number(big) : null,
    up: n(ok), down: n(bad.split(' · ')[0]), passive: pas ? n(pas[1]) : 0, ev: n(ev), risk: (b.querySelector('.po-risk')?.className.match(/po-risk--(\w+)/) || [])[1] ?? null };
}));
const got = { moment: 0, card: false, mismatch: [] , rows: [] };
for (let loop = 0; loop < 200 && got.moment < Number(process.env.MOMENTS ?? 3) && !(got.moment >= 1 && got.card); loop++) {
  await page.waitForSelector('[data-act="mo-confirm"], [data-act="oc-skip"], [data-act="ht-keep"], main.screen-match', { timeout: 180_000 });
  if (await page.evaluate(() => !!document.querySelector('main.screen-match'))) break;
  await page.waitForTimeout(600);
  await dismiss();
  if (await has('[data-act="ht-keep"]')) { await act('ht-keep'); continue; }
  if (!(await has('[data-act="mo-confirm"]'))) { if (await has('[data-act="oc-skip"]')) await act('oc-skip'); await page.waitForTimeout(300); continue; }
  if (await has('.mo-react')) { await act('mo-pick-confirm', '[data-v="0"]'); continue; }
  got.moment++;
  await act('mo-pick', '[data-v="0"]'); await page.waitForTimeout(300);
  const rows = await readRows();
  for (const r of rows) {
    if (r.chance === null) continue;
    const p = r.chance / 100;
    const want = Math.round((p * r.up + (r.chain ? null : 1 - p) * r.down + r.passive) * 100) / 100;
    if (!r.chain && Math.abs(want - r.ev) > 1e-9) got.mismatch.push({ ...r, want });
    const loss = Math.abs(r.down);
    const wr = loss <= 0.02 + 1e-9 ? 'low' : loss <= 0.05 + 1e-9 ? 'mid' : 'high';
    if (wr !== r.risk) got.mismatch.push({ ...r, wantRisk: wr });
  }
  got.rows.push(rows);
  // C.81n 후속: 접힌 줄 이름이 잘리지 않는지 (말줄임·넘침)
  const cut = await page.evaluate(() => [...document.querySelectorAll('.mo-opts .po-choice__name')].filter((e) => e.scrollWidth > e.clientWidth + 1 || getComputedStyle(e).textOverflow === 'ellipsis').map((e) => e.textContent));
  (got.cut ??= []).push(...cut);
  if (got.moment === 1) { await top(); await shot('결정순간-위험-기대평점'); }
  // 플레이 카드 (4번째 선택지) 가 있으면 한 번 눌러 찍는다
  if (!got.card) {
    const before = (await readRows()).length;
    const cards = await page.locator('[data-act="mo-card"]:not([disabled])').count();
    for (let c = 0; c < cards && !got.card; c++) {
      await page.locator('[data-act="mo-card"]:not([disabled])').nth(c).click({ timeout: 3000 }).catch(() => null);
      await page.waitForTimeout(300);
      if (await has('.po-overlay')) { await page.keyboard.press('Escape'); await page.locator('.po-overlay[data-act="modal-close"]').first().click({ position: { x: 5, y: 5 }, timeout: 2000 }).catch(() => null); await page.waitForTimeout(200); continue; }
      const after = (await readRows()).length;
      if (after > before) { got.card = { before, after }; await shot('결정순간-카드-4번째'); }
      await page.locator('[data-act="mo-card"]:not([disabled])').nth(c).click({ timeout: 3000 }).catch(() => null);
      await page.waitForTimeout(200);
    }
  }
  await act('mo-delegate');
  await page.waitForSelector('.po-splash', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(300);
  if (await has('[data-act="oc-skip"]')) await act('oc-skip').catch(() => {});
}
report.got = got;
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ errors: report.errors, potential: report.potential, moments: got.moment, card: got.card, mismatch: got.mismatch, cut: got.cut, rows: got.rows[0] }, null, 1));
await browser.close();
