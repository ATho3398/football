// C.72 하네스 (U7-d 179 이적제안-소속팀없음 · 181 시즌요약-포인트줄): 실게임에서 만들기 어려운 상태를 같은 화면 코드로 그려 캡처한다.
// 개발 서버에서만: npx vite --port 5177 → http://localhost:5177/scripts/c72-harness.html?view=offers|season&skin=b|a (빌드·배포에는 들어가지 않는다)
import '../src/ui/design/tokens.css';
import '../src/ui/design/bundle.css';
import '../src/ui/design/skin-b.css';
import '../src/ui/style.css';
import { setSkin } from '../src/ui/skin';
import { dock, type DockVM } from '../src/ui/views/common';
import { offersView } from '../src/ui/views/transfer';
import { seasonView } from '../src/ui/views/screens';
import type { MarketVM, OfferVM } from '../src/ui/transferVM';
import type { SeasonVM } from '../src/ui/viewModels';

const q = new URLSearchParams(location.search);
const skin = q.get('skin') === 'a' ? 'a' : 'b';
setSkin(skin);
document.documentElement.dataset.skin = skin;
const view = q.get('view') ?? 'offers';

const offer = (i: number, team: string, teamId: string, rank: number, rating: number, start: number, wage: string, annual: string): OfferVM => ({
  i, team, teamId, league: true, rating, rank, diff: -3, loan: false, years: 2, wage, annual, start: '로테이션', startPct: start, tier: '하위', wagePct: 0, repLoss: 0, until: '2020-21',
});
const market = {
  team: '', rating: 0, ovr: 64, tier: '', value: '12억 원',
  contract: { team: '', until: '', yearsLeft: 0, wage: '', annual: '', loan: null, buyout: '' },
  refused: [], refusedOffers: [], tierNote: '', window: '여름 이적시장', pending: true, renewal: null,
  request: { ok: false, reason: '', chance: null, status: null }, notice: null, moves: [], free: true, state: 'free', curWage: '', winter: false,
  offers: [offer(0, '카디프 시티', 'cardiff', 18, 72.4, 62, '0.38억 원', '19.8억 원'), offer(1, '허더즈필드', 'huddersfield', 19, 71.8, 70, '0.34억 원', '17.7억 원')],
} satisfies MarketVM;

const season = {
  season: '2018-19', nextSeason: '2019-20', team: '토트넘 홋스퍼', pos: 1, apps: 36, goals: 21, assists: 14, avg: '7.88', injuries: 0, injuredWeeks: 0,
  achievements: [], achievementXp: 0, levelsGained: 8, seasonGoals: null, cardPicks: 0,
  repBefore: 500, repAfter: 630, tierName: '탑클래스', tier: 'top', slumpPenalty: 0, rankPenalty: null, badgeRep: 0, repLines: [], tierReached: '탑클래스', next: null,
  position: 'LW', ovrBefore: 86, ovrAfter: 86, autoGrowth: [], veteran: [], aging: [], growthAges: '', ageFrom: 26, ageTo: 27,
  retired: false, forcedRetire: false, canRetire: false, points: 8, injury: null, badges: [],
  matches: { rows: [], total: null, recApps: 0 }, moms: 14, levelFrom: 0, levelTo: 8, months: [], positions: [], awards: [],
} as unknown as SeasonVM;

const app = document.getElementById('app')!;
const dockVM: DockVM = {
  screen: view === 'season' ? 'season' : 'home',
  prog: view === 'season' ? { label: '시즌 요약', icon: 'trophy', act: 'noop', kind: 'season' } : { label: '답하기', icon: 'chat', act: 'noop', kind: 'answer', badge: 2 },
  tacticsOpen: true, points: 8, more: false, inbox: 0,
};
const body = view === 'season'
  ? seasonView(season, '', false, null, '', { title: '계약 만료 · 응답 필요', sub: '답하기 전에는 다음 시즌으로 안 넘어가요', act: 'noop', cta: '답하기', warn: true, icon: 'chat' })
  : offersView(market, 0);
app.className = `has-nav app-${view === 'season' ? 'season' : 'offers'}`;
app.innerHTML = `<main class="screen screen-${view === 'season' ? 'season' : 'offers'}">${body}</main>${dock(dockVM)}`;
document.body.dataset.ready = '1';
