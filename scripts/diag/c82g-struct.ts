// @ts-nocheck — 진단 스크립트 (C.82g): 전환 구조 — 공 앞 인원·높은 라인 뒤 침투. 엔진 상태는 읽기만 한다.
// (A) 공격 국면 스냅샷(1초마다, 우리 소유·공 상대 ⅓): 줄별 공 앞 인원, 상대 라인까지 공간, 라인 2 m 안 인원, 침투 중 인원
// (B) 상대 ⅓ 오픈 상실: 공 뒤 인원(줄별)·잃은 팀 라인 높이·잃을 때 선수 목표가 공 뒤인지 → 3초 안 탈취 팀 첫 행동(전진 m·침투·롱), 잃은 팀 라인 뒤로 들어간 탈취 팀 선수 수,
//     잃은 팀 라인 하강 속도(1·2·3 s), 탈취 팀 침투 런(runUntil) 수, 같은 소유 15 s 슛·xG
// 실행: npx vite-node scripts/diag/c82g-struct.ts -- [경기수=50] [seed=41000] [tac=gegenpress] [vs=balanced] [out=파일.json] [경로=값 …]
import { applyOverrides, buildTeam } from '../engine/job';
import { createMatch } from '../../src/engine/sim';
import { attackDir, toNorm, L, W } from '../../src/engine/pitch';
import { offsideLine } from '../../src/engine/offball';
import { candidates } from '../../src/engine/onball';
let dumpN = Number(process.env.DUMP ?? 0);
import { tacticsOf } from '../../src/engine/tactics';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2).filter((a) => a !== '--');
const ov: Record<string, number> = {};
let n = 50, seed0 = 41000, out = '', tac = 'gegenpress', vs = 'balanced', lh = -1;
for (const a of args) {
  if (a.startsWith('seed=')) seed0 = Number(a.slice(5));
  else if (a.startsWith('out=')) out = a.slice(4);
  else if (a.startsWith('tac=')) tac = a.slice(4);
  else if (a.startsWith('vs=')) vs = a.slice(3);
  else if (a.startsWith('lh=')) lh = Number(a.slice(3));
  else if (a.includes('=')) { const [k, v] = a.split('='); ov[k] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
}
const restore = applyOverrides(ov);
const WIN = 15;
const side = () => ({
  // (A)
  snapN: 0, aheadL1: 0, aheadL2: 0, aheadL3: 0, level3: 0, space: 0, nearLine: 0, running: 0, ballX: 0, bandN: [0, 0, 0, 0], bandAhead: [0, 0, 0, 0], defLine: 0,
  // (B)
  n: 0, behind: 0, behindL1: 0, behindL2: 0, behindL3: 0, ahead: 0, tgtAhead: 0, lossX: 0, lineAtLoss: 0, lineD1: 0, lineD2: 0, lineD3: 0, lineN3: 0,
  fpN: 0, fpT: 0, fpGain: 0, fpThr: 0, fpLong: 0, fpOk: 0, fpFwd: 0, fpBehindLine: 0, runners3: 0, beyond3: 0, beyondMax: 0, oppAheadAtLoss: 0,
  shot15: 0, xg15: 0, ballGain3: 0, numUp3: 0,
  posLoss: {}, posSnap: {},
  lossBandN: [0, 0, 0, 0], lossBandBehind: [0, 0, 0, 0], lossBandShot: [0, 0, 0, 0], lossGk: 0, lossGkBehind: 0, lossWide: 0, lossWideBehind: 0,
  // C.82j: 70~87 m·GK 제외 상실 순간 공과 잃은 팀 기준 오프사이드 라인(상대 뒤에서 둘째) 거리 — 라인 2 m 안(라인에서 가로채임) 수, 라인 뒤 x 차 합, 잃은 선수 포지션별 수
  lossLineN: 0, lossAtLine: 0, lossLineD: 0, loserPos: {}, posLossSust: {}, lossSustN: 0, posLossLate: {}, lossLateN: 0, lossEnterDt: 0,
  // 라인 뒤 수신 (탈취 팀이 15 s 창 안 잃은 팀 라인 뒤에서 받음)
  rbN: 0, rbT: 0, rbL3: 0, rbBack: 0, rbFirst: { shot: 0, pass: 0, through: 0, carry: 0, lost: 0, none: 0 }, rbFirstT: 0, rbPassFwd: 0, rbMateShot3: 0, rbD: 0, rbGap: 0, rbGoalSide: 0, rbShot6: 0, rbXg6: 0, rbLost6: 0, rbPass6: 0, rbMinGap: 0, rbDribble: 0,
  // 득실·전체 전환
  shotsAgainst: 0, xgAgainst: 0, transShots: 0, transXg: 0, goalsAgainst: 0,
});
const R: any = { matches: 0, tac, vs, ov, me: side(), op: side() };

for (let k = 0; k < n; k++) {
  const seed = seed0 + k;
  const meHome = k % 2 === 1;
  const A = { id: `va${seed}`, rating: 75, seed: `eng-a-75-${seed}`, formation: '4-4-2', tactics: tacticsOf(tac, lh >= 0 ? { lineHeight: lh } : undefined) };
  const B = { id: `vb${seed}`, rating: 75, seed: `eng-b-75-${seed}`, formation: '4-4-2', tactics: tacticsOf(vs) };
  const ws = `w${seed}`;
  const home = meHome ? A : B, away = meHome ? B : A;
  const sim = createMatch({ home: buildTeam(home, 75, ws), away: buildTeam(away, 75, ws), mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  const s = sim.state;
  const meT = meHome ? 0 : 1;
  let prevPoss = s.possTeam;
  let evN = s.events.length;
  let ep: any = null;
  let nextSnap = 0;
  let lastOwn = -1;
  let possSince0 = 0;
  let enterT = -1; // C.82j: 지금 소유에서 공이 상대 ⅓ 에 처음 들어간 시각
  while (!s.done) {
    if (s.ball.owner >= 0) lastOwn = s.ball.owner;
    possSince0 = s.possSince;
    sim.step();
    if (s.possTeam === prevPoss && enterT < 0 && s.possTeam >= 0 && toNorm(s.ball.x, s.ball.y, attackDir(s.possTeam, s.half))[0] >= 2 / 3) enterT = s.t;
    const t = s.t;
    const shots: any[] = [];
    for (; evN < s.events.length; evN++) {
      const e = s.events[evN];
      if (e.type === 'shot') { shots.push(e); const S = e.team === meT ? R.op : R.me; S.shotsAgainst++; S.xgAgainst += e.params?.xg ?? 0; }
      if (e.type === 'goal') (e.team === meT ? R.op : R.me).goalsAgainst++;
    }
    // (A) 공격 스냅샷
    if (t >= nextSnap) {
      nextSnap = t + 1;
      if (!s.restart && s.possTeam >= 0 && s.ball.owner >= 0 && s.agents[s.ball.owner].team === s.possTeam) {
        const team = s.possTeam;
        const dir = attackDir(team, s.half);
        const [bnx] = toNorm(s.ball.x, s.ball.y, dir);
        if (bnx >= 2 / 3) {
          const S = team === meT ? R.me : R.op;
          const line = offsideLine(s, team);
          S.snapN++; S.space += (line - bnx) * L; S.ballX += bnx * L;
          S.defLine += (1 - offsideLine(s, 1 - team)) * L;
          const band = Math.min(3, Math.floor((bnx - 2 / 3) * 12)); // 2/3~1 을 4구간(약 8.75 m)
          S.bandN[band]++;
          for (const a of s.agents) {
            if (!a.onPitch || a.line === 0 || a.team !== team || a.idx === s.ball.owner) continue;
            const [ax] = toNorm(a.x, a.y, dir);
            if (band <= 1) { const P = (S.posSnap[a.pos] ??= [0, 0, 0, 0]); P[0]++; if (ax > bnx) P[1]++; P[2] += (ax - bnx) * L; if (t < a.runUntil) P[3]++; }
            if (ax > bnx) { S[`aheadL${a.line}`]++; S.bandAhead[band]++; }
            if (a.line === 3 && Math.abs(ax - bnx) * L <= 3) S.level3++;
            if ((line - ax) * L <= 2 && ax > bnx) S.nearLine++;
            if (t < a.runUntil) S.running++;
          }
        }
      }
    }
    // (B) 에피소드 추적
    if (ep) {
      const dt = t - ep.t0;
      const S = ep.loser === meT ? R.me : R.op;
      const dirW = attackDir(ep.opp, s.half);
      const lineW = offsideLine(s, ep.opp); // 잃은 팀 라인 (탈취 팀 공격 방향 정규화)
      if (dt <= 3.05) {
        for (const m of [1, 2, 3]) if (!ep[`l${m}`] && dt >= m) { ep[`l${m}`] = true; ep[`lineD${m}`] = (ep.lineW0 - lineW) * L; }
        let beyond = 0, runners = 0;
        for (const a of s.agents) {
          if (!a.onPitch || a.line === 0 || a.team !== ep.opp) continue;
          const [ax] = toNorm(a.x, a.y, dirW);
          if (ax > ep.lineW0 - 0.5 / L) beyond++;
          if (t < a.runUntil && a.idx !== s.ball.owner) runners++;
        }
        if (beyond > ep.beyondMax) ep.beyondMax = beyond;
        if (runners > ep.runnersMax) ep.runnersMax = runners;
        if (!ep.g3 && dt >= 3) { ep.g3 = true; const [bx] = toNorm(s.ball.x, s.ball.y, dirW); ep.ballGain3 = (bx - ep.bxW0) * L;
          let behindW = 0, aheadLoser = 0; for (const a of s.agents) { if (!a.onPitch || a.line === 0) continue; const [ax] = toNorm(a.x, a.y, dirW); if (a.team === ep.opp && ax > bx) behindW++; if (a.team === ep.loser && ax > bx) aheadLoser++; } ep.numUp3 = behindW >= aheadLoser ? 1 : 0; }
        // 첫 패스
        if (!ep.fp) {
          const fl = s.ball.flight;
          if (fl && fl.kind !== 'shot' && fl.t0 >= ep.t0 && s.agents[fl.passer]?.team === ep.opp) {
            const [fx] = toNorm(fl.toX, fl.toY, dirW);
            const [px] = toNorm(s.agents[fl.passer].x, s.agents[fl.passer].y, dirW);
            ep.fp = { t: dt, gain: (fx - px) * L, thr: !!fl.through, long: fl.kind === 'long' || fl.kind === 'clear', ok: fl.outcome === 'receive', fwd: fx > px, behindLine: fx > ep.lineW0 };
          }
        }
      }
      // 라인 뒤 수신: 탈취 팀 필드 선수가 공을 잡았고(owner), 그 위치가 잃은 팀 라인(그 순간 offsideLine) 뒤(골 쪽)면 1회 기록, 6 s 추적
      if (!ep.rb && dt <= WIN && s.ball.owner >= 0) {
        const o = s.agents[s.ball.owner];
        if (o.team === ep.opp && o.line > 0 && o.idx !== ep.winner) {
          const [ox] = toNorm(o.x, o.y, dirW);
          // 잃은 팀 필드 선수 중 골 쪽(o 보다 앞) 인원
          let goalSide = 0, gap = 99;
          for (const a of s.agents) { if (!a.onPitch || a.team !== ep.loser || a.line === 0) continue; const [ax] = toNorm(a.x, a.y, dirW); if (ax > ox) goalSide++; const d = Math.hypot(a.x - o.x, a.y - o.y); if (d < gap) gap = d; }
          if (goalSide <= 1 && ox > 0.6 && dumpN > 0) {
            dumpN--; ep.dumpIdx = o.idx; ep.dumpNext = dt + 0.5; ep.dumpUntil = dt + 5;
            const cs = candidates(s, o).slice().sort((p, q) => q.u - p.u).slice(0, 6);
            const gxw = toNorm(o.x, o.y, dirW)[0];
            console.error(`[rb] 경기${seed} t=${t.toFixed(1)} 잃은 뒤 ${dt.toFixed(1)}s ${o.pos} 골까지 ${((1 - gxw) * L).toFixed(1)}m 골쪽수비 ${goalSide} 최근접 ${gap.toFixed(1)}m 등지고 ${o.backToGoal} 속도 ${Math.hypot(o.vx ?? 0, o.vy ?? 0).toFixed(1)} | ` + cs.map((c) => `${c.type}${c.receiver >= 0 ? '→' + s.agents[c.receiver].pos : ''} u=${c.u.toFixed(3)} p=${c.p.toFixed(2)} v=${c.value.toFixed(3)} d=${((1 - toNorm(c.x, c.y, dirW)[0]) * L).toFixed(0)}`).join(' · '));
          }
          if (goalSide <= 1 && ox > 0.6) ep.rb = { idx: o.idx, t: dt, d: (1 - ox) * L, gap, goalSide, minGap: gap, shot: false, xg: 0, lost: false, pass: false, dribble: 0, x0: ox, l3: o.line === 3, back: !!o.backToGoal, first: null, firstT: 0, passFwd: false, passT: -1, passTo: -1, mateShot: false };
        }
      }
      if (ep.dumpIdx >= 0 && dt >= ep.dumpNext && dt <= ep.dumpUntil) {
        ep.dumpNext = dt + 0.5;
        const o = s.agents[ep.dumpIdx];
        if (s.ball.owner === o.idx) {
          const cs = candidates(s, o).slice().sort((p, q) => q.u - p.u).slice(0, 5);
          const gxw = toNorm(o.x, o.y, dirW)[0];
          let goalSide = 0, gap = 99; for (const a of s.agents) { if (!a.onPitch || a.team !== ep.loser || a.line === 0) continue; const [ax] = toNorm(a.x, a.y, dirW); if (ax > gxw) goalSide++; const d = Math.hypot(a.x - o.x, a.y - o.y); if (d < gap) gap = d; }
          console.error(`   +${(dt - ep.rb?.t ?? 0).toFixed(1)}s 골까지 ${((1 - gxw) * L).toFixed(1)}m 골쪽수비 ${goalSide} 최근접 ${gap.toFixed(1)}m 등지고 ${o.backToGoal} 속도 ${Math.hypot(o.vx, o.vy).toFixed(1)} 쿨다운 ${o.cooldown.toFixed(2)} | ` + cs.map((c) => `${c.type}${c.receiver >= 0 ? '→' + s.agents[c.receiver].pos : ''} u=${c.u.toFixed(3)} p=${c.p.toFixed(2)} v=${c.value.toFixed(3)} d=${((1 - toNorm(c.x, c.y, dirW)[0]) * L).toFixed(0)}`).join(' · '));
        } else { console.error(`   +${(dt - (ep.rb?.t ?? 0)).toFixed(1)}s 공 주인 ${s.ball.owner >= 0 ? s.agents[s.ball.owner].pos + (s.agents[s.ball.owner].team === ep.opp ? '(동료)' : '(상대)') : '없음/비행'}`); ep.dumpIdx = -1; }
      }
      if (ep.rb && !ep.rb.done) {
        const r = ep.rb;
        if (dt - r.t > 6 || s.possTeam !== ep.opp) r.done = true;
        else {
          const o = s.agents[r.idx];
          if (r.first === null && s.ball.owner === r.idx) { const [ox] = toNorm(o.x, o.y, dirW); if ((ox - r.x0) * L >= 4) { r.first = 'carry'; r.firstT = dt - r.t; } }
          if (s.ball.owner === r.idx) { let gap = 99; for (const a of s.agents) { if (!a.onPitch || a.team !== ep.loser || a.line === 0) continue; const d = Math.hypot(a.x - o.x, a.y - o.y); if (d < gap) gap = d; } if (gap < r.minGap) r.minGap = gap; const [ox] = toNorm(o.x, o.y, dirW); r.dribble = Math.max(r.dribble, (ox - r.x0) * L); }
          else if (s.ball.owner >= 0 && s.agents[s.ball.owner].team === ep.loser) { r.lost = true; if (r.first === null) { r.first = 'lost'; r.firstT = dt - r.t; } if (r.passT < 0) r.done = true; }
          else if (s.ball.flight && s.ball.flight.passer === r.idx && s.ball.flight.kind !== 'shot' && !r.pass) { r.pass = true; const fl = s.ball.flight; const [fx] = toNorm(fl.toX, fl.toY, dirW); const [px] = toNorm(o.x, o.y, dirW); r.passFwd = fx > px + 3 / L; r.passT = dt; r.passTo = fl.receiver; if (r.first === null) { r.first = fl.through ? 'through' : 'pass'; r.firstT = dt - r.t; } }
          if (r.pass && r.passT >= 0 && dt - r.passT > 3) r.done = true;
          for (const e of shots) if (e.team === ep.opp && e.players?.[0] === o.id) { r.shot = true; r.xg += e.params?.xg ?? 0; if (r.first === null) { r.first = 'shot'; r.firstT = dt - r.t; } r.done = true; }
          if (r.pass && r.passT >= 0) for (const e of shots) if (e.team === ep.opp && e.players?.[0] !== o.id) r.mateShot = true;
        }
      }
      for (const e of shots) if (e.team === ep.opp && s.possTeam === ep.opp && dt <= WIN) { ep.shot15 = true; ep.xg15 += e.params?.xg ?? 0; }
      const closed = s.half !== ep.half || (s.possTeam !== ep.opp && s.possTeam >= 0) || dt > WIN;
      if (closed) {
        S.n++; S.lossBandN[ep.band]++; S.lossBandBehind[ep.band] += ep.behind; if (ep.shot15) S.lossBandShot[ep.band]++; if (ep.gk) { S.lossGk++; S.lossGkBehind += ep.behind; } if (ep.wide) { S.lossWide++; S.lossWideBehind += ep.behind; }
        if (ep.rb) { const r = ep.rb; S.rbN++; S.rbT += r.t; if (r.l3) S.rbL3++; if (r.back) S.rbBack++; S.rbFirst[r.first ?? 'none']++; if (r.first) S.rbFirstT += r.firstT; if (r.passFwd) S.rbPassFwd++; if (r.mateShot) S.rbMateShot3++; S.rbD += r.d; S.rbGap += r.gap; S.rbGoalSide += r.goalSide; if (r.shot) { S.rbShot6++; S.rbXg6 += r.xg; } if (r.lost) S.rbLost6++; if (r.pass) S.rbPass6++; S.rbMinGap += r.minGap; S.rbDribble += r.dribble; }
        S.behind += ep.behind; S.behindL1 += ep.bl[1]; S.behindL2 += ep.bl[2]; S.behindL3 += ep.bl[3]; S.ahead += ep.ahead; S.tgtAhead += ep.tgtAhead; S.lossX += ep.lossX;
        S.lineAtLoss += ep.lineAtLoss; S.oppAheadAtLoss += ep.oppAhead;
        if (ep.l3) { S.lineN3++; S.lineD1 += ep.lineD1; S.lineD2 += ep.lineD2; S.lineD3 += ep.lineD3; }
        if (ep.fp) { S.fpN++; S.fpT += ep.fp.t; S.fpGain += ep.fp.gain; if (ep.fp.thr) S.fpThr++; if (ep.fp.long) S.fpLong++; if (ep.fp.ok) S.fpOk++; if (ep.fp.fwd) S.fpFwd++; if (ep.fp.behindLine) S.fpBehindLine++; }
        S.runners3 += ep.runnersMax; S.beyond3 += ep.beyondMax; if (ep.beyondMax > 0) S.beyondMax++;
        if (ep.g3) { S.ballGain3 += ep.ballGain3; S.numUp3 += ep.numUp3; }
        if (ep.shot15) { S.shot15++; S.xg15 += ep.xg15; }
        ep = null;
      }
    }
    if (s.possTeam !== prevPoss) {
      if (!s.restart && s.possOrigin === 'open' && prevPoss >= 0 && s.possTeam >= 0) {
        const loser = prevPoss, opp = s.possTeam;
        const dir = attackDir(loser, s.half);
        const [bnx] = toNorm(s.ball.x, s.ball.y, dir);
        // 전환 슛 집계 (경기당, 전 구역)
        if (!ep && bnx >= 2 / 3) {
          const dirW = attackDir(opp, s.half);
          let behind = 0, ahead = 0, tgtAhead = 0, oppAhead = 0; const bl = [0, 0, 0, 0];
          for (const a of s.agents) {
            if (!a.onPitch || a.line === 0) continue;
            const [ax] = toNorm(a.x, a.y, dir);
            if (a.team === loser) {
              if (ax < bnx) { behind++; bl[a.line]++; } else ahead++;
              const [tx] = toNorm(a.tx, a.ty, dir); if (tx >= bnx) tgtAhead++;
            } else if (ax < bnx) oppAhead++;
          }
          const lineW0 = offsideLine(s, opp);
          const [bxW0] = toNorm(s.ball.x, s.ball.y, dirW);
          const band = Math.min(3, Math.floor((bnx - 2 / 3) * 12));
          const gk = s.ball.owner >= 0 && s.agents[s.ball.owner].line === 0;
          const [, bny] = toNorm(s.ball.x, s.ball.y, dir);
          const wide = Math.abs(bny - 0.5) >= 0.2;
          const winner = s.ball.owner;
          if (band <= 1 && !gk) {
            const S0 = loser === meT ? R.me : R.op;
            { const lineL = offsideLine(s, loser); S0.lossLineN++; S0.lossLineD += (lineL - bnx) * L; if ((lineL - bnx) * L <= 2) S0.lossAtLine++;
              const lp = s.lastPass; const lo = lp && s.t - lp.t < 1.5 ? s.agents[lp.passer] : null; const key = lastOwn >= 0 && s.agents[lastOwn].team === loser ? s.agents[lastOwn].pos + (lo && lo.team === loser && lo.idx === lastOwn ? '패스' : '') : '?'; S0.loserPos[key] = (S0.loserPos[key] ?? 0) + 1; }
            const sust = t - possSince0 >= 6; // C.82j: 지속 공격(소유 6 s 이상) 분리
            if (sust) S0.lossSustN++;
            const late = enterT >= 0 && t - enterT >= 3; // C.82j: 상대 ⅓ 진입 뒤 3 s 이상 지난 상실
            if (late) S0.lossLateN++; if (enterT >= 0) S0.lossEnterDt += t - enterT;
            for (const a of s.agents) {
              if (!a.onPitch || a.line === 0 || a.team !== loser) continue;
              const [ax] = toNorm(a.x, a.y, dir);
              const P = (S0.posLoss[a.pos] ??= [0, 0, 0, 0]); // n, behind, sum offset m, running
              P[0]++; if (ax < bnx) P[1]++; P[2] += (ax - bnx) * L; if (t < a.runUntil) P[3]++;
              if (sust) { const Q = (S0.posLossSust[a.pos] ??= [0, 0, 0, 0]); Q[0]++; if (ax < bnx) Q[1]++; Q[2] += (ax - bnx) * L; }
              if (late) { const Q = (S0.posLossLate[a.pos] ??= [0, 0, 0, 0]); Q[0]++; if (ax < bnx) Q[1]++; Q[2] += (ax - bnx) * L; }
            }
          }
          ep = { dumpIdx: -1, dumpNext: 0, dumpUntil: 0, winner, band, gk, wide, rb: null, loser, opp, t0: t, half: s.half, behind, bl, ahead, tgtAhead, oppAhead, lossX: bnx * L, lineAtLoss: (1 - lineW0) * L, lineW0, bxW0, beyondMax: 0, runnersMax: 0, fp: null, shot15: false, xg15: 0, g3: false, ballGain3: 0, numUp3: 0 };
        }
      }
      prevPoss = s.possTeam;
      enterT = -1;
    }
    // 전환 슛(같은 소유 15 s, 전 구역) 은 em28 이 재므로 여기선 생략
  }
  R.matches++;
}
restore();
const txt = JSON.stringify(R);
if (out) writeFileSync(out, txt); else console.log(txt);
process.exit(0);
