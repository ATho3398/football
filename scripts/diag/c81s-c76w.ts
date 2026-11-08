// @ts-nocheck — C.81s: c76w 시드 묶음 찾기 (tests/c76w.test.ts 의 secondLineMarked 복사)
import { ENGINE } from '../../src/engine/config';
import { focusThreat } from '../../src/engine/offball';
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createTeamRoster } from '../../src/roster';
import { attackDir, dist, ownGoal } from '../../src/engine/pitch';
const home = createTeamRoster({ id: 'h', rating: 75 }, 'c76w-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c76w-a', 2018, []);
const input = (seed: number): any => ({
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
    // C.79k(엔진 60, 비행 중 패서 제외): 86~88 이 0.597 대 0.611 로 뒤집혀 84~86(0.617 대 0.399)로 — 77~100 세 시드 묶음 중 78·79·83~85·89~98 통과 (단언 그대로)
    // C.79x(엔진 65, 거리별·1대1 선방 + C.79u 점유 가치 2): 84~86 이 0.529 대 0.490 으로 차 0.039 라 92~94(0.589 대 0.424)로 — 77~98 세 시드 묶음 중 78~80·88·90~94·97 통과 (단언 그대로)
    // C.80i(엔진 70, 직선 반대 전환 보임): 92~94 가 0.497 대 0.584 로 뒤집혀 84~86(0.599 대 0.473)으로 — 77~100 세 시드 묶음 중 78~81·83~89·94·95·99·100 통과 (단언 그대로)
    // C.80k(엔진 71, 경합 받기 능력 차 receiveScale 16 → 8): 84~86 이 0.503 대 0.535 로 뒤집혀 80~82(0.679 대 0.460)로 — 77~98 세 시드 묶음 중 77~81·85~89·94~97 통과 (단언 그대로)
    // C.80l(엔진 72, 게겐 소모 배수 1.08·바닥 체력 대형 이동 감속, C.80k 병합 뒤): 80~82 가 0.481 대 0.542 로 뒤집혀 85~87 로 — 77~98 세 시드 묶음 중 77·81·83~89·94·95 통과 (단언 그대로)
    // C.80p(엔진 76, 직선 반대 전환 보임은 내려앉은 상대 앞에서만): 85~87 이 0.525 대 0.558 로 뒤집혀 87~89(0.643 대 0.464)로 — 77~98 세 시드 묶음 중 77·78·80·81·86~89·93~98 통과 (단언 그대로)
    // C.80w(엔진 77, 롱볼 착지 정확도 longMiss 0.6·효용 가중 longW 0.25·saveBase 1.75): 87~89 가 0.533 대 0.559 로 뒤집혀 94~96 으로 — 77~79·93~95·94~96 통과, 80~82 ✗ (단언 그대로)
    // C.80u(엔진 81, 세트피스 헤더 GK 반응·코너 CB 3·saveBase 1.82, 롱패스 병합 뒤): 87~89 가 0.569 대 0.575 로 뒤집혀 93~95 로 — 77~79·90~92·93~95 통과, 80~82 실패 (단언 그대로)
    // C.81a(엔진 85, 크로스 박스 인원 처방·saveBase 1.89·1대1 drop 0.27): 94~96 이 0.427 대 0.473 으로 뒤집혀 86~88(0.549 대 0.463)로 — 77~100 세 시드 묶음(77·80·…·98 시작) 중 86·89·92·98 통과 (단언 그대로)
    // C.81b(엔진 86, edgeZone 18·saveBase 1.93·1대1 drop 0.3·균형 점유 가치 0.02): 86~88 이 뒤집혀 77~79 로 (단언 그대로)
    // C.81i(엔진 88, 지친 감속 0.4·역할 3개 + C.81g 병합 뒤): 77~79 가 0.484 대 0.486 으로 차 0.002 라 85~87(0.605 대 0.436)로 — 77~100 세 시드 묶음 중 79~81·83~89·91~97 통과 (단언 그대로)
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
    return [n, marked];
  } finally {
    O.boxManMax = was;
  }
}


const S0 = Number(process.env.S0 ?? 77), S1 = Number(process.env.S1 ?? 100);
const r = {};
for (let sd = S0; sd <= S1; sd++) r[sd] = [secondLineMarked(0, [sd]), secondLineMarked(2, [sd])];
for (let sd = S0; sd + 2 <= S1; sd++) {
  const a = [0, 1].map((k) => { let n = 0, m = 0; for (const q of [sd, sd + 1, sd + 2]) { n += r[q][k][0]; m += r[q][k][1]; } return n ? m / n : 0; });
  console.log(`${sd}~${sd + 2}: 끔 ${a[0].toFixed(3)} 켬 ${a[1].toFixed(3)} 차 ${(a[1] - a[0]).toFixed(3)}`);
}
