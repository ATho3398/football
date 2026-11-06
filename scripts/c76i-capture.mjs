// C.76i 확인 캡처 (U8-d 재정·인박스·면담, 적용 명세 docs/ui-requests/7-13-part2-apply.md): 재정 3탭 · 인박스 목록/상세/답한 뒤/빈 상태 · 면담 3종 · 훈련 일정·하루 시트(생활).
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c76i-capture.mjs [playwright 모듈 경로] [저장 폴더]. 환경: W H PREFIX FULL(1 = 전체 높이) ONLY(쉼표 목록)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c76i-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const P = process.env.PREFIX ?? '';
const FULL = process.env.FULL === '1';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: W < 1024 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const has = async (sel) => (await page.locator(sel).count()) > 0;
const wide = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const report = { W, H, shots: {} };
const shot = async (name, full = FULL) => {
  if (ONLY && !ONLY.some((o) => name.startsWith(o))) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${P}${name}.png`, fullPage: full });
  report.shots[name] = { wide: await wide() };
  console.log('saved', name, 'wide', report.shots[name].wide);
};
async function dismiss() {
  for (let k = 0; k < 5; k++) {
    if (await has('[data-act="intro-ok"]:visible')) await page.locator('[data-act="intro-ok"]:visible').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]:visible')) await page.locator('[data-act="tip-close"]:visible').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const click = async (sel) => { await dismiss(); await page.locator(`${sel}:visible`).first().click(); await page.waitForTimeout(250); };
const top = () => page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('.body')?.scrollTo?.(0, 0); });
/** 화면 어디에 없어도 data-act 클릭을 흉내 낸다 */
const act = async (a, data = {}) => {
  await page.evaluate(([a, data]) => {
    const b = document.createElement('button'); b.dataset.act = a; Object.assign(b.dataset, data); b.style.display = 'none';
    document.querySelector('#app')?.appendChild(b) ?? document.body.appendChild(b); b.click(); b.remove();
  }, [a, data]);
  await page.waitForTimeout(450); await dismiss();
};
const tab = async (v) => { await page.evaluate((x) => document.querySelector(`[data-act="go-tab"][data-v="${x}"]`)?.click(), v); await page.waitForTimeout(450); await dismiss(); };

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
await page.reload();
await click('[data-act="go"][data-to="new"]');
await page.waitForTimeout(300);
if (await has('[data-act="ng-random"]:visible')) await click('[data-act="ng-random"]');
await page.fill('#f-seed', 'c76i-check'); await page.locator('#f-seed').dispatchEvent('change');
await click('[data-act="start"]');
await page.waitForTimeout(900);
await dismiss();
await page.evaluate(() => document.querySelector('[data-act="tips-off"]')?.click()); await page.waitForTimeout(300);
await dismiss();
// 경기 1번 + 며칠 진행(주급·내역)
const playMatch = async () => {
  await click('[data-act="play"]'); await page.waitForSelector('main.screen-prep', { timeout: 60_000 }); await dismiss();
  if (await has('[data-act="ctl-mode"][data-v="auto"]:visible')) await click('[data-act="ctl-mode"][data-v="auto"]');
  await click('[data-act="prep-start"]');
  for (let k = 0; k < 60 && !(await has('main.screen-home, [data-act="go-tab"][data-v="home"]')); k++) await page.waitForTimeout(500);
  await page.waitForTimeout(2500);
  await tab('home');
};
for (let k = 0, g = 0; k < 12; k++) {
  if (await has('[data-act="play"]:visible')) { if (g++ >= 1) break; await playMatch(); }
  else if (await has('[data-act="day-one"]:visible')) { await click('[data-act="day-one"]'); await page.waitForTimeout(500); }
  if (k >= 3 && g >= 1) break;
}
await dismiss();
// 돈 넉넉히 · 코치 후보
await page.evaluate(() => { const g = globalThis.__game(); g.money.cash += 9_000_000; });

// ── 재정 ──
await act('go', { to: 'finance' }); await top();
await shot('01_재정_돈스태프', true);
await act('fn-tab', { v: 'shop' }); await top();
await shot('02_재정_카드상점');
await act('fn-buy', { v: '1' }); await page.waitForTimeout(300);
await shot('03_재정_카드상점_산뒤');
await act('fn-tab', { v: 'life' }); await top();
await shot('04_재정_생활투자', true);

// ── 인박스 ──
await page.evaluate(() => { globalThis.__fireEvent('s_sponsor'); globalThis.__fireEvent('s_charity'); });
await act('go', { to: 'inbox' }); await top();
await shot('05_인박스_목록');
const id = await page.evaluate(() => globalThis.__game().inbox.items.at(-1).id);
await act('inbox-open', { v: String(id) }); await top();
await shot('06_인박스_상세_선택형');
await page.evaluate(() => document.querySelector('[data-act="inbox-answer"]')?.click()); await page.waitForTimeout(500);
await top();
await shot('07_인박스_상세_답한뒤');
await act('inbox-tab', { v: 'todo' });
const sid = await page.evaluate(() => globalThis.__game().inbox.items.find((x) => x.ev === 's_sponsor')?.id);
if (sid != null) { await act('inbox-open', { v: String(sid) }); await page.evaluate(() => document.querySelector('[data-act="inbox-answer"]')?.click()); await page.waitForTimeout(400); await act('inbox-tab', { v: 'todo' }); }
await shot('08_인박스_빈상태');

// ── 면담 ──
for (const [kind, trust, name] of [['low', 22, '09_면담_낮은신뢰'], ['position', 55, '10_면담_포지션제안'], ['reward', 84, '11_면담_보상']]) {
  await page.evaluate(([k, t]) => { const g = globalThis.__game(); g.manager.meeting = k; g.manager.trust = t; }, [kind, trust]);
  await act('go', { to: 'meeting' }); await top();
  await shot(name);
}
// 면담 결과(197 ②): 보상 면담 · 선호 슬롯 보장 → 인박스 줄 칩
await page.evaluate(() => { const g = globalThis.__game(); g.manager.meeting = 'reward'; g.manager.trust = 84; });
await act('go', { to: 'meeting' });
await page.evaluate(() => document.querySelector('[data-act="meet-ok"]:not([disabled])')?.click()); await page.waitForTimeout(800);
await act('go', { to: 'inbox' }); await act('inbox-tab', { v: 'all' }); await top();
await shot('14_인박스_면담결과칩');
await act('go', { to: 'home' });

// ── 훈련 ──
await tab('schedule'); await act('train-tab', { v: 'cal' }); await top();
const days = await page.evaluate(() => [...document.querySelectorAll('[data-act="train-day"]')].map((b) => b.dataset.v));
const day = days[2] ?? days[1] ?? null;
if (day) {
  await act('train-day', { v: day });
  await page.evaluate(() => document.querySelector('[data-act="train-pick"][data-v="family"]')?.click()); await page.waitForTimeout(300);
  await shot('13_하루훈련_생활');
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-act="train-set"]')]; b.at(-1)?.click(); }); await page.waitForTimeout(500);
}
await top();
await shot('12_훈련일정', true);
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify({ ...report, errors }, null, 1));
console.log('errors', JSON.stringify(errors));
await browser.close();
