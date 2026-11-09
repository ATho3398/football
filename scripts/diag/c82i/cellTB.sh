#!/bin/bash
# C.82i 상성 칸 티키 → 블록(버스 포함) 공중 2(지금) 대 3 — 버스>티키 +0.300(경계) · 블록>티키 +0.17 두 칸만 960
cd /home/user/football
D=scripts/diag/c82i
while ! grep -q POSTDONE $D/post.out; do sleep 5; done
for v in 3; do
  for s in 41000 51000; do npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=$s only=tikitaka/block,tikitaka/block@0020 out=$D/cellTB$v-$s.json matchup.tikitaka.block.air=$v > $D/cellTB$v-$s.log 2>&1; done
  node scripts/diag/c79u-merge.cjs $D/cellTB$v-960.json $D/cellTB$v-41000.json $D/cellTB$v-51000.json
  node -e '
const L=(f)=>JSON.parse(require("fs").readFileSync(f));const gd=(r)=>(r.gf-r.ga)/r.n;
for (const r of L(process.argv[1])) { const u=r.unit, mu=u.reduce((a,b)=>a+b,0)/u.length, se=Math.sqrt(u.reduce((a,b)=>a+(b-mu)**2,0)/u.length/u.length); console.log("air '$v'", r.a,">",r.b,gd(r).toFixed(3),"±",se.toFixed(3),"n",r.n); }' $D/cellTB$v-960.json
done
echo "CELLTBDONE $(date +%T)"
