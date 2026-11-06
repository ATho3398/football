// C.80p: c80p-td json 샤드 합 → 표. node c80p-sum.cjs a.json b.json …
const fs=require('fs');const xs=process.argv.slice(2).map(f=>JSON.parse(fs.readFileSync(f)));
const n=xs.reduce((a,x)=>a+x.n,0);const add=(a,b)=>{for(const k in b){if(typeof b[k]==='number')a[k]=(a[k]||0)+b[k];else if(Array.isArray(b[k]))a[k]=b[k].map((v,i)=>v+((a[k]||[])[i]||0));else{a[k]=a[k]||{};add(a[k],b[k]);}}};
const R=[{},{}];for(const x of xs)for(const i of [0,1])add(R[i],x.R[i]);
const f=(v,d=2)=>(v/n).toFixed(d);
console.log(`${xs[0].A} 대 ${xs[0].B} ${n}경기 덮어쓰기 ${JSON.stringify(xs[0].overrides)}`);
for(const i of [0,1]){const r=R[i];const tp=R[0].poss+R[1].poss;const nm=i?xs[0].B:xs[0].A;
console.log(`[${nm}] 득 ${f(r.g)} · 슛 ${f(r.sh,1)} · xG ${f(r.xg)} · xG/슛 ${(r.xg/r.sh).toFixed(3)} · 점유 ${(100*r.poss/tp).toFixed(1)}% · 상대진영 소유 ${(100*r.oppHalfT/r.poss).toFixed(0)}% · 마지막⅓ ${(100*r.finalThirdT/r.poss).toFixed(0)}% · 패스 ${f(r.passes,0)} · 30m+ ${f(r.longs,1)} · 사슬 ${f(r.chains,0)}`);
console.log(`   재개 ${Object.entries(r.rs||{}).map(([k,v])=>k+" "+f(v,1)).join(" · ")}`);console.log(`   오픈 상실 자기/중간/상대 ⅓: ${r.loss.map(v=>f(v,1)).join(' / ')} · 그 뒤 15초 상대 슛 ${r.lossSh.map(v=>f(v)).join(' / ')} · 골 ${r.lossG.map(v=>f(v,3)).join(' / ')} · xG ${r.lossXg.map(v=>f(v,3)).join(' / ')}`);
const g={};for(const[k,c]of Object.entries(r.cls)){const kk=process.env.COARSE?k.replace(/\|(fast|slow)/,'').replace(/\+sw/,''):k;g[kk]=g[kk]||{sh:0,xg:0,g:0};g[kk].sh+=c.sh;g[kk].xg+=c.xg;g[kk].g+=c.g;}
for(const[k,c]of Object.entries(g).sort((p,q)=>q[1].g-p[1].g))console.log(`   ${k.padEnd(34)} 슛 ${f(c.sh)} · xG ${f(c.xg,3)} · 골 ${f(c.g,3)}`);}
