// C.69 확인 캡처 (U7-a: 189·190·171·172 결정 순간·결과 v3, 201 독 v3, 165 경기 중 띠): 세로 폰 390×844 기본 · PC 1280×800 · 가로 폰 844×390 (W H PREFIX).
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c69-capture.mjs [playwright 모듈 경로] [저장 폴더]. 환경: SKIN(a|b) ONLY(home,moment) MAXM(결정 순간 수)
// 독 상태 하네스: HARNESS=1 (npx vite --port 5177 개발 서버 필요) → 다섯 상태 + 더보기 처음·끝
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c69-check/', import.meta.url).pathname;
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


const measure = () => page.evaluate(() => {
  const st = document.querySelector('.mo-stage')?.getBoundingClientRect();
  const conf = document.querySelector('[data-act="mo-confirm"], [data-act="oc-skip"]')?.getBoundingClientRect();
  const panel = document.querySelector('.mo-panel')?.getBoundingClientRect();
  return { stage: st && [Math.round(st.width), Math.round(st.height), Math.round(st.top)], confirmBottom: conf && Math.round(conf.bottom), confirmTop: conf && Math.round(conf.top), panelTop: panel && Math.round(panel.top), vh: innerHeight,
    cards: document.querySelectorAll('.mo-cards .po-card').length, rows: document.querySelectorAll('.po-choice--row').length, sure: document.querySelectorAll('.po-choice__sure').length, dock: !!document.querySelector('.app-moment > .dock-bar:not([style*="none"])') && getComputedStyle(document.querySelector('.dock-bar')).display !== 'none' };
});

if (process.env.HARNESS) {
  const base = process.env.HURL ?? 'http://localhost:5177';
  for (const [st, more, end] of [['continue'], ['running'], ['match'], ['live', 0, 0, 'player'], ['locked'], ['continue', 1], ['continue', 1, 1]]) {
    const scr = st === 'live' ? 'player' : st === 'match' ? 'schedule' : 'home';
    await page.goto(`${base}/scripts/c69-harness.html?state=${st}&more=${more ? 1 : 0}&end=${end ? 1 : 0}&screen=${scr}&skin=${SKIN}`);
    await page.waitForSelector('body[data-ready="1"]', { timeout: 60000 });
    await page.waitForTimeout(900);
    if (end) await page.evaluate(() => { const r = document.querySelector('.dock-more__scroll'); if (r) r.scrollLeft = r.scrollWidth; });
    await shot(`201_독-${st}${more ? (end ? '-더보기끝' : '-더보기처음') : ''}`);
  }
  for (const [tone, name] of [['neutral', '172_결정결과-도장-보통'], ['conceded', '172_결정결과-도장-실점']]) {
    await page.goto(`${base}/scripts/c69-harness.html?view=outcome&tone=${tone}&skin=${SKIN}`);
    await page.waitForSelector('body[data-ready="1"]', { timeout: 60000 }); await page.waitForTimeout(900);
    await shot(name);
  }
} else if (await start('real', 'son', 'c69-check')) {
  const seen = new Set();
  if (want('home')) {
    await tab('home'); await shot('201_독-홈-계속');
    if (await has('[data-act="dock-more"]:visible')) {
      await act('dock-more'); await page.waitForTimeout(300); await shot('201_독-더보기-처음');
      await page.evaluate(() => { const r = document.querySelector('.dock-more__scroll'); if (r) r.scrollLeft = r.scrollWidth; }); await page.waitForTimeout(300); await shot('201_독-더보기-끝');
      await act('dock-more'); await page.waitForTimeout(200);
    }
  }
  if (want('moment')) {
    await tab('home');
    for (let k = 0; k < 8 && !(await has('[data-act="play"]')); k++) {
      if (await has('[data-act="day-continue"]')) { await act('day-continue'); await page.waitForTimeout(1500); }
    }
    await top(); await shot('201_독-경기날');
    await act('play');
    await page.waitForSelector('main.screen-prep', { timeout: 60_000 });
    await page.waitForTimeout(300); await dismiss();
    if (await has('[data-act="ctl-mode"][data-v="direct"]')) await act('ctl-mode', '[data-v="direct"]');
    if (await has('[data-act="ctl-stop"][data-v="all"]')) await act('ctl-stop', '[data-v="all"]');
    await act('prep-start');
    const MAXM = Number(process.env.MAXM ?? 12);
    let n = 0;
    for (let loop = 0; loop < 80; loop++) {
      await page.waitForSelector('[data-act="mo-confirm"], [data-act="oc-skip"], main.screen-match', { timeout: 180_000 });
      if (await page.evaluate(() => !!document.querySelector('main.screen-match'))) break;
      await page.waitForTimeout(1700);
      await dismiss();
      if (!(await has('[data-act="mo-confirm"]'))) { if (await has('[data-act="oc-skip"]')) await act('oc-skip'); await page.waitForTimeout(300); continue; }
      if (await has('.mo-react')) { await act('mo-pick-confirm', '[data-v="0"]'); continue; }
      n++;
      const m = await measure();
      report.moments = [...(report.moments ?? []), m];
      if (n === 1) {
        await top(); await shot('189_결정순간-v3-기본');
        report.moment = m;
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await shot('171_결정순간-v2-아래묶음'); await top();
        if (W < 1024 && H > 600) {
          await page.setViewportSize({ width: W, height: 700 }); await page.waitForTimeout(500); await top();
          await shot('189_결정순간-700높이'); report.moment700 = await measure();
          await page.setViewportSize({ width: W, height: H }); await page.waitForTimeout(400);
        }
        if (await has('[data-act="mo-zoom"][data-v="full"]:visible')) {
          await act('mo-zoom', '[data-v="full"]'); await page.waitForTimeout(500); await top(); await shot('189_결정순간-v3-전체');
          await act('mo-zoom', '[data-v="zoom"]'); await page.waitForTimeout(400);
        }
        // 165: 경기 중 다른 화면 (선수) → 띠 · 독 [다음] = 경기 중
        if (W < 1024 || true) {
          await page.evaluate(() => document.querySelector('[data-act="go-tab"][data-v="player"]')?.click());
          await page.waitForTimeout(900); await dismiss(); await top();
          if (await has('.live-band')) await shot('165_경기중-다른화면-띠');
          await act('live-return'); await page.waitForTimeout(1200);
        }
        if (await has('.mo-cards .po-card:not(.is-disabled)')) { await page.locator('.mo-cards .po-card:not(.is-disabled)').first().click(); await page.waitForTimeout(250); }
        await act('mo-pick', '[data-v="0"]'); await page.waitForTimeout(300); await top(); await shot('189_결정순간-v3-고름+카드');
        await act('mo-confirm'); await page.waitForTimeout(700); await top(); await shot('190_결정결과-v3-재생중');
      } else {
        if (!seen.has('sure') && m.sure > 0) { seen.add('sure'); await top(); await shot('189_결정순간-v3-수비-판정없음'); }
        if (n > MAXM) { await act('mo-auto').catch(() => {}); continue; }
        // 결과 갈래를 고르게 보려고 도박 쪽을 자주 고른다
        const opts = await page.locator('.mo-opts .po-choice').count();
        await act('mo-pick', `[data-v="${n % 3 === 0 ? 0 : Math.max(0, opts - 1)}"]`); await page.waitForTimeout(200);
        await act('mo-confirm');
      }
      // 결과 판 (190·172): 처음 보는 갈래만 저장
      await page.waitForSelector('.po-splash', { timeout: 20_000 }).catch(() => {});
      await page.waitForTimeout(500);
      const tone = await page.evaluate(() => { const s = document.querySelector('.po-splash'); if (!s) return null; return s.classList.contains('po-splash--goal') ? '골' : s.classList.contains('po-splash--concede') ? '도장-실점' : s.classList.contains('po-splash--ok') ? 'v3-성공' : s.classList.contains('po-splash--bad') ? 'v3-실패' : '도장-보통'; });
      if (tone && !seen.has(tone)) { seen.add(tone); await top(); await shot(`${tone.startsWith('도장') ? '172' : '190'}_결정결과-${tone}${n === 1 ? '+카드사용' : ''}`); }
      if (await has('[data-act="oc-skip"]')) await act('oc-skip').catch(() => {});
    }
    report.seen = [...seen];
  }
}
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ errors: report.errors, seen: report.seen, moment: report.moment, moment700: report.moment700 }, null, 1));
await browser.close();
