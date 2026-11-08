// @ts-nocheck — 진단 스크립트 (엔진관리자28): 게겐 "뒤 공간 비용" 재측정. 엔진 상태는 읽기만 한다.
// 옛 지표(transProbe shot8)는 "잃은 뒤 WIN 초 안 상대 슈팅 아무거나"(공이 다시 오간 뒤의 슛, 세트피스 슛 포함)·상실 1건당 비율이라
// 상실 위치·상실 수·같은 소유 여부를 섞는다. 여기서는 상실 1건을 "상대의 그 소유(시퀀스)" 하나로 묶어 잰다.
// 실행: npx vite-node scripts/diag/em28-trans.ts -- [경기수=100] [seed=41000] [tac=gegenpress] [vs=balanced] [form=4-4-2] [out=파일.json] [경로=값 …]
import { applyOverrides, buildTeam } from '../engine/job';
import { createMatch } from '../../src/engine/sim';
import { attackDir, ownGoal, toNorm, L } from '../../src/engine/pitch';
import { offsideLine } from '../../src/engine/offball';
import { tacticsOf } from '../../src/engine/tactics';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2).filter((a) => a !== '--');
const ov: Record<string, number> = {};
let n = 100, seed0 = 41000, out = '', form = '4-4-2', tac = 'gegenpress', vs = 'balanced';
for (const a of args) {
  if (a.startsWith('seed=')) seed0 = Number(a.slice(5));
  else if (a.startsWith('out=')) out = a.slice(4);
  else if (a.startsWith('form=')) form = a.slice(5);
  else if (a.startsWith('tac=')) tac = a.slice(4);
  else if (a.startsWith('vs=')) vs = a.slice(3);
  else if (a.includes('=')) { const [k, v] = a.split('='); ov[k] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
}
const restore = applyOverrides(ov);
const WIN = 15, W8 = 8;
// 집계: 대상 팀(me)이 잃은 에피소드 / 상대(op)가 잃은 에피소드, 상실 구역 0(자기 ⅓)·1(가운데)·2(상대 ⅓)
const zone = () => ({ n: 0, reWin5: 0, broke: 0, brokeShot: 0, brokeXg: 0, seqShot8: 0, seqShot15: 0, seqXg15: 0, seqGoal15: 0, anyShot8: 0, prog8: 0, prog15: 0, reach30: 0, behind: 0, oppAhead: 0, numUp: 0, numUpShot: 0, seqLen: 0, setPiece: 0, space: 0, fpN: 0, fpDt: 0, fpGain: 0, fpFwd10: 0, fpLong: 0, fpThr: 0, fpOk: 0, fpClear: 0, fpBack: 0, carry: 0, pN: [0, 0, 0, 0], pShot: [0, 0, 0, 0], pRe: [0, 0, 0, 0] });
const side = () => ({ z: [zone(), zone(), zone()], shotsAgainst: 0, xgAgainst: 0, goalsAgainst: 0, transShots: 0, transXg: 0 });
const R: any = { matches: 0, tac, vs, ov, me: side(), op: side(), gd: 0 };

for (let k = 0; k < n; k++) {
  const seed = seed0 + k;
  const meHome = k % 2 === 1;
  const A = { id: `va${seed}`, rating: 75, seed: `eng-a-75-${seed}`, formation: form, tactics: tacticsOf(tac) };
  const B = { id: `vb${seed}`, rating: 75, seed: `eng-b-75-${seed}`, formation: '4-4-2', tactics: tacticsOf(vs) };
  const ws = `w${seed}`;
  const home = meHome ? A : B, away = meHome ? B : A;
  const sim = createMatch({ home: buildTeam(home, 75, ws), away: buildTeam(away, 75, ws), mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  const s = sim.state;
  const meT = meHome ? 0 : 1;
  let prevPoss = s.possTeam;
  let evN = s.events.length;
  const eps: any[] = [];
  while (!s.done) {
    sim.step();
    const t = s.t;
    // 새 이벤트
    const shots: any[] = [], goals: number[] = [];
    for (; evN < s.events.length; evN++) {
      const e = s.events[evN];
      if (e.type === 'shot') {
        shots.push(e);
        const S = e.team === meT ? R.op : R.me; // me 가 맞은 슛 → me.shotsAgainst
        S.shotsAgainst++; S.xgAgainst += e.params?.xg ?? 0;
      }
      if (e.type === 'goal') { goals.push(e.team); (e.team === meT ? R.op : R.me).goalsAgainst++; }
    }
    if (s.possTeam !== prevPoss) {
      if (!s.restart && s.possOrigin === 'open' && prevPoss >= 0) {
        const loser = prevPoss;
        const dir = attackDir(loser, s.half);
        const [bnx] = toNorm(s.ball.x, s.ball.y, dir);
        const [gx, gy] = ownGoal(dir);
        const d0 = Math.hypot(s.ball.x - gx, s.ball.y - gy);
        let behind = 0, oppAhead = 0;
        for (const a of s.agents) {
          if (!a.onPitch || a.line === 0) continue;
          const ax = toNorm(a.x, a.y, dir)[0];
          if (a.team === loser && ax < bnx) behind++;
          if (a.team !== loser && ax < bnx) oppAhead++;
        }
        const tmL = s.teams[loser];
        const p = Math.min(3, s.t < tmL.counterUntil ? tmL.counterPressers.length : 0);
        const space = (1 - offsideLine(s, 1 - loser)) * L;
        eps.push({ p, space, loser, opp: 1 - loser, t0: t, half: s.half, z: bnx < 1 / 3 ? 0 : bnx < 2 / 3 ? 1 : 2, d0, minD: d0, minD8: d0, gx, gy, behind, oppAhead,
          open: true, end: -1, reWin5: false, setPiece: false, shot8: false, shot15: false, xg15: 0, goal15: false, anyShot8: false, brokeAt: -1 });
      }
      prevPoss = s.possTeam;
    }
    for (const ep of eps) {
      const dt = t - ep.t0;
      if (dt > WIN + 0.5) continue;
      // 옛 지표: 창 안 상대 슈팅 아무거나
      if (dt <= W8 && !ep.anyShot8 && shots.some((e) => e.team === ep.opp)) ep.anyShot8 = true;
      if (!ep.open) continue;
      for (const e of shots) if (e.team === ep.opp && !ep.shot15) {
        ep.shot15 = true; ep.xg15 = e.params?.xg ?? 0;
        if (dt <= W8) ep.shot8 = true;
      }
      if (goals.includes(ep.opp) && ep.shot15) ep.goal15 = true;
      if (s.half !== ep.half || (s.possTeam !== ep.opp && s.possTeam >= 0)) {
        ep.open = false; ep.end = dt;
        if (dt <= 5 && s.possTeam === ep.loser) ep.reWin5 = true;
        continue;
      }
      if (s.restart) ep.setPiece = true;
      // 상대 첫 패스 (탈취 팀의 첫 공 띄움, 슛 제외)
      const fl = s.ball.flight;
      if (!ep.fp && fl && fl.kind !== 'shot' && fl.t0 >= ep.t0 && s.agents[fl.passer]?.team === ep.opp) {
        const gx = ep.gx;
        ep.fp = { dt, gain: Math.abs(fl.fromX - gx) - Math.abs(fl.toX - gx), len: Math.hypot(fl.toX - fl.fromX, fl.toY - fl.fromY), long: fl.kind === 'long' || fl.kind === 'clear', through: !!fl.through, ok: fl.outcome === 'receive', clear: fl.kind === 'clear' };
      }
      // 탈취 팀 소유자가 공을 갖고 달린 거리(드리블 전진)
      if (s.ball.owner >= 0 && s.agents[s.ball.owner].team === ep.opp && !ep.fp) ep.carry = Math.max(ep.carry ?? 0, ep.d0 - Math.hypot(s.ball.x - ep.gx, s.ball.y - ep.gy));
      const bt = s.teams[ep.loser].brokeAt;
      if (ep.brokeAt < 0 && bt >= ep.t0) ep.brokeAt = bt;
      const d = Math.hypot(s.ball.x - ep.gx, s.ball.y - ep.gy);
      if (d < ep.minD) ep.minD = d;
      if (dt <= W8 && d < ep.minD8) ep.minD8 = d;
    }
    while (eps.length && t - eps[0].t0 > WIN + 1) fin(eps.shift());
  }
  for (const ep of eps) fin(ep);
  R.gd += meT === 0 ? s.teams[0].stats.goals - s.teams[1].stats.goals : s.teams[1].stats.goals - s.teams[0].stats.goals;
  R.matches++;
  function fin(ep) {
    const S = ep.loser === meT ? R.me : R.op;
    const Z = S.z[ep.z];
    Z.n++;
    if (ep.reWin5) Z.reWin5++;
    if (ep.brokeAt >= 0) { Z.broke++; if (ep.shot15) { Z.brokeShot++; Z.brokeXg += ep.xg15; } }
    if (ep.shot8) Z.seqShot8++;
    if (ep.shot15) { Z.seqShot15++; Z.seqXg15 += ep.xg15; S.transShots++; S.transXg += ep.xg15; }
    if (ep.goal15) Z.seqGoal15++;
    if (ep.anyShot8) Z.anyShot8++;
    Z.prog8 += ep.d0 - ep.minD8; Z.prog15 += ep.d0 - ep.minD;
    if (ep.minD < 30 && ep.d0 >= 30) Z.reach30++;
    Z.behind += ep.behind; Z.oppAhead += ep.oppAhead;
    if (ep.oppAhead >= ep.behind) { Z.numUp++; if (ep.shot15) Z.numUpShot++; }
    if (ep.fp) { Z.fpN++; Z.fpDt += ep.fp.dt; Z.fpGain += ep.fp.gain; if (ep.fp.gain >= 10) Z.fpFwd10++; if (ep.fp.gain < 0) Z.fpBack++; if (ep.fp.long) Z.fpLong++; if (ep.fp.through) Z.fpThr++; if (ep.fp.ok) Z.fpOk++; if (ep.fp.clear) Z.fpClear++; }
    Z.carry += ep.carry ?? 0;
    Z.space += ep.space; Z.pN[ep.p]++; if (ep.shot15) Z.pShot[ep.p]++; if (ep.reWin5) Z.pRe[ep.p]++;
    Z.seqLen += ep.end >= 0 ? ep.end : WIN;
    if (ep.setPiece) Z.setPiece++;
  }
}
restore();
const txt = JSON.stringify(R);
if (out) writeFileSync(out, txt); else console.log(txt);
process.exit(0);
