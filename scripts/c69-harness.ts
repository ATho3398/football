// 독 v3 하네스 (부록 C.69, 디자인 201): [다음] 키 다섯 상태(계속·진행 중·경기·경기 중·잠김)와 더보기 펼침을 같은 화면 코드(dock)로 그려 캡처한다.
// 개발 서버에서만: npx vite --port 5177 → http://localhost:5177/scripts/c69-harness.html?state=continue|running|match|live|locked&more=1&screen=home&skin=b|a (빌드·배포에는 들어가지 않는다)
// 172 도장(보통·실점)은 실게임에서 드물어 ?view=outcome&tone=neutral|conceded 로 결과 판만 그린다(피치 칸은 비움)
import '../src/ui/design/tokens.css';
import '../src/ui/design/bundle.css';
import '../src/ui/design/skin-b.css';
import '../src/ui/style.css';
import { setSkin } from '../src/ui/skin';
import { dock, type DockVM } from '../src/ui/views/common';
import { outcomeView } from '../src/ui/views/moment';
import type { Moment } from '../src/engine/moments';

const q = new URLSearchParams(location.search);
const skin = q.get('skin') === 'a' ? 'a' : 'b';
setSkin(skin);
document.documentElement.dataset.skin = skin;
const PROG: Record<string, DockVM['prog']> = {
  continue: { label: '계속', icon: 'chevron-right', act: 'day-continue', kind: 'continue' },
  running: { label: '진행 중', icon: 'running', act: 'noop', kind: 'running' },
  match: { label: '경기', icon: 'match', act: 'play', kind: 'match' },
  live: { label: '경기 중', icon: 'match', act: 'live-return', live: true, kind: 'live' },
  locked: { label: '잠김', icon: 'lock', act: 'noop', kind: 'locked' },
};
const state = q.get('state') ?? 'continue';
const vm: DockVM = { screen: q.get('screen') ?? 'home', prog: PROG[state] ?? PROG.continue!, tacticsOpen: true, points: 1, more: q.get('more') === '1', inbox: 1 };
const app = document.getElementById('app')!;
if (q.get('view') === 'outcome') {
  const tone = q.get('tone') === 'conceded' ? 'conceded' : 'neutral';
  const m = { score: [1, 1], side: 1, minute: 71, scene: 'shootChance' } as unknown as Moment;
  app.className = 'app-moment';
  app.innerHTML = `<main class="screen screen-moment">${outcomeView({
    moment: m, teams: ['카디프 시티', '토트넘 홋스퍼'], choice: '도박 · 측면으로 몰고 가기 (58%)', kind: 'gamble', shown: true, card: null, score: [1, 1],
    band: tone === 'conceded' ? { tone, title: '실점', flow: '돌파 실패 → 역습 → 실점 (1:1)', delta: '-0.31' } : { tone, title: '보통', flow: '돌파 시도 → 공이 밖으로', delta: '+0.00' },
    headline: tone === 'conceded' ? '역습 실점' : '공이 밖으로', ratingDelta: tone === 'conceded' ? -0.31 : 0, rating: tone === 'conceded' ? 5.4 : 6.3,
  })}</main>`;
  document.body.dataset.ready = '1';
} else {
  app.className = `has-nav app-${vm.screen}`;
  app.innerHTML = `<main class="screen"><div style="padding:24px 16px;color:var(--ink-muted);font:600 13px/1.5 var(--font-sans)">독 v3 · ${state}${vm.more ? ' · 더보기 펼침' : ''}</div></main>${dock(vm)}`;
  const row = document.querySelector<HTMLElement>('.dock-more__scroll');
  if (row && q.get('end') === '1') row.scrollLeft = row.scrollWidth;
  document.body.dataset.ready = '1';
}
