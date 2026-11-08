#!/bin/bash
# 상성 칸 보정 측정: B: 티키 → 직선 air 2→5·tackle 2→4, 티키 → 역습 새 칸 tackle 3·air 2 (short·keep 은 효과 없음: A 에서 −0.08·−0.27) (그 두 칸만 960)
cd /home/user/football
D=scripts/diag/c82f
OV="matchup.tikitaka.direct.air=5 matchup.tikitaka.direct.tackle=4 matchup.tikitaka.counter.tackle=3 matchup.tikitaka.counter.air=2"
for s in 41000 51000; do npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=$s only=tikitaka/direct,tikitaka/counter out=$D/cellB-$s.json $OV > $D/cellB-$s.log 2>&1; done
node scripts/diag/c79u-merge.cjs $D/cellB-960.json $D/cellB-41000.json $D/cellB-51000.json
node -e '
const L=(f)=>JSON.parse(require("fs").readFileSync(f));const gd=(r)=>(r.gf-r.ga)/r.n;
for (const r of L("scripts/diag/c82f/cellB-960.json")) { const u=r.unit, mu=u.reduce((a,b)=>a+b,0)/u.length, se=Math.sqrt(u.reduce((a,b)=>a+(b-mu)**2,0)/u.length/u.length); console.log(r.a,">",r.b,gd(r).toFixed(3),"±",se.toFixed(3),"n",r.n); }'
echo CELLSDONE
