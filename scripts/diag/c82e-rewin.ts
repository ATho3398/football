// @ts-nocheck — 진단 (C.82e): 공을 잃은 뒤 5초 재탈취가 왜 게겐과 균형이 같은지 — 역압박 가담자별 태클 시도·성공·가로채기·압박 상실, 소유자까지 거리, 되찾은 방식. 엔진 읽기만.
// 실행: npx vite-node scripts/diag/c82e-rewin.ts -- [경기수=100] [seed=41000] [tac=gegenpress] [vs=balanced] [out=파일.json] [경로=값 …]
import { applyOverrides, buildTeam } from '../engine/job';
import { createMatch } from '../../src/engine/sim';
import { attackDir, toNorm } from '../../src/engine/pitch';
import { tacticsOf } from '../../src/engine/tactics';
import { writeFileSync } from 'node:fs';
import { ENGINE } from '../../src/engine/config';

const args = process.argv.slice(2).filter((a) => a !== '--');
const ov: Record<string, number> = {};
let n = 100, seed0 = 41000, out = '', tac = 'gegenpress', vs = 'balanced';
for (const a of args) {
  if (a.startsWith('seed=')) seed0 = Number(a.slice(5));
  else if (a.startsWith('out=')) out = a.slice(4);
  else if (a.startsWith('tac=')) tac = a.slice(4);
  else if (a.startsWith('vs=')) vs = a.slice(3);
  else if (a.includes('=')) { const [k, v] = a.split('='); ov[k] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
}
const restore = applyOverrides(ov);
const WIN = 5;
const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
const mk = () => ({ n: 0, reWin: 0, reWinKind: { gain: 0, intercept: 0, win: 0, claim: 0, receive: 0, loose: 0, other: 0 }, reWinByPresser: 0, reWinByP0: 0, reWinT: 0,
  pN: [0, 0, 0, 0], pRe: [0, 0, 0, 0], p0d0: 0, p0dMin: 0, p0Reach: 0, p0ReachT: 0, p0Duel: 0, p0DuelN: 0, p0Won: 0, p0Int: 0, p0Disp: 0,
  pkDuel: 0, pkWon: 0, pkInt: 0, othDuel: 0, othWon: 0, othInt: 0, othDisp: 0, oppFirst: { pass: 0, carry: 0, hold: 0, none: 0 }, oppFirstT: 0, oppPassFail: 0, oppPassN: 0,
  windowEnd: 0, zone: [0, 0, 0], zoneRe: [0, 0, 0], tackleFoul: 0 });
const R: any = { matches: 0, tac, vs, ov, me: mk(), op: mk() };

for (let k = 0; k < n; k++) {
  const seed = seed0 + k;
  const meHome = k % 2 === 1;
  const A = { id: `va${seed}`, rating: 75, seed: `eng-a-75-${seed}`, formation: '4-4-2', tactics: tacticsOf(tac) };
  const B = { id: `vb${seed}`, rating: 75, seed: `eng-b-75-${seed}`, formation: '4-4-2', tactics: tacticsOf(vs) };
  const ws = `w${seed}`;
  const home = meHome ? A : B, away = meHome ? B : A;
  const sim = createMatch({ home: buildTeam(home, 75, ws), away: buildTeam(away, 75, ws), mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  const s = sim.state;
  const meT = meHome ? 0 : 1;
  let prevPoss = s.possTeam;
  let ep: any = null;
  const snap = (team) => s.agents.filter((a) => a.team === team).map((a) => ({ idx: a.idx, t: a.stats.tackles, tw: a.stats.tacklesWon, i: a.stats.interceptions }));
  let foulsPrev = [s.teams[0].stats.fouls, s.teams[1].stats.fouls];
  while (!s.done) {
    sim.step();
    const t = s.t;
    if (ep) {
      const dt = t - ep.t0;
      const S = ep.loser === meT ? R.me : R.op;
      // 소유자까지 첫 가담자 거리
      if (ep.p0 >= 0 && s.ball.owner >= 0 && s.agents[s.ball.owner].team === ep.opp) {
        const p0 = s.agents[ep.p0], o = s.agents[s.ball.owner];
        const d = dist(p0.x, p0.y, o.x, o.y);
        if (d < ep.p0dMin) ep.p0dMin = d;
        if (!ep.p0Reached && d <= ENGINE.defense.duelRange) { ep.p0Reached = true; ep.p0ReachT = dt; }
      }
      // 상대 첫 행동
      if (!ep.oppFirst) {
        const fl = s.ball.flight;
        if (fl && fl.kind !== 'shot' && fl.t0 >= ep.t0 && s.agents[fl.passer]?.team === ep.opp) { ep.oppFirst = 'pass'; ep.oppFirstT = dt; ep.oppPassOk = fl.outcome === 'receive'; }
        else if (s.ball.owner >= 0 && s.agents[s.ball.owner].team === ep.opp && dt > 1.0) {
          const o = s.agents[s.ball.owner]; const [ox] = toNorm(o.x, o.y, attackDir(ep.opp, s.half));
          if (ox - ep.ownerX0 > 3 / 105) { ep.oppFirst = 'carry'; ep.oppFirstT = dt; }
        }
      }
      // 되찾은 선수 후보 (reserve)
      const rv = s.ball.reserve;
      if (rv && s.agents[rv.idx]?.team === ep.loser) ep.lastRv = { idx: rv.idx, kind: rv.kind };
      const closed = s.half !== ep.half || (s.possTeam !== ep.opp && s.possTeam >= 0) || dt > WIN;
      if (closed) {
        const reWin = dt <= WIN && s.possTeam === ep.loser && s.half === ep.half;
        S.n++; S.zone[ep.z]++; S.pN[ep.p]++;
        if (reWin) {
          S.reWin++; S.pRe[ep.p]++; S.zoneRe[ep.z]++; S.reWinT += dt;
          const who = s.ball.owner >= 0 ? s.ball.owner : ep.lastRv?.idx ?? -1;
          const kind = ep.lastRv && ep.lastRv.idx === who ? ep.lastRv.kind : (s.possOrigin !== 'open' ? 'other' : 'loose');
          S.reWinKind[kind in S.reWinKind ? kind : 'other']++;
          if (ep.pressers.includes(who)) S.reWinByPresser++;
          if (who === ep.p0) S.reWinByP0++;
        }
        // 가담자 통계 변화
        const now = snap(ep.loser);
        for (const b of ep.snap) {
          const a = now.find((x) => x.idx === b.idx);
          const dT = a.t - b.t, dW = a.tw - b.tw, dI = a.i - b.i;
          // tackles 는 시도 시 ++, 성공 시 -- 뒤 tackleWon 에서 ++ → 시도 수 = dT(실패) + dW(성공)
          const att = dT, won = dW;
          if (b.idx === ep.p0) { S.p0Duel += att; S.p0Won += won; S.p0Int += dI; if (att > 0) S.p0DuelN++; }
          else if (ep.pressers.includes(b.idx)) { S.pkDuel += att; S.pkWon += won; S.pkInt += dI; }
          else { S.othDuel += att; S.othWon += won; S.othInt += dI; }
        }
        if (ep.p0 >= 0) { S.p0d0 += ep.p0d0; S.p0dMin += ep.p0dMin; if (ep.p0Reached) { S.p0Reach++; S.p0ReachT += ep.p0ReachT; } }
        S.oppFirst[ep.oppFirst ?? 'none']++; if (ep.oppFirst) S.oppFirstT += ep.oppFirstT;
        if (ep.oppFirst === 'pass') { S.oppPassN++; if (!ep.oppPassOk) S.oppPassFail++; }
        S.windowEnd += Math.min(dt, WIN);
        const f = s.teams[ep.loser].stats.fouls - ep.fouls0; S.tackleFoul += f;
        ep = null;
      }
    }
    if (s.possTeam !== prevPoss) {
      if (!ep && !s.restart && s.possOrigin === 'open' && prevPoss >= 0 && s.possTeam >= 0) {
        const loser = prevPoss;
        const dir = attackDir(loser, s.half);
        const [bnx] = toNorm(s.ball.x, s.ball.y, dir);
        const tmL = s.teams[loser];
        const pressers = s.t < tmL.counterUntil ? [...tmL.counterPressers] : [];
        const p0 = pressers[0] ?? -1;
        const owner = s.ball.owner >= 0 ? s.agents[s.ball.owner] : null;
        const p0d0 = p0 >= 0 && owner ? dist(s.agents[p0].x, s.agents[p0].y, owner.x, owner.y) : 0;
        const ownerX0 = owner ? toNorm(owner.x, owner.y, attackDir(1 - loser, s.half))[0] : toNorm(s.ball.x, s.ball.y, attackDir(1 - loser, s.half))[0];
        ep = { loser, opp: 1 - loser, t0: s.t, half: s.half, z: bnx < 1 / 3 ? 0 : bnx < 2 / 3 ? 1 : 2, p: Math.min(3, pressers.length), pressers, p0, p0d0, p0dMin: p0d0, p0Reached: false, p0ReachT: 0,
          snap: snap(loser), oppFirst: null, oppFirstT: 0, ownerX0, lastRv: null, fouls0: tmL.stats.fouls };
      }
      prevPoss = s.possTeam;
    }
  }
  R.matches++;
}
restore();
const txt = JSON.stringify(R);
if (out) writeFileSync(out, txt); else console.log(txt);
process.exit(0);
