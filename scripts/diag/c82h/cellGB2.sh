#!/bin/bash
# C.82h 상성 칸 게겐/균형 변형: 게겐 → 균형 공중 4 · 공중 6 · 균형 → 게겐 롱패스 −6 (그 칸만 960)
cd /home/user/football
D=scripts/diag/c82h
M() { name=$1; shift
  for s in 41000 51000; do npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=$s only=gegenpress/balanced out=$D/cell$name-$s.json "$@" > $D/cell$name-$s.log 2>&1; done
  node scripts/diag/c79u-merge.cjs $D/cell$name-960.json $D/cell$name-41000.json $D/cell$name-51000.json > /dev/null
  node -e '
const L=(f)=>JSON.parse(require("fs").readFileSync(f));const gd=(r)=>(r.gf-r.ga)/r.n;
for (const r of L(process.argv[1])) { const u=r.unit, mu=u.reduce((a,b)=>a+b,0)/u.length, se=Math.sqrt(u.reduce((a,b)=>a+(b-mu)**2,0)/u.length/u.length); console.log(process.argv[2], r.a,">",r.b,gd(r).toFixed(3),"±",se.toFixed(3),"n",r.n, new Date().toTimeString().slice(0,8)); }' $D/cell$name-960.json "$name"
}
M GBair4 matchup.gegenpress.balanced.air=4
M GBair6 matchup.gegenpress.balanced.air=6
M BGlong6 matchup.balanced.gegenpress.long=-6
echo "CELLGB2DONE $(date +%T)"
