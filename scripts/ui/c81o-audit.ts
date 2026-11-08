// C.81o 화면 간 데이터 일치 감사 캡처 (UI_6 capture-all.ts 도우미를 가져와 씀). TAG=before|after ONLY=phone|pc · 빌드판 미리 보기(vite preview --port 4173) 필요
// 실행 (다시 찍기):
//   1) npm run build && npx vite preview --port 4173 &   (빌드판이 개발 서버보다 훨씬 빠름)
//   2) npx vite-node scripts/ui/capture-all.ts         (세이브를 만들고 → 두 크기로 찍음)
//      ONLY=phone|pc  · FROM=번호 · TO=번호(그 구간만, 앞 장면에 기대는 구간은 세이브를 넣는 장면부터)  · URL=http://localhost:4173/ 로 바꿀 수 있음
// 세이브는 scripts/ui/make-saves.ts 로 만들고(실제 선수 10월·3월·비시즌·2시즌차 / 유망주 / 은퇴), 저장 화면 [가져오기]로 넣는다.
// 결과: docs/captures/c81o/{phone,pc}/NN_화면이름_상태.png + captures/index.json(번호·이름·찍힘 여부)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const pw = (() => {
  try { return require('playwright'); } catch { return require('/opt/node-tools/node_modules/playwright'); }
})();
// playwright 는 전역(/opt/node-tools)에 있어 타입이 없다
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Page = any;

const ROOT = new URL('../../', import.meta.url).pathname;
const OUT = join(ROOT, 'docs/captures/c81o');
const SAVES = join(ROOT, 'node_modules/.ui6-saves');
const URL_ = process.env.URL ?? 'http://localhost:4173/';
const FROM = Number(process.env.FROM ?? 0);
const TO = Number(process.env.TO ?? 9999);

if (!existsSync(join(SAVES, 'C2_retired.json')) || process.env.RESAVE) {
  mkdirSync(SAVES, { recursive: true });
  execFileSync('npx', ['vite-node', 'scripts/ui/make-saves.ts', '--', SAVES], { cwd: ROOT, stdio: 'inherit' });
}

interface Ctx { p: Page; dev: 'phone' | 'pc' }
type Step = { name: string; run: (c: Ctx) => Promise<boolean | void>; full?: boolean };

// ── 도우미 ──
const wait = (c: Ctx, ms = 250) => c.p.waitForTimeout(ms);
const has = async (c: Ctx, sel: string) => (await c.p.locator(sel).count()) > 0;
/** 보이는 첫 요소를 누른다. 없으면 false */
async function tap(c: Ctx, sel: string, ms = 300): Promise<boolean> {
  const loc = c.p.locator(sel);
  const n = await loc.count();
  for (let i = 0; i < n; i++) {
    const el = loc.nth(i);
    if (await el.isVisible().catch(() => false)) {
      await el.click({ timeout: 3000 }).catch(() => undefined);
      await wait(c, ms);
      return true;
    }
  }
  if (n) { await loc.first().dispatchEvent('click').catch(() => undefined); await wait(c, ms); return true; }
  return false;
}
const act = (c: Ctx, a: string, extra = '') => tap(c, `[data-act="${a}"]${extra}`);
const goTo = (c: Ctx, to: string) => tap(c, `[data-act="go"][data-to="${to}"], [data-act="go-tab"][data-v="${to}"]`);
/** 화면 이동: go/go-tab 버튼이 화면에 없으면 더보기를 연다 */
async function nav(c: Ctx, to: string): Promise<boolean> {
  await closeOverlays(c);
  if (await goTo(c, to)) return true;
  await act(c, 'dock-more');
  return goTo(c, to);
}
/** 첫 방문 안내·말풍선·축하 등 겹친 것 닫기 */
async function closeOverlays(c: Ctx): Promise<void> {
  for (let k = 0; k < 6; k++) {
    let any = false;
    for (const a of ['intro-ok', 'fm-close', 'tips-off', 'tip-close', 'celebrate-close', 'sw-later', 'advice-close']) {
      if (await has(c, `[data-act="${a}"]`)) { await act(c, a); any = true; }
    }
    if (await has(c, '.pk-ov')) { await tap(c, '.pk-skip'); await tap(c, '.pk-res button, .pk-actions button'); any = true; }
    // 아래 시트·모달: 겹침 바깥(화면 맨 위)을 누르면 닫힌다
    if (await has(c, '.po-overlay[data-overlay]')) { await c.p.mouse.click(8, 8); await wait(c, 300); any = true; }
    if (!any) break;
  }
}
async function resetStorage(c: Ctx): Promise<void> {
  await c.p.goto(URL_);
  await c.p.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(); });
  });
  await c.p.goto(URL_);
  await wait(c, 600);
}
/** 세이브 넣기: 타이틀 → 불러오기 → 파일 가져오기 */
async function load(c: Ctx, name: string): Promise<boolean> {
  await resetStorage(c);
  // 첫 방문 안내를 미리 끈다 (말풍선·첫 경기 오버레이는 따로 찍음)
  await goTo(c, 'saves');
  await c.p.setInputFiles('#import-file', join(SAVES, `${name}.json`));
  await c.p.waitForFunction(() => !document.querySelector('.screen-saves'), null, { timeout: 15000 }).catch(() => undefined);
  await wait(c, 800);
  await closeOverlays(c);
  return true;
}
/** 경기 날까지 [계속] (독 [다음] 키가 '경기'가 될 때까지) */
async function toMatchDay(c: Ctx): Promise<boolean> {
  for (let i = 0; i < 4; i++) {
    await closeOverlays(c);
    if (await has(c, '.po-dock__next.is-match')) return true;
    if (!(await has(c, '.po-dock__next.is-running')) && !(await tap(c, '.po-dock__next.is-continue'))) return false;
    await c.p.waitForSelector('.po-dock__next.is-match, .po-overlay[data-overlay]', { timeout: 90000 }).catch(() => undefined);
  }
  return has(c, '.po-dock__next.is-match');
}
async function scrollTop(c: Ctx) { await c.p.evaluate(() => window.scrollTo(0, 0)); }

// ── 장면 목록 (번호 = 배열 순서) ──
const S: Step[] = [];
const add = (name: string, run: Step['run'], full = true) => S.push({ name, run, full });

// 1. 타이틀·새 게임 (세이브 없음)
add('타이틀_세이브없음', async (c) => { await resetStorage(c); }, false);
add('새게임_커스텀1기본', async (c) => { await goTo(c, 'new'); });
add('새게임_커스텀2몸', async (c) => { await act(c, 'cu-step', '[data-v="2"]'); });
add('새게임_커스텀3외모', async (c) => { await act(c, 'cu-step', '[data-v="3"]'); });
add('새게임_커스텀4태그', async (c) => { await act(c, 'cu-step', '[data-v="4"]'); });
add('새게임_커스텀5능력치', async (c) => { await act(c, 'cu-step', '[data-v="5"]'); });

// ── C.81o 감사: 화면 간 같은 값 비교 (전후 캡처 docs/captures/c81o/<TAG>/) ──
const TAG = process.env.TAG ?? 'before';
const dir = join(OUT, TAG);
mkdirSync(dir, { recursive: true });
const browser = await pw.chromium.launch();
const log: Record<string, unknown> = {};
for (const dev of (process.env.ONLY ? [process.env.ONLY] : ['phone', 'pc']) as ('phone' | 'pc')[]) {
  const page: Page = await browser.newPage({ viewport: dev === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 800 }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: dev === 'phone' });
  page.on('pageerror', (e: Error) => console.error(`[${dev}] pageerror`, e.message));
  const c: Ctx = { p: page, dev };
  const shot = async (name: string, full = false) => {
    const vp = page.viewportSize()!;
    if (full) {
      const h = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
      if (h > vp.height) { await page.setViewportSize({ width: vp.width, height: Math.min(h, 9000) }); await wait(c, 300); }
    }
    await page.screenshot({ path: join(dir, `${dev}_${name}.png`) });
    await page.setViewportSize(vp);
  };
  const text = (sel: string) => page.evaluate((s: string) => [...document.querySelectorAll(s)].map((e) => (e as HTMLElement).innerText.replace(/\s+/g, ' ').trim()), sel);
  const L: Record<string, unknown> = {};
  log[dev] = L;
  // 1. 홈·선수·훈련: XP 기준, 다음 경기 상대
  await load(c, 'A1_real-oct');
  await goTo(c, 'home'); await closeOverlays(c);
  L.homeXp = await text('.po-meter, .pl-lv');
  L.homeNext = await text('.po-hero, .nm-card, .next-match');
  await shot('01_home', true);
  await nav(c, 'player'); await act(c, 'player-tab', '[data-v="attrs"]');
  L.playerXp = await text('.po-meter, .pl-lv');
  await shot('02_player', true);
  await act(c, 'player-tab', '[data-v="pos"]');
  L.playerPos = await text('main');
  await shot('03_player_pos', true);
  await act(c, 'player-tab', '[data-v="record"]');
  L.playerRecord = await text('main');
  await shot('04_player_record', true);
  await nav(c, 'schedule'); await act(c, 'train-tab', '[data-v="cal"]');
  L.trainCal = await text('main');
  await shot('05_train_cal', true);
  await act(c, 'train-tab', '[data-v="staff"]');
  L.trainStaff = await text('main');
  await shot('06_train_staff', true);
  // 2. 경기 (자동) → 결과 → 재생
  for (let k = 0; k < 6; k++) {
    await toMatchDay(c);
    await act(c, 'play');
    await act(c, 'ctl-mode', '[data-v="auto"]');
    await act(c, 'prep-start');
    await page.waitForSelector('.screen-match', { timeout: 90000 }).catch(() => undefined);
    await wait(c, 1000);
    await closeOverlays(c);
    const benched = await page.evaluate(() => /결장/.test(document.querySelector('.po-hero')?.textContent ?? ''));
    if (!benched && (await has(c, '.screen-match'))) break;
    await goTo(c, 'home');
  }
  let n = 0; while (n < 4 && (await act(c, 'more'))) n++;
  L.result = await text('main');
  await shot('10_result', true);
  await act(c, 'hl-rewatch');
  await page.waitForSelector('.screen-replay', { timeout: 30000 }).catch(() => undefined);
  await wait(c, 1500);
  L.replayTiles = await text('.scene-tile');
  await shot('11_replay_highlight');
  await page.mouse.click(5, 5);
  await act(c, 'rp-live'); await wait(c, 1500);
  L.liveTiles = await text('.scene-tile');
  L.liveLegend = await text('#rp-legend');
  await shot('12_replay_live');
  await act(c, 'rp-skip'); await act(c, 'rp-skip-ok'); await wait(c, 900); await closeOverlays(c);
  await page.evaluate(() => document.getElementById('avg-canvas')?.scrollIntoView());
  await wait(c, 400);
  await shot('13_result_avgmap');
  // 3. 비시즌 포지션 변경 문구
  await load(c, 'A3_real-offseason');
  await goTo(c, 'home'); await closeOverlays(c);
  await act(c, 'pos-open'); await wait(c, 400);
  L.posSheet = await text('.po-overlay, .po-sheet');
  await shot('20_offseason_pos_sheet');
  await page.close();
}
writeFileSync(join(dir, 'log.json'), JSON.stringify(log, null, 1));
await browser.close();
