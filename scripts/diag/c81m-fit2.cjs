// C.81m 2단계: 기울기 맞춘 보정(fit1)으로 돌린 결과에서 상위 20명 평균이 엔진에 맞게 잡음 σ 만 다시 맞춘다
//  (엔진 잔차는 오른쪽 꼬리가 무거워 정규 잡음으로 잔차 sd 만 맞추면 상위 20명이 0.2~0.3 낮다).
//  상위 20 − 평균 ≈ q × 전체 sd 로 보고 q 를 지금 결과에서 잰 뒤, 필요한 sd → σ. 사용: node c81m-fit2.cjs raw.txt cur.txt fit.json
const fs = require('fs');
const J = (f) => JSON.parse(fs.readFileSync(f, 'utf8').split('\n').find((l) => l.startsWith('JSON ')).slice(5));
const raw = J(process.argv[2]); const cur = J(process.argv[3]); const fit = JSON.parse(fs.readFileSync(process.argv[4], 'utf8'));
for (const g of Object.keys(fit.jitter)) {
  const { y } = raw.regs[g]; const v = cur.gsum[g]; const k = fit.spread[g];
  const sd = Math.sqrt((k * y.r) ** 2 + fit.jitter[g] ** 2);
  const q = (v.et - v.em) / sd;
  const need = (v.at - v.am) / q;
  fit.jitter[g] = +Math.sqrt(Math.max(0, need ** 2 - (k * y.r) ** 2)).toFixed(2);
}
console.log(JSON.stringify(fit));
