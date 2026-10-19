// C.71a 확인 캡처 (U7-c1: 167 훈련프리셋 목록·편집시트 · 168 팀상세 4탭 · 169 선수상세-다른선수 4탭 + 리그밖 · 177 이름표 편집 · 182 포지션 접기).
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c71a-capture.mjs [playwright 모듈 경로] [저장 폴더]. 환경: W H PREFIX
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c71a-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: W < 1024 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.stack); });
const has = async (sel) => (await page.locator(sel).count()) > 0;
const check = () => page.evaluate(() => ({ wide: document.documentElement.scrollWidth - innerWidth, height: document.documentElement.scrollHeight }));
const report = { W, H, errors, screens: {} };
const shot = async (name, full = false) => {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${P}${name}.png`, fullPage: full });
  report.screens[name] = await check();
  console.log('saved', name, JSON.stringify(report.screens[name]));
};
async function dismiss() {
  for (let k = 0; k < 4; k++) {
    if (await has('[data-act="intro-ok"]')) await page.locator('[data-act="intro-ok"]').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]')) await page.locator('[data-act="tip-close"]').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const act = async (a, extra = '') => { if (!['intro-ok', 'tip-close', 'tips-off'].includes(a)) await dismiss(); await page.locator(`[data-act="${a}"]${extra}:visible`).first().click(); await page.waitForTimeout(250); };
const top = () => page.evaluate(() => window.scrollTo(0, 0));
const goTab = async (v) => { await page.evaluate((x) => document.querySelector(`[data-act="go-tab"][data-v="${x}"]`)?.click(), v); await page.waitForTimeout(400); await dismiss(); await top(); };
/** 화면에 없는 동작 버튼을 잠깐 넣어 누른다 (팀·선수 상세 열기) */
const fire = async (a, v) => { await page.evaluate(([x, y]) => { const b = document.createElement('button'); b.dataset.act = x; b.dataset.v = y; document.getElementById('app').appendChild(b); b.click(); }, [a, v]); await page.waitForTimeout(400); await dismiss(); await top(); };

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
await page.reload();
await act('go', '[data-to="new"]');
await page.fill('#f-seed', 'c71a-check');
await page.locator('#f-seed').dispatchEvent('change');
await act('form', '[data-k="mode"][data-v="real"]');
if (!(await has('[data-act="form"][data-k="realId"][data-v="son"]'))) { await page.fill('#f-rq', '손흥민'); await page.locator('#f-rq').dispatchEvent('change'); await page.waitForTimeout(600); }
await page.locator('[data-act="form"][data-k="realId"][data-v="son"]').first().click();
await act('start');
await page.waitForTimeout(800);
if (await has('[data-act="tips-off"]')) await act('tips-off');
await dismiss();
await page.evaluate(() => { const g = window.__game(); for (const f of ['growth', 'tactics', 'deck']) if (!g.guide.unlocked.includes(f)) g.guide.unlocked.push(f); });

// ── 167 훈련 프리셋 ──
await goTab('schedule');
if (await has('[data-act="train-tab"][data-v="pre"]')) await act('train-tab', '[data-v="pre"]');
await top();
// 새 프리셋 시트: 이름 + 칸 4번째 고르고 약발
await act('preset-edit', '[data-v=""]');
await page.fill('#f-preset-name', '약발 집중');
for (let i = 0; i < 3; i++) { await act('preset-slot', `[data-v="${i}"]`); await act('preset-kind', '[data-v="weakFoot"]'); }
await act('preset-slot', '[data-v="4"]'); await act('preset-kind', '[data-v="recovery"]');
await act('preset-slot', '[data-v="3"]');
await shot('167_훈련프리셋-편집시트');
await act('preset-save');
await top();
await shot('167_훈련프리셋-목록'); await shot('167_훈련프리셋-목록_전체', true);
const cid = await page.evaluate(() => window.__game().training.customPresets.at(-1)?.id ?? '');
await act('preset-edit', `[data-v="${cid}"]`);
await shot('167_훈련프리셋-편집시트-고치기');
await act('sheet-close');

// ── 168 팀 상세 ──
const other = await page.evaluate(() => { const g = window.__game(); return g.league.teams.find((t) => t.id !== g.player.teamId && /south|사우/.test(t.id + t.nameKo))?.id ?? g.league.teams.find((t) => t.id !== g.player.teamId).id; });
await fire('team-open', other);
await shot('168_팀상세-개요'); await shot('168_팀상세-개요_전체', true);
await page.evaluate(() => document.querySelector('.dt-squadlink')?.scrollIntoView({ block: 'center' })); await shot('168_팀상세-개요-스쿼드줄');
for (const [t, n] of [['squad', '스쿼드'], ['tactics', '전술'], ['matches', '경기']]) { await act('team-tab', `[data-v="${t}"]`); await top(); await shot(`168_팀상세-${n}`); }
await act('team-tab', '[data-v="squad"]'); await top();
// ── 169 선수 상세(다른 선수) ──
await page.locator('.dt-row[data-act="person-open"]').first().click(); await page.waitForTimeout(400); await top();
for (const [t, n] of [['body', '몸·태그'], ['pos', '포지션'], ['record', '기록'], ['contract', '계약']]) { await act('person-tab', `[data-v="${t}"]`); await top(); await shot(`169_선수상세-다른선수-${n}`); }
// 리그 밖으로 떠난 선수: 이적 기록 한 줄을 넣고 연다
await page.evaluate((from) => { const g = window.__game(); g.transfers.push({ at: 0, season: g.league.season, w: 'summer', id: 'c71a-left', name: '웨스 깁슨', pos: 'GK', ovr: 81, age: 31, from, to: 'x:rma', ce: g.league.season + 3, loy: 50, why: 'contract' }); }, other);
await fire('person-open', 'c71a-left');
await shot('169_선수상세-다른선수-리그밖빈화면');

// ── 177 · 182 내 선수 ──
await goTab('player');
await act('player-tab', '[data-v="body"]');
await act('look-name');
await page.fill('#nm-nick', '쏘니');
await page.locator('#nm-nick').dispatchEvent('input');
await page.evaluate(() => document.querySelector('.pl-look__edit')?.scrollIntoView({ block: 'center' }));
await shot('177_선수-몸태그-이름표편집');
await act('nm-save');
await act('player-tab', '[data-v="pos"]'); await top();
await shot('182_선수-포지션-접기'); await shot('182_선수-포지션-접기_전체', true);
await act('legend-more');
await shot('182_선수-포지션-펼침_전체', true);
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ errors: report.errors }, null, 1));
await browser.close();
