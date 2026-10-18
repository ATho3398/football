// C.72 확인 캡처 (U7-d 178 카드획득-나중에·덱 배너 · 180 이적 소식 빈 상태 + 후속 163 [−][+] · 190 해설 줄 · 189 수비 창 · 170 보상 신뢰도·위상 · 162 홈 토스트 · 201 더보기 is-end). 179·181 은 c72-harness.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c72-capture.mjs [playwright 모듈 경로] [저장 폴더]. 환경: W H PREFIX SKIN(a|b)
// 독 상태 하네스: HARNESS=1 (npx vite --port 5177 개발 서버 필요) → 다섯 상태 + 더보기 처음·끝
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c72-check/', import.meta.url).pathname;
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
const shot = async (name, full = false) => {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${P}${name}.png`, fullPage: full });
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
  await page.evaluate((x) => document.querySelector(`[data-act="go-tab"][data-v="${x}"]`)?.click(), v);
  await page.waitForTimeout(400); await dismiss(); await top();
};
const SKIN = process.env.SKIN ?? 'b';
const start = async (mode, id, seed, shotNew = false) => {
  await page.goto(process.env.URL ?? 'http://localhost:4173/');
  await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
  if (SKIN === 'a') await page.evaluate(() => localStorage.setItem('po-skin', 'a'));
  await page.reload();
  await act('go', '[data-to="new"]');
  await page.waitForTimeout(300);
  await page.fill('#f-seed', seed);
  await page.locator('#f-seed').dispatchEvent('change');
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
  if (await has('[data-act="tips-off"]')) await act('tips-off');
  await dismiss();
  return true;
};



const PC = W >= 1024;
await start('real', 'son', process.env.SEED ?? 'c72-check');
await page.evaluate(() => { const g = window.__game(); for (const f of ['growth', 'tactics', 'deck']) if (!g.guide.unlocked.includes(f)) g.guide.unlocked.push(f); });
if (want('news')) {
  // 180 월드 이적 소식 빈 상태 (첫 시즌 겨울 전)
  await tab('world');
  if (await has('[data-act="world-tab"][data-v="transfers"]')) await act('world-tab', '[data-v="transfers"]');
  await page.waitForTimeout(300); await top();
  await shot('180_월드-이적소식-빈상태');
  if (await has('[data-act="news-cal"]')) { await act('news-cal'); await page.waitForTimeout(400); await dismiss(); await top(); await shot('180_일정에서보기-일정탭'); }
}
if (want('pick')) {
  // 178 카드 획득: 레벨 5 보상 선택권 하나 (덱 카드 3종)
  await page.evaluate(() => { const g = window.__game(); const ids = [...new Set(g.cards.decks[g.cards.active])].slice(0, 3); g.cards.picks.push({ source: 'level', label: '레벨 5 보상', options: ids }); });
  await tab('deck');
  await top(); await shot('178_카드획득-나중에'); await shot('178_카드획득-나중에_전체', true);
  await act('more', '[data-v="pickLater"]'); await page.waitForTimeout(300); await top();
  await shot('178_카드획득-나중에-덱배너');
  await page.evaluate(() => { window.__game().cards.picks = []; });
  await tab('home'); await tab('deck'); await top(); await shot('178_덱-선택없음-배너사라짐');
}
if (want('alloc')) {
  // 163 [−][+] 큰 단추 줄
  await page.evaluate(() => { window.__game().player.unspentPoints = 12; });
  await tab('player'); await tab('home');
  await page.evaluate(() => document.querySelector('[data-act="go"][data-to="allocate"]')?.click());
  await page.waitForTimeout(500); await dismiss(); await top();
  const cells = page.locator('.ag-cell.is-edit:not(.is-short):not(.is-max)');
  if (await cells.count()) { await cells.nth(4).click(); await page.waitForTimeout(200); }
  if (await has('.ag-cell.is-sel [data-act="raise"]')) { await page.locator('.ag-cell.is-sel [data-act="raise"]').click(); await page.waitForTimeout(250); }
  await page.evaluate(() => document.querySelector('.ag-cell.is-sel')?.scrollIntoView({ block: 'center' }));
  await shot('163_포인트찍기-단추줄');
  if (await has('[data-act="alloc-cancel"]')) await act('alloc-cancel');
  await page.waitForTimeout(300);
}
if (want('more') && !PC) {
  // 201 더보기 줄: 처음 / 끝까지 민 is-end
  await tab('home');
  await act('dock-more'); await page.waitForTimeout(300);
  await shot('201_더보기-처음');
  await page.evaluate(() => { const r = document.querySelector('.dock-more__scroll'); if (r) r.scrollLeft = r.scrollWidth * 0.7; });
  await page.waitForTimeout(900);
  report.moreEnd = await page.evaluate(() => ({ isEnd: !!document.querySelector('.dock-more.is-end'), left: document.querySelector('.dock-more__scroll')?.scrollLeft }));
  await shot('201_더보기-is-end');
  await act('dock-more'); await page.waitForTimeout(200);
}
if (want('match')) {
  await tab('home');
  for (let k = 0; k < 10 && !(await has('[data-act="play"]')); k++) {
    if (await has('[data-act="day-continue"]')) { await act('day-continue'); await page.waitForTimeout(1500); await dismiss(); }
  }
  await tab('player');
  const need = await page.evaluate(() => Number((document.querySelector('.pl-lv .po-num')?.textContent ?? '').split('/')[1]) || 0);
  await page.evaluate((n) => { const g = window.__game(); g.player.unspentPoints = 0; if (n) g.player.xp = n - 1; }, need);
  await tab('home');
  await act('play');
  await page.waitForSelector('main.screen-prep', { timeout: 60_000 });
  await page.waitForTimeout(300); await dismiss();
  if (await has('[data-act="ctl-mode"][data-v="direct"]')) await act('ctl-mode', '[data-v="direct"]');
  if (await has('[data-act="ctl-stop"][data-v="all"]')) await act('ctl-stop', '[data-v="all"]');
  await act('prep-start');
  const seen = new Set();
  let n = 0;
  for (let loop = 0; loop < 90; loop++) {
    await page.waitForSelector('[data-act="mo-confirm"], [data-act="oc-skip"], main.screen-match', { timeout: 180_000 });
    if (await page.evaluate(() => !!document.querySelector('main.screen-match'))) break;
    await page.waitForTimeout(1700);
    await dismiss();
    if (!(await has('[data-act="mo-confirm"]'))) { if (await has('[data-act="oc-skip"]')) await act('oc-skip'); await page.waitForTimeout(300); continue; }
    if (await has('.mo-react')) { await act('mo-pick-confirm', '[data-v="0"]'); continue; }
    n++;
    const scene = await page.evaluate(() => document.querySelector('main')?.innerText ?? '');
    const def = /수비 1대1|상대 슈팅|상대 프리킥|상대 코너킥|라인 컨트롤/.test(scene);
    if (def && !seen.has('def')) { seen.add('def'); await top(); await shot('189_수비장면-확대창'); }
    if (!def && !seen.has('att')) { seen.add('att'); await top(); await shot('189_공격장면-확대창'); }
    if (n > 14 || (seen.has('feed') && seen.has('def') && seen.size >= 4)) { await act('mo-auto').catch(() => {}); continue; }
    const opts = await page.locator('.mo-opts .po-choice').count();
    await act('mo-pick', `[data-v="${n % 2 ? Math.max(0, opts - 1) : 0}"]`); await page.waitForTimeout(200);
    await act('mo-confirm');
    await page.waitForSelector('.po-splash', { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(500);
    if (await has('.oc-feed') && !seen.has('feed')) { seen.add('feed'); await top(); await shot('190_결정결과-해설시간줄'); }
    if (await has('[data-act="oc-skip"]')) await act('oc-skip').catch(() => {});
  }
  report.seen = [...seen];
  await page.waitForSelector('main.screen-match .mr-head', { timeout: 120_000 }).catch(() => {});
  await page.waitForTimeout(2400); await dismiss(); await top();
  report.delta = await page.evaluate(() => document.querySelector('.mr-delta')?.textContent ?? null);
  await page.evaluate(() => document.querySelector('.mr-delta, .po-meter')?.scrollIntoView({ block: 'center' }));
  await shot(PC ? '160_PC-보상-신뢰도위상' : '170_보상-신뢰도위상');
  report.goalsMe = await page.evaluate(() => [...document.querySelectorAll('.mr-goal')].map((x) => x.textContent));
  await tab('home');
  await page.waitForTimeout(500);
  report.toast = await page.evaluate(() => { const t = document.querySelector('.toast-wrap.is-bottom'); if (!t) return null; const r = t.getBoundingClientRect(); return { bottom: innerHeight - r.bottom, text: t.textContent }; });
  await shot('162_레벨업-토스트-홈');
}
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ errors: report.errors, seen: report.seen, delta: report.delta, toast: report.toast, moreEnd: report.moreEnd }, null, 1));
await browser.close();
