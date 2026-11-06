// C.81p 캡처: 긴 이름 세이브(피르미누 현역 · 망갈라 은퇴)로 이름+점수 화면과 은퇴 화면. 같은 스크립트로 전(origin/main)·후 빌드를 찍는다.
// 실행: DIST=<빌드 폴더> SAVES=<c81p-save.ts 출력 폴더> PREFIX=before_ W=390 H=844 node scripts/c81p-capture.mjs [저장 폴더]
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PW ?? 'playwright');

const OUT = process.argv[2] ?? new URL('../docs/captures/c81p/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const W = Number(process.env.W ?? 390), H = Number(process.env.H ?? 844), P = process.env.PREFIX ?? '';
const root = process.env.DIST, SAVES = process.env.SAVES;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const port = 4190 + Math.floor(Math.random() * 500);
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  try { const body = readFileSync(join(root, p)); res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(port);
const URL0 = `http://localhost:${port}/`;
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'c81p-')), { viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, serviceWorkers: 'block', hasTouch: W < 1024 });
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
    for (const s of ['[data-act="intro-ok"]', '.fm-card [data-act="fm-close"]', '[data-act="tip-close"]', '[data-act="tips-off"]', '[data-act="modal-close"]']) {
      if (await has(`${s}:visible`)) { await page.locator(`${s}:visible`).first().click().catch(() => {}); hit = true; await page.waitForTimeout(150); }
    }
    if (!hit) break;
  }
}
const click = (act, data = {}) => page.evaluate(([act, data]) => {
  const b = document.createElement('button'); b.dataset.act = act; for (const [k, v] of Object.entries(data)) b.dataset[k] = v;
  b.hidden = true; document.getElementById('app').appendChild(b); b.click();
}, [act, data]);
// 글자 중간 줄바꿈 찾기: 이름·점수가 든 요소 중 한 어절이 두 줄로 갈린 곳, 점수 칸이 두 줄인 곳, 가로 넘침
const measure = () => page.evaluate(() => {
  const out = { hScroll: document.documentElement.scrollWidth > innerWidth + 1, splitWords: [], wrappedScores: [] };
  const walker = document.createTreeWalker(document.querySelector('main') ?? document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent; if (!t || !/[가-힣]/.test(t)) continue;
    const el = n.parentElement; if (!el || !el.offsetParent) continue;
    const re = /[^\s ]+/g;
    for (let m = re.exec(t); m; m = re.exec(t)) {
      if (m[0].length < 2) continue;
      const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
      const rects = [...r.getClientRects()].filter((x) => x.width > 0);
      if (rects.length > 1 && rects.at(-1).top >= rects[0].bottom - 1) out.splitWords.push(m[0]);
    }
  }
  for (const el of document.querySelectorAll('.score-cell, .mr-goal__score, .po-feed__score, .cup-tie__score, .fa-tie__score')) {
    if (!el.offsetParent) continue;
    const r = document.createRange(); r.selectNodeContents(el);
    // 줄이 갈렸다 = 어떤 글자 상자가 다른 상자 바닥보다 아래에서 시작 (글자 크기가 섞인 한 줄은 겹친다)
    const rs = [...r.getClientRects()].filter((x) => x.width > 0);
    if (rs.length && Math.max(...rs.map((x) => x.top)) >= Math.min(...rs.map((x) => x.bottom)) - 1) out.wrappedScores.push(el.textContent);
  }
  out.splitWords = [...new Set(out.splitWords)].slice(0, 20);
  return out;
});
const shot = async (name, full = true) => {
  await page.waitForTimeout(500);
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

await open('firmino.json');
await click('go', { to: 'match' }); await page.waitForTimeout(800); await dismiss(); await shot('01_경기결과');
await click('go-tab', { v: 'player' }); await page.waitForTimeout(500); await click('player-tab', { v: 'record' }); await page.waitForTimeout(500); await dismiss(); await shot('02_선수기록');
await click('go-tab', { v: 'schedule' }); await page.waitForTimeout(500); await click('train-tab', { v: 'cal' }); await page.waitForTimeout(500); await dismiss(); await shot('03_일정');
await click('go-tab', { v: 'world' }); await page.waitForTimeout(800); await dismiss(); await shot('04_월드');
await click('go', { to: 'inbox' }); await page.waitForTimeout(500); await dismiss(); await shot('06_인박스');
await click('go-tab', { v: 'home' }); await page.waitForTimeout(500); await dismiss(); await shot('07_홈', false);

await open('firmino-late.json');
await click('go-tab', { v: 'world' }); await page.waitForTimeout(600); await dismiss();
await click('world-tab', { v: 'cups' }); await page.waitForTimeout(600);
for (const sub of ['groups', 'ko', 'fa']) { await click('cup-sub', { v: sub }); await page.waitForTimeout(600); await shot(`05_대회_${sub}`); }
await click('go-tab', { v: 'schedule' }); await page.waitForTimeout(500); await click('train-tab', { v: 'cal' }); await page.waitForTimeout(500); await dismiss(); await shot('08_일정_후반');
await click('go-tab', { v: 'player' }); await page.waitForTimeout(500); await click('player-tab', { v: 'record' }); await page.waitForTimeout(500); await dismiss(); await shot('09_선수기록_후반');

await open('retired.json');
await shot('11_은퇴_요약', false);
await click('go-tab', { v: 'player' }); await page.waitForTimeout(600); await dismiss(); await shot('12_은퇴_선수', false);
await click('player-tab', { v: 'record' }); await page.waitForTimeout(500); await shot('13_은퇴_선수기록');
await click('go-tab', { v: 'saves' }); await page.waitForTimeout(500); await shot('14_은퇴_저장', false);

writeFileSync(`${OUT}/${P}${W >= 1024 ? 'pc' : W}_report.json`, JSON.stringify(report, null, 1));
console.log('errors', errors.length, errors.slice(0, 3));
await ctx.close(); server.close();
