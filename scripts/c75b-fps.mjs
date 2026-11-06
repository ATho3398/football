// C.75b 모바일 경기 화면 프레임 측정 (44b E-1): 세로 폰 390×844, CPU 저속 흉내(CDP Emulation.setCPUThrottlingRate, 기본 4배)로
// 자동 모드 내 경기 → 결과 → 하이라이트 다시 보기 경기 화면(rp-canvas) 재생 중 requestAnimationFrame 간격을 SEC 초 동안 잰다. 경기 시작 → 경기 화면까지 걸린 시간도 같이.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 RATE=4 node scripts/c75b-fps.mjs [playwright 모듈 경로] [결과 json] [캡처 png]
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? 'c75b-fps.json';
const PNG = process.argv[4] ?? null;
const RATE = Number(process.env.RATE ?? 4);
const SEC = Number(process.env.SEC ?? 10);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: Number(process.env.DPR ?? 2), hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const has = async (sel) => (await page.locator(sel).count()) > 0;
async function dismiss() {
  for (let k = 0; k < 6; k++) {
    if (await has('[data-act="tips-off"]:visible')) await page.locator('[data-act="tips-off"]:visible').first().click();
    else if (await has('[data-act="intro-ok"]:visible')) await page.locator('[data-act="intro-ok"]:visible').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]:visible')) await page.locator('[data-act="tip-close"]:visible').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const act = async (a, extra = '') => { await dismiss(); await page.locator(`[data-act="${a}"]${extra}:visible`).first().click(); await page.waitForTimeout(250); };

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
await page.reload();
await page.waitForTimeout(500);
await act('go', '[data-to="new"]');
await act('form', '[data-k="mode"][data-v="real"]');
await act('form', '[data-k="realId"][data-v="son"]');
await page.fill('#f-seed', process.env.SEED ?? 'c75b-fps');
await act('start');
await page.waitForTimeout(800);
await dismiss();
for (let k = 0; k < 8 && !(await has('[data-act="play"]:visible')); k++) {
  if (await has('[data-act="day-continue"]:visible')) { await act('day-continue'); await page.waitForTimeout(1500); }
}
await act('play');
await page.waitForSelector('main.screen-prep', { timeout: 60_000 });
await page.waitForTimeout(300);
await dismiss();
if (await has('[data-act="ctl-mode"][data-v="auto"]:visible')) await act('ctl-mode', '[data-v="auto"]');
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
const t0 = Date.now();
await act('prep-start');
// 자동 모드는 계산 뒤 결과 화면 → [하이라이트 다시 보기]로 경기 화면(재생)
await page.waitForSelector('main.screen-match', { timeout: 180_000 });
const startMs = Date.now() - t0;
await page.waitForTimeout(800);
await dismiss();
await page.evaluate(() => document.querySelector('[data-act="hl-rewatch"]')?.click());
await page.waitForSelector('#rp-canvas', { timeout: 30_000 });
await page.waitForTimeout(1500);
await dismiss();
// 경기 화면 재생 속도 1배 그대로, rAF 간격 측정
const m = await page.evaluate((sec) => new Promise((res) => {
  const ts = [];
  const t0 = performance.now();
  const f = (t) => { ts.push(t); if (t - t0 < sec * 1000) requestAnimationFrame(f); else res(ts); };
  requestAnimationFrame(f);
}), SEC);
const gaps = m.slice(1).map((t, i) => t - m[i]).sort((a, b) => a - b);
const q = (p) => Math.round(gaps[Math.min(gaps.length - 1, Math.floor(p * gaps.length))] * 10) / 10;
const fps = Math.round(((m.length - 1) / ((m.at(-1) - m[0]) / 1000)) * 10) / 10;
const res = { rate: RATE, dpr: Number(process.env.DPR ?? 2), errors, startMs, frames: m.length, fps, p50: q(0.5), p95: q(0.95), p99: q(0.99), over50: gaps.filter((g) => g > 50).length, over33: gaps.filter((g) => g > 34).length, screen: await page.evaluate(() => document.querySelector('main')?.className ?? '') };
if (PNG) await page.screenshot({ path: PNG });
writeFileSync(OUT, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res));
await browser.close();
