// @ts-nocheck — 진단 스크립트 (엔진관리자15, C.79d 직선 롱볼 수신 뒤 전환 탐침, 엄격 타입 검사 제외)
// 질문 1: 직선 롱볼(30 m+ 공중 패스)을 받은 뒤 10초 안에 슛으로 이어지는가 — 착지 결과(받음·경합 패·루즈볼 세컨드볼), 받은 자리(구역),
//   받는 선수(타깃 ST / 2선 / 윙), 등지고 받음, 받는 순간 지원 동료 수(15 m 안 · 앞쪽 · 2선 뒤 20 m), 수비 밀집(5 m 안 · 골 쪽 수비 수),
//   첫 행동(유지·백패스·전진 패스·드리블·슛·레이오프·버티기), 10초 안 슛/골/상실, 슛을 누가(본인·2선·다른 동료).
//   대조: 같은 팀의 땅볼 패스 수신(같은 구역)의 10초 안 슛. 반대 전환(|Δy| ≥ 30 m) 롱볼은 따로.
// 메인 스레드(probe 훅 + 상태 읽기만, 난수 안 부름 — 엔진 지문 불변).
// 실행: npx vite-node scripts/diag/c79d-recv.ts -- [경기수=40] A전술 B전술 [레이팅=75:75] [fit=1|-1 (A 에 직선 적합 ±d)] [d=10] [경로=값 …]
import { setEnvironmentFixed } from '../../src/weather';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { FORMATION_SLOTS } from '../../src/formations';
import { createMatch } from '../../src/engine/sim';
import { ENGINE } from '../../src/engine/config';
import { tacticsOf, type Level } from '../../src/engine/tactics';
import { attackDir, dist, toNorm, L, W } from '../../src/engine/pitch';
import { probe } from '../../src/engine/probe';
import { offsideLine } from '../../src/engine/offball';
import { FIELD_ATTRIBUTES, type FieldAttribute } from '../../src/attributes';
import { attributeOvrWeight, type FieldPosition } from '../../src/positions';
import type { TeamSetup, Tendency } from '../../src/engine/types';

setEnvironmentFixed(true);
const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
const specs: string[] = [];
let n = 40;
let ratings = [75, 75];
let fit = 0;
let fitD = 10;
let fitTend = 'direct';
let profile = 'c78s'; // 엔진관리자19: profile=c79d 면 직선 프로필을 C.79d 정의(c78s-fit.ts 와 같음)로
for (const a of all) {
  if (a.startsWith('fit=')) fit = Number(a.slice(4));
  else if (a.startsWith('d=')) fitD = Number(a.slice(2));
  else if (a.startsWith('fitTend=')) fitTend = a.slice(8);
  else if (a.startsWith('profile=')) profile = a.slice(8);
  else if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
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
// 성향별 맞는 능력치 (c78s-fit.ts 와 같은 표, pending 146)
type G = 'CB' | 'FB' | 'MID' | 'WING' | 'ST';
const grp = (p: string): G => (p === 'CB' ? 'CB' : p === 'LB' || p === 'RB' ? 'FB' : p === 'CM' || p === 'CDM' ? 'MID' : p === 'ST' ? 'ST' : 'WING');
const FIT: Record<string, Partial<Record<G, FieldAttribute[]>>> = {
  direct: { CB: ['longPassing'], FB: ['longPassing', 'crossing'], MID: ['longPassing', 'crossing'], WING: ['crossing', 'ballControl', 'strength'], ST: ['ballControl', 'strength', 'jumping', 'heading'] },
  tikitaka: { CB: ['shortPassing', 'vision', 'ballControl', 'composure', 'offTheBall'], FB: ['shortPassing', 'vision', 'ballControl', 'composure', 'offTheBall'], MID: ['shortPassing', 'vision', 'ballControl', 'composure', 'offTheBall'], WING: ['shortPassing', 'vision', 'ballControl', 'composure', 'offTheBall'], ST: ['shortPassing', 'vision', 'ballControl', 'composure', 'offTheBall'] },
};
if (profile === 'c79d') FIT.direct = {
  CB: ['longPassing', 'vision'], FB: ['longPassing', 'crossing', 'vision'], MID: ['longPassing', 'vision', 'crossing'],
  WING: ['ballControl', 'strength', 'pace', 'acceleration'], ST: ['ballControl', 'strength', 'jumping', 'heading'],
};
function applyFit(setup: TeamSetup, sign: 1 | -1, d: number): void {
  const slots = FORMATION_SLOTS['4-4-2'];
  for (const p of setup.lineup) {
    const pos = slots[p.slot]!.pos;
    if (pos === 'GK') continue;
    const fp = pos as FieldPosition;
    const F = FIT[fitTend]![grp(pos)] ?? [];
    if (!F.length) continue;
    const next = { ...p.attrs };
    let dF = 0;
    for (const k of F) { const v = Math.max(1, Math.min(99, next[k] + sign * d)); dF += attributeOvrWeight(fp, k) * (v - next[k]); next[k] = v; }
    const O = FIELD_ATTRIBUTES.filter((k) => !F.includes(k) && attributeOvrWeight(fp, k) > 0);
    for (let it = 0; it < 4 && Math.abs(dF) > 1e-6; it++) {
      const free = O.filter((k) => (dF > 0 ? next[k] > 1 : next[k] < 99));
      const wsum = free.reduce((t, k) => t + attributeOvrWeight(fp, k), 0);
      if (!wsum) break;
      const delta = -dF / wsum;
      for (const k of free) { const v = Math.max(1, Math.min(99, next[k] + delta)); dF += attributeOvrWeight(fp, k) * (v - next[k]); next[k] = v; }
    }
    for (const k of FIELD_ATTRIBUTES) p.attrs[k] = next[k];
  }
}
function build(side: string, seed: number, rating: number, spec: string, oppRating: number, fitSign: number): TeamSetup {
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
  if (fitSign) applyFit(setup, fitSign as 1 | -1, fitD);
  return setup;
}

const ZONES = ['자기진영', '중원 .5~.67', '최종⅓ 밖 .67~.84', '박스 부근 ≥.84'];
const zoneOf = (nx: number) => (nx < 0.5 ? 0 : nx < 0.67 ? 1 : nx < 0.84 ? 2 : 3);
const posGrp = (p: string) => (p === 'ST' || p === 'CF' ? 'ST' : p === 'LW' || p === 'RW' || p === 'LM' || p === 'RM' ? 'WING' : p === 'CB' || p === 'LB' || p === 'RB' ? 'DEF' : 'MID');
type Rec = {
  kind: 'long' | 'short'; team: 0 | 1; t: number; idx: number; pg: string; line: number; nx: number; ny: number; back: boolean; target: boolean; second: boolean; sw: boolean;
  mates15: number; ahead15: number; behind20: number; opp5: number; oppGoalSide: number; passerLine: number; fromNx: number; lineNx: number; lineAt: number;
  firstAct: string | null; acts: string[]; shotAt: number | null; shooter: string | null; xg: number; goalAt: number | null; lostAt: number | null; oppShotAfterLoss: number;
  shots0: number; goals0: number; oppShots0: number;
};
type Land = { team: 0 | 1; passer: number; passerLine: number; fromNx: number; lineAt: number; receiver: number; fromX: number; fromY: number; toX: number; toY: number; t0: number; sw: boolean; kind: 'long' | 'short'; tEnd: number; loose: boolean };
const mk = () => ({
  long: 0, sw: 0, landRecv: 0, landRecvSw: 0, landAerialLost: 0, landLooseUs: 0, landLooseThem: 0, landOut: 0, landNone: 0, shots: 0, goals: 0,
  recs: [] as Rec[],
});
type T = ReturnType<typeof mk>;
const acc: [T, T] = [mk(), mk()];
// 엔진관리자19 ③: 슛 출처 — 슛 직전 10 s 안 같은 팀의 마지막 수신 종류(롱볼 공중 / 땅볼 패스 / 없음·기타), 골도 같이
const src: Record<string, { shots: number; goals: number }>[] = [{}, {}];
const lastRecv: { kind: string; t: number }[] = [{ kind: '', t: -99 }, { kind: '', t: -99 }];
const classify = (a: any, c: any, dir: number): string => {
  if (c.type !== 'pass' && c.type !== 'through') return c.type;
  const dx = (c.x - a.x) * dir;
  const d = dist(a.x, a.y, c.x, c.y);
  const tag = c.type === 'through' ? '침투' : d >= 30 ? '롱' : '패스';
  return dx > 3 ? `${tag}-앞` : dx < -3 ? `${tag}-뒤` : `${tag}-옆`;
};
for (let k = 0; k < n; k++) {
  const seed = 41000 + k;
  const A = build('a', seed, ratings[0]!, specs[0]!, ratings[1]!, fit);
  const B = build('b', seed, ratings[1]!, specs[1]!, ratings[0]!, 0);
  const aHome = k % 2 === 1;
  const sim = createMatch({ home: aHome ? A : B, away: aHome ? B : A, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  const s = sim.state;
  const who = (team: 0 | 1) => ((team === 0) === aHome ? 0 : 1);
  let lastFl: any = null;
  let pend: Land | null = null;
  let land: Land | null = null;
  const windows: Rec[] = [];
  const makeRec = (a: any, ld: Land, second: boolean): Rec => {
    const dir = attackDir(a.team, s.half);
    const [nx, ny] = toNorm(a.x, a.y, dir);
    let mates15 = 0, ahead15 = 0, behind20 = 0, opp5 = 0, oppGoalSide = 0;
    for (const o of s.agents) {
      if (!o.onPitch || o === a || o.line === 0) continue;
      const d = dist(o.x, o.y, a.x, a.y);
      const onx = toNorm(o.x, o.y, dir)[0];
      if (o.team === a.team) {
        if (d <= 15) { mates15++; if (onx > nx + 0.02) ahead15++; }
        if (o.line === 2 && d <= 20 && onx < nx) behind20++;
      } else {
        if (d <= 5) opp5++;
        if (onx > nx) oppGoalSide++;
      }
    }
    return {
      kind: ld.kind, team: a.team, t: s.t, idx: a.idx, pg: posGrp(a.pos), line: a.line, nx, ny, back: a.backToGoal, target: a.idx === ld.receiver, second, sw: ld.sw,
      mates15, ahead15, behind20, opp5, oppGoalSide, passerLine: ld.passerLine, fromNx: ld.fromNx, lineNx: offsideLine(s, a.team), lineAt: ld.lineAt, firstAct: a.pre ? `OT:${classify(a, a.pre, dir)}` : null, acts: [], shotAt: null, shooter: null, xg: 0, goalAt: null, lostAt: null, oppShotAfterLoss: 0,
      shots0: s.teams[a.team].stats.shots, goals0: s.teams[a.team].stats.goals, oppShots0: s.teams[1 - a.team].stats.shots,
    };
  };
  probe.decide = (st, p) => {
    const a = p.a, c = p.chosen;
    if (a.line === 0) return;
    const dir = attackDir(a.team, st.half);
    for (const w of windows) {
      if (w.team !== a.team || w.lostAt !== null || st.t - w.t > 10) continue;
      const cl = classify(a, c, dir);
      if (w.firstAct === null && a.idx === w.idx) w.firstAct = cl;
      if (w.acts.length < 6) w.acts.push(cl);
    }
  };
  probe.shot = (st, p) => {
    {
      const T = who(p.team);
      const lr = lastRecv[p.team]!;
      const key = p.kind === 'header' ? '헤더(크로스)' : st.t - lr.t <= 10 && lr.kind ? lr.kind : '기타(세트·리바운드·탈취 뒤)';
      const e = (src[T]![key] ??= { shots: 0, goals: 0 });
      e.shots++;
      const ref = p;
      Object.defineProperty(ref, 'outcome', { get() { return ref._o; }, set(v) { ref._o = v; if (v === 'goal') e.goals++; }, configurable: true });
      ref.outcome = p.outcome;
    }
    for (const w of windows) {
      if (w.team !== p.team || st.t - w.t > 10) continue;
      if (w.lostAt !== null) continue;
      if (w.shotAt === null) {
        w.shotAt = st.t - w.t;
        const sh = st.agents[p.shooter]!;
        w.shooter = p.shooter === w.idx ? '본인' : sh.line === 2 ? '2선' : sh.line === 3 ? '다른 공격수' : '수비';
        w.xg = p.xg ?? 0;
      }
    }
  };
  while (!s.done) {
    sim.step();
    const t = s.t, b = s.ball;
    const fl = b.flight;
    // 새 비행
    if (fl && fl !== lastFl) {
      lastFl = fl;
      if (!land && (fl.kind === 'long' || fl.kind === 'pass') && fl.outcome !== 'shot' && fl.outcome !== 'goal' && !fl.fromCross && !s.restart && s.possOrigin === 'open') {
        const passer = s.agents[fl.passer]!;
        const kind = fl.kind === 'long' ? 'long' : 'short';
        pend = { team: passer.team, passer: fl.passer, passerLine: passer.line, fromNx: toNorm(fl.fromX, fl.fromY, attackDir(passer.team, s.half))[0], lineAt: offsideLine(s, passer.team), receiver: fl.receiver, fromX: fl.fromX, fromY: fl.fromY, toX: fl.toX, toY: fl.toY, t0: fl.t0, sw: Math.abs(fl.toY - fl.fromY) >= 30, kind, tEnd: -1, loose: false };
        if (kind === 'long') { acc[who(passer.team)].long++; if (pend.sw) acc[who(passer.team)].sw++; }
      }
    }
    // 비행 끝 → 착지 추적
    if (pend && (!fl || fl !== lastFl || fl.t0 + fl.dur <= t)) {
      if (!fl || fl.passer !== pend.passer || fl.t0 !== pend.t0) { land = { ...pend, tEnd: t }; pend = null; }
    }
    if (land) {
      const X = acc[who(land.team)];
      let done = false;
      if (b.owner >= 0) {
        const a = s.agents[b.owner]!;
        if (a.team === land.team) {
          if (land.kind === 'long') { if (land.loose) X.landLooseUs++; else { X.landRecv++; if (land.sw) X.landRecvSw++; } }
          if (a.line !== 0) windows.push(makeRec(a, land, land.loose));
          if (a.line !== 0) lastRecv[a.team] = { kind: land.kind === 'long' ? '롱볼 수신 뒤' : '땅볼 수신 뒤', t };
        } else if (land.kind === 'long') { if (land.loose) X.landLooseThem++; else X.landAerialLost++; }
        done = true;
      } else if (b.flight && b.flight !== lastFl) {
        // 소유 없이 바로 찼다 (원터치) — 찬 선수가 받은 셈
        const a = s.agents[b.flight.passer]!;
        if (a.team === land.team) { if (land.kind === 'long') { if (land.loose) X.landLooseUs++; else X.landRecv++; } if (a.line !== 0) { windows.push(makeRec(a, land, land.loose)); lastRecv[a.team] = { kind: land.kind === 'long' ? '롱볼 수신 뒤' : '땅볼 수신 뒤', t }; } }
        else if (land.kind === 'long') { if (land.loose) X.landLooseThem++; else X.landAerialLost++; }
        done = true;
      } else if (s.restart) { if (land.kind === 'long') X.landOut++; done = true; }
      else if (t - land.tEnd > 4) { if (land.kind === 'long') X.landNone++; done = true; }
      else if (t - land.tEnd > 0.3) land.loose = true;
      if (done) land = null;
    }
    // 10초 창
    for (let i = windows.length - 1; i >= 0; i--) {
      const w = windows[i]!;
      const el = t - w.t;
      const tm = s.teams[w.team].stats;
      if (w.lostAt === null) {
        if (tm.goals > w.goals0 && w.goalAt === null) w.goalAt = el;
        if (b.owner >= 0 && s.agents[b.owner]!.team !== w.team && !s.restart) w.lostAt = el;
      } else if (s.teams[1 - w.team].stats.shots > w.oppShots0) w.oppShotAfterLoss = 1;
      if (el > 10) { acc[who(w.team)].recs.push(w); windows.splice(i, 1); }
    }
  }
  for (const w of windows) acc[who(w.team)].recs.push(w);
  for (const tm of [0, 1] as const) { acc[who(tm)].shots += s.teams[tm].stats.shots; acc[who(tm)].goals += s.teams[tm].stats.goals; }
  probe.decide = undefined;
  probe.shot = undefined;
  lastRecv[0] = { kind: '', t: -99 }; lastRecv[1] = { kind: '', t: -99 };
}
const pc = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(1) : '-');
const per = (a: number) => (a / n).toFixed(2);
const avg = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : '-');
console.log(`\n${specs[0]}${fit ? `(${fitTend} 적합 ${fit > 0 ? '맞음' : '안맞음'} d=${fitD})` : ''} 대 ${specs[1]} · ${ratings.join(':')} · ${n}경기 · 덮어쓰기 ${JSON.stringify(overrides)}`);
console.log('| 팀 | 롱(30 m+ 공중)/경기 | 착지: 받음% | 경합 패% | 루즈→우리% | 루즈→상대% | 아웃% | 반대 전환/경기 · 받음% | 슛/경기 | 골/경기 |');
['A', 'B'].forEach((nm, i) => {
  const X = acc[i]!;
  console.log(`| ${nm} ${specs[i]} | ${per(X.long)} | ${pc(X.landRecv, X.long)} | ${pc(X.landAerialLost, X.long)} | ${pc(X.landLooseUs, X.long)} | ${pc(X.landLooseThem, X.long)} | ${pc(X.landOut + X.landNone, X.long)} | ${per(X.sw)} · ${pc(X.landRecvSw, X.sw)} | ${per(X.shots)} | ${per(X.goals)} |`);
});
const top = (xs: (string | null)[], k = 4) => {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x ?? '없음', (m.get(x ?? '없음') ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([a, b]) => `${a} ${pc(b, xs.length)}`).join(' · ');
};
['A', 'B'].forEach((nm, i) => {
  const rs = acc[i]!.recs.filter((r) => r.kind === 'long');
  const pl = (l: number) => pc(rs.filter((r) => r.passerLine === l).length, rs.length);
  console.log(`${nm} ${specs[i]} 롱볼 수신: 패서 GK ${pl(0)}% · 수비 ${pl(1)}% · 중원 ${pl(2)}% · 공격 ${pl(3)}% · 출발 x 평균 ${avg(rs.map((r) => r.fromNx))} · 수신 x 평균 ${avg(rs.map((r) => r.nx))} · 전진 거리 평균 ${avg(rs.map((r) => (r.nx - r.fromNx) * L))} m · 찰 때 상대 라인 x ${avg(rs.map((r) => r.lineAt))} · 수신 때 라인 x ${avg(rs.map((r) => r.lineNx))} · 라인 뒤(수신 x > 라인) ${pc(rs.filter((r) => r.nx > r.lineNx + 0.01).length, rs.length)}% · 라인 5 m 안 ${pc(rs.filter((r) => Math.abs(r.nx - r.lineNx) * L <= 5).length, rs.length)}%`);
});
for (const kind of ['long', 'short'] as const) {
  console.log(`\n### ${kind === 'long' ? '롱볼(30 m+ 공중) 수신' : '땅볼 패스 수신(대조)'} 뒤 10초`);
  console.log('| 팀 | 구역 | 수신/경기 | 슛10% | 골10% | 상실10% | 슛 평균 초 | 슈터 본인/2선/다른공격수 | 등지고% | ST% | 세컨드볼% | 동료 15 m | 앞 동료 | 2선 뒤 20 m | 상대 5 m | 골 쪽 상대 | 첫 행동 |');
  ['A', 'B'].forEach((nm, i) => {
    const X = acc[i]!;
    const rs = X.recs.filter((r) => r.kind === kind);
    for (let z = -1; z < 4; z++) {
      const q = z < 0 ? rs : rs.filter((r) => zoneOf(r.nx) === z);
      if (!q.length) continue;
      const sh = q.filter((r) => r.shotAt !== null);
      const by = (w: string) => pc(sh.filter((r) => r.shooter === w).length, sh.length);
      console.log(`| ${nm} ${specs[i]} | ${z < 0 ? '전체' : ZONES[z]} | ${per(q.length)} | ${pc(sh.length, q.length)} | ${pc(q.filter((r) => r.goalAt !== null).length, q.length)} | ${pc(q.filter((r) => r.lostAt !== null).length, q.length)} | ${avg(sh.map((r) => r.shotAt!))} | ${by('본인')}/${by('2선')}/${by('다른 공격수')} | ${pc(q.filter((r) => r.back).length, q.length)} | ${pc(q.filter((r) => r.pg === 'ST').length, q.length)} | ${pc(q.filter((r) => r.second).length, q.length)} | ${avg(q.map((r) => r.mates15))} | ${avg(q.map((r) => r.ahead15))} | ${avg(q.map((r) => r.behind20))} | ${avg(q.map((r) => r.opp5))} | ${avg(q.map((r) => r.oppGoalSide))} | ${top(q.map((r) => r.firstAct))} |`);
    }
  });
}
console.log('\n### 슛 출처 (슛 직전 10 s 안 마지막 수신 종류, /경기 · 골)');
for (let i = 0; i < 2; i++) { const nm = i === 0 ? 'A' : 'B'; console.log(`- ${nm} ${specs[i]}: ` + Object.entries(src[i]!).map(([k, v]) => `${k} ${(v.shots / n).toFixed(2)} (골 ${(v.goals / n).toFixed(2)})`).join(' · ')); }
console.log('\n### 롱볼 수신 — 받는 선수 포지션군 · 등지고 받음 · 반대 전환별 (A 팀)');
console.log('| 팀 | 분류 | 수신/경기 | 슛10% | 골10% | 상실10% | 첫 행동 | 둘째 행동 |');
['A', 'B'].forEach((nm, i) => {
  const X = acc[i]!;
  const rs = X.recs.filter((r) => r.kind === 'long' && r.nx >= 0.5);
  const groups: [string, Rec[]][] = [
    ['ST', rs.filter((r) => r.pg === 'ST')], ['WING', rs.filter((r) => r.pg === 'WING')], ['MID', rs.filter((r) => r.pg === 'MID')],
    ['등지고', rs.filter((r) => r.back)], ['앞 보고', rs.filter((r) => !r.back)], ['반대 전환', rs.filter((r) => r.sw)], ['세컨드볼', rs.filter((r) => r.second)],
    ['앞 동료 0', rs.filter((r) => r.ahead15 === 0)], ['앞 동료 1+', rs.filter((r) => r.ahead15 >= 1)],
  ];
  for (const [g, q] of groups) {
    if (!q.length) continue;
    console.log(`| ${nm} ${specs[i]} | ${g} (상대 진영) | ${per(q.length)} | ${pc(q.filter((r) => r.shotAt !== null).length, q.length)} | ${pc(q.filter((r) => r.goalAt !== null).length, q.length)} | ${pc(q.filter((r) => r.lostAt !== null).length, q.length)} | ${top(q.map((r) => r.firstAct), 3)} | ${top(q.map((r) => r.acts[1] ?? null), 3)} |`);
  }
});
void L; void W;
process.exit(0);
