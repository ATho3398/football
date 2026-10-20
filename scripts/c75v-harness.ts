// C.75v 확인 하네스: 실제 엔진 경기(MyMatchRun, 최적 플레이 봇으로 진행)에서 조건에 맞는 첫 결정 순간을 멈추고
// 실제 결정 순간 화면(momentView + MomentPitch)을 그린다. B 발동(확실한 선택지 다시 넣음)은 드물어 게임 화면 흐름으로는 찾기 어려워서 쓴다.
// 개발 서버에서만: npx vite --port 5175 → http://localhost:5175/scripts/c75v-harness.html?p=kante&seed=c75v-2-kante&want=back (빌드·배포에는 들어가지 않는다)
import '../src/ui/design/tokens.css';
import '../src/ui/design/bundle.css';
import '../src/ui/design/skin-b.css';
import '../src/ui/style.css';
import { MyMatchRun } from '../src/engine/adapter';
import { bestChoice, type Moment } from '../src/engine/moments';
import { newGame, roundMatch } from '../src/game';
import { replayPlayers } from '../src/replay';
import { initFaces } from '../src/ui/faces';
import { setPitchTeams } from '../src/ui/pitch/renderer';
import { MomentPitch, momentView } from '../src/ui/views/moment';

const q = new URLSearchParams(location.search);
const want = q.get('want') ?? 'back';
const g = newGame({ mode: 'real', playerId: q.get('p') ?? 'kante', seed: q.get('seed') ?? 'c75v-2-kante', difficulty: 'normal' });
const rm = roundMatch(g);
const run = new MyMatchRun({ ...rm.input, control: { mode: 'direct', stop: 'all' } }, { teams: rm.teams });
const hit = (m: Moment) => (want === 'back' ? !!m.sureBack : want === 'five' ? m.options.length >= 5 : m.type === 'onball' && m.options.length === 3);
let m = run.advance();
let n = 0;
while (m && !(m.type !== 'halftime' && hit(m))) {
  if (m.type === 'halftime') run.halftime(null);
  else run.resolve(bestChoice(m));
  n++;
  m = run.advance();
}
const app = document.getElementById('app')!;
if (!m) app.textContent = `조건(${want})에 맞는 결정 순간 없음 (${n}번 지남)`;
else {
  const sel = q.get('sel') !== null ? Number(q.get('sel')) : null;
  const s = run.sim.state;
  const players = new Map(replayPlayers(s.input.home, s.input.away).map((p) => [p.id, p]));
  setPitchTeams(rm.teams);
  app.innerHTML = `<main class="screen screen-moment">${momentView({ moment: m, teams: rm.teams, selected: sel, card: null, stop: 'all', last: s.moments.log.at(-1) ?? null, count: s.moments.log.length + 1 })}</main>`;
  const endE = run.frames.at(-1)!.e;
  const pitch = new MomentPitch(run.frames, players, m.side, m, Math.max(0, endE - 1), sel, m.options);
  void initFaces().then(() => pitch.attach());
  document.body.dataset.ready = '1';
}
