// C.75v 확인 하네스: node 에서 실제 엔진 경기로 뜬 결정 순간(scripts/diag/c75v-dump.ts → scripts/c75v-moment.json)을
// 실제 결정 순간 화면(momentView + MomentPitch)으로 그린다. B 발동(확실한 선택지 다시 넣음)은 드물어 게임 화면 흐름으로는 찾기 어려워서 쓴다.
// 개발 서버에서만: npx vite --port 5175 → http://localhost:5175/scripts/c75v-harness.html?sel=0 (빌드·배포에는 들어가지 않는다)
import '../src/ui/design/tokens.css';
import '../src/ui/design/bundle.css';
import '../src/ui/design/skin-b.css';
import '../src/ui/style.css';
import type { DecisionRecord, Moment } from '../src/engine/moments';
import type { ReplayFrame, ReplayPlayer } from '../src/replay';
import { initFaces } from '../src/ui/faces';
import { setPitchTeams } from '../src/ui/pitch/renderer';
import { MomentPitch, momentView } from '../src/ui/views/moment';
import dump from './c75v-moment.json';

const d = dump as unknown as { teams: [string, string]; moment: Moment; frames: ReplayFrame[]; players: ReplayPlayer[]; log: DecisionRecord[] };
const q = new URLSearchParams(location.search);
const sel = q.get('sel') !== null ? Number(q.get('sel')) : null;
const m = d.moment;
const players = new Map(d.players.map((p) => [p.id, p]));
setPitchTeams(d.teams);
document.documentElement.classList.add('app-moment');
document.getElementById('app')!.classList.add('app-moment');
document.getElementById('app')!.innerHTML = `<main class="screen screen-moment">${momentView({ moment: m, teams: d.teams, selected: sel, card: null, stop: 'all', last: d.log.at(-1) ?? null, count: d.log.length + 1 })}</main>`;
const pitch = new MomentPitch(d.frames, players, m.side, m, d.frames[0]!.e, sel, m.options);
void initFaces().then(() => pitch.attach());
document.body.dataset.ready = '1';
