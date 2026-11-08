#!/bin/bash
# 상성 칸 보정 C(최종 엔진 freeR 4·ST 1.3·saveBase 2.00 뒤): 인자 = 덮어쓰기(경로=값 …). 티키/직선 · 직선/블록 두 칸만 960
cd /home/user/football
D=scripts/diag/c82f
TAG=${TAG:-cellC}
for s in 41000 51000; do npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=$s only=tikitaka/direct,direct/block,tikitaka/counter out=$D/$TAG-$s.json "$@" > $D/$TAG-$s.log 2>&1 & done; wait
node scripts/diag/c79u-merge.cjs $D/$TAG-960.json $D/$TAG-41000.json $D/$TAG-51000.json
node -e '
const L=(f)=>JSON.parse(require("fs").readFileSync(f));const gd=(r)=>(r.gf-r.ga)/r.n;
for (const r of L(process.argv[1])) { const u=r.unit, mu=u.reduce((a,b)=>a+b,0)/u.length, se=Math.sqrt(u.reduce((a,b)=>a+(b-mu)**2,0)/u.length/u.length); console.log(r.a,">",r.b,gd(r).toFixed(3),"±",se.toFixed(3),"n",r.n); }' $D/$TAG-960.json
echo CELLSCDONE
