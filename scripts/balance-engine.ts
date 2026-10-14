// 경기 엔진 통계 점검 (부록 E.15, E.15.1, E.18 0번)
// npm run balance:engine              전체 점검 (E.15 측정 표본, 15분 이내) → docs/engine-report.md 저장
//   -- --note "A1 판단 단위 통일"      보고서의 "변경" 칸
// npm run balance:engine:check        경량 회귀 가드 (고정 시드 작은 표본, 3분 이내). 가드 밖이면 종료 코드 1
//   가드: ① 득점 곡선(동레이팅, Δ±8) ② 평점 평균/σ ③ 엔진/빠른 경기 시즌 XP 비 ④ 스탯 반응 3개 ⑤ 공이 살아 있는 시간
// 환경 변수 WORKERS 로 워커 수 (기본 코어 수)

import { analyze, buildSets, guardFailures, runSets } from './engine/suite';
import { printResult, writeReport } from './engine/report';

const argv = process.argv;
const light = argv.includes('--light');
const check = argv.includes('--check');
const noteIdx = argv.indexOf('--note');
const note = noteIdx >= 0 ? argv[noteIdx + 1] ?? '' : '';

const mode = light ? 'light' : 'full';
const t0 = Date.now();
const res = await runSets(buildSets(mode));
const r = analyze(mode, res, (Date.now() - t0) / 1000);
printResult(r, light);

if (!light) {
  writeReport('docs/engine-report.md', r, note);
  console.log('docs/engine-report.md 저장');
}
if (light) {
  const fails = guardFailures(r);
  console.log(fails.length ? `\n[경량 가드] 실패 ${fails.length}개:\n  ${fails.join('\n  ')}` : '\n[경량 가드] 모두 통과');
  if (check && fails.length) process.exit(1);
}
process.exit(0);
