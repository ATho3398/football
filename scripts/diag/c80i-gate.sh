# C.80i 관문: main 960 기준표(c80h-matrix-41/51)에 직선 행 6칸(새 값)을 덮어 합친 뒤 비교
# 실행: bash scripts/diag/c80i-gate.sh 칸태그 행태그   (레포 루트에서, 예: sc3 row3 = c80i-sc3-db-s41.json + c80i-row3-s41.json)
set -e
cd scripts/diag
T=${1:-sc3}
RW=${2:-row3}
for s in 41 51; do node c80h-overlay.cjs /tmp/c80i-$T-$s.json c80h-matrix-$s.json c80i-$T-db-s$s.json c80i-$RW-s$s.json; done
node c79u-merge.cjs /tmp/c80h-960.json c80h-matrix-41.json c80h-matrix-51.json
node c79u-merge.cjs /tmp/c80i-$T-960.json /tmp/c80i-$T-41.json /tmp/c80i-$T-51.json
node c80d-matrix-cmp.cjs /tmp/c80h-960.json /tmp/c80i-$T-960.json
node -e '
const L=(f)=>JSON.parse(require("fs").readFileSync(f));const gd=(r)=>(r.gf-r.ga)/r.n;
for (const f of ["/tmp/c80h-960.json","/tmp/c80i-'$T'-960.json"]) { const m=L(f); const c=m.find(r=>r.a==="direct"&&r.b==="block"); const u=c.unit, mu=u.reduce((a,b)=>a+b,0)/u.length, se=Math.sqrt(u.reduce((a,b)=>a+(b-mu)**2,0)/u.length/u.length);
  const row=m.filter(r=>r.a==="direct"||r.b==="direct").map(r=>r.a==="direct"?gd(r):-gd(r)); console.log(f, "직선>블록", gd(c).toFixed(3), "±", se.toFixed(3), "| 직선 행", (row.reduce((a,b)=>a+b,0)/row.length).toFixed(3), row.map(v=>v.toFixed(2)).join(" ")); }'
