#!/bin/bash
# 상성 칸 보정 측정: 티키 → 직선 short·keep 2 → 3, 티키 → 역습 새 칸 short 2·keep 2 (그 두 칸만 960)
cd /home/user/football
D=scripts/diag/c82f
OV="matchup.tikitaka.direct.short=3 matchup.tikitaka.direct.keep=3 matchup.tikitaka.counter.short=2 matchup.tikitaka.counter.keep=2"
for s in 41000 51000; do npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=$s only=tikitaka/direct,tikitaka/counter out=$D/cellA-$s.json $OV > $D/cellA-$s.log 2>&1; done
node scripts/diag/c79u-merge.cjs $D/cellA-960.json $D/cellA-41000.json $D/cellA-51000.json
node -e '
const L=(f)=>JSON.parse(require("fs").readFileSync(f));const gd=(r)=>(r.gf-r.ga)/r.n;
for (const r of L("scripts/diag/c82f/cellA-960.json")) { const u=r.unit, mu=u.reduce((a,b)=>a+b,0)/u.length, se=Math.sqrt(u.reduce((a,b)=>a+(b-mu)**2,0)/u.length/u.length); console.log(r.a,">",r.b,gd(r).toFixed(3),"±",se.toFixed(3),"n",r.n); }'
echo CELLSDONE
