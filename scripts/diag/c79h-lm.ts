// @ts-nocheck — 진단 스크립트 (엔진관리자18, C.79h 줄 인원 맞춤이 게겐 대 직선 칸만 지운 이유)
// 두 전술 A 대 B(동레이팅 75, 4-4-2)를 메인 스레드(probe 훅 + lineMatchPeek 읽기만, 지문 불변)로 돌려 팀별로
//  ⒜ 줄 인원 맞춤 발동: 수비 틱 중 내려온 인원 ≥ 1 인 비율(인원별), 발동 횟수/경기, 발동 순간 — 상대가 공을 가진 뒤 몇 초(소유 전환 직후?), 공 위치(우리 골 기준 ⅓), 공이 떠 있는지(롱볼), 상대 공격 줄·우리 수비 줄 인원, 우리 역압박 창 안인지, 내려온 선수 포지션 · 발동 길이
//  ⒝ 상대 슛: 슛 순간 우리 내려온 인원(0 / ≥1)별 수·xG 합·골·박스 안 우리 수비(줄 1 / 내려온 줄 2 / 다른 줄 2)
//  ⒞ 우리 공격: 오픈 플레이 탈취(wonAt) 위치·그 뒤 8초 슛·xG · 탈취 순간 공보다 앞(상대 골 쪽) 우리 필드 선수 수 · 우리 슛 전체 xG·골
//  ⒟ 상대가 공을 가진 동안 상대 롱볼(long/clear 비행) 착지 결과: 떠 있는 동안 우리 내려온 인원
// 실행: npx vite-node scripts/diag/c79h-lm.ts -- [경기수=40] A B [seed=91000] [경로=값 …]
import { setEnvironmentFixed } from '../../src/weather';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { FORMATION_SLOTS } from '../../src/formations';
import { createMatch } from '../../src/engine/sim';
import { ENGINE } from '../../src/engine/config';
import { tacticsOf, type Level } from '../../src/engine/tactics';
import { attackDir, dist, toNorm, ownGoal, L } from '../../src/engine/pitch';
import { ballRank, lineMatchPeek } from '../../src/engine/offball';
import { probe } from '../../src/engine/probe';
import type { TeamSetup, Tendency } from '../../src/engine/types';

setEnvironmentFixed(true);
const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
let n = 40;
let seed0 = 91000;
const specs: string[] = [];
for (const a of all) {
  if (a.startsWith('seed=')) seed0 = Number(a.slice(5));
  else if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
  else specs.push(a);
}
if (specs.length < 2) { console.log('A B 두 전술을 주세요'); process.exit(1); }
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
function build(side: string, seed: number, rating: number, spec: string): TeamSetup {
  const roster = createTeamRoster({ id: `v${side}${seed}`, rating }, `eng-${side}-${rating}-${seed}`, 2018, []);
  roster.formation = '4-4-2';
  const setup = teamSetupFromRoster(roster, rosterRating(roster), rating, `w${seed}`);
  const before = setup.tactics.tendency;
  setup.tactics = { ...setup.tactics, ...tac(spec) };
  if (setup.tactics.tendency !== before) {
    const slots = FORMATION_SLOTS[roster.formation];
    for (const p of setup.lineup) delete p.role;
    fillRoles(setup, (slot) => slots[slot]!.pos);
  }
  return setup;
}
const LB = ENGINE.pitch.boxDepth, WB = ENGINE.pitch.boxWidth / 2;
const inBox = (x: number, y: number, gx: number, gy: number) => Math.abs(x - gx) <= LB && Math.abs(y - gy) <= WB;

interface Side {
  defTicks: number; dropTicks: number[]; // [1,2,3+]
  act: number; actSince: number[]; // 상대 소유 뒤 초 [<1, 1~3, 3~6, 6~12, 12+]
  actZone: number[]; // 공 위치 우리 골 기준 [<⅓, ⅓~½, ½~⅔, ⅔+]
  actFlight: number; actLong: number; actPress: number; actRestart: number;
  actAtts: number; actDefs: number; actSurplus: number[]; // [2,3,4+]
  actPos: Record<string, number>;
  epLen: number[]; // 발동 길이 초 [<1, 1~3, 3~8, 8+]
  epSum: number;
  // ⒝ 상대 슛 (내 수비): drop 0 / ≥1
  oppShot: number[]; oppXg: number[]; oppGoal: number[]; oppBoxD1: number[]; oppBoxDrop: number[]; oppBoxD2: number[]; oppBoxAtt: number[]; oppGsLe1: number[];
  // ⒞ 내 공격
  wins: number; winsOppHalf: number; winShot8: number; winXg8: number; winAhead: number; winAheadN: number;
  shots: number; xg: number; goals: number;
  // 내 슛 순간 상대 내려온 인원 0 / ≥1
  myShot: number[]; myXg: number[]; myGoal: number[];
  // ⒟ 상대 롱볼 비행 동안 우리 drop
  oppLong: number; oppLongDrop: number; oppLongLandAtt: number; oppLongLandDef: number;
  // 수비 때 우리 줄 1 평균 x(자기 골 기준) · 상대 공격 줄 인원 평균(수비 틱)
  lineSum: number; attsSum: number; defsSum: number; nullTicks: number;
  // 내 슛 분류 [수, xG, 골] — 탈취 8초 · 직전 2초 크로스 · 직전 2초 롱볼 · 헤더 · 재시작 소유 · 소유 8초 안 · 8~20 · 20+ · 슈터 FB · 윙 · CM · ST
  cat: Record<string, [number, number, number]>;
  dropDx: number[]; // 발동 순간 내려온 선수의 (x − 우리 수비 줄 x) m 분포 [<10, 10~20, 20~30, 30+]
  dropDxSum: number; dropDxN: number;
}
const mk = (): Side => ({ defTicks: 0, dropTicks: [0, 0, 0], act: 0, actSince: [0, 0, 0, 0, 0], actZone: [0, 0, 0, 0], actFlight: 0, actLong: 0, actPress: 0, actRestart: 0, actAtts: 0, actDefs: 0, actSurplus: [0, 0, 0], actPos: {}, epLen: [0, 0, 0, 0], epSum: 0,
  oppShot: [0, 0], oppXg: [0, 0], oppGoal: [0, 0], oppBoxD1: [0, 0], oppBoxDrop: [0, 0], oppBoxD2: [0, 0], oppBoxAtt: [0, 0], oppGsLe1: [0, 0],
  wins: 0, winsOppHalf: 0, winShot8: 0, winXg8: 0, winAhead: 0, winAheadN: 0, shots: 0, xg: 0, goals: 0, myShot: [0, 0], myXg: [0, 0], myGoal: [0, 0],
  oppLong: 0, oppLongDrop: 0, oppLongLandAtt: 0, oppLongLandDef: 0, lineSum: 0, attsSum: 0, defsSum: 0, nullTicks: 0, cat: {}, dropDx: [0, 0, 0, 0], dropDxSum: 0, dropDxN: 0 });
const S: Side[] = [mk(), mk()];
let gamesN = 0;

for (let k = 0; k < n; k++) {
  const seed = seed0 + k;
  const A = build('a', seed, 75, specs[0]!);
  const B = build('b', seed, 75, specs[1]!);
  const aHome = k % 2 === 0;
  const sim = createMatch({ home: aHome ? A : B, away: aHome ? B : A, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  const s = sim.state;
  const side = (team: 0 | 1): 0 | 1 => ((team === 0) === aHome ? 0 : 1);
  const dropNow: [number, number] = [0, 0];
  const epStart: [number, number] = [-1, -1];
  const lastWon: [number, number] = [-1, -1];
  const lastPlan: [any, any] = [null, null];
  const lastFlight: [{ kind: string; t: number }, { kind: string; t: number }] = [{ kind: '', t: -99 }, { kind: '', t: -99 }];
  // 슛 기록 (결과는 나중에 고쳐짐)
  const shotRefs: { sd: Side; i: number; mine: boolean; p: any }[] = [];
  probe.shot = (st, p) => {
    const a = st.agents[p.shooter]!;
    const defTeam = (1 - a.team) as 0 | 1;
    const dSide = S[side(defTeam)]!;
    const aSide = S[side(a.team)]!;
    const dirD = attackDir(defTeam, st.half);
    const [gx, gy] = ownGoal(dirD);
    const sd = dist(a.x, a.y, gx, gy);
    const lm = lineMatchPeek(st, defTeam);
    const dsz = lm ? lm.drop.size : 0;
    const i = dsz >= 1 ? 1 : 0;
    let bd1 = 0, bdrop = 0, bd2 = 0, ba = 0, gs = 0;
    for (const o of st.agents) {
      if (!o.onPitch || o.line === 0) continue;
      if (o.team === defTeam) {
        if (dist(o.x, o.y, gx, gy) < sd - 0.5) gs++;
        if (inBox(o.x, o.y, gx, gy)) { if (o.line === 1) bd1++; else if (lm && lm.drop.has(o.idx)) bdrop++; else if (o.line === 2) bd2++; }
      } else if (inBox(o.x, o.y, gx, gy)) ba++;
    }
    const xg = p.xg ?? 0;
    dSide.oppShot[i]!++; dSide.oppXg[i]! += xg; dSide.oppBoxD1[i]! += bd1; dSide.oppBoxDrop[i]! += bdrop; dSide.oppBoxD2[i]! += bd2; dSide.oppBoxAtt[i]! += ba; if (gs <= 1) dSide.oppGsLe1[i]!++;
    aSide.shots++; aSide.xg += xg; aSide.myShot[i]!++; aSide.myXg[i]! += xg;
    const tm = st.teams[a.team]!;
    if (st.possOrigin === 'open' && st.t - tm.wonAt <= 8) { aSide.winShot8++; aSide.winXg8 += xg; }
    const cats: string[] = [];
    if (st.possOrigin === 'open' && st.t - tm.wonAt <= 8) cats.push('탈취8초');
    const lf = lastFlight[a.team]!;
    if (st.t - lf.t <= 2 && lf.kind === 'cross') cats.push('크로스뒤');
    if (st.t - lf.t <= 2 && lf.kind === 'long') cats.push('롱볼뒤');
    if (p.kind === 'header') cats.push('헤더');
    if (st.possOrigin !== 'open') cats.push('재시작소유');
    const since = st.t - st.possStartT;
    cats.push(since <= 8 ? '소유8초안' : since <= 20 ? '소유8~20' : '소유20+');
    const g = a.pos === 'LB' || a.pos === 'RB' || a.pos === 'LWB' || a.pos === 'RWB' ? 'FB' : a.pos === 'LM' || a.pos === 'RM' || a.pos === 'LW' || a.pos === 'RW' ? '윙' : a.pos === 'ST' || a.pos === 'CF' ? 'ST' : a.line === 1 ? 'CB' : 'CM';
    cats.push('슈터' + g);
    cats.push(st.half === 1 ? '전반' : '후반');
    for (const c of cats) { const e = (aSide.cat[c] ??= [0, 0, 0]); e[0]++; e[1] += xg; }
    shotRefs.push({ sd: dSide, i, mine: false, p });
    shotRefs.push({ sd: aSide, i, mine: true, p, cats });
  };
  const seen = new WeakSet<object>();
  while (!s.done) {
    sim.step();
    // 슛 결과 반영 (골)
    for (const r of shotRefs) {
      if (r.p.outcome === 'goal' && !seen.has(r)) { seen.add(r); if (r.mine) { r.sd.goals++; r.sd.myGoal[r.i]!++; for (const c of r.cats) r.sd.cat[c]![2]++; } else r.sd.oppGoal[r.i]!++; }
    }
    const b = s.ball;
    const owner = b.owner >= 0 ? s.agents[b.owner]! : null;
    const att = owner ? owner.team : s.possTeam;
    if (b.flight && b.flight.kind !== 'shot') { const pt = s.agents[b.flight.passer]?.team; if (pt !== undefined) lastFlight[pt] = { kind: b.flight.kind, t: s.t }; }
    for (const team of [0, 1] as const) {
      const sd = S[side(team)]!;
      const tm = s.teams[team]!;
      // ⒞ 탈취 기록
      if (tm.wonAt !== lastWon[team]) {
        lastWon[team] = tm.wonAt;
        if (tm.wonAt > 0) {
          sd.wins++;
          const dir = attackDir(team, s.half);
          const [bx] = toNorm(b.x, b.y, dir);
          if (bx > 0.5) sd.winsOppHalf++;
          let ahead = 0;
          for (const o of s.agents) if (o.onPitch && o.team === team && o.line !== 0 && toNorm(o.x, o.y, dir)[0] > bx) ahead++;
          sd.winAhead += ahead; sd.winAheadN++;
        }
      }
      if (att === team || s.restart) {
        if (dropNow[team] > 0) { const len = s.t - epStart[team]; sd.epLen[len < 1 ? 0 : len < 3 ? 1 : len < 8 ? 2 : 3]!++; sd.epSum += len; }
        dropNow[team] = 0;
        continue;
      }
      const lm0 = lineMatchPeek(s, team, s.tick - 1); // step() 끝에 tick 이 하나 늘어 있다
      sd.defTicks++;
      // 이 틱에 아무 선수도 오프볼 판단을 안 했으면 계획이 없다 (엔진도 그 틱엔 prev 를 잃는다) — 탐침은 직전 값을 잇고 그 수를 센다
      if (!lm0) sd.nullTicks++;
      const lm = lm0 ?? lastPlan[team];
      if (lm0) lastPlan[team] = lm0;
      const dsz = lm ? lm.drop.size : 0;
      if (dsz >= 1) sd.dropTicks[Math.min(dsz, 3) - 1]!++;
      const dir = attackDir(team, s.half);
      const oppTm = s.teams[1 - team]!;
      // 수비 때 줄 인원 (1초마다)
      if (s.tick % 10 === 0) {
        let lx = 0, ln = 0, defs = 0;
        for (const o of s.agents) { if (!o.onPitch || o.team !== team || o.line !== 1) continue; lx += toNorm(o.x, o.y, dir)[0]; ln++; if (ballRank(s, o, b.x, b.y) >= 2) defs++; }
        const band = (ln ? lx / ln : 0) + ENGINE.offball.lineMatchBand / L;
        let atts = 0;
        for (const o of s.agents) if (o.onPitch && o.team !== team && o.line !== 0 && o !== owner && toNorm(o.x, o.y, dir)[0] < band) atts++;
        sd.lineSum += ln ? lx / ln : 0; sd.attsSum += atts; sd.defsSum += defs;
      }
      // ⒟ 상대 롱볼 비행
      const fl = b.flight;
      if (!owner && fl && (fl.kind === 'long' || fl.kind === 'clear') && s.agents[fl.passer]?.team !== team) {
        if (!seen.has(fl)) { seen.add(fl); sd.oppLong++; if (dsz >= 1) sd.oppLongDrop++; }
      }
      if (dsz >= 1 && dropNow[team] === 0) {
        // ⒜ 발동
        sd.act++;
        epStart[team] = s.t;
        const since = s.possOrigin === 'open' ? s.t - oppTm.wonAt : -1;
        if (since < 0) sd.actRestart++;
        else sd.actSince[since < 1 ? 0 : since < 3 ? 1 : since < 6 ? 2 : since < 12 ? 3 : 4]!++;
        const [bx] = toNorm(b.x, b.y, dir);
        sd.actZone[bx < 1 / 3 ? 0 : bx < 0.5 ? 1 : bx < 2 / 3 ? 2 : 3]!++;
        if (!owner) { sd.actFlight++; if (fl && (fl.kind === 'long' || fl.kind === 'clear')) sd.actLong++; }
        if (s.t < tm.counterUntil && tm.counterPressers.length) sd.actPress++;
        let lx = 0, ln = 0, defs = 0;
        for (const o of s.agents) { if (!o.onPitch || o.team !== team || o.line !== 1) continue; lx += toNorm(o.x, o.y, dir)[0]; ln++; if (ballRank(s, o, b.x, b.y) >= 2) defs++; }
        const band = (ln ? lx / ln : 0) + ENGINE.offball.lineMatchBand / L;
        let atts = 0;
        for (const o of s.agents) if (o.onPitch && o.team !== team && o.line !== 0 && o !== owner && toNorm(o.x, o.y, dir)[0] < band) atts++;
        sd.actAtts += atts; sd.actDefs += defs;
        const sur = atts - defs;
        sd.actSurplus[sur <= 2 ? 0 : sur === 3 ? 1 : 2]!++;
        for (const i of lm!.drop) { const o = s.agents[i]!; const key = `${o.pos}/${o.role.id}`; sd.actPos[key] = (sd.actPos[key] ?? 0) + 1; const dx = (toNorm(o.x, o.y, dir)[0] - (ln ? lx / ln : 0)) * L; sd.dropDx[dx < 10 ? 0 : dx < 20 ? 1 : dx < 30 ? 2 : 3]!++; sd.dropDxSum += dx; sd.dropDxN++; }
      } else if (dsz === 0 && dropNow[team] > 0) {
        const len = s.t - epStart[team]; sd.epLen[len < 1 ? 0 : len < 3 ? 1 : len < 8 ? 2 : 3]!++; sd.epSum += len;
      }
      dropNow[team] = dsz;
    }
  }
  gamesN++;
  if ((k + 1) % 10 === 0) console.error(`${k + 1}/${n}`);
}

const f = (v: number, q = 2) => (v / gamesN).toFixed(q);
console.log(`\n${specs[0]} 대 ${specs[1]} ${gamesN}경기 (시드 ${seed0}~), 덮어쓰기 ${JSON.stringify(overrides)}`);
for (const i of [0, 1] as const) {
  const sd = S[i]!;
  const name = specs[i];
  const dt = sd.defTicks || 1;
  console.log(`\n### ${name} (득점 ${f(sd.goals)} · 슛 ${f(sd.shots, 1)} · xG ${f(sd.xg)} · 탈취 ${f(sd.wins, 1)} (상대 진영 ${f(sd.winsOppHalf, 1)}) · 탈취 8초 슛 ${f(sd.winShot8)} xG ${f(sd.winXg8)} · 탈취 순간 공 앞 인원 ${(sd.winAhead / (sd.winAheadN || 1)).toFixed(2)})`);
  console.log(`- 수비 틱 중 내려온 인원 ≥1: ${(100 * (sd.dropTicks[0] + sd.dropTicks[1] + sd.dropTicks[2]) / dt).toFixed(1)}% (1명 ${(100 * sd.dropTicks[0] / dt).toFixed(1)} · 2명 ${(100 * sd.dropTicks[1] / dt).toFixed(1)} · 3+ ${(100 * sd.dropTicks[2] / dt).toFixed(1)}) · 계획 없는 수비 틱 ${(100 * sd.nullTicks / dt).toFixed(1)}% · 발동 ${f(sd.act, 1)}/경기 · 평균 길이 ${(sd.epSum / (sd.act || 1)).toFixed(1)}초 · 길이 분포 <1/1~3/3~8/8+: ${sd.epLen.join('/')}`);
  console.log(`- 발동 순간 상대 소유 뒤 초 <1/1~3/3~6/6~12/12+: ${sd.actSince.join('/')} · 재시작 소유 ${sd.actRestart} · 공 위치(우리 골 기준) <⅓/⅓~½/½~⅔/⅔+: ${sd.actZone.join('/')} · 공 비행 중 ${sd.actFlight} (롱볼 ${sd.actLong}) · 우리 역압박 창 안 ${sd.actPress}`);
  console.log(`- 발동 순간 상대 공격 줄 ${(sd.actAtts / (sd.act || 1)).toFixed(2)} · 우리 수비 줄(압박 제외) ${(sd.actDefs / (sd.act || 1)).toFixed(2)} · 초과 2/3/4+: ${sd.actSurplus.join('/')} · 수비 틱 평균 줄 1 x ${(sd.lineSum / (sd.defTicks / 10 || 1)).toFixed(3)} 상대 공격 줄 ${(sd.attsSum / (sd.defTicks / 10 || 1)).toFixed(2)} 우리 수비 줄 ${(sd.defsSum / (sd.defTicks / 10 || 1)).toFixed(2)}`);
  console.log(`- 내려온 선수의 수비 줄 앞 거리 m <10/10~20/20~30/30+: ${sd.dropDx.join('/')} · 평균 ${(sd.dropDxSum / (sd.dropDxN || 1)).toFixed(1)}`);
  console.log(`- 내려온 선수: ${Object.entries(sd.actPos).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  for (const j of [0, 1]) {
    const nn = sd.oppShot[j]! || 1;
    console.log(`- 상대 슛(우리 내려온 인원 ${j ? '≥1' : '0'}): ${f(sd.oppShot[j]!, 1)}/경기 · xG/슛 ${(sd.oppXg[j]! / nn).toFixed(3)} · 골 ${f(sd.oppGoal[j]!)} · 골/슛 ${(100 * sd.oppGoal[j]! / nn).toFixed(1)}% · 골 쪽 수비 ≤1 ${(100 * sd.oppGsLe1[j]! / nn).toFixed(0)}% · 박스 안 우리 줄1 ${(sd.oppBoxD1[j]! / nn).toFixed(2)} 내려온 ${(sd.oppBoxDrop[j]! / nn).toFixed(2)} 줄2 ${(sd.oppBoxD2[j]! / nn).toFixed(2)} 상대 공격 ${(sd.oppBoxAtt[j]! / nn).toFixed(2)}`);
  }
  console.log(`- 내 슛(상대 내려온 인원 0 / ≥1): ${f(sd.myShot[0]!, 1)} / ${f(sd.myShot[1]!, 1)} · xG/슛 ${(sd.myXg[0]! / (sd.myShot[0]! || 1)).toFixed(3)} / ${(sd.myXg[1]! / (sd.myShot[1]! || 1)).toFixed(3)} · 골 ${f(sd.myGoal[0]!)} / ${f(sd.myGoal[1]!)}`);
  console.log(`- 내 슛 분류 (수/경기 · xG/슛 · 골/경기): ${Object.entries(sd.cat).map(([k, v]) => `${k} ${f(v[0], 1)}·${(v[1] / (v[0] || 1)).toFixed(3)}·${f(v[2])}`).join(' | ')}`);
  console.log(`- 상대 롱볼(long/clear) ${f(sd.oppLong, 1)}/경기 · 떠 있는 동안 우리 내려온 ≥1 ${(100 * sd.oppLongDrop / (sd.oppLong || 1)).toFixed(0)}%`);
}
process.exit(0);
