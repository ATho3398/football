// C.63 확인 캡처 (36단계 5-2 이벤트·인박스·라이벌·경질·주장 + 생활): 홈 알림 아이콘·인박스 카드·라이벌 카드 · 인박스 목록 · 선택형 상세 · 답한 뒤 · 팀 상세 새 감독 · (LIFE=1) 하루 행동 시트.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c63-capture.mjs [playwright 모듈 경로] [저장 폴더]. 환경: W H PREFIX SKIN(a|b) LIFE=1
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c63-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: Number(process.env.H ?? 844) }, colorScheme: 'dark', deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
const broken = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.stack); });
page.on('response', (r) => { if (r.status() >= 400) broken.push(`${r.status()} ${r.url()}`); });
const shot = async (name, full = false) => { await page.screenshot({ path: `${OUT}/${P}${name}.png`, fullPage: full }); console.log('saved', name); };
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
const act = async (a, extra = '') => { if (!['intro-ok', 'tip-close', 'tips-off'].includes(a)) await dismiss(); return page.locator(`[data-act="${a}"]${extra}:visible`).first().click(); };
const waitImgs = () => page.evaluate(() => Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 3000); }))));
const len = () => page.evaluate(() => document.documentElement.scrollHeight);
const wide = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const top = () => page.evaluate(() => window.scrollTo(0, 0));
const report = { errors, broken, len: {}, wide: {} };
const measure = async (k) => { report.len[k] = await len(); report.wide[k] = await wide(); };
const SKIN = process.env.SKIN ?? 'b';
const skin = async () => { if (SKIN === 'a') await page.evaluate(() => { localStorage.setItem('po-skin', 'a'); document.documentElement.dataset.skin = 'a'; }); };
const home = async () => { await act('go-tab', '[data-v="home"]'); await page.waitForTimeout(400); await dismiss(); };
const scrollTo = (sel) => page.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: 'start' }));

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
await page.reload();
await skin();
await act('go', '[data-to="new"]');
await page.waitForTimeout(300);
await page.fill('#f-seed', 'c63-check');
await page.locator('#f-seed').dispatchEvent('change');
await act('form', '[data-k="mode"][data-v="real"]');
await page.waitForTimeout(300);
if (!(await has('[data-act="form"][data-k="realId"][data-v="son"]'))) { await page.fill('#f-rq', '손흥민'); await page.locator('#f-rq').dispatchEvent('change'); await page.waitForTimeout(600); }
await page.locator('[data-act="form"][data-k="realId"][data-v="son"]').first().click();
await page.waitForTimeout(200);
await act('start');
await page.waitForTimeout(800);
if (await has('[data-act="tips-off"]')) await act('tips-off');
await dismiss();
if (await has('[data-act="opt-quick"][data-v="quick"]')) await act('opt-quick', '[data-v="quick"]');
// 5경기 자동 진행 → 이벤트·라이벌 기록이 쌓인다
await home();
await act('sim-rest');
await page.waitForTimeout(300);
await act('auto-count', '[data-v="5"]');
await act('auto-run');
{ const t0 = Date.now(); await page.waitForTimeout(1000); while (Date.now() - t0 < 600000 && (await has('.auto-layer'))) await page.waitForTimeout(500); }
await page.waitForTimeout(800);
await dismiss();
// 캡처용: 선택형 하나(자선 행사)와 정보형 둘을 안 읽음으로 (실제 이벤트 데이터 문구 그대로)
await page.evaluate(() => {
  const g = window.__game();
  const box = (g.inbox ??= { items: [], seq: 0 });
  for (const x of box.items) x.read = true;
  const d = g.calendar.date;
  const add = (o) => box.items.push({ id: ++box.seq, date: d, season: g.league.season, read: false, ...o });
  add({ cat: 'media', title: '결승골 인터뷰', body: '결승골 직후 중계 카메라가 손흥민을 따라와요. "오늘 골, 어떤 기분이에요?"', ev: 'm_decisive', due: d,
    choices: [{ id: 'team', label: '팀 덕분이라고 말한다', desc: '동료들이 좋아해요' }, { id: 'bold', label: '자신감을 보인다', desc: '위상 +, 동료 관계는 조금 −' }, { id: 'fans', label: '팬들에게 감사한다', desc: '위상 +1' }] });
  add({ cat: 'club', title: '감독 경질 · 랄프 하센휘틀 부임', body: '성적 부진 끝에 감독이 물러났어요. 랄프 하센휘틀 감독이 지휘봉을 잡았고, 모두가 다시 경쟁해야 해요.' });
  const [y, m, dd] = d.split('-').map(Number); const due = new Date(Date.UTC(y, m - 1, dd + 6)).toISOString().slice(0, 10);
  add({ cat: 'event', title: '자선 행사 초대', body: '지역 어린이 병원이 자선 행사에 와 달래요. 훈련 뒤 저녁 일정이에요.', ev: 's_charity', due,
    choices: [{ id: 'go', label: '직접 간다', desc: '위상 +2, 체력 조금 −' }, { id: 'donate', label: '기부만 한다', desc: '위상 +1' }, { id: 'skip', label: '이번엔 쉰다', desc: '변화 없음' }] });
});
await home();
await waitImgs();
await page.evaluate(() => document.fonts.ready);
await top();
await shot('ib_홈-알림_전체', true);
await measure('home');
await top();
await shot('ib_홈-알림아이콘');
await scrollTo('.hm-alerts-head');
await page.evaluate(() => window.scrollBy(0, -60));
await shot('ib_홈-인박스카드');
if (await has('.rv-card')) {
  await scrollTo('.rv-card');
  await page.evaluate(() => window.scrollBy(0, -70));
  await shot('rv_홈-라이벌카드');
}
// 인박스 목록 (알림 아이콘)
await top();
await page.locator('[data-act="go"][data-to="inbox"]').first().click();
await page.waitForTimeout(400);
await top();
await shot('ib_인박스-목록');
await measure('inbox');
await shot('ib_인박스-목록_전체', true);
await act('inbox-tab', '[data-v="todo"]');
await page.waitForTimeout(300);
await shot('ib_인박스-답할것');
// 선택형 상세 → 답하기
await page.locator('[data-act="inbox-open"]').first().click();
await page.waitForTimeout(400);
await top();
await shot('ib_인박스-선택형');
await measure('detail');
await act('inbox-pick', '[data-v="go"]');
await page.waitForTimeout(200);
await act('inbox-answer');
await page.waitForTimeout(500);
await shot('ib_인박스-답한뒤');
// 팀 상세 새 감독 (경질)
await page.evaluate(() => { const g = window.__game(); (g.coaches ??= {})[g.player.teamId] = { name: 'Ralph Hasenhüttl', nameKo: '랄프 하센휘틀', style: 'strict', since: g.league.season }; });
await home();
await page.evaluate(() => { const b = document.querySelector('.next-card [data-act="team-open"], [data-act="team-open"]'); b?.click(); });
await page.waitForTimeout(500);
await top();
await shot('157_팀상세-새감독');
if (process.env.LIFE) {
  await home();
  await page.locator('[data-act="go-tab"][data-v="schedule"], [data-act="go"][data-to="schedule"]').first().click().catch(() => {});
  await page.waitForTimeout(400);
  await dismiss();
  if (await has('[data-act="train-tab"][data-v="cal"]')) await act('train-tab', '[data-v="cal"]');
  await page.waitForTimeout(300);
  if (await has('[data-act="train-day"]')) {
    await page.locator('[data-act="train-day"]').nth(1).click();
    await page.waitForTimeout(400);
    await shot('lf_하루행동-시트');
    if (await has('.lf-sec')) { await scrollTo('.lf-sec'); await shot('lf_하루행동-생활'); }
  }
}
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
await browser.close();
