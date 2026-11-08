#!/bin/bash
# C.82e: 게겐>티키 칸만 다시 재기 (상성 칸 보정 후보) — 시드 41000·51000 각 480 짝
cd /home/user/football; D=scripts/diag/c82e
for cand in "A:-10:-7" "B:-12:-9"; do
  IFS=: read name tk air <<< "$cand"
  for sd in 41000 51000; do
    npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=$sd only=tikitaka/gegenpress matchup.gegenpress.tikitaka.tackle=$tk matchup.gegenpress.tikitaka.air=$air out=$D/cell-$name-$sd.json > $D/cell-$name-$sd.log 2>&1
  done
  node -e "
const fs=require('fs');const f=(p)=>JSON.parse(fs.readFileSync(p,'utf8'))[0];
const a=f('$D/cell-$name-41000.json'),b=f('$D/cell-$name-51000.json');
const v=(x)=>((x.gf-x.ga)/x.n).toFixed(3);
const u=[...a.unit,...b.unit];const mu=u.reduce((p,q)=>p+q,0)/u.length;const se=Math.sqrt(u.reduce((p,q)=>p+(q-mu)**2,0)/u.length/u.length);
console.log('$name tackle $tk air $air: 티키>게겐 41000 '+v(a)+' · 51000 '+v(b)+' · 960 '+(((a.gf+b.gf)-(a.ga+b.ga))/(a.n+b.n)).toFixed(3)+' ± '+se.toFixed(3));"
done
echo CELLSDONE
