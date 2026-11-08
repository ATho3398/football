// U17-a 확인 캡처 (17차 1단계 · S00 컴포넌트 + S03 독 v4 · 더보기 격자 · 도구 줄 · 위 띠 · 토스트 자리)
// 실행: npx vite --port 5173 & 그다음 W=390 H=844 PREFIX=after_390_ node scripts/u17a-capture.mjs [playwright] [저장 폴더]
// 검사(적용 명세 4절): 가로 넘침 0 · 페이지 오류 0 · 새 컴포넌트 안 12px 미만 글자 0 · 누르는 영역 44px 미만 0. 결과는 <저장 폴더>/<PREFIX>check.json
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/captures/u17a/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const P = process.env.PREFIX ?? '';
const URL0 = process.env.URL ?? 'http://localhost:5173/';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: W < 1024 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const has = async (sel) => (await page.locator(sel).count()) > 0;
const wait = (ms) => page.waitForTimeout(ms);
async function dismiss(keepTips = false) {
  for (let k = 0; k < 4; k++) {
    if (await has('[data-act="intro-ok"]')) await page.locator('[data-act="intro-ok"]').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (!keepTips && await has('[data-act="tip-close"]')) await page.locator('[data-act="tip-close"]').first().click();
    else break;
    await wait(150);
  }
}
const click = (sel) => page.evaluate((s) => { const el = [...document.querySelectorAll(s)].find((e) => e.offsetParent !== null) ?? document.querySelector(s); el?.click(); return !!el; }, sel);
const top = () => page.evaluate(() => window.scrollTo(0, 0));
const shot = async (name, full = false) => { await top(); await wait(250); await page.screenshot({ path: `${OUT}${P}${name}.png`, fullPage: full }); };

const checks = {};
async function check(name) {
  checks[name] = await page.evaluate(() => {
    const vw = window.innerWidth;
    const overflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - vw;
    const scope = '.dock-bar, .po-toolbar, .top-strip, .po-sheet, .career-links, .toast-wrap';
    const roots = [...document.querySelectorAll(scope)];
    const small = [];
    const tapSmall = [];
    for (const r of roots) {
      const walker = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = n.textContent.trim();
        if (!t) continue;
        const el = n.parentElement;
        if (!el || el.offsetParent === null && getComputedStyle(el).position !== 'fixed') continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 12) small.push(`${t.slice(0, 16)} ${fs}px (${el.className})`);
      }
      for (const b of r.querySelectorAll('button, [role="button"], a[href]')) {
        const rc = b.getBoundingClientRect();
        if (!rc.width || !rc.height) continue;
        if (getComputedStyle(b).visibility === 'hidden') continue;
        if (rc.width < 44 || rc.height < 44) tapSmall.push(`${(b.getAttribute('aria-label') ?? b.textContent).trim().slice(0, 16)} ${Math.round(rc.width)}×${Math.round(rc.height)} (${b.className})`);
      }
    }
    return { overflow, small, tapSmall };
  });
}

// 새 게임 (가상 선수, 시드 고정) — 첫 방문 안내는 켜 둔 채
await page.goto(URL0);
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
await page.reload();
await click('[data-act="go"][data-to="new"]');
await wait(300);
if (await has('#f-seed')) { await page.fill('#f-seed', 'u17a'); await page.locator('#f-seed').dispatchEvent('change'); }
await click('[data-act="ng-random"]');
await wait(400);
await click('[data-act="start"]');
await wait(1200);
await click('[data-act="opt-quick"][data-v="quick"]');
await wait(300);
await dismiss(true);

// 1) 홈 + 첫 방문 안내 띠(guide)
await shot('01_홈_안내띠');
await check('01_홈_안내띠');
await dismiss();
await shot('02_홈_도구줄', true);
await check('02_홈_도구줄');

// 2) 더보기 격자 (폰) / PC 는 독 그대로
if (W < 1024) {
  await click('[data-act="dock-more"]');
  await wait(300);
  await page.screenshot({ path: `${OUT}${P}03_더보기격자.png` });
  await check('03_더보기격자');
  // 3) 수집 → 도감 · 진열실 고르기 시트
  await click('.dock-more [data-act="collect-open"]');
  await wait(300);
  await page.screenshot({ path: `${OUT}${P}04_수집시트.png` });
  await check('04_수집시트');
  await click('.po-sheet__x');
  await wait(200);
}

// 4) 다른 화면 (선수) — 위 띠 없음 · 독 켜진 칸
await click('[data-act="go-tab"][data-v="player"]');
await wait(500); await dismiss();
await shot('05_선수_독');
await check('05_선수_독');

// 5) 진행 중 띠 (running): 독 [다음]=계속 → 띠가 뜨는 순간 찍기 (중단 단추 = 그날까지 끝내고 멈춤)
await click('[data-act="go-tab"][data-v="home"]');
await wait(400); await dismiss();
await click('.dock-bar .po-dock__next');
for (let k = 0; k < 200 && !(await has('.top-strip--running')); k++) await wait(20);
if (await has('.top-strip--running')) {
  await page.screenshot({ path: `${OUT}${P}06_진행중띠.png` });
  await check('06_진행중띠');
}
for (let k = 0; k < 120 && await has('.top-strip--running'); k++) await wait(250);
await wait(600); await dismiss();
// 경기 날이면 [다음] = 경기 (S03-a)
await page.screenshot({ path: `${OUT}${P}06b_다음키.png` });

// 6) 토스트 자리 (독 위 16px): 저장 화면에서 수동 저장
await click('[data-act="go-tab"][data-v="saves"]');
await wait(400); await dismiss();
if (await click('[data-act="save"]')) {
  await wait(300);
  if (await has('.toast-wrap')) {
    await page.screenshot({ path: `${OUT}${P}07_토스트자리.png` });
    await check('07_토스트자리');
  }
}

writeFileSync(`${OUT}${P}check.json`, JSON.stringify({ W, H, errors, checks }, null, 2));
console.log(JSON.stringify({ W, errors: errors.length, checks: Object.fromEntries(Object.entries(checks).map(([k, v]) => [k, { overflow: v.overflow, small: v.small.length, tap: v.tapSmall.length }])) }));
await browser.close();
