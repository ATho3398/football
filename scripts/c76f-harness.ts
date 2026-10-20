// C.76f 확인 하네스: C.75v 실제 엔진 결정 순간(scripts/c75v-moment.json)을 PC·폰 결정 순간·결과·하프타임 화면으로 그린다.
// 디자인 218(PC 결정·결과)·237(하프타임)·240A(몰고 가다 슛)·236A(약점 공략·못 차는 이유) 상태를 한 데이터로 맞춰 보려고 선택지를 더한다(표시 확인용).
// 개발 서버에서만: npx vite --port 5175 → http://localhost:5175/scripts/c76f-harness.html?view=moment|outcome|half (빌드·배포에는 들어가지 않는다)
import '../src/ui/design/tokens.css';
import '../src/ui/design/bundle.css';
import '../src/ui/design/skin-b.css';
import '../src/ui/style.css';
import type { DecisionRecord, Moment } from '../src/engine/moments';
import type { ReplayFrame, ReplayPlayer } from '../src/replay';
import { tendencyLevels } from '../src/engine/tactics';
import { initFaces } from '../src/ui/faces';
import { setPitchTeams, setPitchWeather, type PitchWeather } from '../src/ui/pitch/renderer';
import { halftimeSets, halftimeVM } from '../src/ui/viewModels';
import { halftimeView } from '../src/ui/views/tactics';
import { MomentPitch, momentView, OutcomePitch, outcomeView } from '../src/ui/views/moment';
import dump from './c75v-moment.json';

const d = dump as unknown as { teams: [string, string]; moment: Moment; frames: ReplayFrame[]; players: ReplayPlayer[]; log: DecisionRecord[] };
const q = new URLSearchParams(location.search);
const view = q.get('view') ?? 'moment';
const sel = q.get('sel') !== null ? Number(q.get('sel')) : null;
const card = q.get('card') !== null ? Number(q.get('card')) : null;
const base = d.moment;
// 디자인과 같은 줄 수: 안전 · 균형 · 도박 + 몰고 가다 슛 (q.n 으로 줄 수)
const o0 = base.options[0]!;
const more: Moment['options'] = [
  { ...o0, kind: 'balanced', action: 'hold', label: '공 지키기', p: 0.87, success: '공 지킴', fail: '뺏김', to: { x: o0.to.x - 6, y: o0.to.y + 4 }, offside: undefined, exploit: true },
  { ...o0, kind: 'gamble', action: 'carry', label: '측면으로 몰고 가기', p: 0.58, success: '측면 돌파', fail: '뺏김', to: { x: o0.to.x + 4, y: o0.to.y - 12 }, offside: undefined },
  { ...o0, kind: 'gamble', action: 'carry', label: '몰고 가다 슛', p: 0.12, success: '몰고 가서 골', fail: '막히거나 뺏김', to: { x: o0.to.x + 10, y: o0.to.y - 4 }, offside: undefined, chain: { type: 'shoot', p: 0.2 } },
];
const n = Number(q.get('n') ?? 4);
const m: Moment = { ...base, sureBack: false, shotNote: q.get('shot') === '1' ? '등지고 있어 슛 각이 없어요' : base.shotNote, options: [base.options[0]!, ...more].slice(0, n) };
const players = new Map(d.players.map((p) => [p.id, p]));
setPitchTeams(d.teams);
setPitchWeather((q.get('wx') ?? 'clear') as PitchWeather);
const app = document.getElementById('app')!;
document.documentElement.classList.add('app-moment');
app.classList.add('app-moment');
const last = d.log.at(-1) ?? null;
if (view === 'moment') {
  app.innerHTML = `<main class="screen screen-moment">${momentView({ moment: m, teams: d.teams, selected: sel, card, stop: 'important', last, count: d.log.length + 1, feed: [{ minute: '17', text: '브라이턴이 왼쪽에서 빌드업합니다', kind: 'normal', mine: false }, { minute: '18', text: '타일러 허친슨이 측면에서 공을 잡습니다', kind: 'chance', mine: true }] })}</main>`;
  const pitch = new MomentPitch(d.frames, players, m.side, m, d.frames[0]!.e, sel, m.options);
  void initFaces().then(() => pitch.attach());
} else if (view === 'outcome') {
  const shown = q.get('shown');
  const ok = shown !== 'fail';
  app.innerHTML = `<main class="screen screen-moment">${outcomeView({
    moment: m, teams: d.teams, choice: '안전 · 톰 내시에게 전진 패스 (96%)', kind: 'safe',
    band: ok ? { tone: 'success', title: '패스 연결', flow: '톰 내시가 받아 전진', delta: '+0.05' } : { tone: 'fail', title: '패스 끊김', flow: '상대가 가로채 역습', delta: '-0.10' },
    headline: ok ? '패스 연결' : '패스 끊김', ratingDelta: ok ? 0.05 : -0.1, rating: ok ? 7.15 : 6.9, card: ok && shown ? '집중' : null, score: m.score, shown: !!shown,
    lines: [{ minute: "18'", text: '톰 내시에게 전진 패스', kind: 'chance', mine: true }, { minute: "18'", text: '톰 내시가 받아 오른쪽으로', kind: 'normal', mine: false }],
  })}</main>`;
  const f = d.frames;
  const pitch = new OutcomePitch(f, players, m.side, f[0]!.e, f.at(-1)!.e + 30, () => undefined);
  void initFaces().then(() => pitch.attach());
} else {
  const b = { tendency: 'balanced' as const, levels: tendencyLevels('balanced') };
  const setId = q.get('set') === 'allout' ? 2 : null;
  const s = setId === null ? null : halftimeSets(b)[setId]!;
  const draft = s ? { tendency: s.tendency, levels: s.levels, set: setId } : { ...b, levels: { ...b.levels }, set: 0 };
  app.innerHTML = `<main class="screen screen-moment">${halftimeView(halftimeVM(draft, b, d.teams, [0, 1], 0))}</main>`;
  const pitch = new MomentPitch(d.frames, players, m.side, { ...m, type: 'halftime' }, d.frames.at(-1)!.e, null, []);
  void initFaces().then(() => pitch.attach());
}
document.body.dataset.ready = '1';
