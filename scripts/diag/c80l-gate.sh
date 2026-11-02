# C.80l 관문: main 960 기준표(c80i-matrix-41/51)에 게겐 행 6칸(새 값)을 덮어 합친 뒤 비교
# 실행: bash scripts/diag/c80l-gate.sh 태그   (레포 루트에서, 칸 파일 = /tmp/c80l/<태그>-s41.json · -s51.json)
set -e
cd scripts/diag
T=${1:-g03}
for s in 41 51; do node c80h-overlay.cjs /tmp/c80l/$T-$s-all.json c80i-matrix-$s.json ${ROWDIR:-/tmp/c80l}/$T-s$s.json; done
node c79u-merge.cjs /tmp/c80l/base-960.json c80i-matrix-41.json c80i-matrix-51.json
node c79u-merge.cjs /tmp/c80l/$T-960.json /tmp/c80l/$T-41-all.json /tmp/c80l/$T-51-all.json
node c80d-matrix-cmp.cjs /tmp/c80l/base-960.json /tmp/c80l/$T-960.json
node -e '
const L=(f)=>JSON.parse(require("fs").readFileSync(f));const gd=(r)=>(r.gf-r.ga)/r.n;
for (const f of ["/tmp/c80l/base-960.json","/tmp/c80l/'$T'-960.json"]) { const m=L(f); const c=m.find(r=>r.a==="tikitaka"&&r.b==="gegenpress"); const u=c.unit, mu=u.reduce((a,b)=>a+b,0)/u.length, se=Math.sqrt(u.reduce((a,b)=>a+(b-mu)**2,0)/u.length/u.length);
  const row=m.filter(r=>r.a==="gegenpress"||r.b==="gegenpress").map(r=>r.a==="gegenpress"?gd(r):-gd(r)); console.log(f, "게겐>티키", (-gd(c)).toFixed(3), "±", se.toFixed(3), "| 게겐 행", (row.reduce((a,b)=>a+b,0)/row.length).toFixed(3), row.map(v=>v.toFixed(2)).join(" ")); }'
