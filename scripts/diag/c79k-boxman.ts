// @ts-nocheck — 진단 스크립트 (C.79k): tests/c76w boxManMax 2 대 0 비율을 시드별로 (시드 재선정용)
import { ENGINE } from '../../src/engine/config';
import { focusThreat } from '../../src/engine/offball';
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createTeamRoster } from '../../src/roster';
import { attackDir, dist, ownGoal } from '../../src/engine/pitch';
const home = createTeamRoster({ id: 'h', rating: 75 }, 'c76w-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c76w-a', 2018, []);
const input = (seed: number) => ({
  home: teamSetupFromRoster(home, 75, 75), away: teamSetupFromRoster(away, 75, 75), mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true,
});

/** 공이 수비 팀 골 25 m 안(boxDefense 구간)일 때, 그 팀 박스 안의 상대 2선(줄 ≥ 2, ST/CF 아님, 위협 1위 아님) 선수를 목표(2.5 m 안)로 둔 수비 줄 선수가 있는 비율 (시드 3개 합) */
function secondLineMarked(maxMan: number, seeds: number[]): [number, number] {
  const O = ENGINE.offball as { boxManMax: number };
  const was = O.boxManMax;
  O.boxManMax = maxMan;
  try {
    let n = 0;
    let marked = 0;
    // C.79e(엔진 59, 줄 인원 맞춤 내려앉기): 줄 2 가 수비 줄로 내려와 마크를 늘려 77~79 의 차가 0.004 로 줄어 86~88(+0.097)로 — 77~92 세 시드 묶음 중 78·79·80·81·86·92 통과 (단언 그대로)
    for (const seed of seeds) {
      const m = createMatch(input(seed));
      const s = m.state;
      while (!s.done) {
        m.step();
        if (s.tick % 5 !== 0 || s.ball.owner < 0) continue;
        const owner = s.agents[s.ball.owner]!;
        const def = (1 - owner.team) as 0 | 1;
        const [gx, gy] = ownGoal(attackDir(def, s.half));
        if (dist(s.ball.x, s.ball.y, gx, gy) > 25) continue;
        const focus = focusThreat(s, def);
        for (const o of s.agents) {
          if (!o.onPitch || o.team !== owner.team) continue;
          if (o === owner || o === focus || o.line < 2 || o.pos === 'ST' || o.pos === 'CF') continue;
          if (Math.abs(o.x - gx) > ENGINE.pitch.boxDepth || Math.abs(o.y - gy) > ENGINE.pitch.boxWidth / 2) continue;
          n++;
          if (s.agents.some((d) => d.onPitch && d.team === def && d.line === 1 && dist(d.tx, d.ty, o.x, o.y) <= 2.5)) marked++;
        }
      }
    }
    return [marked, n];
  } finally {
    O.boxManMax = was;
  }
}

// 실행: … -- 시작 끝 → 시드별 (on 마크/n, off 마크/n) · … -- tri 84 85 86 → 테스트와 같은 순서(on 3시드 뒤 off 3시드)의 비율
const args = process.argv.slice(2).filter((x) => x !== '--');
if (args[0] === 'tri') { const ss = args.slice(1).map(Number); const on = secondLineMarked(2, ss); const off = secondLineMarked(0, ss); console.log(ss.join(','), (on[0] / on[1]).toFixed(4), (off[0] / off[1]).toFixed(4)); }
else for (let s = Number(args[0] ?? 77); s <= Number(args[1] ?? 100); s++) { const on = secondLineMarked(2, [s]); const off = secondLineMarked(0, [s]); console.log(s, on.join(' '), off.join(' ')); }
process.exit(0);
