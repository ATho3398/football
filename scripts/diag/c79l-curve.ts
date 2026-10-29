// @ts-nocheck — 진단 스크립트 (엔진관리자19, C.79l 미해결 4 직선 선수빨 ⒜: 능력치별 실행 곡선 표)
// 엔진 식을 그대로 불러 능력치 40/50/60/70/80/90 선수의 롱패스 정확도(땅볼·공중 판정 passProbability 꼴), 롱볼 착지 오차 σ(longBall),
// 공중 경합 승률(aerialWin 점수 차), 수신 정지 시간(receive.timeModel), 원터치 배수(oneTouchMul), 박스 수신 경합(receiveWin) 을 표로 낸다. 경기 없음.
// 실행: npx vite-node scripts/diag/c79l-curve.ts -- [경로=값 …]

import { ENGINE } from '../../src/engine/config';
import { passDistBase, passSkillApply } from '../../src/engine/onball';
import { L1 } from '../../src/engine/pitch';

const all = process.argv.slice(2).filter((a) => a !== '--');
for (const a of all) {
  if (!a.includes('=')) continue;
  const [k, v] = a.split('=');
  const keys = k!.split('.'); let o = ENGINE as unknown as Record<string, unknown>;
  for (const p of keys.slice(0, -1)) o = o[p] as Record<string, unknown>;
  o[keys[keys.length - 1]!] = Number(v);
}
const PR = ENGINE.prob;
const RC = ENGINE.receive;
const lv = [40, 50, 60, 70, 80, 90];
const f = (x: number) => x.toFixed(2);
const pcf = (x: number) => (100 * x).toFixed(0);
console.log(`덮어쓰기 ${JSON.stringify(Object.fromEntries(all.filter((a) => a.includes('=')).map((a) => a.split('='))))}`);
console.log('\n① 패스 성공 확률(레인 위험 0·압박 0, passProbability 꼴 = passSkillApply(passDistBase(d), 능력치)) — 거리별 × 능력치별 (%)');
console.log('| 거리 | 기본(거리만) | ' + lv.map((v) => `${v}`).join(' | ') + ' | 40/80 실패 배수 |');
for (const d of [10, 20, 30, 35, 40, 45, 50]) {
  const base = passDistBase(d);
  const ps = lv.map((v) => passSkillApply(base, v));
  console.log(`| ${d} m | ${pcf(Math.max(PR.passMin, Math.min(PR.passMax, base)))} | ${ps.map(pcf).join(' | ')} | ${f((1 - ps[0]!) / (1 - ps[4]!))} |`);
}
console.log(`- 식: 실패 = (1 − clamp(기본, ${PR.passMin}, ${PR.passMax})) × exp(−${PR.passSkill} × (능력치 − ${PR.skillCenter})/10), 상한 ${PR.passCap}. 25~45 m 는 숏·롱 능력치를 거리 비례로 섞음(여기선 한 값)`);
console.log('\n② 롱볼(longBall: 걷어내기·수비 롱볼) 착지 오차 σ (m) = (100 − 롱패스) × 0.08 + 2 (약발·바람 제외)');
console.log('| ' + lv.map((v) => `${v}`).join(' | ') + ' |');
console.log('| ' + lv.map((v) => f((100 - v) * 0.08 + 2)).join(' | ') + ' |');
console.log(`\n③ 공중 경합 승률 aerialWin = L1((점수 차)/${PR.aerialScale}) (점수 = 헤더 0.5 + 점프 0.3 + 근력 0.2; duelTail ${PR.duelTail}) — 공격 점수 행 × 수비 점수 열 (%)`);
console.log('| 공격\\수비 | ' + lv.map((v) => `${v}`).join(' | ') + ' |');
for (const a of lv) console.log(`| ${a} | ${lv.map((d) => pcf(L1((a - d) / PR.aerialScale))).join(' | ')} |`);
console.log(`\n④ 박스 땅볼 수신 경합 receiveWin = L1((공격 − 수비)/${PR.receiveScale} + ${PR.receiveBias}) (공격 = 볼컨 0.5 + 근력 0.3 + 민첩 0.2, 수비 = 마킹 0.5 + 태클 0.3 + 포지셔닝 0.2) (%)`);
console.log('| 공격\\수비 | ' + lv.map((v) => `${v}`).join(' | ') + ' |');
for (const a of lv) console.log(`| ${a} | ${lv.map((d) => pcf(L1((a - d) / PR.receiveScale + PR.receiveBias))).join(' | ')} |`);
console.log(`\n⑤ 수신 정지 시간(초, receive.timeModel ${RC.timeModel}) = clamp(${RC.base} − ${RC.touchSkill} × (볼컨 − 70)/100 + ${RC.ballSpeed} × max(0, 공속 − 12)/10 + ${RC.press} × 압박 + ${RC.back} × 등짐 − ${RC.run} × 달림 + 반응 × ${RC.reactMul}, ${RC.min}, ${RC.max}) — 반응 0.2 가정`);
console.log('| 상황 | ' + lv.map((v) => `${v}`).join(' | ') + ' |');
for (const [nm, sp, pr, back] of [['땅볼 12 m/s 압박 0 앞', 12, 0, 0], ['공중 22 m/s 압박 0 앞', 22, 0, 0], ['공중 22 m/s 압박 0.7 등짐', 22, 0.7, 1]] as const) {
  console.log(`| ${nm} | ${lv.map((v) => f(Math.max(RC.min, Math.min(RC.max, RC.base - RC.touchSkill * (v - 70) / 100 + RC.ballSpeed * Math.max(0, sp - 12) / 10 + RC.press * pr + RC.back * back + 0.2 * RC.reactMul)))).join(' | ')} |`);
}
console.log(`\n⑥ 원터치 배수 otMul = clamp(1 − ${RC.otBase} − ${RC.otSpeed} × max(0, 공속 − 12)/10 − ${RC.otPress} × 압박 + ${RC.otSkill} × (볼컨 − 70)/100, ${RC.otMin}, 1) — 공속 12 · 압박 0.5`);
console.log('| ' + lv.map((v) => `${v}`).join(' | ') + ' |');
console.log('| ' + lv.map((v) => f(Math.max(RC.otMin, Math.min(1, 1 - RC.otBase - RC.otPress * 0.5 + RC.otSkill * (v - 70) / 100)))).join(' | ') + ' |');
console.log(`\n⑦ 몰기 상실 배수 exp(−${ENGINE.onball.carrySkill} × ((드리블+볼컨)/2 − ${PR.skillCenter})/10) · 드리블 1대1 L1(차/${PR.dribbleScale} + ${PR.dribbleBias})`);
console.log('| ' + lv.map((v) => `${v}`).join(' | ') + ' |');
console.log('| ' + lv.map((v) => f(Math.exp(-ENGINE.onball.carrySkill * (v - PR.skillCenter) / 10))).join(' | ') + ' |');
console.log(`\n⑧ 마무리 배수 finishMult(슈팅 0.6 + 침착 0.25 + 빅매치 0.15 = v) — 엔진 식 그대로 (onball finishMult)`);
import('../../src/engine/onball').then(({ finishMult }) => {
  console.log('| ' + lv.map((v) => `${v}`).join(' | ') + ' |');
  console.log('| ' + lv.map((v) => f(finishMult({ shooting: v, composure: v, bigMatch: v, longShots: v, heading: v, freeKick: v } as any, 'shot'))).join(' | ') + ' |');
  process.exit(0);
});
