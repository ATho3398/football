#!/bin/bash
# 상성 칸 보정 D(C.82g 병합 뒤 최종 엔진): 인자 = 덮어쓰기(경로=값 …). 게겐/블록 · 게겐/역습 · 게겐/직선 · 직선/블록 · 티키/직선 · 게겐/티키 여섯 칸만 960 (두 시드 동시)
cd /home/user/football
D=scripts/diag/c82f
TAG=${TAG:-cellD}
CELLS=${CELLS:-gegenpress/block,gegenpress/counter,gegenpress/direct,direct/block,tikitaka/direct,gegenpress/tikitaka}
for s in 41000 51000; do npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=$s only=$CELLS out=$D/$TAG-$s.json "$@" > $D/$TAG-$s.log 2>&1 & done; wait
node scripts/diag/c79u-merge.cjs $D/$TAG-960.json $D/$TAG-41000.json $D/$TAG-51000.json
node -e '
const L=(f)=>JSON.parse(require("fs").readFileSync(f));const gd=(r)=>(r.gf-r.ga)/r.n;
for (const r of L(process.argv[1])) { const u=r.unit, mu=u.reduce((a,b)=>a+b,0)/u.length, se=Math.sqrt(u.reduce((a,b)=>a+(b-mu)**2,0)/u.length/u.length); console.log(r.a,">",r.b,gd(r).toFixed(3),"±",se.toFixed(3),"n",r.n); }' $D/$TAG-960.json
echo CELLSDDONE
