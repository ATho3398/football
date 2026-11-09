#!/bin/bash
# C.82j 상성 칸 게겐 → 티키 (tackle/air) 변형별 960 (41000·51000)
cd /home/user/football
D=scripts/diag/c82j
for v in "$@"; do t=${v%/*}; a=${v#*/}; tag=gt${t}_${a}
  for s in 41000 51000; do npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=$s only=gegenpress/tikitaka,gegenpress/tikitaka@0020 out=$D/$tag-$s.json matchup.gegenpress.tikitaka.tackle=$t matchup.gegenpress.tikitaka.air=$a > $D/$tag-$s.log 2>&1; done
  node scripts/diag/c79u-merge.cjs $D/$tag-960.json $D/$tag-41000.json $D/$tag-51000.json > /dev/null
  node -e 'const L=(f)=>JSON.parse(require("fs").readFileSync(f));const gd=(r)=>(r.gf-r.ga)/r.n;for (const r of L(process.argv[1])) { const u=r.unit, mu=u.reduce((a,b)=>a+b,0)/u.length, se=Math.sqrt(u.reduce((a,b)=>a+(b-mu)**2,0)/u.length/u.length); console.log("'$tag'", r.a,">",r.b,gd(r).toFixed(3),"±",se.toFixed(3),"n",r.n); }' $D/$tag-960.json
done
echo "CELLGTDONE $(date +%T)"
