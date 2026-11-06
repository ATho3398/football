// usage: node rep.cjs tag
const fs=require('fs');const tag=process.argv[2];
const files=[0,1,2,3].map(i=>`${process.argv[3]||'.'}/${tag}-${i}.json`).filter(f=>fs.existsSync(f));
const add=(a,b)=>{if(typeof b==='number')return (a||0)+b;if(Array.isArray(b))return b.map((v,i)=>add(a?.[i],v));const o={...(a||{})};for(const k in b)o[k]=add(a?.[k],b[k]);return o;};
let R=null;for(const f of files)R=add(R,JSON.parse(fs.readFileSync(f)));
const f1=(x)=>x.toFixed(1),f2=x=>x.toFixed(2),p=(a,b)=>(100*a/Math.max(1,b)).toFixed(0)+'%';
console.log(`[${tag}] 경기 ${R.matches} 골/경기 ${f2(R.goals/R.matches)}`);
console.log(`① 크로스·컷백 ${R.ev} (크로스 ${R.evCross} 컷백 ${R.evCut}) 박스 인원 ${f2(R.boxSum/R.ev)} (지표 ${f2(R.metricBox/R.ev)}) 착지 순간 ${f2(R.landBox/R.landN)}`);
console.log(`  인원 분포 0..6+: ${R.boxHist.map(v=>p(v,R.ev)).join(' ')}`);
console.log(`  크로스 지점 골라인까지 ${f1(R.crossGoalM/R.ev)} m, 중앙에서 ${f1(R.crossWide/R.ev)} m; 오프사이드 라인 골에서 ${f1(R.lineM/R.ev)} m (박스 밖 ${p(R.lineBeyondBox,R.ev)}) 분포<12/12-16.5/16.5-20/20-25/25-30/30+: ${R.lineHist.map(v=>p(v,R.ev)).join(' ')}`);
console.log(`  최종⅓ 진입 뒤 크로스까지 ${f1(R.sinceThird/(R.ev-R.notThird))} s (진입 기록 없음 ${p(R.notThird,R.ev)}); 침투 중 비율(최종⅓ 공·줄≥2) ${p(R.runOn,R.runSmp)}`);
for(const k of ['ST','W','CM','DM','FB','CB']){const G=R.grp[k];if(!G)continue;const roles=Object.entries(G.role).sort((a,b)=>b[1]-a[1]).map(([r,v])=>`${r} ${(v/R.ev).toFixed(2)}`).join(', ');
console.log(`  ${k}: 크로스당 ${f2(G.n/R.ev)}명 · 박스 안 ${f2(G.inBox/R.ev)} · 목표 박스·가는 중 ${f2(G.late/R.ev)}(남은 ${f1(G.lateD/Math.max(1,G.late))} m) · 라인 제한 ${f2(G.lineCap/R.ev)} · 역할 밖[${roles}]`);}
console.log(`② 슛 ${R.shots} 유효 ${R.onT} 선방 ${R.saves}(캐치 ${R.catch} 코너 ${R.saveCorner} 쳐냄-루즈 ${R.parryLoose}) 블록 ${R.blocks}(코너 ${R.blockCorner} 루즈 ${R.blockLoose})`);
for(const k of ['parry','block']){const E=R.ep[k];console.log(`  ${k} 루즈 ${E.n}: 첫 접촉 공격 ${p(E.attFirst,E.n)} 수비 ${p(E.defFirst,E.n)} GK ${p(E.gkFirst,E.n)} 밖/없음 ${p(E.out,E.n)} · 첫 접촉까지 ${f2(E.tFirst/E.n)} s · 공격 첫 접촉 골거리 ${f1(E.dFirstAtt/Math.max(1,E.nAttFirst))} m · 그 순간 공 골거리 ${f1(E.ballGoalM/E.n)} m · 가장 가까운 공격 ${f1(E.nearAtt/E.n)} m 수비 ${f1(E.nearDef/E.n)} m (공격이 더 가까움 ${p(E.attCloser,E.n)}) · 6 m 안 공격 ${f2(E.attIn6/E.n)} 수비 ${f2(E.defIn6/E.n)} · 5초 안 공격 슛 ${p(E.attShot5,E.n)}(${f1(E.tShot/Math.max(1,E.attShot5))} s, xG ${f2(E.xg/Math.max(1,E.attShot5))}) 골 ${p(E.attGoal5,E.n)}`);}
const gp=R.goalPathsSum,sp=R.shotPathsSum,gs=gp.reduce((a,b)=>a+b),ss=sp.reduce((a,b)=>a+b);
console.log(`  리바운드 경로: 슛 ${p(sp[5],ss)} 골 ${p(gp[5],gs)} (${gp[5]}골) · 골 경로 % ${gp.map(v=>(100*v/gs).toFixed(0)).join('/')}`);
