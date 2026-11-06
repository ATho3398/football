// C.81m: c81m-analyze 를 보정 없음(shift 0, spread 1)으로 돌린 JSON 줄에서 포지션군별 퍼짐 k·이동 c 를 닫힌 식으로 맞춘다
// (평균과 상위 20명 평균 둘 다 엔진에 맞도록: k = (T엔진 − M엔진) / (T추정 − M추정), c = M엔진 − B − (M추정 − B) k, B = ratingBase 6.62)
const line = require('fs').readFileSync(0, 'utf8').split('\n').find((l) => l.startsWith('JSON '));
const j = JSON.parse(line.slice(5));
const B = 6.62; const shift = {}; const spread = {};
for (const [g, v] of Object.entries(j.gsum)) {
  if (g === '전체') continue;
  const k = (v.at - v.am) / (v.et - v.em);
  spread[g] = +k.toFixed(2);
  shift[g] = +(v.am - B - (v.em - B) * spread[g]).toFixed(2);
}
console.log(JSON.stringify({ shift, spread }));
