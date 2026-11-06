// @ts-nocheck — 진단 스크립트 (엔진관리자13, 엄격 타입 검사 제외)
// 진단 (엔진관리자13, C.78x): 오픈 플레이 소유 상실을 "단계"로 분해 — 잃은 팀이 공을 직접 놓친 마지막 사건(원인)을 자기 진영 깊이별로 센다.
//  원인: duel:recvPass(패스 받고 정지 시간 중 태클) · duel:recvGain(뺏은/주운 뒤 정지 시간 중 태클) · duel:hold/carry/dribble(유지·몰기·돌파 성공 뒤 쿨다운 중 태클) ·
//        hold/carry(결정 순간 유지·몰기 실패 = pressureLoss) · dribble·holdup(1대1 진 것) · pass:intercept(차단) · pass:loose(부정확) · pass:deepCut(깊은 블록 컷) ·
//        long:landing(롱패스 착지 경합 패) · pass:notReached(받을 선수가 못 닿음) · clear·cross·shot.
//  + 받기 표: 자기 진영 패스 수신(깊이별) — 3 m 안 압박%, 정지 시간, 10 m 안 동료 수, 5 m 안 상대 수, 그 소유를 정지 시간 중 잃은 비율·다음 행동 전에 잃은 비율.
//  + 압박 속 결정 표(자기 진영, 3 m 안 상대): 고른 행동 비율·고른 행동 성공 확률 p·p ≥ 0.8 짧은 패스(≤ 20 m) 후보 수.
// 메인 스레드(probe.decide 훅 · 상태·집계 읽기만, 지문 불변). 실행: npx vite-node scripts/diag/c78x-loss.ts -- [경기수=40] A전술 B전술 [레이팅=75:75] [시드=41000] [경로=값 …]
import { setEnvironmentFixed } from '../../src/weather';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { FORMATION_SLOTS } from '../../src/formations';
import { createMatch } from '../../src/engine/sim';
import { ENGINE } from '../../src/engine/config';
import { tacticsOf, type Level } from '../../src/engine/tactics';
import { attackDir, dist, toNorm } from '../../src/engine/pitch';
import { probe } from '../../src/engine/probe';
import { laneRiskAt, passDistBase, pressureAt } from '../../src/engine/onball';
import type { TeamSetup, Tendency } from '../../src/engine/types';

setEnvironmentFixed(true);
const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
const specs: string[] = [];
let n = 40;
let seed0 = 41000;
let ratings = [75, 75];
for (const a of all) {
  if (a.includes('=')) { const [k, v] = a.split('='); if (k === 'seed') seed0 = Number(v); else overrides[k!] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
  else if (/^\d+:\d+$/.test(a)) ratings = a.split(':').map(Number);
  else specs.push(a);
}
for (const [path, v] of Object.entries(overrides)) {
  const keys = path.split('.'); let o = ENGINE as unknown as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>;
  o[keys[keys.length - 1]!] = v;
}
const tac = (spec: string) => {
  const [t, lv] = spec.split('@') as [Tendency, string | undefined];
  const levels = lv ? { lineHeight: Number(lv[0]) as Level, pressing: Number(lv[1]) as Level, style: Number(lv[2]) as Level, width: Number(lv[3]) as Level } : undefined;
  return tacticsOf(t, levels);
};
function build(side: string, seed: number, rating: number, spec: string, oppRating: number): TeamSetup {
  const roster = createTeamRoster({ id: `v${side}${seed}`, rating }, `eng-${side}-${rating}-${seed}`, 2018, []);
  roster.formation = '4-4-2';
  const setup = teamSetupFromRoster(roster, rosterRating(roster), oppRating, `w${seed}`);
  const before = setup.tactics.tendency;
  setup.tactics = { ...setup.tactics, ...tac(spec) };
  if (setup.tactics.tendency !== before) {
    const slots = FORMATION_SLOTS[roster.formation];
    for (const p of setup.lineup) delete p.role;
    fillRoles(setup, (slot) => slots[slot]!.pos);
  }
  return setup;
}

const DB = [0, 0.17, 0.33, 0.5, 1.01];
const DN = ['0~18 m', '18~35 m', '35~52 m', '상대 진영'];
const dbin = (nx: number) => { let k = 0; while (k < DB.length - 2 && nx >= DB[k + 1]!) k++; return k; };
type Acc = {
  loss: Record<string, number[]>; // 원인 → 깊이별 (오픈 플레이 상대 소유로 끝남)
  out: Record<string, number[]>; // 원인 → 깊이별 (상대 리스타트로 끝남: 라인 밖·오프사이드)
  ctx: Record<string, { n: number; n5: number; mates10: number; near: number }>; // 원인별 사건 순간 (자기 진영 절반)
  rec: { n: number; pr3: number; cd: number; m10: number; o5: number; lostCd: number; lostBefore: number }[]; // 깊이별 패스 수신
  gain: { n: number; pr3: number; cd: number; m10: number; o5: number; lostCd: number }[]; // 깊이별 탈취·주운 공 (자기 소유 시작)
  dec: { n: number; type: Record<string, number>; p: number; esc: number; escP: number }; // 자기 진영 압박 속 결정
  air: Record<string, { n: number; rec: number; icp: number; loose: number; keep: number; p: number; base: number; lane: number; cut: number; cutNear: number; press: number; icpD: number[] }>; // 자기 진영 공중 패스(30 m+) 시도: GK/필드 → 결과
  danger: Record<string, { sh: number; g: number; xg: number; wonNx: number; n: number }>; // 원인별 잃은 뒤 12초 상대 슈팅·골·xG, 상대가 딴 곳(상대 기준 nx)
  orig: Record<string, { sh: number; xg: number; n: number }>; // 소유 시작별(탈취 깊이 = 자기 기준 nx · 리스타트) 슈팅·xG, 빠름 = 시작 12초 안
  pressPass: { n: number; ok: number }; // 자기 진영 압박 속 20 m 이하 패스 성공 (다음 소유가 우리)
};
const mkAcc = (): Acc => ({
  loss: {}, out: {}, ctx: {},
  rec: DN.map(() => ({ n: 0, pr3: 0, cd: 0, m10: 0, o5: 0, lostCd: 0, lostBefore: 0 })),
  gain: DN.map(() => ({ n: 0, pr3: 0, cd: 0, m10: 0, o5: 0, lostCd: 0 })),
  dec: { n: 0, type: {}, p: 0, esc: 0, escP: 0 },
  pressPass: { n: 0, ok: 0 },
  orig: {},
  danger: {},
  air: {},
});
const acc: [Acc, Acc] = [mkAcc(), mkAcc()];
const add = (m: Record<string, number[]>, k: string, b: number) => { (m[k] ??= DN.map(() => 0))[b]!++; };

for (let k = 0; k < n; k++) {
  const seed = seed0 + k;
  const A = build('a', seed, ratings[0]!, specs[0]!, ratings[1]!);
  const B = build('b', seed, ratings[1]!, specs[1]!, ratings[0]!);
  const aHome = k % 2 === 1;
  const sim = createMatch({ home: aHome ? A : B, away: aHome ? B : A, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  const s = sim.state;
  const who = (team: 0 | 1) => ((team === 0) === aHome ? 0 : 1);
  const nxOf = (team: 0 | 1, x: number, y: number) => toNorm(x, y, attackDir(team, s.half))[0];
  const around = (a) => {
    let n5 = 0, m10 = 0, near = 99;
    for (const o of s.agents) {
      if (!o.onPitch || o === a || o.line === 0) continue;
      const d = dist(o.x, o.y, a.x, a.y);
      if (o.team === a.team) { if (d <= 10) m10++; } else { if (d <= 5) n5++; near = Math.min(near, d); }
    }
    return { n5, m10, near };
  };
  // 사건 기록
  const lastDec: { t: number; type: string }[] = s.agents.map(() => ({ t: -100, type: '' }));
  let decNow: { idx: number; type: string } | null = null;
  const cause: ({ cat: string; b: number } | null)[] = [null, null];
  let curRec: { team: 0 | 1; idx: number; b: number; kind: 'rec' | 'gain'; t: number } | null = null;
  let pp: { team: 0 | 1 } | null = null;
  let decP: number | null = null;
  let decInfo: { base: number; lane: number; cut: number; cutNear: number; press: number } | null = null;
  let airW: { team: 0 | 1; key: string } | null = null;
  const watch: { L: 0 | 1; cat: string; t: number; poss: number }[] = [];
  let cur: { team: number; t0: number; key: string } = { team: -1, t0: -1, key: '' };
  probe.shot = (st, sp) => {
    if (cur.team === sp.team) { const fast = st.t - cur.t0 <= 12 ? '빠름' : '느림'; const O = (acc[who(sp.team)].orig[`${cur.key} ${fast}`] ??= { sh: 0, xg: 0, n: 0 }); O.sh++; O.xg += sp.xg ?? 0; }
    for (const w of watch) if (sp.team !== w.L && st.t - w.t <= 12) { const Dg = acc[who(w.L)].danger[w.cat]!; Dg.sh++; Dg.xg += sp.xg ?? 0; if (w.box) Dg.bxg += sp.xg ?? 0; }
  };
  probe.decide = (st, p) => {
    const a = p.a;
    if (st.ball.owner !== a.idx) return; // 미리 정하기(받는 중)는 실행 순간에 센다
    decNow = { idx: a.idx, type: p.chosen.type }; decP = p.chosen.pFlight ?? p.chosen.p;
    decInfo = null;
    if (dist(a.x, a.y, p.chosen.x, p.chosen.y) > 30 && (p.chosen.type === 'pass' || p.chosen.type === 'through')) {
      const ln = laneRiskAt(st, a.team, a.x, a.y, p.chosen.x, p.chosen.y);
      const d = dist(a.x, a.y, p.chosen.x, p.chosen.y);
      decInfo = { base: passDistBase(d), lane: ln.risk * Math.max(0.3, 1 + (ENGINE.prob.laneVision * (60 - a.attrs.vision)) / 100), cut: ln.cutters.length, cutNear: ln.cutters.filter((c) => c.t * d <= 6).length, press: ENGINE.prob.pressurePenalty * pressureAt(st, a) };
    }
    if (a.line === 0 || st.restart) return;
    const nx = nxOf(a.team, a.x, a.y);
    const ar = around(a);
    if (nx < 0.5 && ar.near <= 3) {
      const D = acc[who(a.team)].dec;
      D.n++; D.type[p.chosen.type] = (D.type[p.chosen.type] ?? 0) + 1; D.p += p.chosen.p;
      let esc = 0;
      for (const c of p.cands) if ((c.type === 'pass' || c.type === 'layoff') && c.p >= 0.8 && dist(a.x, a.y, c.x, c.y) <= 20) esc++;
      D.esc += esc; if (esc > 0) D.escP++;
      if ((p.chosen.type === 'pass' || p.chosen.type === 'layoff') && dist(a.x, a.y, p.chosen.x, p.chosen.y) <= 20) pp = { team: a.team };
    }
  };
  let prevOwner = -1;
  while (!s.done) {
    const b = s.ball;
    const preOwner = b.owner;
    const preFlight = b.flight;
    const preRestart = !!s.restart;
    const prePoss = s.possTeam;
    let preO = null as null | { idx: number; team: 0 | 1; x: number; y: number; cd: number; pre: string | null; ballT: number; gotBy: string; ar: ReturnType<typeof around> };
    if (preOwner >= 0) {
      const o = s.agents[preOwner]!;
      preO = { idx: o.idx, gk: o.line === 0, team: o.team, x: o.x, y: o.y, cd: o.cooldown, pre: o.pre ? o.pre.type : null, ballT: o.ballT, gotBy: o.gotBy, ar: around(o) };
    }
    const tw0 = [s.teams[0].stats.tacklesWon, s.teams[1].stats.tacklesWon];
    decNow = null; decP = null;
    sim.step();
    for (let q = watch.length - 1; q >= 0; q--) if (s.t - watch[q]!.t > 12) watch.splice(q, 1);
    if (s.possStartT !== cur.t0 || s.possTeam !== cur.team) {
      const gnx = nxOf(s.possTeam as 0 | 1, b.x, b.y);
      const key = s.possOrigin === 'open' ? `탈취 ${gnx < 0.5 ? DN[dbin(gnx)] : gnx < 0.67 ? '상대 52~70' : gnx < 0.83 ? '상대 70~87' : '상대 87~'}` : `리스타트 ${s.possOrigin}`;
      cur = { team: s.possTeam, t0: s.possStartT, key };
      const O = (acc[who(s.possTeam as 0 | 1)].orig[`${key} 빠름`] ??= { sh: 0, xg: 0, n: 0 }); O.n++;
    }
    // 1) 소유자가 공을 직접 놓친 사건
    if (preO && b.owner !== preOwner && !preRestart) {
      const L = preO.team, D = (1 - L) as 0 | 1;
      const bk = dbin(nxOf(L, preO.x, preO.y));
      let cat: string | null = null;
      const decided = decNow && decNow.idx === preO.idx ? decNow.type : preO.cd <= 0 && preO.pre ? preO.pre : null;
      if (decided) {
        lastDec[preO.idx] = { t: s.t, type: decided };
        const fl = b.flight && b.flight !== preFlight && b.flight.passer === preO.idx ? b.flight : null;
        if (fl && fl.air && (decided === 'pass' || decided === 'through') && nxOf(L, preO.x, preO.y) < 0.5) {
          const key = preO.gk ? 'GK' : nxOf(L, preO.x, preO.y) < 0.17 ? '필드 0~18' : nxOf(L, preO.x, preO.y) < 0.33 ? '필드 18~35' : '필드 35~52';
          const Ar = (acc[who(L)].air[key] ??= { n: 0, rec: 0, icp: 0, loose: 0, keep: 0, p: 0, base: 0, lane: 0, cut: 0, cutNear: 0, press: 0, icpD: [0, 0, 0] });
          if (decInfo) { Ar.base += decInfo.base; Ar.lane += decInfo.lane; Ar.cut += decInfo.cut; Ar.cutNear += decInfo.cutNear; Ar.press += decInfo.press; }
          if (fl.outcome === 'intercept') { const di = dist(fl.fromX, fl.fromY, fl.toX, fl.toY); Ar.icpD[di <= 6 ? 0 : di <= 20 ? 1 : 2]!++; }
          Ar.n++; if (fl.outcome === 'receive') Ar.rec++; else if (fl.outcome === 'intercept') Ar.icp++; else Ar.loose++;
          Ar.p += decP ?? 0;
          airW = { team: L, key };
        }
        if (fl) {
          if (decided === 'shoot') cat = 'shot';
          else if (decided === 'clear') cat = 'clear';
          else if (decided === 'cross') cat = 'cross';
          else cat = fl.outcome === 'receive' ? null : `${fl.air ? 'long' : 'pass'}:${fl.outcome}`;
          if (cat === 'long:intercept') { const tf = dist(fl.fromX, fl.fromY, fl.toX, fl.toY) / Math.max(1, fl.aimD ?? 1); cat += tf < 0.19 ? '@발밑' : tf <= 0.81 ? '@중간' : '@착지'; }
          if (fl.outcome === 'receive') cause[L] = { cat: `${preO.gk ? 'GK ' : ''}${fl.air ? 'long' : 'pass'}:recvPending`, b: bk };
        } else if (s.restart) cat = null; // 오프사이드·파울
        else cat = decided === 'shoot' ? 'shot' : decided; // 유지·몰기·돌파·버티기 실패
      } else if (s.teams[D].stats.tacklesWon > tw0[D]! || (b.owner >= 0 && s.agents[b.owner]!.team === D) || (b.reserve && s.agents[b.reserve.idx]!.team === D) || (b.owner < 0 && !b.flight && !b.reserve)) {
        if (!s.restart) {
          const ld = lastDec[preO.idx] ?? { t: -100, type: '' };
          cat = ld.t >= preO.ballT ? `duel:${ld.type}` : preO.gotBy === 'receive' ? 'duel:recvPass' : 'duel:recvGain';
        }
      }
      if (cat && preO.gk) cat = `GK ${cat}`;
      if (cat) {
        cause[L] = { cat, b: bk };
        if (nxOf(L, preO.x, preO.y) < 0.5) {
          const C = (acc[who(L)].ctx[cat] ??= { n: 0, n5: 0, mates10: 0, near: 0 });
          C.n++; C.n5 += preO.ar.n5; C.mates10 += preO.ar.m10; C.near += Math.min(10, preO.ar.near);
        }
        if (curRec && curRec.idx === preO.idx && !cat.startsWith('shot')) {
          const R = curRec.kind === 'rec' ? acc[who(curRec.team)].rec[curRec.b]! : acc[who(curRec.team)].gain[curRec.b]!;
          if (cat === 'duel:recvPass' || cat === 'duel:recvGain') R.lostCd++;
          if (curRec.kind === 'rec' && (cat.startsWith('duel:recv') || ['hold', 'carry', 'dribble', 'holdup'].includes(cat))) R.lostBefore++;
        }
      }
      if (curRec && curRec.idx === preO.idx) curRec = null;
    }
    // 2) 비행이 끝나며 수신 실패(착지 경합·박스 경합·깊은 컷·못 닿음)
    if (preFlight && b.flight !== preFlight && preFlight.outcome === 'receive' && preFlight.kind !== 'shot') {
      const L = s.agents[preFlight.passer]!.team;
      const D = (1 - L) as 0 | 1;
      const toD = (b.owner >= 0 && s.agents[b.owner]!.team === D) || (b.reserve && s.agents[b.reserve.idx]!.team === D);
      const c = cause[L];
      if (c && c.cat.endsWith('recvPending')) {
        if (toD) c.cat = (c.cat.startsWith('GK') ? 'GK ' : '') + (preFlight.air ? 'long:landing' : 'pass:contest');
        else if (b.owner < 0 && !b.reserve && !b.flight) c.cat = (c.cat.startsWith('GK') ? 'GK ' : '') + 'pass:notReached';
      }
    }
    // 3) 같은 팀이 다시 잡음 → 원인 지움
    if (b.owner >= 0) {
      const o = s.agents[b.owner]!;
      if (airW && b.owner !== preOwner) { if (o.team === airW.team) acc[who(airW.team)].air[airW.key]!.keep++; airW = null; }
      if (pp && b.owner !== preOwner) { const P = acc[who(pp.team)].pressPass; P.n++; if (o.team === pp.team) P.ok++; pp = null; }
      if (b.owner !== prevOwner) {
        // 새 소유 시작 (받기·탈취)
        const nx = nxOf(o.team, o.x, o.y);
        if (o.line !== 0 && !s.restart && nx < 0.5) {
          const ar = around(o);
          const kind = o.gotBy === 'receive' && prevOwner >= 0 && s.agents[prevOwner]!.team === o.team ? 'rec' : prePoss !== o.team ? 'gain' : 'rec';
          const bk = dbin(nx);
          const R = kind === 'rec' ? acc[who(o.team)].rec[bk]! : acc[who(o.team)].gain[bk]!;
          R.n++; if (ar.near <= 3) R.pr3++; R.cd += o.cooldown; R.m10 += ar.m10; R.o5 += ar.n5;
          curRec = { team: o.team, idx: o.idx, b: bk, kind, t: s.t };
        } else curRec = null;
      }
      cause[o.team] = null;
      prevOwner = b.owner;
    }
    if (airW && s.restart && !preRestart) airW = null;
    // 4) 소유가 상대로 넘어감
    if (s.possTeam !== prePoss && !s.restart && b.owner >= 0) {
      const L = prePoss as 0 | 1;
      const c = cause[L];
      add(acc[who(L)].loss, c ? c.cat : 'other', c ? c.b : dbin(1 - nxOf(s.possTeam as 0 | 1, b.x, b.y)));
      if (c && c.b < 3) {
        const box = nxOf(s.possTeam as 0 | 1, b.x, b.y) >= 0.83;
        const Dg = (acc[who(L)].danger[c.cat] ??= { sh: 0, g: 0, xg: 0, wonNx: 0, n: 0, bn: 0, bxg: 0 });
        Dg.n++; Dg.wonNx += nxOf(s.possTeam as 0 | 1, b.x, b.y); if (box) Dg.bn++;
        for (let q = watch.length - 1; q >= 0; q--) if (watch[q]!.L === L) watch.splice(q, 1);
        watch.push({ L, cat: c.cat, t: s.t, poss: s.possStartT, box });
      }
      cause[L] = null;
    } else if (s.restart && !preRestart && s.restart.team !== prePoss && s.restart.type !== 'kickoff' && s.restart.type !== 'freeKick' && s.restart.type !== 'penalty') {
      const L = prePoss as 0 | 1;
      const c = cause[L];
      add(acc[who(L)].out, `${c ? c.cat : 'other'}→${s.restart.type}`, c ? c.b : 0);
      cause[L] = null;
    }
  }
  probe.decide = undefined; probe.shot = undefined;
}

const per = (x: number) => (x / n).toFixed(2);
const pc = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(0) : '-');
console.log(`\n${specs[0]} 대 ${specs[1]} · ${ratings.join(':')} · ${n}경기 · 시드 ${seed0}~ · 덮어쓰기 ${JSON.stringify(overrides)}`);
['A', 'B'].forEach((nm, i) => {
  const X = acc[i]!;
  const tot = DN.map((_, b) => Object.values(X.loss).reduce((t, v) => t + v[b]!, 0));
  console.log(`\n### ${nm} ${specs[i]} — 오픈 플레이 소유 상실/경기 (잃은 사건 위치 = 자기 공격 방향 깊이)`);
  console.log(`| 원인 | ${DN.join(' | ')} | 자기 진영 합 | 합 |`);
  console.log(`|---|${DN.map(() => '---').join('|')}|---|---|`);
  const rows = Object.entries(X.loss).sort((a, b) => (b[1][0]! + b[1][1]! + b[1][2]!) - (a[1][0]! + a[1][1]! + a[1][2]!));
  for (const [k, v] of rows) console.log(`| ${k} | ${v.map(per).join(' | ')} | ${per(v[0]! + v[1]! + v[2]!)} | ${per(v.reduce((t, x) => t + x, 0))} |`);
  console.log(`| **합** | ${tot.map(per).join(' | ')} | ${per(tot[0]! + tot[1]! + tot[2]!)} | ${per(tot.reduce((t, x) => t + x, 0))} |`);
  const outs = Object.entries(X.out).sort((a, b) => b[1].reduce((t, x) => t + x, 0) - a[1].reduce((t, x) => t + x, 0)).slice(0, 6);
  console.log(`리스타트로 잃음(상위): ${outs.map(([k, v]) => `${k} ${per(v.reduce((t, x) => t + x, 0))}`).join(' · ')}`);
  console.log(`자기 진영 사건 순간(원인별): ${Object.entries(X.ctx).filter(([, c]) => c.n >= n * 0.5).sort((a, b) => b[1].n - a[1].n).map(([k, c]) => `${k} n${per(c.n)} 5m상대 ${(c.n5 / c.n).toFixed(2)} 10m동료 ${(c.mates10 / c.n).toFixed(2)} 최근접 ${(c.near / c.n).toFixed(1)}m`).join(' · ')}`);
  console.log(`| 자기 진영 받기(패스) | 깊이 | 수신/경기 | 3 m 압박% | 정지 시간 s | 10 m 동료 | 5 m 상대 | 정지 중 잃음% | 다음 패스·슛 전 잃음% |`);
  X.rec.forEach((R, b) => { if (b < 3) console.log(`| | ${DN[b]} | ${per(R.n)} | ${pc(R.pr3, R.n)} | ${(R.cd / Math.max(1, R.n)).toFixed(2)} | ${(R.m10 / Math.max(1, R.n)).toFixed(2)} | ${(R.o5 / Math.max(1, R.n)).toFixed(2)} | ${pc(R.lostCd, R.n)} | ${pc(R.lostBefore, R.n)} |`); });
  console.log(`| 자기 진영 탈취·주움 | 깊이 | 건/경기 | 3 m 압박% | 정지 시간 s | 10 m 동료 | 5 m 상대 | 정지 중 잃음% | |`);
  X.gain.forEach((R, b) => { if (b < 3) console.log(`| | ${DN[b]} | ${per(R.n)} | ${pc(R.pr3, R.n)} | ${(R.cd / Math.max(1, R.n)).toFixed(2)} | ${(R.m10 / Math.max(1, R.n)).toFixed(2)} | ${(R.o5 / Math.max(1, R.n)).toFixed(2)} | ${pc(R.lostCd, R.n)} | |`); });
  console.log(`자기 진영 공중 패스(30 m+): ${Object.entries(X.air).sort().map(([k, A]) => `${k} ${per(A.n)}/경기 판단p ${(A.p / Math.max(1, A.n)).toFixed(2)} 받음 ${pc(A.rec, A.n)}% 차단 ${pc(A.icp, A.n)}% 빗나감 ${pc(A.loose, A.n)}% → 우리 소유 ${pc(A.keep, A.n)}% [거리 기본 ${(A.base / A.n).toFixed(2)} − 레인 ${(A.lane / A.n).toFixed(2)}(차단 후보 ${(A.cut / A.n).toFixed(1)}명, 6 m 안 ${(A.cutNear / A.n).toFixed(1)}) − 압박 ${(A.press / A.n).toFixed(2)} · 차단 지점 ≤6/6~20/20+ m ${A.icpD.join('/')}]`).join(' · ')}`);
  console.log(`자기 진영(깊이 0~52 m)에서 잃은 원인별 위험(잃은 뒤 12초 상대 슈팅/xG, 상대가 딴 곳 nx): ${Object.entries(X.danger).filter(([, d]) => d.n >= n * 0.3).sort((a, b) => b[1].xg - a[1].xg).map(([k, d]) => `${k} 잃음 ${per(d.n)} 슛 ${per(d.sh)} xG ${per(d.xg)} (건당 ${(d.xg / d.n).toFixed(3)}) 딴 곳 ${(d.wonNx / d.n).toFixed(2)} [우리 박스 앞 18 m 안에서 뺏김 ${per(d.bn)} → xG ${per(d.bxg)}]`).join(' · ')}`);
  console.log(`소유 시작별 슈팅·xG/경기 (빠름 = 시작 12초 안, n = 소유 수): ${Object.entries(X.orig).filter(([, o]) => o.xg > n * 0.01 || o.n > n).sort((a, b) => b[1].xg - a[1].xg).map(([k, o]) => `${k}${o.n ? ` n${per(o.n)}` : ''} 슛 ${per(o.sh)} xG ${per(o.xg)}`).join(' · ')}`);
  const D = X.dec;
  console.log(`자기 진영 압박(3 m) 속 결정 ${per(D.n)}/경기: ${Object.entries(D.type).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v, D.n)}%`).join(' · ')} · 고른 p ${(D.p / Math.max(1, D.n)).toFixed(2)} · p≥0.8 짧은 패스 후보 ${(D.esc / Math.max(1, D.n)).toFixed(2)}개(있음 ${pc(D.escP, D.n)}%) · 압박 속 짧은 패스 성공 ${pc(X.pressPass.ok, X.pressPass.n)}% (${per(X.pressPass.n)}/경기)`);
});
process.exit(0);
