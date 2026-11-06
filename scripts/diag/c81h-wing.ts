// @ts-nocheck — 진단 스크립트 (C.81h): quick 의 표준 표본(neutralJob, 4-2-3-1 균형 75:75)만 n 경기 돌려 득점 · 롱패스 비율 · 포지션별 골 비중 · 리바운드 골 경로를 출력.
// 실행: npx vite-node scripts/diag/c81h-wing.ts -- [경기수=600] [경로=값 …]
import type { MatchOut } from '../engine/job';
import { runJobs } from '../engine/pool';
import { neutralJob } from '../engine/suite';
const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides = {}; let n = 600;
for (const a of all) { if (a.includes('=')) { const [k, v] = a.split('='); overrides[k] = Number(v); } else if (/^\d+$/.test(a)) n = Number(a); }
const jobs = []; for (let i = 0; i < n; i++) jobs.push(neutralJob(i, Object.keys(overrides).length ? { overrides } : {}));
const outs = await runJobs<MatchOut>(jobs, { label: `c81h ${n}경기` });
const grp = (p) => (p === 'ST' || p === 'CF' ? 'ST' : ['LW', 'RW', 'LM', 'RM'].includes(p) ? 'WING' : ['CDM', 'CM', 'CAM'].includes(p) ? 'MID' : p === 'GK' ? 'GK' : 'DEF');
let goals = 0, passes = 0, longP = 0, longC = 0; const gp = [0, 0, 0, 0, 0, 0, 0]; const by = { ST: 0, WING: 0, MID: 0, DEF: 0, GK: 0 }; const sh = { ST: 0, WING: 0, MID: 0, DEF: 0, GK: 0 };
for (const m of outs) {
  for (const t of m.team) { goals += t.goals; passes += t.passes; longP += t.longPasses; longC += t.longCompleted; t.goalPaths.forEach((v, i) => (gp[i] += v)); }
  for (const p of m.players) { by[grp(p.position)] += p.goals; sh[grp(p.position)] += p.shots; }
}
const tot = Object.values(by).reduce((a, b) => a + b, 0), stot = Object.values(sh).reduce((a, b) => a + b, 0), gs = gp.reduce((a, b) => a + b, 0);
const pc = (a, b) => (100 * a / Math.max(1, b)).toFixed(1);
console.log(`\n[c81h] ${n}경기 덮어쓰기 ${JSON.stringify(overrides)}`);
console.log(`득점/팀 ${(goals / outs.length / 2).toFixed(3)} · 롱패스 비율 ${pc(longP, passes)}% (성공 ${pc(longC, longP)}%)`);
console.log(`득점 비율 ST ${pc(by.ST, tot)} / 윙어 ${pc(by.WING, tot)} / 미드 ${pc(by.MID, tot)} / 수비 ${pc(by.DEF, tot)} · 슈팅 비율 ST ${pc(sh.ST, stot)} / 윙어 ${pc(sh.WING, stot)} / 미드 ${pc(sh.MID, stot)} / 수비 ${pc(sh.DEF, stot)}`);
console.log(`골 경로 % 패스/몰고/코너/FK/PK/리바운드/그밖: ${gp.map((v) => pc(v, gs)).join(' / ')} (리바운드 ${gp[5]}골)`);
process.exit(0);
