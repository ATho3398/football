#!/bin/bash
cd /home/user/football; D=scripts/diag/c82e
for sd in 41000 51000; do npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=$sd only=tikitaka/gegenpress matchup.gegenpress.tikitaka.tackle=-9 matchup.gegenpress.tikitaka.air=-6 out=$D/cell-C-$sd.json > $D/cell-C-$sd.log 2>&1; done
node -e "
const fs=require('fs');const f=(p)=>JSON.parse(fs.readFileSync(p,'utf8'))[0];
const a=f('$D/cell-C-41000.json'),b=f('$D/cell-C-51000.json');
const v=(x)=>((x.gf-x.ga)/x.n).toFixed(3);
const u=[...a.unit,...b.unit];const mu=u.reduce((p,q)=>p+q,0)/u.length;const se=Math.sqrt(u.reduce((p,q)=>p+(q-mu)**2,0)/u.length/u.length);
console.log('C tackle -9 air -6: 티키>게겐 41000 '+v(a)+' · 51000 '+v(b)+' · 960 '+(((a.gf+b.gf)-(a.ga+b.ga))/(a.n+b.n)).toFixed(3)+' ± '+se.toFixed(3));"
echo CELLCDONE
