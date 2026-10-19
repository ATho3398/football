// 진단 (12단계 B): 강팀 ST 쏠림, 레이팅 차, 슈팅 품질·선방률, 골 경로, 롱패스, 파울 원인을 틱 단위로 센다.
// 실행: npx vite-node scripts/diag/polish-b.ts -- gap [경기수=40]      생성 팀 4-2-3-1 균형, Δ 0 / 8 / 15
//       npx vite-node scripts/diag/polish-b.ts -- liv [경기수=40]      리버풀(league-0) 대 중위권 10팀 중립, 변형 비교
//       npx vite-node scripts/diag/polish-b.ts -- cells [경기수=40] [대형번호|base ...]   커스텀 대형(custom-sweep 번호) 대 균형 4-4-2 (C.33 진단, 미해결 5번)
//       npx vite-node scripts/diag/polish-b.ts -- role [경기수=40] <포메이션> <슬롯> <역할 ...>   홈 슬롯 역할만 바꿔 균형 상대와 (C.33 진단, 미해결 4번)
// 엔진 코드는 건드리지 않는다. 결정 순간에 candidates()/choose() 를 같은 틱에서 다시 계산해 "슛이 효용 1위였는가"를 본다.
import { NEUTRAL_MODS } from '../../src/body';
import { ENGINE } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { candidates, choose } from '../../src/engine/onball';
import { tacticsOf, type Level } from '../../src/engine/tactics';
import type { Tendency } from '../../src/engine/types';
import { attackDir, dist, inOppBox, oppGoal, toNorm } from '../../src/engine/pitch';
import { keeperOf, saveProb } from '../../src/engine/keeper';
import type { Flight } from '../../src/engine/state';
import type { Agent, SimState } from '../../src/engine/state';
import type { TeamSetup } from '../../src/engine/types';
import { cellExists, customLabel, customProblem, customSlots, FORMATION_SLOTS, GRID_LANES, GRID_ROWS, presetCells, type Formation } from '../../src/formations';
import { createRng, hashSeed } from '../../src/rng';
import { rebuildRosters } from '../../src/game';
import { createTeamRoster, pickLineup, rosterRating, teamRatings } from '../../src/roster';
import { BALANCED } from '../engine/job';

// 경로=값 인자는 엔진 상수를 덮어쓴다 (C.31, 예: prob.passBase=1.35)
const allArgs = process.argv.slice(2).filter((a) => a !== '--');
for (const a of allArgs.filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string];
  const path = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>;
  for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>;
  o[path[path.length - 1]!] = Number(v);
}
const args = allArgs.filter((x) => !x.includes('='));
const MODE = args[0] ?? 'gap';
const N = Number(args[1] ?? 40);

const group = (pos: string): string => (pos === 'ST' || pos === 'CF' ? 'ST' : ['LW', 'RW', 'LM', 'RM'].includes(pos) ? 'WING' : ['CM', 'CAM', 'CDM'].includes(pos) ? 'MID' : pos === 'GK' ? 'GK' : 'DEF');
const DBINS = [0, 11, 16.5, 20, 25, 31];
const dbin = (d: number) => { let b = 0; while (b + 1 < DBINS.length && d >= DBINS[b + 1]!) b++; return b; };

interface Side {
  n: number; goals: number; shots: number; sot: number; xg: number; saves: number; poss: number; passes: number; passOk: number;
  long: number; longByOrigin: Record<string, number>; drib: number; dribOk: number; through: number; fouls: number; foulBy: Record<string, number>;
  byGroup: Record<string, { shots: number; goals: number; xg: number }>;
  byDist: { shots: number; sot: number; goals: number; xg: number }[];
  // 결정 분석
  dec: number; decMistake: number; shootExists: number; shootBest: number; shootChosen: number; shootChosenNotBest: number; shootChosenGap: number[];
  shotXgChosen: number[]; shotXgWhenBest: number[]; bestTypeWhenShoot: Record<string, number>; typeMatch: number; typeMismatch: number;
  // 경로 (내 분류)
  pathMine: Record<string, number>; pathEngine: number[]; goalPathEngine: number[];
  stShotsFromReceiveSec: number[]; stShotDist: number[];
  thrAtt: number; thrRecv: number; thrRecvDist: number[]; thrShot3: number; thrGoals: number;
  byGot: Record<string, { shots: number; goals: number; xg: number }>;
  byGotST: Record<string, { shots: number; goals: number; xg: number }>;
  /** 슛 순간 슈터 5 m 안 상대 수, 박스 안 상대 수 (C.29 진단: 수비 인원이 슛 질에 반영되는가) */
  crowd: { n: number; near5: number; boxDef: number; boxDefL1: number; boxDefL2: number; boxAtt: number; xgByNear: Record<string, { n: number; xg: number; goals: number }>; xgByBoxDiff: Record<string, { n: number; xg: number; goals: number }> };
  /** 줄별(1 수비·2 중원·3 공격) 슈팅/골/xG (C.33 진단) */
  byLine: Record<string, { shots: number; goals: number; xg: number }>;
  /** 박스 안에서 패스를 받는 순간 가장 가까운 상대 거리 (C.29 진단: 마크 중인 선수에게 패스가 들어가는가) */
  recvBox: { n: number; dsum: number; within15: number; within25: number; stN: number; stWithin15: number; shots3: number; shots3Within15: number };
  /** 골 직전 점수 차(득점 팀 기준)별 골·슈팅 (C.29 재진단: 크게 앞선 뒤에도 계속 넣는가) */
  byLead: Record<string, { goals: number; shots: number }>;
  offsides: number; distKm: number; stamina75: number; nAgents: number;
  passBins: { n: number; ok: number }[]; saveJudged: number; saveActual: number; saveN: number; gkSs: number[];
  oppHalfWins: number; ints: number; tackleAtt: number; disp: number; counterShots: number; goalKicks: number; corners: number;
}
const side = (): Side => ({
  n: 0, goals: 0, shots: 0, sot: 0, xg: 0, saves: 0, poss: 0, passes: 0, passOk: 0, long: 0, longByOrigin: {}, drib: 0, dribOk: 0, through: 0, fouls: 0, foulBy: {},
  byGroup: {}, byDist: DBINS.map(() => ({ shots: 0, sot: 0, goals: 0, xg: 0 })),
  dec: 0, decMistake: 0, shootExists: 0, shootBest: 0, shootChosen: 0, shootChosenNotBest: 0, shootChosenGap: [0, 0, 0], shotXgChosen: [], shotXgWhenBest: [], bestTypeWhenShoot: {},
  typeMatch: 0, typeMismatch: 0, pathMine: {}, pathEngine: [0, 0, 0, 0, 0, 0, 0], goalPathEngine: [0, 0, 0, 0, 0, 0, 0], stShotsFromReceiveSec: [], stShotDist: [],
  thrAtt: 0, thrRecv: 0, thrRecvDist: [], thrShot3: 0, thrGoals: 0, byGot: {}, byGotST: {}, crowd: { n: 0, near5: 0, boxDef: 0, boxDefL1: 0, boxDefL2: 0, boxAtt: 0, xgByNear: {}, xgByBoxDiff: {} }, byLine: {}, recvBox: { n: 0, dsum: 0, within15: 0, within25: 0, stN: 0, stWithin15: 0, shots3: 0, shots3Within15: 0 }, byLead: {}, offsides: 0, distKm: 0, stamina75: 0, nAgents: 0, passBins: PBINS.map(() => ({ n: 0, ok: 0 })), saveJudged: 0, saveActual: 0, saveN: 0, gkSs: [], oppHalfWins: 0, ints: 0, tackleAtt: 0, disp: 0, counterShots: 0, goalKicks: 0, corners: 0,
});
const PBINS = [0, 10, 20, 30, 40, 50];
const pbin = (d: number) => { let b = 0; while (b + 1 < PBINS.length && d >= PBINS[b + 1]!) b++; return b; };
const LEAGUE_GK = { gk: { attrs: { shotStopping: ENGINE.keeper.leagueShotStopping, handling: ENGINE.keeper.leagueHandling, distribution: 70, commandOfArea: 70 }, type: 'classic' }, body: NEUTRAL_MODS } as unknown as Agent;
const inc = (r: Record<string, number>, k: string, v = 1) => (r[k] = (r[k] ?? 0) + v);

/** 한 경기를 틱 단위로 돌리며 분석. 홈이 '관심 팀'(index 0) */
function analyze(home: TeamSetup, away: TeamSetup, seed: number, out: [Side, Side]): void {
  const m = createMatch({ home, away, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  const s = m.state;
  const G = ENGINE.onball.plausibleGap;
  // 소유 추적 (경로 분류): 선수별 공을 얻은 방식·시각·몰고 가기·돌파 횟수
  const got = new Map<Agent, { how: string; t: number; carries: number; dribbles: number; detail: string }>();
  const recvMark = new Map<Agent, number>();
  let prevOwner = -1;
  let prevRestart = s.restart;
  let prevEv = 0;
  let prevStats = s.teams.map((t) => ({ ...t.stats }));
  let prevPl = new Map<Agent, { dribbles: number; dribblesWon: number; passes: number; shots: number; tackles: number; fouls: number; aerialDuels: number }>();
  const snapPl = () => new Map(s.agents.map((a) => [a, { dribbles: a.stats.dribbles, dribblesWon: a.stats.dribblesWon, passes: a.stats.passes, shots: a.stats.shots, tackles: a.stats.tackles, fouls: a.stats.fouls, aerialDuels: a.stats.aerialDuels }]));
  prevPl = snapPl();
  let pending: { a: Agent; type: string; isShoot: boolean } | null = null;
  while (!s.done) {
    // 결정 직전: 같은 틱의 후보와 선택을 재계산
    pending = null;
    const b = s.ball;
    if (b.owner >= 0 && !s.restart) {
      const o = s.agents[b.owner]!;
      if ((o.cooldown > 0 ? o.cooldown - ENGINE.time.dt : o.cooldown) <= 0 && o.line !== 0) {
        const [nx] = toNorm(o.x, o.y, attackDir(o.team, s.half));
        const cs = candidates(s, o);
        const c = choose(s, o, cs);
        pending = { a: o, type: c.type, isShoot: c.type === 'shoot' };
        if (nx > 0.5) {
          const S = out[o.team]!;
          let maxU = -Infinity;
          let best = cs[0]!;
          for (const x of cs) if (x.u > maxU) { maxU = x.u; best = x; }
          S.dec++;
          if (c.u < maxU - G) S.decMistake++;
          const sh = cs.find((x) => x.type === 'shoot');
          if (sh) {
            S.shootExists++;
            if (best.type === 'shoot') { S.shootBest++; S.shotXgWhenBest.push(sh.p); }
            if (c.type === 'shoot') {
              S.shootChosen++;
              S.shotXgChosen.push(sh.p);
              if (best.type !== 'shoot') {
                S.shootChosenNotBest++;
                const g = maxU - sh.u;
                S.shootChosenGap[g <= G ? 0 : g <= 2 * G ? 1 : 2]!++;
                inc(S.bestTypeWhenShoot, best.type);
              }
            }
          }
        }
      }
    }
    const flBefore: Flight | null = b.flight;
    m.step();
    const newEv = s.events.slice(prevEv);
    // 비행 시작/종료 추적: 패스 거리별 성공률, 침투 패스, 슈팅 선방 확률(판단용 대 실제)
    if (b.flight && b.flight !== flBefore) {
      const fl = b.flight;
      const S = out[s.agents[fl.passer]!.team]!;
      if (fl.kind === 'pass' || fl.kind === 'long') { if (fl.receiver >= 0 && fl.outcome !== 'shot') { const d = Math.hypot(fl.toX - fl.fromX, fl.toY - fl.fromY); S.passBins[pbin(d)]!.n++; } if (fl.through) S.thrAtt++; }
      if (fl.kind === 'shot' && fl.outcome === 'shot' && fl.shot && !fl.shot.penalty) {
        const sh = fl.shot; const gk = keeperOf(s, (1 - s.agents[fl.passer]!.team) as 0 | 1);
        S.saveJudged += saveProb(LEAGUE_GK, ENGINE.ball.shotSpeed, 0.5, sh.d); S.saveActual += saveProb(gk, sh.speed, sh.corner, sh.d); S.saveN++;
        if (gk?.gk) S.gkSs.push(gk.gk.attrs.shotStopping);
      }
    }
    if (flBefore && b.flight !== flBefore && (flBefore.kind === 'pass' || flBefore.kind === 'long') && flBefore.receiver >= 0 && flBefore.outcome !== 'shot') {
      const S = out[s.agents[flBefore.passer]!.team]!;
      if (b.owner === flBefore.receiver) { const d = Math.hypot(flBefore.toX - flBefore.fromX, flBefore.toY - flBefore.fromY); S.passBins[pbin(d)]!.ok++; }
    }
    const restartDone = prevRestart && !s.restart;
    // 소유 변화 → 경로 추적
    if (b.owner >= 0 && b.owner !== prevOwner) {
      const o = s.agents[b.owner]!;
      const how = restartDone ? `restart:${prevRestart!.type}` : (prevOwner >= 0 && s.agents[prevOwner]!.team === o.team) || o.gotBy === 'receive' ? 'receive' : 'gain';
      let detail = how;
      if (how === 'receive' && flBefore && flBefore.receiver === o.idx) detail = flBefore.through ? 'through' : flBefore.quick ? 'cutback/layoff' : flBefore.fromCross ? 'cross' : flBefore.kind === 'long' ? 'longpass' : 'pass';
      else if (how === 'receive' && flBefore && flBefore.fromCross) detail = 'cross';
      if (detail === 'through') { const S = out[o.team]!; S.thrRecv++; const [gx, gy] = oppGoal(attackDir(o.team, s.half)); S.thrRecvDist.push(dist(o.x, o.y, gx, gy)); }
      got.set(o, { how, t: s.t, carries: 0, dribbles: 0, detail });
      if (how === 'receive' && inOppBox(o.x, o.y, attackDir(o.team, s.half)) && o.line !== 0) {
        let nd = Infinity;
        for (const q of s.agents) if (q.onPitch && q.team !== o.team && q.line !== 0) nd = Math.min(nd, dist(q.x, q.y, o.x, o.y));
        const R = out[o.team]!.recvBox; R.n++; R.dsum += nd; if (nd <= 1.5) R.within15++; if (nd <= 2.5) R.within25++;
        if (group(o.pos) === 'ST') { R.stN++; if (nd <= 1.5) R.stWithin15++; }
        recvMark.set(o, nd);
      } else recvMark.delete(o);
    }
    // 선택 유형 검증과 몰고 가기 기록
    if (pending) {
      const a = pending.a;
      const pp = prevPl.get(a)!;
      const actual = a.stats.shots > pp.shots ? 'shoot' : a.stats.dribbles > pp.dribbles ? 'dribble' : a.stats.passes > pp.passes ? 'pass' : null;
      const mine = pending.type === 'through' || pending.type === 'cutback' || pending.type === 'layoff' || pending.type === 'cross' ? 'pass' : pending.type;
      if (actual) { if (actual === mine) out[a.team]!.typeMatch++; else out[a.team]!.typeMismatch++; }
      const g = got.get(a);
      if (g && pending.type === 'carry') g.carries++;
      if (g && pending.type === 'dribble') g.dribbles++;
    }
    for (const e of newEv) {
      const S = out[e.team]!;
      const leadKey = (team: 0 | 1, goalEvent: boolean) => { const g = s.teams[team].stats.goals - (goalEvent ? 1 : 0); const o = s.teams[1 - team]!.stats.goals; const m = g - o; return m <= -1 ? '뒤짐' : m === 0 ? '동점' : m === 1 ? '+1' : m === 2 ? '+2' : '+3이상'; };
      if (e.type === 'shot') {
        { const lk = leadKey(e.team, false); (S.byLead[lk] ??= { goals: 0, shots: 0 }).shots++; }
        const a = s.agents.find((x) => x.id === e.players[0])!;
        const xg = Number(e.params?.xg ?? 0);
        const d = Number(e.params?.d ?? 0);
        const on = Number(e.params?.onTarget ?? 0);
        S.shots++; S.xg += xg; if (on) S.sot++;
        const gk = (S.byGroup[group(a.pos)] ??= { shots: 0, goals: 0, xg: 0 });
        gk.shots++; gk.xg += xg;
        const db = S.byDist[dbin(d)]!; db.shots++; db.xg += xg; if (on) db.sot++;
        const g = got.get(a);
        let path = 'other';
        if (g) {
          const dt = s.t - g.t;
          if (g.how.startsWith('restart:')) path = g.how;
          else if (g.dribbles > 0) path = '돌파 후';
          else if (g.how === 'receive' && g.carries === 0) path = '받고 바로';
          else if (g.how === 'receive' && g.carries > 0 && dt < 3) path = '받고 몰고(3초 안)';
          else if (g.how === 'receive') path = '받고 몰고(3초 넘게)';
          else path = `얻고(${g.carries ? '몰고' : '바로'})`;
          if (group(a.pos) === 'ST') { S.stShotsFromReceiveSec.push(dt); S.stShotDist.push(d); }
        }
        inc(S.pathMine, path);
        S.pathEngine[a.shotPath]!++;
        const bg = (S.byGot[g?.detail ?? 'other'] ??= { shots: 0, goals: 0, xg: 0 }); bg.shots++; bg.xg += xg;
        if (group(a.pos) === 'ST') { const bs = (S.byGotST[g?.detail ?? 'other'] ??= { shots: 0, goals: 0, xg: 0 }); bs.shots++; bs.xg += xg; }
        { const nd = recvMark.get(a); if (nd !== undefined && g && s.t - g.t < 3) { S.recvBox.shots3++; if (nd <= 1.5) S.recvBox.shots3Within15++; } }
        {
          const dirA = attackDir(a.team, s.half);
          let near5 = 0, boxDef = 0, boxDefL1 = 0, boxDefL2 = 0, boxAtt = 0;
          for (const o of s.agents) {
            if (!o.onPitch || o.line === 0) continue;
            if (o.team === a.team) { if (inOppBox(o.x, o.y, dirA)) boxAtt++; continue; }
            if (dist(o.x, o.y, a.x, a.y) <= 5) near5++;
            if (inOppBox(o.x, o.y, dirA)) { boxDef++; if (o.line === 1) boxDefL1++; else if (o.line === 2) boxDefL2++; }
          }
          S.crowd.n++; S.crowd.near5 += near5; S.crowd.boxDef += boxDef; S.crowd.boxDefL1 += boxDefL1; S.crowd.boxDefL2 += boxDefL2; S.crowd.boxAtt += boxAtt;
          const k = near5 >= 3 ? '3+' : String(near5);
          const c = (S.crowd.xgByNear[k] ??= { n: 0, xg: 0, goals: 0 }); c.n++; c.xg += xg;
          const bd = boxAtt - boxDef; const kb = bd <= -2 ? '≤-2' : bd >= 2 ? '≥+2' : String(bd);
          const cb = (S.crowd.xgByBoxDiff[kb] ??= { n: 0, xg: 0, goals: 0 }); cb.n++; cb.xg += xg;
          const bl = (S.byLine[String(a.line)] ??= { shots: 0, goals: 0, xg: 0 }); bl.shots++; bl.xg += xg;
        }
        if (g?.detail === 'through' && s.t - g.t < 3) S.thrShot3++;
      } else if (e.type === 'goal') {
        { const lk = leadKey(e.team, true); (S.byLead[lk] ??= { goals: 0, shots: 0 }).goals++; }
        const a = s.agents.find((x) => x.id === e.players[0])!;
        S.goals++;
        (S.byGroup[group(a.pos)] ??= { shots: 0, goals: 0, xg: 0 }).goals++;
        S.goalPathEngine[a.shotPath]!++;
        const gg = got.get(a); if (gg) { (S.byGot[gg.detail] ??= { shots: 0, goals: 0, xg: 0 }).goals++; if (gg.detail === 'through') S.thrGoals++; if (group(a.pos) === 'ST') (S.byGotST[gg.detail] ??= { shots: 0, goals: 0, xg: 0 }).goals++; }
        { const dirA = attackDir(a.team, s.half); let near5 = 0, boxDef = 0, boxAtt = 0; for (const o of s.agents) { if (!o.onPitch || o.line === 0) continue; if (o.team === a.team) { if (inOppBox(o.x, o.y, dirA)) boxAtt++; continue; } if (dist(o.x, o.y, a.x, a.y) <= 5) near5++; if (inOppBox(o.x, o.y, dirA)) boxDef++; } const k = near5 >= 3 ? '3+' : String(near5); (S.crowd.xgByNear[k] ??= { n: 0, xg: 0, goals: 0 }).goals++; const bd = boxAtt - boxDef; const kb = bd <= -2 ? '≤-2' : bd >= 2 ? '≥+2' : String(bd); (S.crowd.xgByBoxDiff[kb] ??= { n: 0, xg: 0, goals: 0 }).goals++; (S.byLine[String(a.line)] ??= { shots: 0, goals: 0, xg: 0 }).goals++; }
        // 거리 구간: 직전 슈팅 이벤트
        const sh = [...s.events].reverse().find((x) => x.type === 'shot' && x.players[0] === a.id);
        if (sh) S.byDist[dbin(Number(sh.params?.d ?? 0))]!.goals++;
      } else if (e.type === 'save') S.saves++;
      else if (e.type === 'foul') {
        const f = s.agents.find((x) => x.id === e.players[0])!;
        const v = s.agents.find((x) => x.id === e.players[1])!;
        const pf = prevPl.get(f)!; const pv = prevPl.get(v)!;
        let src = '몸싸움(contact)';
        if (v.stats.dribblesWon > pv.dribblesWon) src = '돌파 허용';
        else if (f.stats.tackles > pf.tackles) src = '태클 실패';
        else if (f.stats.aerialDuels > pf.aerialDuels) src = '공중볼';
        else if (s.teams[v.team].stats.holdupsWon > prevStats[v.team]!.holdupsWon) src = '버티기 허용';
        S.fouls++;
        inc(S.foulBy, src);
      }
    }
    // 롱패스 출처
    for (const t of [0, 1] as const) {
      const d = s.teams[t].stats.longPasses - prevStats[t]!.longPasses;
      if (d > 0) {
        const origin = restartDone && prevRestart!.team === t ? `재개:${prevRestart!.type}` : prevOwner >= 0 ? `오픈:${group(s.agents[prevOwner]!.pos)}` : '오픈:?';
        inc(out[t]!.longByOrigin, origin, d);
      }
    }
    prevOwner = b.owner;
    prevRestart = s.restart;
    prevEv = s.events.length;
    prevStats = s.teams.map((t) => ({ ...t.stats }));
    prevPl = snapPl();
  }
  for (const t of [0, 1] as const) {
    const S = out[t]!; const st = s.teams[t].stats;
    S.n++; S.poss += st.possessionTicks / (s.teams[0].stats.possessionTicks + s.teams[1].stats.possessionTicks);
    S.offsides += st.offsides;
    for (const a of s.agents) if (a.team === t && a.onPitch) { S.distKm += a.stats.distance / 1000; S.stamina75 += a.stamina; S.nAgents++; }
    S.oppHalfWins += st.oppHalfWins; S.ints += st.interceptions; S.tackleAtt += st.tackleAttempts; S.disp += st.dispossessed; S.counterShots += st.counterShots; S.goalKicks += st.goalKicks; S.corners += st.corners;
    S.passes += st.passes; S.passOk += st.passesCompleted; S.long += st.longPasses; S.drib += st.dribbles; S.dribOk += st.dribblesWon; S.through += st.throughReceived;
  }
}

function report(label: string, out: [Side, Side]): void {
  console.log(`\n### ${label}`);
  for (const [i, S] of out.entries()) {
    const n = S.n;
    const q = (v: number) => (v / n).toFixed(2);
    const other = out[1 - i]!;
    console.log(`[팀 ${i}] 득점 ${q(S.goals)} 슈팅 ${q(S.shots)} 유효 ${q(S.sot)} xG/슛 ${(S.xg / S.shots).toFixed(3)} 유효률 ${(100 * S.sot / S.shots).toFixed(0)}% 유효→골 ${(100 * S.goals / S.sot).toFixed(0)}% | 상대 GK 선방률 ${(100 * other.saves / S.sot).toFixed(1)}% | 점유 ${(100 * S.poss / n).toFixed(1)}% 패스 ${q(S.passes)} 성공 ${(100 * S.passOk / S.passes).toFixed(1)}% 롱 ${(100 * S.long / S.passes).toFixed(1)}% 드리블 ${q(S.drib)}/${(100 * S.dribOk / S.drib).toFixed(0)}% 침투수신 ${q(S.through)} 파울 ${q(S.fouls)}`);
    console.log(`  포지션별 슈팅/골/xG: ${Object.entries(S.byGroup).map(([k, v]) => `${k} ${q(v.shots)}/${q(v.goals)}/${(v.xg / Math.max(1, v.shots)).toFixed(3)}`).join(' · ')}`);
    console.log(`  거리별 슈팅(유효률/골/xG): ${S.byDist.map((d, k) => `${DBINS[k]}m~ ${q(d.shots)}(${(100 * d.sot / Math.max(1, d.shots)).toFixed(0)}%/${q(d.goals)}/${(d.xg / Math.max(1, d.shots)).toFixed(3)})`).join(' · ')}`);
    console.log(`  결정(상대 진영) ${q(S.dec)}/경기, 1위 밖 선택 ${(100 * S.decMistake / S.dec).toFixed(0)}% · 슛 후보 있음 ${q(S.shootExists)}, 그중 슛이 1위 ${(100 * S.shootBest / S.shootExists).toFixed(0)}%, 슛 선택 ${q(S.shootChosen)} (1위 아닌데 선택 ${q(S.shootChosenNotBest)} = ${(100 * S.shootChosenNotBest / Math.max(1, S.shootChosen)).toFixed(0)}%; 효용 차 ≤gap/≤2gap/>2gap = ${S.shootChosenGap.join('/')})`);
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
    console.log(`  선택된 슛 xG 평균 ${mean(S.shotXgChosen).toFixed(3)} (1위일 때 ${mean(S.shotXgWhenBest).toFixed(3)}) · 슛이 1위 아닐 때 1위 후보: ${Object.entries(S.bestTypeWhenShoot).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')} · 선택 재현 ${S.typeMatch}/${S.typeMatch + S.typeMismatch}`);
    console.log(`  슈팅 경로(내 분류): ${Object.entries(S.pathMine).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(100 * v / S.shots).toFixed(0)}%`).join(' · ')}`);
    console.log(`  슈팅 경로(엔진, 패스/몰고·돌파/코너/FK/PK/리바운드/그밖): ${S.pathEngine.map((v) => (100 * v / S.shots).toFixed(0)).join('/')} · 골 경로: ${S.goalPathEngine.map((v) => (100 * v / Math.max(1, S.goals)).toFixed(0)).join('/')}`);
    console.log(`  롱패스 출처(경기당): ${Object.entries(S.longByOrigin).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${q(v)}`).join(' · ')}`);
    console.log(`  파울 원인(경기당): ${Object.entries(S.foulBy).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${q(v)}`).join(' · ')}`);
    console.log(`  오프사이드 ${q(S.offsides)} · 선발 끝까지 뛴 선수 이동 거리 평균 ${(S.distKm / Math.max(1, S.nAgents)).toFixed(2)} km, 경기 끝 스태미나 평균 ${(S.stamina75 / Math.max(1, S.nAgents)).toFixed(1)}`);
    console.log(`  상대 진영 탈취 ${q(S.oppHalfWins)} 인터셉트 ${q(S.ints)} 태클 시도 ${q(S.tackleAtt)} 소유 상실(몰고·유지 실패) ${q(S.disp)} 역습 슈팅 ${q(S.counterShots)} 골킥 ${q(S.goalKicks)} 코너 ${q(S.corners)}`);
    console.log(`  침투 패스: 시도 ${q(S.thrAtt)} 수신 ${q(S.thrRecv)} (${(100 * S.thrRecv / Math.max(1, S.thrAtt)).toFixed(0)}%), 받은 곳 골까지 평균 ${mean(S.thrRecvDist).toFixed(1)} m, 받고 3초 안 슛 ${q(S.thrShot3)}, 침투로 받은 뒤 골 ${q(S.thrGoals)} (${(100 * S.thrGoals / Math.max(1, S.goals)).toFixed(0)}% of 골)`);
    console.log(`  얻은 방식별 슈팅/골/xG: ${Object.entries(S.byGot).sort((a, b) => b[1].shots - a[1].shots).map(([k, v]) => `${k} ${q(v.shots)}/${q(v.goals)}/${(v.xg / Math.max(1, v.shots)).toFixed(3)}`).join(' · ')}`);
    console.log(`  ST 얻은 방식별 슈팅/골/xG: ${Object.entries(S.byGotST).sort((a, b) => b[1].shots - a[1].shots).map(([k, v]) => `${k} ${q(v.shots)}/${q(v.goals)}/${(v.xg / Math.max(1, v.shots)).toFixed(3)}`).join(' · ')}`);
    console.log(`  슛 순간 수비 밀집: 슈터 5 m 안 상대 평균 ${(S.crowd.near5 / Math.max(1, S.crowd.n)).toFixed(2)}명, 박스 안 상대 평균 ${(S.crowd.boxDef / Math.max(1, S.crowd.n)).toFixed(2)}명(수비 줄 ${(S.crowd.boxDefL1 / Math.max(1, S.crowd.n)).toFixed(2)} / 중원 줄 ${(S.crowd.boxDefL2 / Math.max(1, S.crowd.n)).toFixed(2)}), 박스 안 우리 공격 평균 ${(S.crowd.boxAtt / Math.max(1, S.crowd.n)).toFixed(2)}명 · 5 m 안 상대 수별 슛(xG/실제 골률): ${Object.entries(S.crowd.xgByNear).sort().map(([k, v]) => `${k}명 ${q(v.n)} (${(v.xg / v.n).toFixed(3)}/${(v.goals / v.n).toFixed(3)})`).join(' · ')}`);
    console.log(`  박스 안 (우리 공격 − 상대 수비) 인원 차별 슛/경기(xG/실제 골률): ${['≤-2', '-1', '0', '1', '≥+2'].filter((k) => S.crowd.xgByBoxDiff[k]).map((k) => { const v = S.crowd.xgByBoxDiff[k]!; return `${k} ${q(v.n)} (${(v.xg / v.n).toFixed(3)}/${(v.goals / v.n).toFixed(3)})`; }).join(' · ')} · 줄별 슈팅/골/xG: ${Object.entries(S.byLine).sort().map(([k, v]) => `줄${k} ${q(v.shots)}/${q(v.goals)}/${(v.xg / Math.max(1, v.shots)).toFixed(3)}`).join(' · ')}`);
    console.log(`  박스 안 패스 수신 ${q(S.recvBox.n)}/경기: 받는 순간 가장 가까운 상대 평균 ${(S.recvBox.dsum / Math.max(1, S.recvBox.n)).toFixed(2)} m, 1.5 m 안 ${(100 * S.recvBox.within15 / Math.max(1, S.recvBox.n)).toFixed(0)}%, 2.5 m 안 ${(100 * S.recvBox.within25 / Math.max(1, S.recvBox.n)).toFixed(0)}% · ST 수신 ${q(S.recvBox.stN)} (1.5 m 안 ${(100 * S.recvBox.stWithin15 / Math.max(1, S.recvBox.stN)).toFixed(0)}%) · 받고 3초 안 슛 ${q(S.recvBox.shots3)} (그중 1.5 m 안에서 받은 것 ${(100 * S.recvBox.shots3Within15 / Math.max(1, S.recvBox.shots3)).toFixed(0)}%)`);
    // 진단 지표 (C.30, pending 20·21): "박스 수신 1.5 m 안 ≥30%" 대신 "ST 박스 안 수신/경기 ≤12"
    const stRecv = S.recvBox.stN / n;
    console.log(`  ${stRecv <= 12 ? '✓' : '✗'} 진단 지표 ST 박스 안 수신/경기 ${stRecv.toFixed(1)} (목표 ≤12)`);
    console.log(`  점수 차별 골/슈팅(경기당): ${['뒤짐', '동점', '+1', '+2', '+3이상'].map((k) => { const v = S.byLead[k] ?? { goals: 0, shots: 0 }; return `${k} ${q(v.goals)}/${q(v.shots)}`; }).join(' · ')}`);
    console.log(`  패스 거리별 시도/성공률: ${S.passBins.map((p, k) => `${PBINS[k]}m~ ${q(p.n)} (${(100 * p.ok / Math.max(1, p.n)).toFixed(0)}%)`).join(' · ')}`);
    console.log(`  유효 슈팅 선방 확률: 판단용(리그 GK, 구석 0.5) ${(100 * S.saveJudged / Math.max(1, S.saveN)).toFixed(1)}% 대 실제(상대 GK, 실제 구석·속도) ${(100 * S.saveActual / Math.max(1, S.saveN)).toFixed(1)}% (n ${S.saveN}), 상대 GK 선방 능력치(곡선 후) 평균 ${mean(S.gkSs).toFixed(1)}`);
    if (S.stShotDist.length) console.log(`  ST 슈팅 ${q(S.stShotDist.length)}/경기: 골까지 평균 ${mean(S.stShotDist).toFixed(1)} m, 공 얻고 슛까지 평균 ${mean(S.stShotsFromReceiveSec).toFixed(1)}초, 2초 안 ${(100 * S.stShotsFromReceiveSec.filter((x) => x < 2).length / S.stShotsFromReceiveSec.length).toFixed(0)}%`);
  }
}

const mkGen = (side: string, i: number, rating: number, opp: number, formation: Formation = '4-2-3-1', tactics: 'balanced' | 'data' = 'balanced', cells?: number[]) => {
  const r = createTeamRoster({ id: `v${side}${i}`, rating }, `diagB-${side}-${rating}-${i}`, 2018, []);
  r.formation = formation;
  if (cells) r.customSlots = customSlots(cells);
  const s = teamSetupFromRoster(r, rosterRating(r), opp, `wB${i}`);
  if (tactics === 'balanced') s.tactics = { ...s.tactics, ...BALANCED };
  return s;
};
const refill = (s: TeamSetup) => {
  const slots = s.customSlots ?? FORMATION_SLOTS[s.formation];
  for (const p of s.lineup) delete p.role;
  fillRoles(s, (slot) => slots[slot]!.pos);
};

if (MODE === 'gap') {
  for (const [rh, ra] of [[75, 75], [79, 71], [82, 67]] as const) {
    const out: [Side, Side] = [side(), side()];
    for (let i = 0; i < N; i++) analyze(mkGen('a', i, rh, ra), mkGen('b', i, ra, rh), 9000 + i, out);
    report(`생성 팀 4-2-3-1 균형 중립 ${N}경기: ${rh} 대 ${ra} (Δ ${rh - ra})`, out);
  }
} else if (MODE === 'tac') {
  // 전술 짝 비교 (C.32 진단): 생성 팀 75 대 75, 4-4-2, 홈 = 전술 A, 원정 = 전술 B(기본 균형). 지정: 성향@라인압박빌드업폭 (tactic-pair 와 같은 표기)
  const tacOf = (spec: string) => { const [tn, lv] = spec.split('@') as [Tendency, string | undefined]; const levels = lv ? { lineHeight: Number(lv[0]) as Level, pressing: Number(lv[1]) as Level, style: Number(lv[2]) as Level, width: Number(lv[3]) as Level } : undefined; return tacticsOf(tn, levels); };
  const mkT = (side: string, i: number, spec: string) => { const s = mkGen(side, i, 75, 75, '4-4-2', 'data'); s.tactics = tacOf(spec); refill(s); return s; };
  const specs = args.length > 2 ? args.slice(2) : ['balanced', 'balanced@2111', 'balanced@0011', 'balanced@1211', 'gegenpress', 'block', 'counter'];
  const vs = process.env.VS ?? 'balanced';
  for (const sp of specs) {
    const out: [Side, Side] = [side(), side()];
    for (let i = 0; i < N; i++) analyze(mkT('a', i, sp), mkT('b', i, vs), 31000 + i, out);
    report(`전술 ${sp} (홈) 대 ${vs} (원정) — 생성 75 대 75, 4-4-2, 중립 ${N}경기`, out);
  }
} else if (MODE === 'cells') {
  // 커스텀 대형 (C.33 진단, 미해결 5번): custom-sweep.ts 와 같은 무작위 대형(번호)을 홈에, 균형 4-4-2 칸 대형을 원정에. 'base' 는 4-4-2 칸 대형끼리
  const randomCells = (i: number): number[] => {
    const rng = createRng(hashSeed(`custom-sweep:${i}`));
    const all = Array.from({ length: GRID_ROWS * GRID_LANES }, (_, c) => c).filter(cellExists);
    for (;;) {
      const pool = [...all];
      const cells = [-1];
      for (let k = 0; k < 10; k++) cells.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!);
      if (customProblem(cells)) continue;
      return cells;
    }
  };
  const ids = args.length > 2 ? args.slice(2) : ['35', 'base'];
  for (const id of ids) {
    const cells = id === 'base' ? presetCells('4-4-2') : randomCells(Number(id));
    const base = presetCells('4-4-2');
    const out: [Side, Side] = [side(), side()];
    for (let i = 0; i < N; i++) {
      const h = mkGen('a', i, 75, 75, '4-4-2', 'balanced', cells); refill(h);
      const a = mkGen('b', i, 75, 75, '4-4-2', 'balanced', base); refill(a);
      analyze(h, a, 71000 + i, out);
    }
    const slots = customSlots(cells).slice(1);
    report(`커스텀 대형 ${id} ${customLabel(cells)} (${slots.map((x) => x.pos).join(' ')}) 홈 대 균형 4-4-2 칸 대형 원정 — 생성 75 대 75, 중립 ${N}경기`, out);
  }
} else if (MODE === 'role') {
  // 역할 비교 (C.33 진단, 미해결 4번): 홈 슬롯 역할만 바꾸고 나머지는 균형 추천 역할, 원정은 같은 포메이션 균형 (role-pair 와 같은 짝)
  const formation = (args[2] ?? '4-3-3') as Formation;
  const slot = Number(args[3] ?? 8);
  const roles = args.slice(4);
  for (const role of roles) {
    const out: [Side, Side] = [side(), side()];
    for (let i = 0; i < N; i++) {
      const h = mkGen('a', i, 75, 75, formation, 'balanced'); refill(h);
      if (role !== 'default') { const p = h.lineup.find((x) => x.slot === slot); if (p) p.role = role; }
      const a = mkGen('b', i, 75, 75, formation, 'balanced'); refill(a);
      analyze(h, a, 47000 + i, out);
    }
    report(`역할 ${role} (${formation} 슬롯 ${slot}, 홈) 대 균형 기본 역할 (원정) — 생성 75 대 75, 중립 ${N}경기`, out);
  }
} else if (MODE === 'liv') {
  const ws = 'league-0';
  const MID = ['wol', 'eve', 'lei', 'whu', 'wat', 'cry', 'new', 'bou', 'bur', 'sou'];
  const rosters = rebuildRosters(ws, undefined, 0);
  const ratings = teamRatings(rosters);
  const ids = Object.keys(ratings);
  const avg = ids.reduce((t, id) => t + ratings[id]!, 0) / ids.length;
  const team = args[2] ?? 'liv';
  const r = rosters[team]!;
  console.log(`${team} 레이팅 ${ratings[team]!.toFixed(1)}, 중위권 평균 ${(MID.reduce((t, id) => t + ratings[id]!, 0) / MID.length).toFixed(1)}, 포메이션 ${r.formation}`);
  const lu = pickLineup(r);
  console.log(lu.slots.map((s) => `${s.pos} ${s.playerId}(${s.ovr})`).join(' '));
  type Variant = { label: string; home: (i: number, opp: string) => TeamSetup; away?: (i: number, opp: string) => TeamSetup };
  const base = (i: number, opp: string) => teamSetupFromRoster(r, ratings[team]!, ratings[opp]!, ws, undefined, avg);
  const awayBase = (i: number, opp: string) => teamSetupFromRoster(rosters[opp]!, ratings[opp]!, ratings[team]!, ws, undefined, avg);
  const variants: Variant[] = [
    { label: 'A 기준 (데이터 전술, 상대 약팀 대응 켬)', home: base },
    { label: 'B 리버풀 전술만 균형으로 (역할도 균형 추천으로)', home: (i, opp) => { const s = base(i, opp); s.tactics = { ...s.tactics, ...BALANCED }; refill(s); return s; } },
    { label: 'C 리버풀 포메이션 4-2-3-1', home: (i, opp) => teamSetupFromRoster({ ...r, formation: '4-2-3-1' }, ratings[team]!, ratings[opp]!, ws, undefined, avg) },
    { label: 'D 같은 레이팅의 생성 팀 (4-3-3 게겐프레스, style 0.7)', home: (i, opp) => { const g = createTeamRoster({ id: 'vliv', rating: ratings[team]! }, `diagB-liv-${i}`, 2018, []); g.formation = '4-3-3'; const s = teamSetupFromRoster(g, rosterRating(g), ratings[opp]!, `wL${i}`); s.tactics = { ...tacticsOf('gegenpress'), style: 0.7 }; refill(s); return s; } },
    { label: 'E 상대 약팀 대응 끔 (상대는 자기 데이터 전술 그대로)', home: base, away: (i, opp) => teamSetupFromRoster(rosters[opp]!, ratings[opp]!, ratings[team]!, ws, undefined, avg, false) },
    { label: 'F 리버풀 전술 균형 + 상대 대응 끔', home: (i, opp) => { const s = base(i, opp); s.tactics = { ...s.tactics, ...BALANCED }; refill(s); return s; }, away: (i, opp) => teamSetupFromRoster(rosters[opp]!, ratings[opp]!, ratings[team]!, ws, undefined, avg, false) },
  ];
  const only = args[3];
  for (const v of variants) {
    if (only && !v.label.startsWith(only)) continue;
    const out: [Side, Side] = [side(), side()];
    for (let i = 0; i < N; i++) {
      const opp = MID[i % MID.length]!;
      analyze(v.home(i, opp), (v.away ?? awayBase)(i, opp), 70000 + i, out);
    }
    report(`${v.label} — ${team} 대 중위권 중립 ${N}경기`, out);
  }
}
process.exit(0);
