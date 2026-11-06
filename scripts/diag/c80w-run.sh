#!/bin/bash
# 4 프로세스 병렬로 c80w-long.ts (경기수 = 4 × N) 후 합산. 사용: bash scripts/diag/c80w-run.sh N 성향 [경로=값 …]
N=$1; shift; TN=$1; shift
for i in 0 1 2 3; do npx vite-node scripts/diag/c80w-long.ts -- $N $((i*N)) $TN "$@" 2>/dev/null | tail -1 > /tmp/c80w-$$-$i.json & done; wait
node -e '
const xs=process.argv.slice(1).map(f=>JSON.parse(require("fs").readFileSync(f,"utf8")));
const s={gl:0,th:0,lp:0,lc:0,pa:0,pSum:0,pN:0,ev:{}};
for(const x of xs){for(const k of ["gl","th","lp","lc","pa","pSum","pN"])s[k]+=x[k];for(const[k,v]of Object.entries(x.ev))s.ev[k]=(s.ev[k]??0)+v;}
const L=s.ev; const tot=s.pN;
console.log(`${xs[0].tn} ${JSON.stringify(xs[0].overrides)} 경기 ${xs.reduce((a,x)=>a+x.n,0)}: 롱% ${(100*s.lp/s.pa).toFixed(1)} 성공 ${(100*s.lc/s.lp).toFixed(1)} 판단P ${(100*s.pSum/s.pN).toFixed(1)} 팀당골 ${(s.gl/2/xs.reduce((a,x)=>a+x.n,0)).toFixed(2)} 팀당침투 ${(s.th/2/xs.reduce((a,x)=>a+x.n,0)).toFixed(1)}`);
for(const [k,v] of Object.entries(L).sort()) console.log(`  ${k} ${v} (${(100*v/tot).toFixed(1)}%)`);
' /tmp/c80w-$$-*.json; rm -f /tmp/c80w-$$-*.json
