// C.81m: c81m-analyze 를 보정 없음(shift 0 · spread 1 · jitter 0)으로 돌린 JSON 줄에서 포지션군별 보정을 닫힌 식으로 맞춘다.
//  퍼짐 k = 엔진 기울기 / 추정 기울기 (평점 ~ OVR), 잡음 σ = √(엔진 잔차² − k² 추정 잔차²), 이동 c = M엔진 − B − (M추정 − B) k (B = ratingBase 6.62)
//  → 같은 OVR 에서 평균·퍼짐이 엔진과 같아져 평균·상위 분포가 같이 맞는다 (퍼짐만 늘리면 OVR 높은 스타 평점이 엔진보다 높아진다)
const line = require('fs').readFileSync(0, 'utf8').split('\n').find((l) => l.startsWith('JSON '));
const j = JSON.parse(line.slice(5));
const B = 6.62; const shift = {}; const spread = {}; const jitter = {};
for (const [g, { e, y }] of Object.entries(j.regs)) {
  const k = e.b / y.b;
  const v = j.gsum[g];
  spread[g] = +k.toFixed(2);
  jitter[g] = +Math.sqrt(Math.max(0, e.r ** 2 - (k * y.r) ** 2)).toFixed(2);
  shift[g] = +(v.am - B - (v.em - B) * spread[g]).toFixed(2);
}
console.log(JSON.stringify({ shift, spread, jitter }));
