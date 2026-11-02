// c80n-wing.ts 샤드 json 여러 개를 합쳐 표로 낸다. 실행: node scripts/diag/c80n-sum.cjs a.json b.json ...
const fs = require('fs');
const xs = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, 'utf8').trim().split('\n').pop()));
const G = ['GK', 'CB', 'FB', 'CDM', 'CM', 'CAM', 'WING', 'ST'];
const add = (a, b) => (typeof a === 'number' ? a + b : Array.isArray(a) ? a.map((v, i) => add(v, b[i])) : Object.fromEntries(Object.keys(a).map((k) => [k, add(a[k], b[k])])));
let t = xs[0];
for (const x of xs.slice(1)) for (const k of Object.keys(t)) if (k !== 'MODE') t[k] = add(t[k], x[k]);
const N = t.N;
const tg = G.reduce((s, g) => s + t.goals[g], 0), ts = G.reduce((s, g) => s + t.shots[g], 0);
console.log(`${t.MODE} ${N}경기 · 경기당 팀 득점 ${(t.totalGoalsStat / N / 2).toFixed(3)}`);
console.log('군 | 골% | 슛% | 골/경기 | 슛/경기 | xG/슛 | 골/슛 | 박스 터치/경기');
for (const g of G) console.log(`${g} | ${(t.goals[g] / tg * 100).toFixed(1)} | ${(t.shots[g] / ts * 100).toFixed(1)} | ${(t.goals[g] / N).toFixed(3)} | ${(t.shots[g] / N).toFixed(2)} | ${(t.xg[g] / Math.max(1, t.shots[g])).toFixed(3)} | ${(t.goals[g] / Math.max(1, t.shots[g])).toFixed(3)} | ${(t.boxTouch[g] / N).toFixed(2)}`);
const Z = ['박스 자기쪽 넓은', '박스 중앙(±7m)', '박스 반대쪽 넓은', '박스 밖'];
console.log(`윙어 반대발 비율 ${(t.wingersInv / t.wingersAll * 100).toFixed(0)}% · 박스 터치/경기 반대발 ${(t.wTouch[0] / N).toFixed(2)} · 정발 ${(t.wTouch[1] / N).toFixed(2)}`);
for (const k of [0, 1]) console.log(`${k ? '정발' : '반대발'} 슛/경기: ` + Z.map((z, i) => `${z} ${(t.wShot[k][i] / N).toFixed(2)} (골 ${(t.wGoal[k][i] / N).toFixed(3)}, xG/슛 ${(t.wXg[k][i] / Math.max(1, t.wShot[k][i])).toFixed(3)})`).join(' · '));
console.log(`크로스 ${(t.crosses / N).toFixed(1)}/경기 · 먼 쪽 윙어 있음 ${(t.farExists / t.crosses * 100).toFixed(0)}% · 크로스 순간 박스 안 ${(t.farIn / Math.max(1, t.farExists) * 100).toFixed(0)}% · 도착 순간 ${(t.farInArr / Math.max(1, t.farExists) * 100).toFixed(0)}% · 먼 쪽 윙어 겨냥 ${(t.crossToFar / Math.max(1, t.farExists) * 100).toFixed(0)}%`);
