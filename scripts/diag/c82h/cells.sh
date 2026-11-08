#!/bin/bash
# C.82h 상성 칸 재보정 측정 템플릿: cells.sh <이름> <only=A/B,C/D> [경로=값 ...] → 그 칸만 960(41000·51000 각 480)
cd /home/user/football
D=scripts/diag/c82h
NAME=$1; ONLY=$2; shift 2
for s in 41000 51000; do npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=$s $ONLY out=$D/cell$NAME-$s.json "$@" > $D/cell$NAME-$s.log 2>&1; done
node scripts/diag/c79u-merge.cjs $D/cell$NAME-960.json $D/cell$NAME-41000.json $D/cell$NAME-51000.json > /dev/null
node -e '
const L=(f)=>JSON.parse(require("fs").readFileSync(f));const gd=(r)=>(r.gf-r.ga)/r.n;
for (const r of L(process.argv[1])) { const u=r.unit, mu=u.reduce((a,b)=>a+b,0)/u.length, se=Math.sqrt(u.reduce((a,b)=>a+(b-mu)**2,0)/u.length/u.length); console.log(process.argv[2], r.a,">",r.b,gd(r).toFixed(3),"±",se.toFixed(3),"n",r.n, new Date().toTimeString().slice(0,8)); }' $D/cell$NAME-960.json "$NAME"
echo "CELLDONE $NAME $(date +%T)"
