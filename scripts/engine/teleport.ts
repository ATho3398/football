// 순간이동 가드 (C.24, 12단계 진단 A2): 엔진을 한 틱씩 돌리며 선수의 틱당 1.0 m 초과 이동(하프타임 대형 제외)과
// 비행 중이 아닌 공의 틱당 3 m 초과 이동(재개 배치·하프타임 제외, 직전 공 속도만큼은 정상)을 센다. 0회여야 통과.
// 킥오프 순간 자기 진영을 벗어난 선수도 센다 (키커는 공 1 m 안 허용).
import { ENGINE } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { attackDir, dist, L } from '../../src/engine/pitch';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { BALANCED } from './job';

export const PLAYER_JUMP = 1.0;
export const BALL_JUMP = 3.0;

export interface TeleportCount {
  matches: number;
  player: number;
  ball: number;
  kickoffOut: number;
}

const mk = (side: string, i: number, rating: number, opp: number) => {
  const r = createTeamRoster({ id: `t${side}${i}`, rating }, `guardT-${side}-${rating}-${i}`, 2018, []);
  r.formation = '4-2-3-1';
  const s = teamSetupFromRoster(r, rosterRating(r), opp, `wT${i}`);
  s.tactics = { ...s.tactics, ...BALANCED };
  return s;
};

export function countTeleports(n: number): TeleportCount {
  const out: TeleportCount = { matches: n, player: 0, ball: 0, kickoffOut: 0 };
  for (let i = 0; i < n; i++) {
    const m = createMatch({ home: mk('a', i, 78, 76), away: mk('b', i, 76, 78), mode: 'auto', difficulty: 'normal', seed: 8800 + i, bigMatch: false, neutral: true });
    const s = m.state;
    let prev = s.agents.map((a) => ({ id: a.id, x: a.x, y: a.y }));
    let pb = { x: s.ball.x, y: s.ball.y, sp: 0, owned: false };
    let prevRestart = s.restart;
    while (!s.done) {
      const half = s.half;
      m.step();
      const b = s.ball;
      if (s.half === half) {
        for (const a of s.agents) {
          const p = prev[a.idx];
          if (a.onPitch && p && p.id === a.id && dist(p.x, p.y, a.x, a.y) > PLAYER_JUMP) out.player++;
        }
        const restartSet = !!s.restart && s.restart !== prevRestart;
        if (!b.flight && !restartSet && dist(pb.x, pb.y, b.x, b.y) - (pb.owned ? 0 : pb.sp * ENGINE.time.dt) > BALL_JUMP) out.ball++;
        if (prevRestart?.type === 'kickoff' && !s.restart) {
          for (const a of s.agents) {
            if (a.onPitch && (a.x - L / 2) * attackDir(a.team, s.half) > (a.idx === prevRestart.taker ? 1.0 : 0.05)) out.kickoffOut++;
          }
        }
      }
      prev = s.agents.map((a) => ({ id: a.id, x: a.x, y: a.y }));
      const fl = b.flight;
      pb = { x: b.x, y: b.y, owned: b.owner >= 0, sp: fl ? Math.hypot(fl.toX - fl.fromX, fl.toY - fl.fromY) / Math.max(0.05, fl.dur) : Math.hypot(b.vx, b.vy) };
      prevRestart = s.restart;
    }
  }
  return out;
}
