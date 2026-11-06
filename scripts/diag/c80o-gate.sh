# C.80o 관문: main(9fead51) 960 기준표(c80o-base41/51) 대 변형 960(c80o-<태그>41/51)
# 실행: bash scripts/diag/c80o-gate.sh A   (레포 루트에서)
set -e
cd scripts/diag
T=${1:-A}
node c79u-merge.cjs /tmp/c80o-base-960.json c80o-base41-s41.json c80o-base51-s51.json
node c79u-merge.cjs /tmp/c80o-$T-960.json c80o-${T}41-s41.json c80o-${T}51-s51.json
node c80d-matrix-cmp.cjs /tmp/c80o-base-960.json /tmp/c80o-$T-960.json
node -e '
const L=(f)=>JSON.parse(require("fs").readFileSync(f));const gd=(r)=>(r.gf-r.ga)/r.n;
const cell=(m,a,b)=>{const c=m.find(r=>(r.a===a&&r.b===b)||(r.a===b&&r.b===a));const s=c.a===a?1:-1;const u=c.unit,mu=u.reduce((x,y)=>x+y,0)/u.length,se=Math.sqrt(u.reduce((x,y)=>x+(y-mu)**2,0)/u.length/u.length);return [s*gd(c),se];};
const f=(v)=>(v>=0?"+":"")+v.toFixed(3);
for (const p of ["/tmp/c80o-base-960.json","/tmp/c80o-'$T'-960.json"]) { const m=L(p);
  const row=m.filter(r=>r.a==="direct"||r.b==="direct").map(r=>r.a==="direct"?gd(r):-gd(r));
  const [db,dbs]=cell(m,"direct","block"),[gt,gts]=cell(m,"gegenpress","tikitaka"),[td,tds]=cell(m,"tikitaka","direct");
  const goals=m.reduce((a,r)=>a+r.gf+r.ga,0)/m.reduce((a,r)=>a+r.n,0)/2;
  console.log(p.split("/").pop(), "직선>블록", f(db),"±",dbs.toFixed(3), "| 게겐>티키", f(gt),"±",gts.toFixed(3), "| 티키>직선", f(td), "| 직선 행", f(row.reduce((a,b)=>a+b,0)/row.length), "| 팀당 득점", goals.toFixed(3)); }'
