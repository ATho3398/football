#!/bin/bash
# C.82h 상성 칸 게겐/균형: 게겐 → 균형 태클 2(지금) 대 4 (그 칸만 960 = 41000·51000 각 480)
cd /home/user/football
D=scripts/diag/c82h
for v in 2 4; do
  for s in 41000 51000; do npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=$s only=gegenpress/balanced out=$D/cellGB$v-$s.json matchup.gegenpress.balanced.tackle=$v > $D/cellGB$v-$s.log 2>&1; done
  node scripts/diag/c79u-merge.cjs $D/cellGB$v-960.json $D/cellGB$v-41000.json $D/cellGB$v-51000.json
  node -e '
const L=(f)=>JSON.parse(require("fs").readFileSync(f));const gd=(r)=>(r.gf-r.ga)/r.n;
for (const r of L(process.argv[1])) { const u=r.unit, mu=u.reduce((a,b)=>a+b,0)/u.length, se=Math.sqrt(u.reduce((a,b)=>a+(b-mu)**2,0)/u.length/u.length); console.log("tackle '$v'", r.a,">",r.b,gd(r).toFixed(3),"±",se.toFixed(3),"n",r.n); }' $D/cellGB$v-960.json
done
echo "CELLGBDONE $(date +%T)"
