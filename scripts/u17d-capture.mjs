// U17-d 확인 캡처 (17차 S10 경기 재생 · S11 경기 결과). 세이브: npx vite-node scripts/u17d-save.ts -- <SAVES>
// 실행: npx vite --port 5173 & 그다음 SAVES=<폴더> W=390 H=844 PREFIX=after_ node scripts/u17d-capture.mjs [저장 폴더]
// 검사(적용 명세 4절): 가로 넘침 0 · 페이지 오류 0 · 본문 12px 미만 글자 0 · 누르는 영역 44px 미만 0
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PW ?? 'playwright');
const OUT = process.argv[2] ?? new URL('../docs/captures/u17d/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const W = Number(process.env.W ?? 390), H = Number(process.env.H ?? 844), P = process.env.PREFIX ?? '';
const SAVES = process.env.SAVES;
const URL0 = process.env.URL ?? 'http://localhost:5173/';
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'u17d-')), { viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, serviceWorkers: 'block', hasTouch: W < 1024 });
const page = ctx.pages()[0] ?? await ctx.newPage();
const errors = [];
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
  return { overflow, small: [...new Set(small)].slice(0, 14), tap: [...new Set(tap)].slice(0, 14), stageH: stage ? Math.round(stage.getBoundingClientRect().height) : null };
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
const toPrep = async () => { await click('play'); await page.waitForSelector('main.screen-prep', { timeout: 30000 }); await page.waitForTimeout(500); await dismiss(); };
const toResult = async () => {
  await toPrep(); await click('prep-start');
  for (let k = 0; k < 90 && !(await has('main.screen-match .mr-head, main.screen-match .mr-sum')); k++) {
    if (await has('[data-act="oc-skip"]')) await click('oc-skip');
    if (await has('[data-act="mo-delegate"]')) await click('mo-delegate');
    else if (await has('[data-act="mo-pick-confirm"]')) await click('mo-pick-confirm', { v: '0' });
    if (await has('[data-act="ht-keep"]')) await click('ht-keep');
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(800);
};
const fname = (n) => `${OUT}/${P}${wide ? 'pc' : W}_${n}.png`;
const at = async (sel) => { await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'start' }), sel); await page.waitForTimeout(300); };
// S11 결과 — 결장
if (!process.env.NOBENCH) { await open('bench.json'); await toResult(); await shot('S11-a_결장벤치', !wide); }
// S11 출전 · 더 보기 · 유니폼 교환
await open('mid.json'); await toResult(); await shot('S11-b_출전'); if (!wide) await shot('S11-b_출전_전체', true);
for (const m of await page.locator('[data-act="more"], .po-panel__fold, [data-act="panel-fold"]').all()) await m.click().catch(() => {});
await page.waitForTimeout(400); await shot('S11-c_더보기펼침', true);
if (await has('[data-act="jersey-ask"]')) { await page.locator('[data-act="jersey-ask"]').first().click(); await page.waitForTimeout(800); await dismiss(); await at('.jersey, .jx-panel, [class*="jersey"]'); await page.screenshot({ path: fname('S11-d_유니폼교환') }); }
// S10 재생 — 하이라이트 다시보기 (첫 경기 오버레이 → 하이라이트 → 실시간 → 건너뛰기 확인)
await page.evaluate(() => window.scrollTo(0, 0));
await click('hl-rewatch'); await page.waitForTimeout(1200);
await shot('S10-f_첫경기오버레이');
await dismiss(); if (await has('[data-act="fm-ok"]')) await click('fm-ok');
await page.waitForTimeout(2500); await shot('S10-a_하이라이트');
const splash = async (name) => { for (let i = 0; i < 80; i++) { if (await has('.gs-layer')) { await page.screenshot({ path: fname(name) }); return true; } await page.waitForTimeout(250); } return false; };
await click('rp-speed', { v: '4' });
await splash('S10-c_골스플래시');
await click('rp-live'); await page.waitForTimeout(2000); await shot('S10-b_실시간');
await click('rp-skip'); await page.waitForTimeout(600); await shot('S10-d_건너뛰기확인');
// 클립
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
if (await has('[data-act="modal-close"]')) await click('modal-close');
await click('rp-result'); await page.waitForTimeout(800);
if (await has('[data-act="clip-play"]')) {
  await click('clip-play', { v: 'all' }); await page.waitForTimeout(1500);
  await click('rp-skip'); await page.waitForTimeout(1200); await shot('S10-e_클립2of3');
}
// 우승 축하
if (!process.env.NOTITLE) { await open('title.json'); await toResult(); await page.waitForTimeout(800);
  // 축하 한 장은 시즌 끝 처리 뒤(phase ≠ season)에 뜬다 — 최종전 결과 화면 위에 같은 컴포넌트를 얹어 모양만 확인
  if (!(await has('.celebrate'))) await page.evaluate(async () => { const m = await import('/src/ui/views/matchResult.ts');
    document.getElementById('app').insertAdjacentHTML('beforeend', m.celebrateView({ key: 'x', season: '2018/19', title: '리그 우승', sub: '프리미어리그 · 맨체스터 시티', line: '38R 최종전 뒤 1위 확정 · 커리어 첫 리그 우승', scope: '리그 38경기',
      tiles: [{ label: '경기', value: '36' }, { label: '골', value: '9', hi: true }, { label: '도움', value: '14' }, { label: '평점', value: '7.21' }], rows: [{ label: '커리어 우승', value: '리그 1 · FA컵 0 · 챔스 0' }] })); });
  await shot('S11-f_우승축하'); }
writeFileSync(`${OUT}/${P}${wide ? 'pc' : W}_check.json`, JSON.stringify(report, null, 2));
console.log('errors', errors.length, errors.slice(0, 3));
await ctx.close();
