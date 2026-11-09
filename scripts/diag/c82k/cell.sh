#!/bin/bash
# C.82k 상성 칸 하나 변형 960(41000·51000 각 480, 두 시드 동시): cell.sh 태그 A/B [경로=값 …]
cd /home/user/football
D=scripts/diag/c82k
TAG=$1; PAIR=$2; shift 2
for s in 41000 51000; do npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=$s only=$PAIR out=$D/cell-$TAG-$s.json "$@" > $D/cell-$TAG-$s.log 2>&1 & done; wait
node scripts/diag/c79u-merge.cjs $D/cell-$TAG-960.json $D/cell-$TAG-41000.json $D/cell-$TAG-51000.json > /dev/null
node -e 'const L=(f)=>JSON.parse(require("fs").readFileSync(f));const gd=(r)=>(r.gf-r.ga)/r.n;for (const r of L(process.argv[1])) { const u=r.unit, mu=u.reduce((a,b)=>a+b,0)/u.length, se=Math.sqrt(u.reduce((a,b)=>a+(b-mu)**2,0)/u.length/u.length); console.log("'$TAG'", r.a,">",r.b,gd(r).toFixed(3),"±",se.toFixed(3),"n",r.n, "'$*'"); }' $D/cell-$TAG-960.json
