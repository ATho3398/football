// U17-e 확인 캡처 (17차 S12 훈련 · S13 선수). 세이브: npx vite-node scripts/u17e-save.ts -- <SAVES>
// 실행: npx vite --port 5173 & 그다음 SAVES=<폴더> W=390 H=844 PREFIX=after_ node scripts/u17e-capture.mjs [저장 폴더]
// 검사(적용 명세 4절): 가로 넘침 0 · 페이지 오류 0 · 본문 12px 미만 글자 0 · 누르는 영역 44px 미만 0
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PW ?? 'playwright');
const OUT = process.argv[2] ?? new URL('../docs/captures/u17e/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const W = Number(process.env.W ?? 390), H = Number(process.env.H ?? 844), P = process.env.PREFIX ?? '';
const SAVES = process.env.SAVES;
const URL0 = process.env.URL ?? 'http://localhost:5173/';
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'u17e-')), { viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, serviceWorkers: 'block', hasTouch: W < 1024 });
const page = ctx.pages()[0] ?? await ctx.newPage();
const errors = [];
if (process.env.N) await page.addInitScript((n) => { window.__N = n; }, process.env.N);
page.on('pageerror', (e) => errors.push(String(e)));
const report = { W, H, errors, screens: {} };
async function putSave(slot, json) {
  await page.evaluate(async ([slot, json]) => {
    const raw = new TextEncoder().encode(json);
    const data = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    const s = JSON.parse(json);
    const meta = { slot, savedAt: new Date().toISOString(), name: s.player.name, season: s.league.season, round: s.league.round, age: s.player.age, startPatch: s.startPatch, date: s.calendar.date, size: data.length };
    await new Promise((ok, bad) => {
      const req = indexedDB.open('football-career', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('saves');
      req.onsuccess = () => { const tx = req.result.transaction('saves', 'readwrite'); tx.objectStore('saves').put({ meta, data, enc: 'gzip', raw: json.length }, `slot:${slot}`); tx.oncomplete = () => { req.result.close(); ok(); }; tx.onerror = () => bad(tx.error); };
      req.onerror = () => bad(req.error);
    });
  }, [slot, json]);
}
const has = async (sel) => (await page.locator(sel).count()) > 0;
async function dismiss() {
  for (let k = 0; k < 6; k++) {
    let hit = false;
    for (const s of ['[data-act="intro-ok"]', '.fm-card [data-act="fm-close"]', '[data-act="tip-close"]', '[data-act="modal-close"]']) {
      if (await has(`${s}:visible`)) { await page.locator(`${s}:visible`).first().click().catch(() => {}); hit = true; await page.waitForTimeout(150); }
    }
    if (!hit) break;
  }
}
const click = (act, data = {}) => page.evaluate(([act, data]) => {
  const b = document.createElement('button'); b.dataset.act = act; for (const [k, v] of Object.entries(data)) b.dataset[k] = v;
  b.hidden = true; document.getElementById('app').appendChild(b); b.click();
}, [act, data]);
const measure = () => page.evaluate(() => {
  const vw = innerWidth;
  const overflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - vw;
  const root = document.body; // 재생 아래 띠 · 모달도 검사
  const small = [], tap = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent.trim(); if (!t) continue;
    const el = n.parentElement; if (!el || !el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue;
    if (el.closest('.po-hero__kit, .po-hero__num, .po-hero__value, svg')) continue; // 머리말 큰 숫자 · 아이콘
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 12) small.push(`${t.slice(0, 16)} ${fs}px (${el.className})`);
  }
  for (const b of root.querySelectorAll('button, [role="button"], a[href]')) {
    const rc = b.getBoundingClientRect();
    if (!rc.width || !rc.height) continue;
    if (rc.width < 44 || rc.height < 44) tap.push(`${(b.getAttribute('aria-label') ?? b.textContent).trim().slice(0, 16)} ${Math.round(rc.width)}×${Math.round(rc.height)} (${b.className})`);
  }
  const stage = document.querySelector('.mo-stage');
  return { overflow, small: [...new Set(small)].slice(0, Number(window.__N ?? 14)), tap: [...new Set(tap)].slice(0, Number(window.__N ?? 14)), stageH: stage ? Math.round(stage.getBoundingClientRect().height) : null };
});
const shot = async (name, full = false) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${P}${W >= 1024 ? 'pc' : W}_${name}.png`, fullPage: full });
  report.screens[name] = await measure();
  console.log(name, JSON.stringify(report.screens[name]));
};
const open = async (file) => {
  await page.goto(URL0);
  await page.waitForSelector('[data-act="go"]');
  await page.evaluate(() => localStorage.clear());
  await putSave('auto', readFileSync(join(SAVES, file), 'utf8'));
  await page.reload();
  await page.waitForSelector('[data-act="continue"]');
  await page.click('[data-act="continue"]');
  await page.waitForTimeout(1500);
  await dismiss();
};
const wide = W >= 1024;
const FULL = !wide && !process.env.NOFULL;
const go = async (to, extra = {}) => { await click('go-tab', { v: to, ...extra }); await page.waitForTimeout(500); await dismiss(); };
const tab = async (act, v) => { await click(act, { v }); await page.waitForTimeout(400); };
const tabIds = async () => page.evaluate(() => [...document.querySelectorAll('[data-act="train-tab"]')].map((b) => b.dataset.v));
// S12 훈련 — 시즌 중
await open('mid.json');
await go('schedule');
const ids = await tabIds();
const T = { week: ids[0] ?? 'pre', cal: ids.includes('cal') ? 'cal' : ids[1], grow: ids.includes('grow') ? 'grow' : 'g', staff: 'staff' };
await tab('train-tab', T.week); await shot('S12-a_훈련-이번주', FULL);
await click('preset-edit', { v: '' }); await page.waitForTimeout(400); await shot('S12-b_프리셋편집시트');
await click('sheet-close'); await page.waitForTimeout(300);
const day = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-act="train-day"]')].find((x) => !/이동일/.test(x.getAttribute('aria-label') ?? '')); return b?.dataset.v; });
if (day) { await click('train-day', { v: day }); await page.waitForTimeout(400); await shot('S12-d_하루훈련시트'); await click('sheet-close'); await page.waitForTimeout(300); }
const trav = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-act="train-day"]')].find((x) => /이동일/.test(x.getAttribute('aria-label') ?? '')); return b?.dataset.v; });
if (trav) { await click('train-day', { v: trav }); await page.waitForTimeout(400); await shot('S12-i_이동일시트'); await click('sheet-close'); await page.waitForTimeout(300); }
await tab('train-tab', T.cal); await shot('S12-c_훈련-일정', FULL);
await tab('train-tab', T.grow); await shot('S12-e_훈련-성장', FULL);
await tab('train-tab', T.staff); await shot('S12-f_훈련-스태프', FULL);
// S13 선수 — 시즌 중
await go('player');
for (const [t, n] of [['attrs', 'S13-a_능력치'], ['body', 'S13-b_몸태그'], ['pos', 'S13-c_포지션'], ['record', 'S13-d_기록'], ['contract', 'S13-e_계약']]) {
  await tab('player-tab', t); await shot(n, FULL && t !== 'attrs');
  if (t === 'attrs' && FULL) await shot(`${n}_전체`, true);
}
await click('tags-all'); await page.waitForTimeout(400); await shot('S13-f_태그전체시트'); await click('tags-all'); await page.waitForTimeout(300);
await tab('player-tab', 'contract');
if (await has('[data-act="transfer-request"]:not([disabled])')) { await click('transfer-request'); await page.waitForTimeout(400); await shot('S13-e2_이적요청확인'); }
// S12-h 부상
await open('injured.json'); await go('schedule'); await tab('train-tab', (await tabIds())[0]); await shot('S12-h_부상중', FULL);
// S12-g 비시즌
await open('offseason.json'); await go('schedule'); await shot('S12-g_비시즌', FULL);
await tab('train-tab', 'staff'); await shot('S12-g2_비시즌-스태프');
// S13-g 유망주
await open('prospect.json');
if (!report.screens['S12-d_하루훈련시트']) { // 시즌 중 세이브 이번 주에 고를 수 있는 날이 없으면(A매치 휴가) 유망주 세이브에서
  await go('schedule'); await tab('train-tab', 'pre');
  const d2 = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-act="train-day"]')].find((x) => !/이동일/.test(x.getAttribute('aria-label') ?? '')); return b?.dataset.v; });
  if (d2) { await click('train-day', { v: d2 }); await page.waitForTimeout(400); await shot('S12-d_하루훈련시트'); await click('sheet-close'); await page.waitForTimeout(300); }
}
await go('player'); await tab('player-tab', 'attrs'); await shot('S13-g_유망주', FULL);
// S13-h 은퇴
await open('retired.json'); await go('player'); await shot('S13-h_은퇴', FULL);
writeFileSync(`${OUT}/${P}${wide ? 'pc' : W}_check.json`, JSON.stringify(report, null, 2));
console.log('errors', errors.length, errors.slice(0, 3));
await ctx.close();
