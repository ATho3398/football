// C.81j 결과 불변 지문: 엔진 지문(c74a 식) + 상성 960 일부(성향 7개 라운드 로빈 21쌍 × 4경기, MatchOut 전체)
//   + 다른 팀 경기 20회(EngineResult 전체) + 내 경기 재생 데이터 3경기(프레임 전체) — 변경 전후가 완전히 같아야 한다
// 실행: npx vite-node scripts/diag/c81j-fp.ts
import { createHash } from 'node:crypto';
import { newGame, otherJob, roundMatch, selectableRealPlayers } from '../../src/game';
import { playMyMatch } from '../../src/engine/adapter';
import { playNpcMatch } from '../../src/engine/npcMatch';
import { setEnvironmentFixed } from '../../src/weather';
import { runMatchJob, type MatchJob } from '../engine/job';
import { std } from '../engine/suite';
import { tacticsOf, type Level } from '../../src/engine/tactics';
import type { Tendency } from '../../src/engine/types';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createMatch } from '../../src/engine/sim';
import { createTeamRoster } from '../../src/roster';

setEnvironmentFixed(true);
// 실수는 비트 그대로 (JSON 의 짧은 표기가 같으면 같은 비트지만, -0 도 구분)
const ser = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'number' && Object.is(x, -0) ? '-0' : x));
const part = (name: string, f: (h: ReturnType<typeof createHash>) => void) => {
  const h = createHash('sha256'); const t = Date.now(); f(h); const d = h.digest('hex').slice(0, 16);
  console.log(`${name} ${d} (${((Date.now() - t) / 1000).toFixed(1)}s)`); return d;
};
const all: string[] = [];
all.push(part('c74a', (h) => {
  for (let k = 0; k < 4; k++) {
    const real = selectableRealPlayers()[k * 3]!;
    const g = newGame({ seed: `fp-${k}`, mode: 'real', playerId: real.id, difficulty: 'normal' });
    const rm = roundMatch(g);
    const o = playMyMatch(rm.input);
    h.update(ser([o.engine.homeGoals, o.engine.awayGoals, o.engine.teamStats, o.engine.events.length, o.my]));
    h.update(ser(playNpcMatch(otherJob(g, 0, 1).input)));
  }
}));
all.push(part('replay', (h) => {
  for (let k = 0; k < 3; k++) {
    const real = selectableRealPlayers()[k * 5 + 1]!;
    const g = newGame({ seed: `fpr-${k}`, mode: 'real', playerId: real.id, difficulty: 'normal' });
    const o = playMyMatch(roundMatch(g).input, { teams: ['A', 'B'] });
    h.update(ser(o.engine)); h.update(ser(o.replay));
  }
}));
const specs = ['balanced', 'tikitaka', 'gegenpress', 'counter', 'direct', 'block', 'block@0020'];
const tac = (spec: string) => {
  const [t, lv] = spec.split('@') as [Tendency, string | undefined];
  const levels = lv ? { lineHeight: Number(lv[0]) as Level, pressing: Number(lv[1]) as Level, style: Number(lv[2]) as Level, width: Number(lv[3]) as Level } : undefined;
  return tacticsOf(t, levels);
};
all.push(part('matrix', (h) => {
  const N = Number(process.env.FP_N ?? 4);
  for (let i = 0; i < specs.length; i++) for (let j = i + 1; j < specs.length; j++) for (let k = 0; k < N; k++) {
    const seed = 41000 + Math.floor(k / 2); const flip = k % 2 === 1;
    const A = std(flip ? 'b' : 'a', seed, 75, '4-4-2', tac(specs[i]!));
    const B = std(flip ? 'a' : 'b', seed, 75, '4-4-2', tac(specs[j]!));
    const job: MatchJob = k % 2 ? { kind: 'match', seed, neutral: true, home: A, away: B } : { kind: 'match', seed, neutral: true, home: B, away: A };
    { const o = runMatchJob(job) as unknown as Record<string, unknown>; delete o.ms; h.update(ser(o)); }
  }
}));
all.push(part('others', (h) => {
  for (let i = 0; i < 20; i++) {
    const hr = 64 + (i * 7) % 24, ar = 64 + (i * 11) % 24;
    const home = createTeamRoster({ id: `h${i}`, rating: hr }, `same-h${i}`, 2018, []);
    const away = createTeamRoster({ id: `a${i}`, rating: ar }, `same-a${i}`, 2018, []);
    const r = createMatch({ home: teamSetupFromRoster(home, hr, ar), away: teamSetupFromRoster(away, ar, hr), mode: 'auto', difficulty: 'normal', seed: 1000 + i, bigMatch: false }).runToEnd();
    h.update(ser(r));
  }
}));
console.log('FP', createHash('sha256').update(all.join()).digest('hex').slice(0, 16));
process.exit(0);
