// C.75v 하네스용 장면 덤프: node 에서 실제 엔진 경기(최적 플레이 봇)로 조건 장면까지 진행해 Moment·직전 2초 프레임·선수 표를 JSON 으로 쓴다.
// npx vite-node scripts/diag/c75v-dump.ts -- [want=back|five|normal] [선수 id=kante] [시드=c75v-2-kante] [출력=scripts/c75v-moment.json]
import { writeFileSync } from 'node:fs';
import { MyMatchRun } from '../../src/engine/adapter';
import { bestChoice, type Moment } from '../../src/engine/moments';
import { newGame, roundMatch } from '../../src/game';
import { replayPlayers } from '../../src/replay';

const [want = 'back', pid = 'kante', seed = 'c75v-2-kante', out = 'scripts/c75v-moment.json'] = process.argv.slice(2).filter((a) => a !== '--');
const hit = (m: Moment) => (want === 'back' ? !!m.sureBack : want === 'five' ? m.options.length >= 5 : m.type === 'onball' && m.options.length === 3);
const g = newGame({ mode: 'real', playerId: pid, seed, difficulty: 'normal' });
const rm = roundMatch(g);
const run = new MyMatchRun({ ...rm.input, control: { mode: 'direct', stop: 'all' } }, { teams: rm.teams });
let m = run.advance();
while (m && !(m.type !== 'halftime' && hit(m))) {
  if (m.type === 'halftime') run.halftime(null);
  else run.resolve(bestChoice(m));
  m = run.advance();
}
if (!m) throw new Error('조건 장면 없음');
const s = run.sim.state;
const endE = run.frames.at(-1)!.e;
const { cands: _c, variants: _v, ...moment } = m as Moment & { cands?: unknown; variants?: unknown };
writeFileSync(out, JSON.stringify({
  teams: rm.teams, moment, frames: run.frames.filter((f) => f.e >= endE - 2), players: replayPlayers(s.input.home, s.input.away),
  log: s.moments.log, seed, pid,
}));
console.log(`${out}: ${pid} ${seed} ${m.minute}' 선택지 ${m.options.length}`);
