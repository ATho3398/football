// @ts-nocheck — 진단 스크립트 (엔진관리자26): ① 크로스·컷백 순간 박스 안 인원을 막는 고리 ② 슛 뒤 루즈볼(막힌 슛·쳐낸 공) 흐름.
// 엔진 상태는 읽기만 한다. 표준 경기(4-2-3-1 균형 75:75, 홈·원정 짝).
// 실행: npx vite-node scripts/diag/em26-box-rebound.ts -- [경기수=60] [seed=41000] [out=파일.json] [경로=값 …]
import { applyOverrides, buildTeam } from '../engine/job';
import { createMatch } from '../../src/engine/sim';
import { attackDir, inOppBox, toNorm, L, W } from '../../src/engine/pitch';
import { finalThirdJob, offsideLine } from '../../src/engine/offball';
import { ENGINE } from '../../src/engine/config';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2).filter((a) => a !== '--');
const ov: Record<string, number> = {};
let n = 60, seed0 = 41000, out = '', form = '4-2-3-1', tac = 'balanced';
for (const a of args) {
  if (a.startsWith('seed=')) seed0 = Number(a.slice(5));
  else if (a.startsWith('out=')) out = a.slice(4);
  else if (a.startsWith('form=')) form = a.slice(5);
  else if (a.startsWith('tac=')) tac = a.slice(4);
  else if (a.includes('=')) { const [k, v] = a.split('='); ov[k] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
}
const restore = applyOverrides(ov);
const O = ENGINE.offball;
const grpOf = (p: string) => (p === 'ST' || p === 'CF' ? 'ST' : ['LW', 'RW', 'LM', 'RM'].includes(p) ? 'W' : p === 'CM' || p === 'CAM' ? 'CM' : p === 'CDM' ? 'DM' : p === 'CB' ? 'CB' : 'FB');
const R: any = {
  matches: 0, goals: 0,
  // ① 크로스
  ev: 0, evCross: 0, evCut: 0, boxSum: 0, metricBox: 0, landBox: 0, landN: 0,
  crossGoalM: 0, crossWide: 0, lineM: 0, lineBeyondBox: 0, sinceThird: 0, notThird: 0,
  grp: {} as Record<string, any>,
  lineHist: [0, 0, 0, 0, 0, 0], // 라인 골에서 <12, 12-16.5, 16.5-20, 20-25, 25-30, 30+
  boxHist: [0, 0, 0, 0, 0, 0, 0],
  // 침투 빈도: 공격 소유 중 공이 최종 ⅓ 일 때 2선(줄≥2) 표본 중 running 비율
  runSmp: 0, runOn: 0,
  // ② 슛 뒤
  shots: 0, onT: 0, saves: 0, blocks: 0, catch: 0, saveCorner: 0, parryLoose: 0, blockCorner: 0, blockLoose: 0,
  ep: { parry: newEp(), block: newEp() },
  path5Shots: 0, path5Goals: 0, shotPathsSum: [0, 0, 0, 0, 0, 0, 0], goalPathsSum: [0, 0, 0, 0, 0, 0, 0],
};
function newEp() {
  return { n: 0, attFirst: 0, defFirst: 0, gkFirst: 0, out: 0, tFirst: 0, dFirstAtt: 0, nAttFirst: 0, attShot5: 0, attGoal5: 0, tShot: 0, xg: 0,
    nearAtt: 0, nearDef: 0, attIn6: 0, defIn6: 0, ballGoalM: 0, attCloser: 0, firstHist: [0, 0, 0, 0] };
}
function g(k: string) { return (R.grp[k] ??= { n: 0, inBox: 0, tgtIn: 0, late: 0, lateD: 0, lineCap: 0, role: {} as Record<string, number>, running: 0 }); }

for (let k = 0; k < n; k++) {
  const seed = seed0 + Math.floor(k / 2); const flip = k % 2 === 1;
  const A = { id: `v${flip ? 'b' : 'a'}${seed}`, rating: 75, seed: `eng-${flip ? 'b' : 'a'}-75-${seed}`, formation: form, tactics: tac };
  const B = { id: `v${flip ? 'a' : 'b'}${seed}`, rating: 75, seed: `eng-${flip ? 'a' : 'b'}-75-${seed}`, formation: form, tactics: 'balanced' };
  const ws = `w${seed}`;
  const sim = createMatch({ home: buildTeam(A, 75, ws), away: buildTeam(B, 75, ws), mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  const s = sim.state;
  const thirdT = [-1, -1];
  let land: { fl: any; team: number } | null = null;
  const eps: any[] = [];
  while (!s.done) {
    const pre = s.agents.map((a) => ({ x: a.x, y: a.y, tx: a.tx, ty: a.ty, run: s.t < a.runUntil }));
    const bc = [s.teams[0].stats.boxCrossN, s.teams[1].stats.boxCrossN];
    const ba = [s.teams[0].stats.boxAtCross, s.teams[1].stats.boxAtCross];
    const cut = [s.teams[0].stats.cutbacks, s.teams[1].stats.cutbacks];
    const owner0 = s.ball.owner;
    const evLen = s.events.length;
    const t0 = s.t;
    sim.step();
    // 최종 ⅓ 진입 시각 (팀 소유 + 공 nx ≥ lateRunFromX)
    for (const tm of [0, 1]) {
      const own = s.ball.owner >= 0 && s.agents[s.ball.owner].team === tm;
      const bnx = toNorm(s.ball.x, s.ball.y, attackDir(tm, s.half))[0];
      if (s.possTeam !== tm || s.restart) thirdT[tm] = -1;
      else if (own && bnx >= O.lateRunFromX && thirdT[tm] < 0) thirdT[tm] = s.t;
      if (own && bnx >= O.lateRunFromX && !s.restart) for (const a of s.agents) if (a.onPitch && a.team === tm && a.line >= 2 && a.idx !== s.ball.owner) { R.runSmp++; if (s.t < a.runUntil) R.runOn++; }
    }
    // 크로스 착지 순간 박스 인원
    if (land && s.ball.flight !== land.fl) {
      const dir = attackDir(land.team, s.half);
      let c = 0; for (const a of s.agents) if (a.onPitch && a.team === land.team && a.line !== 0 && inOppBox(a.x, a.y, dir)) c++;
      R.landBox += c; R.landN++; land = null;
    }
    for (const tm of [0, 1]) {
      if (s.teams[tm].stats.boxCrossN === bc[tm]) continue;
      const crosser = s.agents[owner0];
      if (!crosser || crosser.team !== tm) continue;
      const isCut = s.teams[tm].stats.cutbacks > cut[tm];
      R.ev++; if (isCut) R.evCut++; else R.evCross++;
      R.metricBox += s.teams[tm].stats.boxAtCross - ba[tm];
      const dir = attackDir(tm, s.half);
      const [cnx, cny] = toNorm(pre[owner0].x, pre[owner0].y, dir);
      R.crossGoalM += (1 - cnx) * L; R.crossWide += Math.abs(cny - 0.5) * W;
      const line = offsideLine(s, tm); const lineM = (1 - line) * L;
      R.lineM += lineM; if (lineM > 16.5) R.lineBeyondBox++;
      R.lineHist[lineM < 12 ? 0 : lineM < 16.5 ? 1 : lineM < 20 ? 2 : lineM < 25 ? 3 : lineM < 30 ? 4 : 5]++;
      if (thirdT[tm] >= 0) R.sinceThird += t0 - thirdT[tm]; else R.notThird++;
      let box = 0;
      for (const a of s.agents) {
        if (!a.onPitch || a.team !== tm || a.idx === owner0 || a.line === 0) continue;
        const p = pre[a.idx]; const G = g(grpOf(a.pos)); G.n++;
        const inB = inOppBox(p.x, p.y, dir);
        if (p.run) G.running++;
        if (inB) { G.inBox++; box++; continue; }
        const tIn = inOppBox(p.tx, p.ty, dir);
        const [tnx] = toNorm(p.tx, p.ty, dir);
        if (tIn) { G.tgtIn++; G.late++; G.lateD += Math.hypot(p.tx - p.x, p.ty - p.y); continue; }
        // 목표가 라인에 붙어 있고 라인이 박스 밖이면 라인 제한
        if (lineM > 16.5 && Math.abs(tnx - line) * L < 2.0) { G.lineCap++; continue; }
        let job = 'none';
        try { job = finalThirdJob(s, a, crosser) ?? 'none'; } catch { job = 'err'; }
        const key = (p.run ? 'run:' : '') + job;
        G.role[key] = (G.role[key] ?? 0) + 1;
      }
      R.boxSum += box; R.boxHist[Math.min(6, box)]++;
      if (s.ball.flight && s.ball.flight.passer === owner0) land = { fl: s.ball.flight, team: tm };
    }
    // ② 슛 이벤트
    for (let i = evLen; i < s.events.length; i++) {
      const e = s.events[i];
      if (e.type === 'shot') { R.shots++; if (e.params?.onTarget) R.onT++; for (const ep of eps) if (e.team === ep.att && ep.half === s.half && s.t >= ep.t0 && s.t - ep.t0 <= 5 && !ep.shot) { ep.shot = true; ep.tShot = s.t - ep.t0; ep.xg = e.params?.xg ?? 0; } }
      if (e.type === 'goal') { R.goals++; for (const ep of eps) if (e.team === ep.att && ep.half === s.half && s.t >= ep.t0 && s.t - ep.t0 <= 6 && ep.shot && !ep.goal) ep.goal = true; }
      if (e.type === 'save' || e.type === 'block') {
        const att = e.type === 'save' ? 1 - e.team : e.team;
        const kind = e.type === 'save' ? 'parry' : 'block';
        if (e.type === 'save') R.saves++; else R.blocks++;
        const gkIdx = s.agents.findIndex((a) => a.onPitch && a.team === 1 - att && a.line === 0);
        if (s.ball.owner >= 0 || (s.ball.reserve && s.ball.reserve.kind === 'claim')) { if (e.type === 'save') R.catch++; else R.blockGk = (R.blockGk ?? 0) + 1; continue; }
        if (s.restart) { if (e.type === 'save') R.saveCorner++; else R.blockCorner++; continue; }
        if (e.type === 'save') R.parryLoose++; else R.blockLoose++;
        const dir = attackDir(att, s.half);
        const gx = dir > 0 ? L : 0;
        let nA = 99, nD = 99, aIn6 = 0, dIn6 = 0;
        for (const a of s.agents) {
          if (!a.onPitch) continue;
          const d = Math.hypot(a.x - s.ball.x, a.y - s.ball.y);
          if (a.team === att) { if (a.line !== 0) nA = Math.min(nA, d); } else if (a.line !== 0) nD = Math.min(nD, d);
          if (d < 6 && a.line !== 0) { if (a.team === att) aIn6++; else dIn6++; }
        }
        eps.push({ kind, att, half: s.half, t0: s.t, nA, nD, aIn6, dIn6, gk: gkIdx, gkD: gkIdx >= 0 ? Math.hypot(s.agents[gkIdx].x - s.ball.x, s.agents[gkIdx].y - s.ball.y) : 99, ballGoal: Math.hypot(s.ball.x - gx, s.ball.y - W / 2), first: -1, shot: false, goal: false });
      }
    }
    // 루즈볼 첫 접촉
    for (const ep of eps) {
      if (ep.first >= 0) continue;
      if (s.ball.owner >= 0) {
        const o = s.agents[s.ball.owner];
        ep.first = o.team === ep.att ? 1 : o.idx === ep.gk ? 3 : 2; ep.tF = s.t - ep.t0;
        const dir = attackDir(ep.att, s.half);
        ep.dF = Math.hypot(o.x - (dir > 0 ? L : 0), o.y - W / 2);
      } else if (s.restart) { ep.first = 0; ep.tF = s.t - ep.t0; }
      else if (s.t - ep.t0 > 8) { ep.first = 0; ep.tF = 8; }
    }
  }
  for (const ep of eps) {
    const E = R.ep[ep.kind]; E.n++;
    E.nearAtt += ep.nA; E.nearDef += ep.nD; E.attIn6 += ep.aIn6; E.defIn6 += ep.dIn6; E.ballGoalM += ep.ballGoal; if (ep.nA < ep.nD) E.attCloser++;
    if (ep.first === 1) { E.attFirst++; E.dFirstAtt += ep.dF; E.nAttFirst++; } else if (ep.first === 2) E.defFirst++; else if (ep.first === 3) { E.gkFirst++; E.gkT = (E.gkT ?? 0) + ep.tF; E.gkTh = E.gkTh ?? [0,0,0,0,0]; E.gkTh[Math.min(4, Math.floor(ep.tF / 0.5))]++; } else E.out++;
    E.gkD = (E.gkD ?? 0) + ep.gkD;
    E.tFirst += ep.tF ?? 0; E.firstHist[Math.max(0, ep.first)]++;
    if (ep.shot) { E.attShot5++; E.tShot += ep.tShot; E.xg += ep.xg; }
    if (ep.goal) E.attGoal5++;
  }
  for (const tm of [0, 1]) for (let j = 0; j < 7; j++) { R.shotPathsSum[j] += s.teams[tm].stats.shotPaths[j]; R.goalPathsSum[j] += s.teams[tm].stats.goalPaths[j]; }
  R.matches++;
}
restore();
const txt = JSON.stringify(R);
if (out) writeFileSync(out, txt); else console.log(txt);
