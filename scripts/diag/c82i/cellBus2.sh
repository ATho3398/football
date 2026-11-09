#!/bin/bash
# C.82i 버스 → 역습 칸 완화: 공중 −2·태클 −1 (공중 −4·태클 −2 는 버스>역습 +0.13 → −0.10 으로 지나침)
cd /home/user/football
D=scripts/diag/c82i
for s in 41000 51000; do npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=$s only=counter/block@0020 out=$D/cellBus2-$s.json matchup.bus.counter.air=-2 matchup.bus.counter.tackle=-1 > $D/cellBus2-$s.log 2>&1; done
node scripts/diag/c79u-merge.cjs $D/cellBus2-960.json $D/cellBus2-41000.json $D/cellBus2-51000.json
node -e '
const L=(f)=>JSON.parse(require("fs").readFileSync(f));const gd=(r)=>(r.gf-r.ga)/r.n;
for (const r of L(process.argv[1])) { const u=r.unit, mu=u.reduce((a,b)=>a+b,0)/u.length, se=Math.sqrt(u.reduce((a,b)=>a+(b-mu)**2,0)/u.length/u.length); console.log(r.a,">",r.b,gd(r).toFixed(3),"±",se.toFixed(3),"n",r.n); }' $D/cellBus2-960.json
echo "CELLBUS2DONE $(date +%T)"
