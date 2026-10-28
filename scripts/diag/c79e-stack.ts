// @ts-nocheck — 진단 스크립트 (엔진관리자16, C.79e 미해결 5 몰빵 대형)
// 몰빵 커스텀 대형(custom-sweep 의 대형 번호, 기본 35 = 1-2-1-2-4) 대 균형 4-4-2(동레이팅 75) 를 메인 스레드(probe 훅, 상태 읽기만, 지문 불변)로 돌려
//  ⒜ 양 팀 슛 1건 자료: 거리·xG·결과·골 쪽 상대 수비 수(GK 제외)·가장 가까운 수비 거리·역습 여부(탈취 뒤 8초)·슈터 줄
//  ⒝ 상대(균형)가 수비할 때 "상대 공격 줄 인원 − 내 수비 줄 인원" 분포(틱 표본): 몰빵 선수 중 균형 수비 줄 ± lineBand m 안 또는 그 골 쪽 인원 대 균형 줄 1(압박 제외)
//  ⒞ 몰빵 슛·박스 수신 순간 균형 쪽 박스 안 수비(줄 1 / 줄 2) 수, 몰빵 쪽 박스 안 공격 수, 미마크(3 m 안 수비 없음) 비율
//  ⒟ 몰빵 빌드업: 자기 진영 시작 소유 중 하프라인 못 넘기고 잃은 비율, 자기 ⅓ 패스 성공률
// 실행: npx vite-node scripts/diag/c79e-stack.ts -- [경기수=40] [cells=35|base] [opp=balanced|block@…] [경로=값 …]
import { setEnvironmentFixed } from '../../src/weather';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { cellExists, customLabel, customProblem, customSlots, FORMATION_SLOTS, GRID_LANES, GRID_ROWS, presetCells } from '../../src/formations';
import { createRng, hashSeed } from '../../src/rng';
import { createMatch } from '../../src/engine/sim';
import { ENGINE } from '../../src/engine/config';
import { tacticsOf, type Level } from '../../src/engine/tactics';
import { attackDir, dist, toNorm, ownGoal, L, W } from '../../src/engine/pitch';
import { ballRank } from '../../src/engine/offball';
import { probe } from '../../src/engine/probe';
import type { TeamSetup, Tendency } from '../../src/engine/types';

setEnvironmentFixed(true);
const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
let n = 40;
let cellsArg = '35';
let oppSpec = 'balanced';
let mySpec = 'balanced';
for (const a of all) {
  if (a.startsWith('cells=')) cellsArg = a.slice(6);
  else if (a.startsWith('opp=')) oppSpec = a.slice(4);
  else if (a.startsWith('me=')) mySpec = a.slice(3);
  else if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
}
for (const [path, v] of Object.entries(overrides)) {
  const keys = path.split('.'); let o = ENGINE as unknown as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>;
  o[keys[keys.length - 1]!] = v;
}
function randomCells(i: number): number[] {
  const rng = createRng(hashSeed(`custom-sweep:${i}`));
  const allC = Array.from({ length: GRID_ROWS * GRID_LANES }, (_, c) => c).filter(cellExists);
  for (;;) {
    const pool = [...allC];
    const cells = [-1];
    for (let k = 0; k < 10; k++) cells.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!);
    if (!customProblem(cells)) return cells;
  }
}
const cells = cellsArg === 'base' ? presetCells('4-4-2') : cellsArg.includes(',') ? cellsArg.split(',').map(Number) : randomCells(Number(cellsArg));
const BALANCED = { tendency: 'balanced', lineHeight: 0.5, pressing: 0.55, style: 0.5, width: 1 };
const tac = (spec: string) => {
  if (spec === 'balanced') return BALANCED;
  const [t, lv] = spec.split('@') as [Tendency, string | undefined];
  const levels = lv ? { lineHeight: Number(lv[0]) as Level, pressing: Number(lv[1]) as Level, style: Number(lv[2]) as Level, width: Number(lv[3]) as Level } : undefined;
  return tacticsOf(t, levels);
};
function build(side: string, seed: number, rating: number, spec: string, oppRating: number, c: number[] | null): TeamSetup {
  const roster = createTeamRoster({ id: `v${side}${seed}`, rating }, `eng-${side}-${rating}-${seed}`, 2018, []);
  roster.formation = '4-4-2';
  if (c) roster.customSlots = customSlots(c);
  const setup = teamSetupFromRoster(roster, rosterRating(roster), oppRating, `w${seed}`);
  const before = setup.tactics.tendency;
  setup.tactics = { ...setup.tactics, ...tac(spec) };
  if (setup.tactics.tendency !== before) {
    const slots = roster.customSlots ?? FORMATION_SLOTS[roster.formation];
    for (const p of setup.lineup) delete p.role;
    fillRoles(setup, (slot) => slots[slot]!.pos);
  }
  return setup;
}

interface Shot { team: 0 | 1; d: number; xg: number; out: string; gs: number; near: number; counter: boolean; line: number; pos: string; boxDef1: number; boxDef2: number; boxAtt: number; pOn: number; gkOut: number }
const shots: Shot[] = [];
// ⒝ 줄 인원 분포 (균형이 수비할 때, 몰빵이 소유·오픈 플레이): surplus = attN − defN
const surplus: Record<string, number> = {};
let surplusN = 0;
const surplusHi: Record<string, number> = {}; // 공이 균형 수비 ⅓ 안일 때
let surplusHiN = 0;
let attAtLineSum = 0, def1Sum = 0, mid2BackSum = 0, tickN = 0;
// ⒞ 박스 수신
let boxRecv = 0, boxRecvFree = 0, boxRecvDef = 0, boxRecvDef2 = 0, boxRecvAtt = 0;
let boxRecvO = 0, boxRecvFreeO = 0;
// ⒞′ 마커 배정: 박스 수신자에게 배정된 수비(tvIdx = 수신자) 수·거리, 박스 안 공격수 중 배정 마커 있는 비율
let recvAssigned = 0, recvAssignedN = 0, recvAssignDist = 0, recvAssignDistN = 0, boxAttN = 0, boxAttMarked = 0, boxAttNear = 0;
// ⒟ 빌드업
let seqOwn = 0, seqOwnLost = 0, seqOwnO = 0, seqOwnLostO = 0;
let passOwn = [0, 0], passOwnOk = [0, 0];
// ⒠ 슛 거리 안(≤ 25 m) 결정: 골 쪽 수비 ≤ 1 일 때 무엇을 고르나, 슛을 골랐을 때 슛 효용 대 최고 몰기·돌파·패스 효용
interface Dec { team: 0 | 1; d: number; gs: number; chosen: string; uShot: number; uCarry: number; vCarry: number; pCarry: number; uDrib: number; uPass: number; xg: number; near: number }
const decs: Dec[] = [];
const LB = ENGINE.pitch.boxDepth, WB = ENGINE.pitch.boxWidth / 2;

function inBox(x: number, y: number, gx: number, gy: number): boolean { return Math.abs(x - gx) <= LB && Math.abs(y - gy) <= WB; }

for (let k = 0; k < n; k++) {
  const seed = 71000 + k;
  const M = build('a', seed, 75, mySpec, 75, cells);
  const O = build('b', seed, 75, oppSpec, 75, null);
  const mHome = k % 2 === 1;
  const sim = createMatch({ home: mHome ? M : O, away: mHome ? O : M, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  const s = sim.state;
  const mTeam: 0 | 1 = mHome ? 0 : 1;
  const who = (team: 0 | 1): 0 | 1 => (team === mTeam ? 0 : 1); // 0 = 몰빵(나), 1 = 상대
  probe.shot = (st, p) => {
    const a = st.agents[p.shooter]!;
    const defTeam = (1 - a.team) as 0 | 1;
    const dirD = attackDir(defTeam, st.half);
    const [gx, gy] = ownGoal(dirD);
    const sd = dist(a.x, a.y, gx, gy);
    let gs = 0, near = 99, bd1 = 0, bd2 = 0, ba = 0, gkOut = NaN;
    for (const o of st.agents) {
      if (!o.onPitch) continue;
      if (o.team === defTeam) {
        if (o.line === 0) { gkOut = dist(o.x, o.y, gx, gy); continue; }
        if (dist(o.x, o.y, gx, gy) < sd - 0.5) gs++;
        near = Math.min(near, dist(o.x, o.y, a.x, a.y));
        if (inBox(o.x, o.y, gx, gy)) { if (o.line === 1) bd1++; else bd2++; }
      } else if (o.line !== 0 && inBox(o.x, o.y, gx, gy)) ba++;
    }
    const counter = st.possOrigin === 'open' && st.t - st.teams[a.team].wonAt <= 8;
    const sh: Shot = { team: who(a.team), d: p.d, xg: p.xg ?? 0, out: p.outcome, gs, near, counter, line: a.line, pos: a.pos, boxDef1: bd1, boxDef2: bd2, boxAtt: ba, pOn: p.pOn, gkOut };
    shots.push(sh);
    // 결과는 뒤에 고쳐진다 — 객체 참조로 따라감
    (p as unknown as { _ref: Shot })._ref = sh;
    const orig = p;
    Object.defineProperty(orig, 'outcome', { get() { return sh.out; }, set(v) { sh.out = v; }, configurable: true });
  };
  probe.decide = (st, p) => {
    const a = p.a;
    if (a.line === 0 || st.restart) return;
    const dirA = attackDir(a.team, st.half);
    const [gx, gy] = ownGoal(-dirA as 1 | -1);
    const d = dist(a.x, a.y, gx, gy);
    if (d > 25 || toNorm(a.x, a.y, dirA)[0] < 0.6) return;
    let gs = 0, near = 99;
    for (const o of st.agents) {
      if (!o.onPitch || o.team === a.team || o.line === 0) continue;
      if (dist(o.x, o.y, gx, gy) < d - 0.5) gs++;
      near = Math.min(near, dist(o.x, o.y, a.x, a.y));
    }
    const best = (t: string) => p.cands.filter((c) => c.type === t && !c.ot).reduce((m, c) => (c.u > m ? c.u : m), -9);
    const bc = p.cands.filter((c) => c.type === 'carry' && !c.ot).sort((x, y) => y.u - x.u)[0];
    const sh = p.cands.find((c) => c.type === 'shoot' && !c.ot);
    decs.push({ team: who(a.team), d, gs, chosen: p.chosen.type, uShot: sh ? sh.u : -9, uCarry: bc ? bc.u : -9, vCarry: bc ? bc.value : 0, pCarry: bc ? bc.p : 0, uDrib: best('dribble'), uPass: Math.max(best('pass'), best('through'), best('cross')), xg: sh ? sh.p : 0, near });
  };
  let lastOwner = -1;
  let seq: { team: 0 | 1; startOwn: boolean; crossed: boolean } | null = null;
  const band = 8 / L;
  while (!s.done) {
    sim.step();
    const b = s.ball;
    if (s.restart) { lastOwner = -1; seq = null; continue; }
    if (b.owner < 0) continue;
    const o = s.agents[b.owner]!;
    const ot = o.team, dt = (1 - ot) as 0 | 1;
    const dirO = attackDir(ot, s.half);
    const onx = toNorm(o.x, o.y, dirO)[0];
    // 소유 시퀀스 (⒟)
    if (!seq || seq.team !== ot) {
      if (seq && seq.startOwn && !seq.crossed) { if (who(seq.team) === 0) seqOwnLost++; else seqOwnLostO++; }
      seq = { team: ot, startOwn: onx < 0.5, crossed: onx >= 0.5 };
      if (seq.startOwn) { if (who(ot) === 0) seqOwn++; else seqOwnO++; }
    } else if (onx >= 0.5) seq.crossed = true;
    // 박스 수신 (⒞): 소유자가 바뀐 틱, 상대 박스 안
    if (b.owner !== lastOwner && lastOwner >= 0 && s.agents[lastOwner]!.team === ot) {
      const dirD = attackDir(dt, s.half);
      const [gx, gy] = ownGoal(dirD);
      if (inBox(o.x, o.y, gx, gy)) {
        let near = 99, d1 = 0, d2 = 0, at = 0;
        for (const q of s.agents) {
          if (!q.onPitch || q.line === 0) continue;
          if (q.team === dt) { near = Math.min(near, dist(q.x, q.y, o.x, o.y)); if (inBox(q.x, q.y, gx, gy)) { if (q.line === 1) d1++; else d2++; } }
          else if (inBox(q.x, q.y, gx, gy)) at++;
        }
        if (who(ot) === 0) {
          boxRecv++; if (near > 3) boxRecvFree++; boxRecvDef += d1; boxRecvDef2 += d2; boxRecvAtt += at;
          let asg = 0;
          for (const q of s.agents) if (q.onPitch && q.team === dt && q.line !== 0 && q.tvIdx === o.idx) { asg++; recvAssignDist += dist(q.x, q.y, o.x, o.y); recvAssignDistN++; }
          if (asg > 0) recvAssigned++;
          recvAssignedN++;
          for (const q of s.agents) {
            if (!q.onPitch || q.team !== ot || q.line === 0 || !inBox(q.x, q.y, gx, gy)) continue;
            boxAttN++;
            let m = 0, nd = 99;
            for (const r of s.agents) if (r.onPitch && r.team === dt && r.line !== 0) { if (r.tvIdx === q.idx) m++; nd = Math.min(nd, dist(r.x, r.y, q.x, q.y)); }
            if (m > 0) boxAttMarked++;
            if (nd <= 2) boxAttNear++;
          }
        }
        else { boxRecvO++; if (near > 3) boxRecvFreeO++; }
      }
    }
    lastOwner = b.owner;
    // ⒝ 줄 인원: 상대(균형)가 수비, 몰빵 소유, 1초마다
    if (who(ot) === 0 && s.possOrigin === 'open' && s.tick % 10 === 0) {
      const dirD = attackDir(dt, s.half);
      const [gx, gy] = ownGoal(dirD);
      const bnx = toNorm(b.x, b.y, dirD)[0];
      // 균형 줄 1 (압박 제외) 평균 x
      let l1 = 0, l1n = 0;
      const defs: typeof s.agents = [];
      for (const q of s.agents) if (q.onPitch && q.team === dt && q.line === 1) { l1 += toNorm(q.x, q.y, dirD)[0]; l1n++; if (ballRank(s, q, b.x, b.y) >= 2) defs.push(q); }
      if (!l1n) continue;
      const lineX = l1 / l1n;
      let att = 0, mid2 = 0;
      for (const q of s.agents) {
        if (!q.onPitch || q.line === 0) continue;
        const qx = toNorm(q.x, q.y, dirD)[0];
        if (q.team === ot && q !== o && qx < lineX + band) att++;
        if (q.team === dt && q.line === 2 && qx < bnx) mid2++;
      }
      const sp = att - defs.length;
      const key = String(Math.max(-3, Math.min(5, sp)));
      surplus[key] = (surplus[key] ?? 0) + 1; surplusN++;
      if (bnx < 0.34) { surplusHi[key] = (surplusHi[key] ?? 0) + 1; surplusHiN++; }
      attAtLineSum += att; def1Sum += defs.length; mid2BackSum += mid2; tickN++;
    }
  }
  probe.shot = undefined;
  probe.decide = undefined;
  const st = s.teams;
  for (const tm of [0, 1] as const) {
    const X = who(tm);
    // 자기 ⅓ 패스는 stats 에 없음 — 생략(전체 패스 성공률만)
    passOwn[X] += st[tm].stats.passes; passOwnOk[X] += st[tm].stats.passesCompleted;
  }
}
const pc = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(1) : '-');
const f2 = (x: number) => x.toFixed(2);
console.log(`\n몰빵 ${cellsArg} (${customLabel(cells)}) ${mySpec} 대 4-4-2 ${oppSpec} · 75:75 · ${n}경기 · 덮어쓰기 ${JSON.stringify(overrides)}`);
console.log('\n⒜ 슛 1건 자료 (팀당 /경기)');
console.log('| 팀 | 슛 | xG 합 | 골 | 유효 | 유효→골% | 골/xG | 평균 거리 | 골 쪽 수비 ≤1 슛 (골·xG) | 역습 슛 (골·xG·유효→골%) | 3 m 안 수비 없음% | 슈터 줄 1/2/3 % | 박스 안 수비 1/2줄 (슛 순간) | 박스 안 공격 | GK 골라인 거리 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const T of [0, 1] as const) {
  const xs = shots.filter((q) => q.team === T);
  const g = xs.filter((q) => q.out === 'goal').length;
  const on = xs.filter((q) => q.out === 'goal' || q.out === 'save').length;
  const xg = xs.reduce((a, q) => a + q.xg, 0);
  const oneOnOne = xs.filter((q) => q.gs <= 1);
  const ctr = xs.filter((q) => q.counter);
  const free = xs.filter((q) => q.near > 3).length;
  const lines = [1, 2, 3].map((l) => pc(xs.filter((q) => q.line === l).length, xs.length));
  const gkOut = xs.filter((q) => !Number.isNaN(q.gkOut)).reduce((a, q) => a + q.gkOut, 0) / Math.max(1, xs.length);
  console.log(`| ${T === 0 ? '몰빵' : '상대'} | ${f2(xs.length / n)} | ${f2(xg / n)} | ${f2(g / n)} | ${f2(on / n)} | ${pc(g, on)} | ${f2(g / Math.max(0.01, xg))} | ${(xs.reduce((a, q) => a + q.d, 0) / Math.max(1, xs.length)).toFixed(1)} | ${f2(oneOnOne.length / n)} (${f2(oneOnOne.filter((q) => q.out === 'goal').length / n)} · ${f2(oneOnOne.reduce((a, q) => a + q.xg, 0) / n)}) | ${f2(ctr.length / n)} (${f2(ctr.filter((q) => q.out === 'goal').length / n)} · ${f2(ctr.reduce((a, q) => a + q.xg, 0) / n)} · ${pc(ctr.filter((q) => q.out === 'goal').length, ctr.filter((q) => q.out === 'goal' || q.out === 'save').length)}) | ${pc(free, xs.length)} | ${lines.join('/')} | ${f2(xs.reduce((a, q) => a + q.boxDef1, 0) / Math.max(1, xs.length))} / ${f2(xs.reduce((a, q) => a + q.boxDef2, 0) / Math.max(1, xs.length))} | ${f2(xs.reduce((a, q) => a + q.boxAtt, 0) / Math.max(1, xs.length))} | ${gkOut.toFixed(1)} |`);
}
console.log('\n⒜′ 상대 슛 거리 구간별 (슛/경기 · 골/경기 · 유효→골% · 골/xG · 골 쪽 수비 평균)');
for (const T of [0, 1] as const) {
  const xs = shots.filter((q) => q.team === T);
  const bins: [number, number, string][] = [[0, 12, '<12'], [12, 16.5, '12~16.5'], [16.5, 25, '16.5~25'], [25, 99, '25+']];
  const row = bins.map(([lo, hi, nm]) => {
    const ys = xs.filter((q) => q.d >= lo && q.d < hi);
    const g = ys.filter((q) => q.out === 'goal').length, on = ys.filter((q) => q.out === 'goal' || q.out === 'save').length;
    return `${nm}: ${f2(ys.length / n)} · ${f2(g / n)} · ${pc(g, on)} · ${f2(g / Math.max(0.01, ys.reduce((a, q) => a + q.xg, 0)))} · gs ${(ys.reduce((a, q) => a + q.gs, 0) / Math.max(1, ys.length)).toFixed(1)}`;
  });
  console.log(`- ${T === 0 ? '몰빵' : '상대'}: ${row.join(' | ')}`);
}
console.log('\n⒝ 상대(균형)가 수비할 때 줄 인원 (1초 표본, 몰빵 소유 오픈 플레이): 공격 줄 = 균형 수비 줄 평균 x + 8 m 안쪽·골 쪽 몰빵 선수(소유자 제외), 수비 줄 = 균형 줄 1 중 압박 아닌 선수');
console.log(`- 평균: 공격 줄 ${f2(attAtLineSum / Math.max(1, tickN))} 대 수비 줄 ${f2(def1Sum / Math.max(1, tickN))} · 공 뒤 균형 줄 2 ${f2(mid2BackSum / Math.max(1, tickN))} (표본 ${tickN})`);
console.log(`- 초과(공격−수비) 분포 전체: ${Object.keys(surplus).sort((a, b) => Number(a) - Number(b)).map((k) => `${k}: ${pc(surplus[k]!, surplusN)}%`).join(' · ')}`);
console.log(`- 초과 분포 (공이 균형 수비 ⅓ 안): ${Object.keys(surplusHi).sort((a, b) => Number(a) - Number(b)).map((k) => `${k}: ${pc(surplusHi[k]!, surplusHiN)}%`).join(' · ')} (표본 ${surplusHiN})`);
console.log('\n⒞ 박스 수신 (/경기): 몰빵 ' + f2(boxRecv / n) + ' · 3 m 안 수비 없음 ' + pc(boxRecvFree, boxRecv) + '% · 수신 순간 박스 안 균형 수비 줄 1 ' + f2(boxRecvDef / Math.max(1, boxRecv)) + ' / 줄 2 ' + f2(boxRecvDef2 / Math.max(1, boxRecv)) + ' · 박스 안 몰빵 공격 ' + f2(boxRecvAtt / Math.max(1, boxRecv)) + ' ‖ 상대 ' + f2(boxRecvO / n) + ' · 자유 ' + pc(boxRecvFreeO, boxRecvO) + '%');
console.log('\n⒠ 슛 거리 안(≤ 25 m, 상대 진영 0.6+) 결정 (/경기): 골 쪽 수비 수별 선택 비율 · 슛 골랐을 때 평균 (xG · 슛 u · 최고 몰기 u · 몰기 value · 몰기 p · 최고 돌파 u · 최고 패스 u · 3 m 안 수비 없음%)');
for (const T of [0, 1] as const) {
  for (const [lo, hi, nm] of [[0, 1, 'gs≤1'], [2, 9, 'gs≥2']] as const) {
    const xs = decs.filter((q) => q.team === T && q.gs >= lo && q.gs <= hi);
    const cnt = (t: string) => pc(xs.filter((q) => q.chosen === t).length, xs.length);
    const sh = xs.filter((q) => q.chosen === 'shoot');
    const av = (f: (q: Dec) => number) => (sh.reduce((a, q) => a + f(q), 0) / Math.max(1, sh.length)).toFixed(3);
    const far = sh.filter((q) => q.d >= 12);
    const avf = (f: (q: Dec) => number) => (far.reduce((a, q) => a + f(q), 0) / Math.max(1, far.length)).toFixed(3);
    console.log(`- ${T === 0 ? '몰빵' : '상대'} ${nm}: ${f2(xs.length / n)}/경기 · 슛 ${cnt('shoot')} 몰기 ${cnt('carry')} 돌파 ${cnt('dribble')} 패스 ${cnt('pass')} 침투 ${cnt('through')} 크로스 ${cnt('cross')} 유지 ${cnt('hold')} · 슛 골랐을 때 거리 ${av((q) => q.d)}: xG ${av((q) => q.xg)} · u슛 ${av((q) => q.uShot)} · u몰기 ${av((q) => q.uCarry)} · v몰기 ${av((q) => q.vCarry)} · p몰기 ${av((q) => q.pCarry)} · u돌파 ${av((q) => q.uDrib)} · u패스 ${av((q) => q.uPass)} · 자유 ${pc(sh.filter((q) => q.near > 3).length, sh.length)}% ‖ 12 m+ 슛만(${f2(far.length / n)}): xG ${avf((q) => q.xg)} · u슛 ${avf((q) => q.uShot)} · u몰기 ${avf((q) => q.uCarry)} · v몰기 ${avf((q) => q.vCarry)} · p몰기 ${avf((q) => q.pCarry)} · u패스 ${avf((q) => q.uPass)} · 자유 ${pc(far.filter((q) => q.near > 3).length, far.length)}%`);
  }
}
console.log('⒞′ 마커 배정 (몰빵 박스 수신 순간): 수신자에게 배정된 수비(tvIdx) 있음 ' + pc(recvAssigned, recvAssignedN) + '% · 배정 수비 평균 거리 ' + (recvAssignDist / Math.max(1, recvAssignDistN)).toFixed(2) + ' m · 박스 안 공격수 중 배정 마커 있음 ' + pc(boxAttMarked, boxAttN) + '% · 2 m 안 수비 있음 ' + pc(boxAttNear, boxAttN) + '% (박스 안 공격수 표본 ' + boxAttN + ')');
console.log('\n⒟ 빌드업: 자기 진영 시작 소유 중 하프라인 못 넘기고 잃음 — 몰빵 ' + pc(seqOwnLost, seqOwn) + '% (' + f2(seqOwn / n) + '/경기) · 상대 ' + pc(seqOwnLostO, seqOwnO) + '% (' + f2(seqOwnO / n) + '/경기) · 패스 성공률 몰빵 ' + pc(passOwnOk[0]!, passOwn[0]!) + ' 상대 ' + pc(passOwnOk[1]!, passOwn[1]!));
