// C.81l 확인 캡처: 2019 아시안컵 소집 세이브(scripts/c81l-save.ts)를 슬롯에 넣고 불러와 — 홈(다음 경기 = 대회 조별 1차전) · 인박스(소집 알림·컵 소식) ·
// 대표팀 화면(진행 중 대회 조 순위) · 경기 준비 · 결과 화면 → 조별·녹아웃을 끝까지(자동 결정) → 녹아웃 대진 · 시즌 요약.
// 실행: npx vite --port 5173 & 그다음 node scripts/c81l-capture.mjs <save.json> [저장 폴더] [playwright]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const SAVE = process.argv[2];
const OUT = process.argv[3] ?? new URL('../docs/captures/c81l/', import.meta.url).pathname;
const { chromium } = require(process.argv[4] ?? 'playwright');
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 2, hasTouch: W < 1024 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const report = { errors, steps: [] };
let n = 0;
const shot = async (name, full = false) => { await page.waitForTimeout(250); await page.screenshot({ path: join(OUT, `${String(++n).padStart(2, '0')}_${name}.png`), fullPage: full }); };
const has = async (sel) => (await page.locator(sel).count()) > 0;
async function dismiss() {
  for (let k = 0; k < 4; k++) {
    if (await has('[data-act="intro-ok"]')) await page.locator('[data-act="intro-ok"]').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]')) await page.locator('[data-act="tip-close"]').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const top = () => page.evaluate(() => window.scrollTo(0, 0));
// 화면 이동: 홈 도구 줄의 [data-act=go] 아이콘 (대표팀은 홈에만 있다) — 없으면 임시 버튼을 만들어 같은 클릭 처리기를 태운다
const go = async (to) => {
  await page.evaluate((x) => {
    const b = document.querySelector(`[data-act="go"][data-to="${x}"]`);
    if (b) return b.click();
    const t = document.createElement('button');
    t.dataset.act = 'go'; t.dataset.to = x; t.style.display = 'none';
    document.querySelector('#app').appendChild(t); t.click(); t.remove();
  }, to);
  await page.waitForTimeout(500); await dismiss(); await top();
};
const state = () => page.evaluate(() => { const g = globalThis.__game(); const nat = g.national; return { date: g.calendar.date, phase: g.phase, screen: document.querySelector('#app')?.className, live: nat.live ? { id: nat.live.id, played: Object.keys(nat.live.played).length } : null, mine: nat.fixtures.filter((m) => m.key.startsWith('t:')).map((m) => `${m.date} ${m.stage} ${m.opp} ${m.gf ?? '-'}-${m.ga ?? '-'}${m.pens ? ` pk ${m.pens[0]}-${m.pens[1]}` : ''}`), last: g.lastMatch?.nat ?? null }; });

/** 슬롯에 세이브 JSON 을 직접 써 넣기 (gzip, saveStore 와 같은 모양) */
async function putSave(slot, json) {
  await page.evaluate(async ([slot, json]) => {
    const raw = new TextEncoder().encode(json);
    const data = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    const s = JSON.parse(json);
    const meta = { slot, savedAt: new Date().toISOString(), name: s.player.name, season: s.league.season, round: s.league.round, age: s.player.age, startPatch: s.startPatch, date: s.calendar.date, size: data.length };
    await new Promise((ok, bad) => {
      const req = indexedDB.open('football-career', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('saves');
      req.onsuccess = () => {
        const tx = req.result.transaction('saves', 'readwrite');
        tx.objectStore('saves').put({ meta, data, enc: 'gzip', raw: json.length }, `slot:${slot}`);
        tx.oncomplete = () => { req.result.close(); ok(); };
        tx.onerror = () => bad(tx.error);
      };
      req.onerror = () => bad(req.error);
    });
  }, [slot, json]);
}

const URL0 = process.env.URL ?? 'http://localhost:5173/';
await page.goto(URL0);
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
await page.reload();
await page.waitForSelector('[data-act="go"]');
await putSave('auto', readFileSync(SAVE, 'utf8').trim());
await page.reload();
await page.waitForSelector('[data-act="continue"]');
await page.click('[data-act="continue"]');
await page.waitForTimeout(2500);
await dismiss();
await page.evaluate(() => { const g = globalThis.__game(); g.control.mode = 'auto'; g.options = { others: 'quick' }; });
report.steps.push({ step: 'loaded', ...(await state()) });
await top();
await shot('홈-대회-조별1차전');
await go('inbox');
await shot('인박스-소집-컵소식');
await go('national');
await shot('대표팀-일정');
await page.evaluate(() => document.querySelector('[data-act="nat-tab"][data-v="cups"]')?.click());
await page.waitForTimeout(400); await top();
await shot('대표팀-대회-진행중-조별', true);
await go('schedule');
await shot('일정-대회경기', true);
await go('home');

/** 다음 내 경기까지 가서 준비 화면 → 시작 → 결과 화면 */
async function playOne(label) {
  const t0 = Date.now();
  let clicks = 0;
  for (;;) {
    if (await page.evaluate(() => document.querySelector('#app')?.className.includes('app-prep'))) break;
    const ph = await page.evaluate(() => globalThis.__game().phase);
    if (ph !== 'season') return false;
    const busy = await page.evaluate(() => !!document.querySelector('[data-act="sim-stop"]'));
    if (!busy) {
      await dismiss();
      if (clicks > 40) return false;
      await page.evaluate(() => (document.querySelector('[data-act="play"]') ?? document.querySelector('[data-act="day-continue"]'))?.click());
      clicks++;
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(100);
    if (Date.now() - t0 > 180000) return false;
  }
  await page.waitForTimeout(800); await top();
  if (label) await shot(`준비-${label}`);
  const n0 = await page.evaluate(() => globalThis.__matchPerf.length);
  await page.evaluate(() => document.querySelector('[data-act="prep-start"]')?.click());
  const ok = await page.waitForFunction((k) => globalThis.__matchPerf.length > k, n0, { timeout: 180000, polling: 50 }).then(() => true, () => false);
  await page.waitForTimeout(1200); await dismiss(); await top();
  if (label) await shot(`결과-${label}`);
  const st = await state();
  report.steps.push({ step: `play ${label ?? ''}`, ok, clicks, ...st });
  return ok;
}

await playOne('조별1차전');
await playOne('조별2차전');
await playOne('조별3차전');
await go('national');
await page.evaluate(() => document.querySelector('[data-act="nat-tab"][data-v="cups"]')?.click());
await page.waitForTimeout(400); await top();
await shot('대표팀-대회-조별끝-녹아웃대진', true);
await go('home');
for (let k = 0; k < 5; k++) {
  const ph = await page.evaluate(() => globalThis.__game().phase);
  if (ph !== 'season') break;
  const st = await state();
  const next = st.mine.find((m) => / ---$/.test(m))?.split(' ')[1] ?? `녹아웃${k}`;
  if (!(await playOne(next))) break;
}
await page.waitForTimeout(800); await dismiss(); await top();
report.steps.push({ step: 'end', ...(await state()) });
if ((await state()).phase !== 'season') {
  await page.evaluate(() => document.querySelector('[data-act="go-tab"][data-v="season"]')?.click());
  await page.waitForTimeout(600); await dismiss(); await top();
  await shot('시즌요약-대표팀');
  await go('national');
  await page.evaluate(() => document.querySelector('[data-act="nat-tab"][data-v="cups"]')?.click());
  await page.waitForTimeout(400); await top();
  await shot('대표팀-대회-기록', true);
  await go('inbox');
  await shot('인박스-대회결과', true);
}
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
await browser.close();
