// UI_6 전체 재설계 요청서용 캡처 (docs/ui-requests/17-full): 모든 화면·주요 상태를 폰 세로 390×844 다크 + PC 1280×800 다크로 찍는다.
// 실행 (다시 찍기):
//   1) npm run build && npx vite preview --port 4173 &   (빌드판이 개발 서버보다 훨씬 빠름)
//   2) npx vite-node scripts/ui/capture-all.ts         (세이브를 만들고 → 두 크기로 찍음)
//      ONLY=phone|pc  · FROM=번호 · TO=번호(그 구간만, 앞 장면에 기대는 구간은 세이브를 넣는 장면부터)  · URL=http://localhost:4173/ 로 바꿀 수 있음
// 세이브는 scripts/ui/make-saves.ts 로 만들고(실제 선수 10월·3월·비시즌·2시즌차 / 유망주 / 은퇴), 저장 화면 [가져오기]로 넣는다.
// 결과: docs/ui-requests/17-full/captures/{phone,pc}/NN_화면이름_상태.png + captures/index.json(번호·이름·찍힘 여부)
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
const OUT = join(ROOT, 'docs/ui-requests/17-full/captures');
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
add('새게임_커스텀6시작', async (c) => { await act(c, 'cu-step', '[data-v="6"]'); });
add('새게임_전체랜덤결과', async (c) => { await act(c, 'cu-step', '[data-v="1"]'); await act(c, 'ng-random'); await scrollTop(c); });
add('새게임_실제선수목록', async (c) => { await act(c, 'form', '[data-k="mode"][data-v="real"]'); });
add('새게임_실제선수고름', async (c) => { await act(c, 'form', '[data-k="realId"]'); });
add('새게임_레전드탭', async (c) => { return act(c, 'ng-real', '[data-k="realTab"][data-v="legend"]'); });
// 2. 첫 경기 흐름 (전체 랜덤으로 바로 시작)
add('홈_첫날_체크리스트·말풍선', async (c) => {
  await act(c, 'form', '[data-k="mode"][data-v="custom"]');
  await act(c, 'ng-random');
  await c.p.fill('#f-name', '김민준').catch(() => undefined);
  await act(c, 'start');
  await wait(c, 1200);
});
add('홈_첫날_새기능안내없음', async (c) => { await act(c, 'tips-off'); await closeOverlays(c); });
add('홈_경기날', async (c) => { await act(c, 'tips-off'); return toMatchDay(c); });
add('경기준비_첫경기', async (c) => { await act(c, 'play'); await wait(c, 600); return has(c, '.screen-prep'); });
add('경기재생_첫경기안내', async (c) => {
  await act(c, 'ctl-mode', '[data-v="auto"]');
  await act(c, 'prep-start');
  await c.p.waitForSelector('.screen-replay, .screen-match', { timeout: 90000 }).catch(() => undefined);
  await wait(c, 1200);
  return has(c, '[data-act="fm-close"]');
}, false);
add('경기재생_하이라이트', async (c) => {
  await act(c, 'fm-close');
  await c.p.waitForSelector('.screen-replay', { timeout: 60000 }).catch(() => undefined);
  await wait(c, 1500);
  return has(c, '.screen-replay');
}, false);
add('경기재생_골스플래시', async (c) => {
  await act(c, 'rp-speed', '[data-v="4×"]');
  const ok = await c.p.waitForSelector('.gs-root, .goal-splash, [class*="goal-splash"], [class*="gs-"]', { timeout: 45000 }).then(() => true).catch(() => false);
  await wait(c, 350);
  return ok;
}, false);
add('경기재생_건너뛰기확인', async (c) => { await act(c, 'rp-skip'); return has(c, '[data-act="rp-skip-ok"]'); }, false);
add('경기결과_첫경기', async (c) => { await act(c, 'rp-skip-ok'); await wait(c, 800); await closeOverlays(c); });
add('경기결과_더보기펼침', async (c) => { let n = 0; while (n < 4 && (await act(c, 'more'))) n++; return n > 0; });
add('포인트찍기_첫경기뒤', async (c) => { return goTo(c, 'allocate'); });
add('포인트찍기_하나올림', async (c) => { await tap(c, '[data-act="alloc-sel"]'); return tap(c, '[data-act="raise"]:not([disabled])'); });
add('포인트찍기_규칙펼침', async (c) => { return act(c, 'alloc-rule'); });
add('홈_첫경기뒤', async (c) => { await act(c, 'alloc-cancel'); await act(c, 'modal-close'); await goTo(c, 'home'); await closeOverlays(c); });


// 3. 실제 선수 · 시즌 중 10월 (A1)
add('홈_시즌중_10월', async (c) => { await load(c, 'A1_real-oct'); await goTo(c, 'home'); await closeOverlays(c); });
add('홈_더보기펼침', async (c) => { if (c.dev === 'pc') return false; return act(c, 'dock-more'); }, false);
add('홈_자동진행시트', async (c) => { await closeOverlays(c); if (await has(c, '[data-act="dock-more"][aria-current]')) await act(c, 'dock-more'); return act(c, 'sim-rest'); }, false);
add('훈련_프리셋', async (c) => { await closeOverlays(c); await c.p.keyboard.press('Escape'); await nav(c, 'schedule'); await act(c, 'train-tab', '[data-v="pre"]'); });
add('훈련_프리셋편집시트', async (c) => { return act(c, 'preset-edit'); }, false);
add('훈련_일정', async (c) => { await closeOverlays(c); await act(c, 'train-tab', '[data-v="cal"]'); });
add('훈련_하루훈련시트', async (c) => { return act(c, 'train-day'); }, false);
add('훈련_게이지', async (c) => { await closeOverlays(c); await act(c, 'train-tab', '[data-v="g"]'); });
add('훈련_스태프', async (c) => { await act(c, 'train-tab', '[data-v="staff"]'); });
add('선수_능력치', async (c) => { await nav(c, 'player'); await act(c, 'player-tab', '[data-v="attrs"]'); });
add('선수_몸태그', async (c) => { await act(c, 'player-tab', '[data-v="body"]'); });
add('선수_포지션', async (c) => { await act(c, 'player-tab', '[data-v="pos"]'); });
add('선수_기록', async (c) => { await act(c, 'player-tab', '[data-v="record"]'); });
add('선수_계약·에이전트', async (c) => { await act(c, 'player-tab', '[data-v="contract"]'); });
add('포인트찍기', async (c) => { await act(c, 'player-tab', '[data-v="attrs"]'); return (await goTo(c, 'allocate')) || false; });
add('상점_기본', async (c) => { await act(c, 'alloc-cancel'); await nav(c, 'shop'); });
add('상점_카드상세시트', async (c) => { return act(c, 'card-open'); }, false);
add('상점_카드팩개봉연출', async (c) => {
  await closeOverlays(c);
  if (!(await act(c, 'fn-pack'))) return false;
  if (await has(c, '[data-act="modal-ok"], .po-modal [data-act]')) await tap(c, '.po-modal .po-btn--primary, .po-modal [data-act]:not([data-act="modal-close"])');
  await wait(c, 1200);
  return true;
}, false);
add('상점_팩개봉_결과목록', async (c) => {
  await tap(c, '.pk-skip'); await wait(c, 1500);
  await tap(c, '.pk-actions button'); await wait(c, 1200);
  return has(c, '.pk-ov');
}, false);
add('상점_방금연팩', async (c) => {
  await closeOverlays(c);
  await wait(c, 500);
  return has(c, '.screen-shop');
});
add('인박스_전체', async (c) => { await nav(c, 'inbox'); await act(c, 'inbox-tab', '[data-v="all"]'); });
add('인박스_답할것', async (c) => { await act(c, 'inbox-tab', '[data-v="todo"]'); });
add('인박스_상세', async (c) => { await act(c, 'inbox-tab', '[data-v="all"]'); return act(c, 'inbox-open'); });
add('재정_돈', async (c) => { await nav(c, 'finance'); await act(c, 'fn-tab', '[data-v="money"]'); });
add('재정_생활투자', async (c) => { await act(c, 'fn-tab', '[data-v="life"]'); });
add('월드_순위표', async (c) => { await nav(c, 'world'); await act(c, 'world-tab', '[data-v="table"]'); });
add('월드_순위표_다른리그', async (c) => { return act(c, 'world-league', ':not([aria-selected="true"]):not(.is-on)'); });
add('월드_컵챔스', async (c) => { await act(c, 'world-league', '[data-v=""]'); await act(c, 'world-tab', '[data-v="cups"]'); });
add('월드_득점', async (c) => { await act(c, 'world-tab', '[data-v="scorers"]'); });
add('월드_리그스타', async (c) => { await act(c, 'world-tab', '[data-v="stars"]'); });
add('월드_이적소식', async (c) => { await act(c, 'world-tab', '[data-v="transfers"]'); });
add('팀상세_개요', async (c) => { await act(c, 'world-tab', '[data-v="table"]'); return act(c, 'team-open'); });
add('팀상세_스쿼드', async (c) => { return act(c, 'team-tab', '[data-v="squad"]'); });
add('팀상세_전술', async (c) => { return act(c, 'team-tab', '[data-v="tactics"]'); });
add('팀상세_경기', async (c) => { return act(c, 'team-tab', '[data-v="matches"]'); });
add('선수상세_능력치', async (c) => { await act(c, 'team-tab', '[data-v="squad"]'); return act(c, 'person-open'); });
add('선수상세_기록', async (c) => { return act(c, 'person-tab', '[data-v="record"]'); });
add('덱_편집', async (c) => { await nav(c, 'deck'); });
add('덱_카드상세시트', async (c) => { return act(c, 'card-open'); }, false);
add('전술_기본', async (c) => { await closeOverlays(c); await act(c, 'dock-more'); return act(c, 'tac-open'); });
add('전술_성향고르기', async (c) => { return act(c, 'tac-tend', '[data-v="gegen"], [data-v="gegenpress"]') || act(c, 'tac-tend'); });
add('전술_세부편집', async (c) => { return act(c, 'tac-edit') || act(c, 'tac-detail'); });
add('전술_떠나기확인', async (c) => { await closeOverlays(c); await act(c, 'tac-back'); return has(c, '.po-modal'); }, false);
add('도감', async (c) => { await act(c, 'tac-leave'); await act(c, 'modal-close'); await act(c, 'tac-back'); await goTo(c, 'home'); return goTo(c, 'dex'); });
add('진열실', async (c) => { await goTo(c, 'home'); return goTo(c, 'showroom'); });
add('대표팀_일정결과', async (c) => { await goTo(c, 'home'); return goTo(c, 'national'); });
add('대표팀_대회', async (c) => { return act(c, 'nat-tab', '[data-v="cups"]'); });
add('개인시상_시상', async (c) => { await goTo(c, 'home'); if (!(await goTo(c, 'awards'))) return false; await act(c, 'aw-tab', '[data-v="year"]'); });
add('개인시상_이달의선수', async (c) => { return act(c, 'aw-tab', '[data-v="month"]'); });
add('개인시상_역대수상자', async (c) => { return act(c, 'aw-tab', '[data-v="history"]'); });
add('설정_메인', async (c) => { await nav(c, 'settings'); });
add('설정_화면보기', async (c) => { return act(c, 'set-open', '[data-v="view"]'); });
add('설정_꾸미기', async (c) => { return act(c, 'set-open', '[data-v="look"]'); });
add('설정_저장안내_출처', async (c) => { await act(c, 'set-open', '[data-v="saves"]'); await act(c, 'set-credits'); });
add('설정_페이스팩', async (c) => { return act(c, 'set-open', '[data-v="pack"]'); });
add('설정_선수이름', async (c) => { await act(c, 'set-open', '[data-v="look"]'); return act(c, 'set-page', '[data-v="names"]'); });
add('설정_경기아이콘', async (c) => { await act(c, 'set-back'); await act(c, 'set-open', '[data-v="look"]'); return act(c, 'set-page', '[data-v="pixel"]'); });
add('설정_페이스온', async (c) => { await act(c, 'set-back'); await act(c, 'set-open', '[data-v="look"]'); return act(c, 'set-page', '[data-v="faceon"]'); });
add('설정_카드이미지', async (c) => { await act(c, 'set-back'); await act(c, 'set-open', '[data-v="look"]'); return act(c, 'set-page', '[data-v="cardart"]'); });
add('저장_슬롯', async (c) => { await act(c, 'set-back'); await nav(c, 'saves'); });
add('저장_가져오기오류토스트', async (c) => {
  await c.p.setInputFiles('#import-file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"x":1}') });
  await wait(c, 500);
  return has(c, '.po-toast, .toast-wrap');
}, false);
add('타이틀로_확인모달', async (c) => { await goTo(c, 'home'); await closeOverlays(c); return act(c, 'to-title'); }, false);
add('타이틀_이어하기', async (c) => { await act(c, 'to-title-ok'); await wait(c, 500); return has(c, '.screen-title'); }, false);
add('경기준비_시즌중', async (c) => { await load(c, 'A1_real-oct'); await toMatchDay(c); await act(c, 'play'); return has(c, '.screen-prep'); });
add('경기준비_상대팀', async (c) => { return act(c, 'team-open'); });
add('경기준비_직접모드', async (c) => { await act(c, 'detail-back'); return act(c, 'ctl-mode', '[data-v="direct"]'); });
add('결정순간_고르기전', async (c) => {
  // 선발은 경기를 시작해야 정해진다: 결장(벤치)이면 홈으로 가서 다음 경기로 (최대 4경기)
  for (let k = 0; k < 4; k++) {
    await act(c, 'prep-start');
    await c.p.waitForSelector('.screen-moment, .screen-replay, .screen-match', { timeout: 90000 }).catch(() => undefined);
    await wait(c, 1500);
    if (await has(c, '[data-act="fm-close"]')) await act(c, 'fm-close');
    if (await has(c, '.screen-moment')) return true;
    await goTo(c, 'home');
    await toMatchDay(c);
    await act(c, 'play');
    await act(c, 'ctl-mode', '[data-v="direct"]');
  }
  return false;
}, false);
add('결정순간_선택지고름', async (c) => { const ok = await act(c, 'mo-pick'); await wait(c, 600); return ok; }, false);
add('결정순간_결과재생', async (c) => {
  const ok = (await act(c, 'mo-confirm')) || (await act(c, 'mo-pick-confirm'));
  await wait(c, 1600);
  return ok;
}, false);
add('결정순간_다음장면또는하프타임', async (c) => {
  for (let i = 0; i < 40; i++) {
    if (await has(c, '[data-act="ht-ok"]')) return true;
    if (await has(c, '[data-act="oc-skip"]')) { await act(c, 'oc-skip'); continue; }
    if (await has(c, '[data-act="mo-pick"]')) { await act(c, 'mo-pick'); await act(c, 'mo-confirm'); await act(c, 'mo-pick-confirm'); await wait(c, 400); continue; }
    if (!(await has(c, '.screen-moment'))) return false;
    await wait(c, 500);
  }
  return has(c, '[data-act="ht-ok"]');
}, false);
add('경기중_다른화면_경기중띠', async (c) => { await goTo(c, 'home'); await wait(c, 400); return has(c, '.live-band'); });

add('하프타임_전술시트', async (c) => { await act(c, 'live-return'); return has(c, '[data-act="ht-ok"]'); }, false);
add('결정순간_맡기기후_재생', async (c) => {
  (await act(c, 'ht-keep')) || (await act(c, 'ht-ok'));
  for (let i = 0; i < 10 && !(await has(c, '[data-act="mo-delegate"]')); i++) { await act(c, 'oc-skip'); await wait(c, 500); }
  await act(c, 'mo-delegate');
  await wait(c, 1500);
  return has(c, '.screen-replay');
}, false);
add('경기결과_시즌중', async (c) => {
  await c.p.waitForSelector('[data-act="rp-skip"]', { timeout: 60000 }).catch(() => undefined);
  await act(c, 'rp-skip'); await act(c, 'rp-skip-ok'); await wait(c, 900); await closeOverlays(c);
  return has(c, '.screen-match');
});
add('경기결과_하이라이트클립재생', async (c) => { const ok = await act(c, 'clip-play'); await wait(c, 1500); return ok; }, false);

// 4. 3월 (A2): 시즌 후반 홈·면담·이적
add('홈_시즌중_3월', async (c) => { await load(c, 'A2_real-mar'); await goTo(c, 'home'); await closeOverlays(c); });
add('감독면담', async (c) => { return goTo(c, 'meeting'); });
add('재계약', async (c) => { await goTo(c, 'home'); return goTo(c, 'contract'); });
add('개인시상_3월', async (c) => { await goTo(c, 'home'); return goTo(c, 'awards'); });
add('대표팀_3월', async (c) => { await goTo(c, 'home'); return goTo(c, 'national'); });

// 5. 비시즌 (A3): 시즌 요약 · 이적 제안 · 챕터
add('시즌요약_비시즌', async (c) => { await load(c, 'A3_real-offseason'); await closeOverlays(c); await goTo(c, 'season'); await act(c, 'go-tab', '[data-v="season"]'); });
for (const [id, ko] of [['matches', '경기별'], ['months', '월별'], ['positions', '포지션별'], ['awards', '리그시상'], ['transfers', '이적소식'], ['growth', '성장위상']] as const) {
  add(`시즌요약_${ko}`, async (c) => act(c, 'season-tab', `[data-v="${id}"]`));
}
add('이적제안', async (c) => { return goTo(c, 'offers'); });
add('재계약_비시즌', async (c) => { return goTo(c, 'contract'); });
add('홈_비시즌', async (c) => { await goTo(c, 'home'); await closeOverlays(c); });
add('홈_비시즌_주포지션변경시트', async (c) => { return act(c, 'pos-open'); }, false);

// 6. 2시즌차 9월 (A4)
add('홈_2시즌차', async (c) => { await load(c, 'A4_real-s2-sep'); await goTo(c, 'home'); await closeOverlays(c); });
add('개인시상_2시즌차결과', async (c) => { if (!(await goTo(c, 'awards'))) return false; });
add('개인시상_시상식', async (c) => { return act(c, 'aw-cer'); }, false);
add('대표팀_2시즌차', async (c) => { await act(c, 'modal-close'); await goTo(c, 'home'); return goTo(c, 'national'); });
add('진열실_2시즌차', async (c) => { await goTo(c, 'home'); return goTo(c, 'showroom'); });
add('도감_2시즌차', async (c) => { await goTo(c, 'home'); return goTo(c, 'dex'); });
add('덱_카드선택권', async (c) => { await nav(c, 'deck'); return has(c, '[data-act="pick-take"]'); });

// 7. 가상 유망주 (B1·B2)
add('홈_유망주_부상중', async (c) => { await load(c, 'B1_prospect-sep'); await goTo(c, 'home'); await closeOverlays(c); });
add('선수_유망주_능력치', async (c) => { await nav(c, 'player'); });
add('시즌요약_유망주', async (c) => { await load(c, 'B2_prospect-offseason'); await closeOverlays(c); await act(c, 'go-tab', '[data-v="season"]'); });
add('이적제안_유망주', async (c) => { return goTo(c, 'offers'); });

// 8. 은퇴 (C1·C2)
add('시즌요약_은퇴가능', async (c) => { await load(c, 'C1_old-offseason'); await closeOverlays(c); await act(c, 'go-tab', '[data-v="season"]'); });
add('챕터리뷰', async (c) => { if (!(await goTo(c, 'chapter'))) return false; return has(c, '.screen-chapter'); });
add('은퇴_확인모달', async (c) => { await act(c, 'go-tab', '[data-v="season"]'); return act(c, 'retire'); }, false);
add('은퇴_커리어요약', async (c) => { await load(c, 'C2_retired'); await closeOverlays(c); return has(c, '.screen-retired, .screen-home'); });
add('은퇴_선수화면', async (c) => { return goTo(c, 'player'); });

// 9. 라이트 테마 표본 (설정 → 화면 보기 테마)
add('라이트_홈', async (c) => {
  await load(c, 'A1_real-oct');
  await c.p.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await goTo(c, 'home');
  await c.p.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
});
add('라이트_선수', async (c) => { await nav(c, 'player'); await c.p.evaluate(() => document.documentElement.setAttribute('data-theme', 'light')); });

// ── 실행 ──
const browser = await pw.chromium.launch();
const index: { no: string; name: string; phone?: boolean; pc?: boolean; phoneScreen?: string; pcScreen?: string }[] = S.map((s, i) => ({ no: String(i + 1).padStart(3, '0'), name: s.name }));
for (const dev of (process.env.ONLY ? [process.env.ONLY] : ['phone', 'pc']) as ('phone' | 'pc')[]) {
  const dir = join(OUT, dev);
  mkdirSync(dir, { recursive: true });
  if (!FROM) for (const f of readdirSync(dir)) unlinkSync(join(dir, f));
  const page: Page = await browser.newPage({ viewport: dev === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 800 }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: dev === 'phone' });
  page.on('pageerror', (e: Error) => console.error(`[${dev}] pageerror`, e.message));
  const c: Ctx = { p: page, dev };
  for (let i = 0; i < S.length; i++) {
    const s = S[i]!;
    const row = index[i]!;
    if ((FROM && i + 1 < FROM) || i + 1 > TO) continue;
    let ok: boolean | void = false;
    try { ok = await Promise.race([s.run(c), new Promise<false>((r) => setTimeout(() => r(false), 120000))]); } catch (e) { console.error(`[${dev}] ${row.no} ${s.name} 실패`, (e as Error).message); ok = false; }
    const screen = await page.evaluate(() => document.querySelector('main.screen')?.className.replace('screen ', '') ?? '?').catch(() => '?');
    if (ok === false) { console.log(`[${dev}] ${row.no} ${s.name} — 못 찍음 (지금 화면 ${screen})`); row[dev] = false; continue; }
    await wait(c, 300);
    const file = join(dir, `${row.no}_${s.name}.png`);
    const vp = page.viewportSize()!;
    if (s.full !== false) {
      const h = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
      if (h > vp.height) { await page.setViewportSize({ width: vp.width, height: Math.min(h, 9000) }); await wait(c, 300); }
    }
    await page.screenshot({ path: file }).catch((e: Error) => console.error(e.message));
    await page.setViewportSize(vp);
    row[dev] = true;
    row[dev === 'phone' ? 'phoneScreen' : 'pcScreen'] = screen;
    console.log(`[${dev}] ${row.no} ${s.name} (${screen})`);
  }
  await page.close();
}
if (!FROM && TO === 9999) writeFileSync(join(OUT, `index${process.env.ONLY ? `-${process.env.ONLY}` : ''}.json`), JSON.stringify(index, null, 1));
await browser.close();
