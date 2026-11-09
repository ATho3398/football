#!/bin/bash
# C.82i 버스 전용 칸(bus 키): 버스 → 균형·역습 공중 −4·태클 −2 — 두 칸만 960
cd /home/user/football
D=scripts/diag/c82i
for s in 41000 51000; do npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=$s only=balanced/block@0020,counter/block@0020 out=$D/cellBus-$s.json > $D/cellBus-$s.log 2>&1; done
node scripts/diag/c79u-merge.cjs $D/cellBus-960.json $D/cellBus-41000.json $D/cellBus-51000.json
node -e '
const L=(f)=>JSON.parse(require("fs").readFileSync(f));const gd=(r)=>(r.gf-r.ga)/r.n;
for (const r of L(process.argv[1])) { const u=r.unit, mu=u.reduce((a,b)=>a+b,0)/u.length, se=Math.sqrt(u.reduce((a,b)=>a+(b-mu)**2,0)/u.length/u.length); console.log(r.a,">",r.b,gd(r).toFixed(3),"±",se.toFixed(3),"n",r.n); }' $D/cellBus-960.json
echo "CELLBUSDONE $(date +%T)"
