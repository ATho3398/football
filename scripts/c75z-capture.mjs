// C.75z 확인 캡처: 주발 발자국 아이콘(새 게임·커스텀·선수 몸·태그 탭) · 자동 진행 중 인터뷰 자동 답(인박스). 세로 폰 390×844 기본 · PC 1280×800 (W H PREFIX).
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c75z-capture.mjs [playwright 모듈 경로] [저장 폴더]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/c75x-check/', import.meta.url).pathname;
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




const PLAYER = process.env.PLAYER ?? 'son';
// 1) 새 게임 랜덤 선수 신체 칸
if (want('new')) {
  await page.goto(process.env.URL ?? 'http://localhost:4173/');
  await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
  await page.reload();
  await act('go', '[data-to="new"]');
  await page.waitForTimeout(400);
  const ex = page.locator('.ng-extras').first();
  if (await ex.count()) { await ex.scrollIntoViewIfNeeded(); await shot('새게임-신체'); }
  // 커스텀 몸 단계
  if (await has('[data-act="form"][data-k="mode"][data-v="custom"]')) {
    await act('form', '[data-k="mode"][data-v="custom"]');
    await page.waitForTimeout(400);
    // 기본 단계 (U 추가 3번): 국적·인종 → 이름. 인종을 바꾸면 빈 이름 칸이 그 인종 이름으로 채워진다
    await page.locator('[data-act="cu"][data-k="app"]:visible').nth(1).click().catch(() => null);
    await page.waitForTimeout(300);
    const n1 = await page.inputValue('#f-name').catch(() => '');
    await page.selectOption('#cu-nat', 'Brazil').catch(() => null);
    await page.waitForTimeout(300);
    const n2 = await page.inputValue('#f-name').catch(() => '');
    await page.fill('#f-name', '직접이름');
    await page.locator('[data-act="cu"][data-k="app"]:visible').nth(0).click().catch(() => null);
    await page.waitForTimeout(300);
    const n3 = await page.inputValue('#f-name').catch(() => '');
    await act('cu-name-rand');
    await page.waitForTimeout(300);
    const n4 = await page.inputValue('#f-name').catch(() => '');
    report.names = { afterApp: n1, afterBrazil: n2, typedKept: n3, randomBtn: n4 };
    console.log('names', JSON.stringify(report.names));
    await top();
    if (W < 1024) await page.evaluate(() => { const el = document.querySelector('#cu-nat'); if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 120); });
    await shot('커스텀-기본');
    await page.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'cu-step'; b.dataset.v = '2'; document.querySelector('main')?.appendChild(b); b.click(); });
    await page.waitForTimeout(400);
    const f = page.locator('.cu-feet').first();
    if (await f.count()) { await f.scrollIntoViewIfNeeded(); await shot('커스텀-몸'); } else console.log('no cu-feet');
  }
}
if (want('auto') && await start('real', PLAYER, process.env.SEED ?? 'c75z-check')) {
  await tab('player');
  await page.locator('[data-act="player-tab"][data-v="body"]:visible').first().click().catch(() => null);
  await page.waitForTimeout(400);
  await top();
  const bs = page.locator('.bs-feet').first();
  if (await bs.count()) await bs.scrollIntoViewIfNeeded();
  await shot('선수-몸태그');
  // 2) 자동 진행 N경기: 인터뷰에서 멈추지 않는지
  await tab('home');
  const N = Number(process.env.N ?? 12);
  await page.evaluate(() => { document.querySelector('[data-act="sim-rest"]')?.click(); });
  await page.waitForTimeout(400);
  await page.fill('#auto-n', String(N)).catch(() => null);
  await act('auto-run');
  await page.waitForFunction(() => !document.querySelector('.auto-layer'), null, { timeout: 600_000 });
  await page.waitForTimeout(600);
  const st = await page.evaluate(() => {
    const g = globalThis.__game();
    const items = g.inbox?.items ?? [];
    return {
      auto: globalThis.__auto,
      answered: items.filter((x) => x.answer?.text?.startsWith('자동 진행')).map((x) => ({ id: x.id, ev: x.ev, title: x.title, pick: x.answer.id })),
      pending: items.filter((x) => x.choices && !x.answer).map((x) => ({ ev: x.ev, title: x.title })),
    };
  });
  report.auto = st;
  console.log(JSON.stringify(st));
  await shot('자동진행-끝');
  const first = st.answered[0];
  if (first) {
    await page.evaluate((id) => { const b = document.createElement('button'); b.dataset.act = 'inbox-open'; b.dataset.v = String(id); document.querySelector('main')?.appendChild(b); b.click(); }, first.id);
    await page.waitForTimeout(500);
    await top();
    await shot('인박스-인터뷰자동답');
  }
}
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
await browser.close();
