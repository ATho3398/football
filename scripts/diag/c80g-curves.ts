// @ts-nocheck — 진단 스크립트 (엔진관리자24, c80g 3번): 롱패스 수신 실행식의 능력치 곡선을 엔진 함수로 직접 표로 (경기 없음)
// 실행: npx vite-node scripts/diag/c80g-curves.ts
import { ENGINE } from '../../src/engine/config';
import { passDistBase, passSkillApply } from '../../src/engine/onball';
import { aerialScore, aerialWin, receiveWin } from '../../src/engine/duel';
import { L1 } from '../../src/engine/pitch';
import { BALANCE } from '../../src/config/balance';

const PR = ENGINE.prob;
const f = (v: number, d = 2) => v.toFixed(d);
const pcs = (v: number) => (100 * v).toFixed(0);

console.log('## A. 패스 성공 확률(실행 = 판단 같은 식) — 거리 × 패서 능력치(숏/롱 혼합: 25 m 숏 100% → 45 m 롱 100%), 레인 위험 0 · 패서 압박 0');
console.log(`passBase ${PR.passBase} · passPerM ${PR.passPerM}(≤ ${PR.shortPassMax} m) · longPerM ${PR.longPerM}(~${PR.longFarFrom} m) · longFarPerM ${PR.longFarPerM} · passSkill ${PR.passSkill} · 수신 압박 벌점 receiverPressure ${PR.receiverPressure} × (1 − 가장 가까운 수비/${PR.receiverPressureDist} m) · passCap ${PR.passCap}`);
console.log('| 거리 m | 기본값(거리만) | 패서 50 | 60 | 70 | 80 | 90 | 패서 70 + 수신자 마크 2.5 m(rp .5) | 수신자 마크 0 m(rp 1) | 패서 압박 1.5 m(pressure .5) |');
for (const d of [10, 15, 20, 25, 30, 35, 40, 45]) {
  const base = passDistBase(d);
  const row = [50, 60, 70, 80, 90].map((sk) => pcs(passSkillApply(base, sk)));
  console.log(`| ${d} | ${f(base)} | ${row.join(' | ')} | ${pcs(passSkillApply(base - PR.receiverPressure * 0.5, 70))} | ${pcs(passSkillApply(base - PR.receiverPressure, 70))} | ${pcs(passSkillApply(base - PR.pressurePenalty * 0.5, 70))} |`);
}

console.log('\n## B. 공중 롱볼(30 m+) 착지 경합 aerialWin — 받는 선수가 longContest 2.8 m 안 수비수를 이길 확률. 공중 점수 = 헤더 .5 + 점프 .3 + (근력 + 체격 보정) .2 + 키 보정((키 − 181) × 0.25, ±5)');
console.log(`aerialScale ${PR.aerialScale} · duelTail ${PR.duelTail}(0 = 끝 눕히기 없음)`);
console.log('| 공중 점수 차(받는 − 수비) | −30 | −20 | −10 | −5 | 0 | +5 | +10 | +20 | +30 |');
console.log(`| P(받음) | ${[-30, -20, -10, -5, 0, 5, 10, 20, 30].map((d) => pcs(L1(d / PR.aerialScale))).join(' | ')} |`);
console.log('키 보정: 165 cm → ' + f(Math.max(-5, Math.min(5, (165 - 181) * 0.25)), 1) + ' · 175 → ' + f((175 - 181) * 0.25, 1) + ' · 185 → ' + f((185 - 181) * 0.25, 1) + ' · 195 → ' + f(Math.min(5, (195 - 181) * 0.25), 1) + ' (= 헤더 능력치 ' + f(5 / 0.5, 0) + '점 ≈ 키 20 cm)');

console.log('\n## C. 박스 안 땅볼 수신 경합 receiveWin(contestDist 2 m) — 받는 쪽: 볼 컨트롤 .5 + 근력 .3 + 민첩 .2 / 수비: 마킹 .5 + 태클 .3 + 수비 포지셔닝 .2, receiveBias ' + PR.receiveBias + ' · receiveScale ' + PR.receiveScale);
console.log(`| 점수 차 | −20 | −10 | 0 | +10 | +20 |`);
console.log(`| P(받음) | ${[-20, -10, 0, 10, 20].map((d) => pcs(L1(d / PR.receiveScale + PR.receiveBias))).join(' | ')} |`);

console.log('\n## D. 박스 밖 땅볼 패스(20~30 m) 수신: 받는 선수 능력치가 들어가는 항 = **없음**. 성공 확률은 패서(숏패스 100% ~ 롱패스 25%)·거리·레인·패서 압박·수신자 마크 거리(rp)만. 받는 순간(도착 때) 수비 거리도 안 본다(판정은 찰 때 1회).');

// 선수 유형 비교
type P = { name: string; ballControl: number; agility: number; strength: number; jumping: number; heading: number; height: number; pace: number; marking: number; tackling: number; defensivePositioning: number };
const mk = (name: string, o: Partial<P>): P => ({ name, ballControl: 75, agility: 75, strength: 75, jumping: 75, heading: 75, height: 181, pace: 75, marking: 75, tackling: 75, defensivePositioning: 75, ...o });
const agent = (p: P) => ({ attrs: p, body: { aerial: Math.max(-5, Math.min(5, (p.height - 181) * 0.25)), strength: 0 }, spec: {}, duelEdge: 0, stamina: 100, fatigue: 0, burst: 100 }) as never;
const small = mk('작고 기술 좋은(볼컨 88 민첩 88 속도 85 · 근력 60 점프 55 헤더 50 · 168 cm)', { ballControl: 88, agility: 88, pace: 85, strength: 60, jumping: 55, heading: 50, height: 168 });
const big = mk('크고 느린(볼컨 62 민첩 55 속도 58 · 근력 88 점프 88 헤더 88 · 193 cm)', { ballControl: 62, agility: 55, pace: 58, strength: 88, jumping: 88, heading: 88, height: 193 });
const cb = mk('평균 CB(헤더 78 점프 78 근력 80 · 186 cm · 마킹 78 태클 78 수비위치 78)', { heading: 78, jumping: 78, strength: 80, height: 186, marking: 78, tackling: 78, defensivePositioning: 78 });
const cbSlow = mk('느린 큰 CB(헤더 85 점프 85 근력 85 · 192 cm)', { heading: 85, jumping: 85, strength: 85, height: 192 });
console.log('\n## E. 선수 유형별 수신 성공 확률 — 지금 실행식 (패서 70, 레인 0, 패서 압박 0)');
console.log('| 받는 선수 | 25 m 땅볼, 자유 | 25 m 땅볼, 마크 2.5 m | 25 m 땅볼, 마크 0 m(붙음) | 35 m 공중, 수비 3 m+ (경합 없음) | 35 m 공중, 평균 CB 2.8 m 안 | 35 m 공중, 큰 CB 2.8 m 안 | 박스 안 15 m 땅볼, 평균 CB 2 m 안 |');
for (const p of [small, big]) {
  const a = agent(p);
  const g25 = passSkillApply(passDistBase(25), 70);
  const g25m = passSkillApply(passDistBase(25) - PR.receiverPressure * 0.5, 70);
  const g25p = passSkillApply(passDistBase(25) - PR.receiverPressure, 70);
  const a35 = passSkillApply(passDistBase(35), 70);
  console.log(`| ${p.name} | ${pcs(g25)} | ${pcs(g25m)} | ${pcs(g25p)} | ${pcs(a35)} (비행 ${pcs(a35)} × 경합 100) | ${pcs(a35 * aerialWin(a, agent(cb)))} (비행 ${pcs(a35)} × 경합 ${pcs(aerialWin(a, agent(cb)))}) | ${pcs(a35 * aerialWin(a, agent(cbSlow)))} (경합 ${pcs(aerialWin(a, agent(cbSlow)))}) | ${pcs(passSkillApply(passDistBase(15), 70) * receiveWin(a, agent(cb)))} (경합 ${pcs(receiveWin(a, agent(cb)))}) |`);
}
console.log(`공중 점수: 작은 선수 ${f(aerialScore(agent(small)), 1)} · 큰 선수 ${f(aerialScore(agent(big)), 1)} · 평균 CB ${f(aerialScore(agent(cb)), 1)} · 큰 CB ${f(aerialScore(agent(cbSlow)), 1)}`);

console.log('\n## F. 수신 압박(rp) 벌점이 패스 성공에 미치는 크기 — 패서 70, 25 m: 가장 가까운 수비 0 / 1 / 2 / 3 / 4 / 5 m');
console.log(`| 수비 거리 m | ${[0, 1, 2, 3, 4, 5].join(' | ')} |`);
console.log(`| P | ${[0, 1, 2, 3, 4, 5].map((dd) => pcs(passSkillApply(passDistBase(25) - PR.receiverPressure * Math.max(0, 1 - dd / PR.receiverPressureDist), 70))).join(' | ')} |`);
console.log(`\n참고: 첫 터치 정지 시간(receive.timeModel)은 볼 컨트롤·공 속도·압박으로 달라지지만 받음/실패를 가르지 않는다(받은 뒤 시간만). 유지 중 상실은 onball.holdLose ${ENGINE.onball.holdLose} × (1 − 거리/3) 로 3 m 안 수비마다 — 받은 뒤 다음 결정까지의 상실은 능력치 무관.`);
void BALANCE;
process.exit(0);
