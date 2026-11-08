// 진단 (C.78m, 재진단 의뢰 1~3번): 발 슛 1건마다 **앞 장면**(어떻게 공을 받았나)과 **GK 가 슛 선을 덮는 정도**를 같이 기록해
// "GK 가 슛 선 밖(cover < 0.5)" 찬스가 어떤 앞 동작에서 나오는지, 원인이 GK 자리 규칙(목표가 선 밖)인지 이동 중(목표는 선 위인데 아직 못 감)인지 가른다.
// 수비 인원 민감도(미해결 3·4·5)와 앞 패스 거리(미해결 2) 분해도 같이 낸다. 엔진 코드는 바꾸지 않는다(훅은 난수·상태 무변경).
// 실행: npx vite-node scripts/diag/c78m-chance.ts -- [경기수=40] [홈레이팅=75] [원정레이팅=75] [경로=값 ...]
import { ENGINE } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { shotExec } from '../../src/engine/onball';
import { probe, type ShotProbe } from '../../src/engine/probe';
import { keeperOf, coverOf } from '../../src/engine/keeper';
import { oppGoal, attackDir, dist, segDist } from '../../src/engine/pitch';
import { keeperTarget } from '../../src/engine/offball';
import { createTeamRoster, rosterRating } from '../../src/roster';
import type { Flight, SimState } from '../../src/engine/state';

const allArgs = process.argv.slice(2).filter((a) => a !== '--');
for (const a of allArgs.filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string];
  const path = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>;
  for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>;
  o[path[path.length - 1]!] = Number(v);
}
const args = allArgs.filter((x) => !x.includes('='));
const N = Number(args[0] ?? 40);
const HR = Number(args[1] ?? 75);
const AR = Number(args[2] ?? 75);
const SEED0 = Number(process.env.SEED0 ?? 8800);
/**
 * 가설 탐침 (엔진 코드는 안 고치고, 매 틱 뒤 GK 의 이동 목표만 덮어써서 "규칙을 바꾸면 어떻게 되나"를 잰다).
 * GKSET=1 각 좁히기 밖에서 GK 자리를 '공 → 골 가운데 선 위 깊이 d'(이상 자리)로 + 슛 거리 깊이(각도 조건 없이, 골 쪽 수비 조건은 유지)
 * GKSET=2 선 위 자리만(깊이 규칙은 지금 엔진 그대로)
 * GKSET=3 1 + 각 좁히기(rush)를 "닿을 수 있을 때만"(GK 가 공까지 오는 시간 ≤ RUSHT 초) — 아니면 선 위 자리
 * GKSET=4 2(선 위 자리) + 각 좁히기를 닿을 수 있을 때만
 */
const GKSET = Number(process.env.GKSET ?? 0);
const RUSHT = Number(process.env.RUSHT ?? 1.2);

interface Rec {
  /** 판정 뒤 결과가 고쳐지는 원본 기록 (probeShotEnd 가 save·goal 로 바꾼다) */
  p: ShotProbe;
  xg: number;
  d: number;
  cover: number;
  /** 앞 장면 */
  scene: string;
  /** 받고 슛까지 (초, −1 = 받은 게 아니라 뺏어서/루즈볼) */
  held: number;
  /** 앞 패스: 거리 m(−1 없음) · 공중 · 컷백 · 침투 · 측면에서 */
  passD: number;
  passAir: boolean;
  cut: boolean;
  thr: boolean;
  /** 수비 인원: 콘 안(블록) · 5 m 안 필드 · 박스 안 필드 · 슛 선 2 m 안 */
  blockers: number;
  near5: number;
  inBox: number;
  lane2: number;
  /** 가운데(구석 0) 슛 선을 덮는 정도 (빈 골 보정이 쓰는 값) */
  coverC: number;
  /** 슈터 옆 거리 (골 가운데 기준) */
  shY: number;
  /** 원터치 실행 배수가 걸린 슛인가 */
  ot: number;
  /** GK 규칙이 지금 주는 목표의 슛 선까지 거리 · GK 에서 그 목표까지 거리 */
  eRule: number;
  gkToRule: number;
  /** GK: 슛 선까지 거리 e · 목표까지 거리 · 목표의 슛 선까지 거리 · 깊이 · 옆 · 속도 · urgent · 비행 중 자리(flightSet) 중이었나 */
  e: number;
  gkToTgt: number;
  eTgt: number;
  gkDepth: number;
  gkLat: number;
  gkSp: number;
  urgent: number;
  fs: number;
  /** GK 가 지금 자리로 목표를 받은 뒤 지난 시간 (초) · 그 사이 이동한 거리 */
  tgtAge: number;
  gkMoved: number;
  /** 최근 1.5초 GK 평균·최고 속도 · 그 사이 비행 중 자리(flightSet)였던 틱 비율 · GK 최고 속도(능력) */
  sp15: number;
  spMax: number;
  fsWin: number;
  gkMax: number;
  /** GK 이상 자리(골 가운데 → 슈터 선 위 깊이 3 m)에서 떨어진 거리 */
  gkOff: number;
  /** GK 자리 규칙 분기: rush 각좁히기 · set 자세잡기 · setLine 슛거리깊이 적용 · 스위퍼 */
  rush: number;
  setB: number;
  setLine: number;
  sweeper: number;
  /** 슛거리깊이 규칙 세 조건: 각도(중앙) · 골 쪽 수비 · 거리 ≥ setFrom · 각도비 |옆|/|골 쪽| */
  cAng: number;
  cBehind: number;
  cFar: number;
  angR: number;
  /** 앞 패스를 찬 뒤 슛까지 (초, −1 없음) */
  sincePass: number;
}

const rec: Rec[] = [];

/** GK 틱 표본 */
interface GkS { t: number; x: number; y: number; tx: number; ty: number; sp: number; urgent: number; fs: number }

for (let i = 0; i < N; i++) {
  const h = createTeamRoster({ id: `h${i}`, rating: HR }, `sx-h${i}`, 2018, []);
  const aw = createTeamRoster({ id: `a${i}`, rating: AR }, `sx-a${i}`, 2018, []);
  const m = createMatch({
    home: teamSetupFromRoster(h, rosterRating(h), HR, `sxh${i}`), away: teamSetupFromRoster(aw, rosterRating(aw), AR, `sxa${i}`),
    mode: 'auto', difficulty: 'normal', seed: SEED0 + i, bigMatch: false, neutral: true,
  });
  const s = m.state;
  // 받은 패스 기록: 받는 선수 idx → 그 패스와 받은 시각
  const recv = new Map<number, { fl: Flight; t: number }>();
  const recent: Flight[] = [];
  const gkHist: [GkS[], GkS[]] = [[], []];
  let prevFl: Flight | null = null;
  let prevOwner = -1;

  probe.shot = (st: SimState, p) => {
    if (p.kind !== 'foot') return;
    const a = st.agents[p.shooter]!;
    const e0 = shotExec(st, a, false);
    const gk = keeperOf(st, (1 - a.team) as 0 | 1);
    const [gx, gy] = oppGoal(attackDir(a.team, st.half));
    const P = ENGINE.pitch;
    // 수비 인원
    let near5 = 0;
    let inBox = 0;
    let lane2 = 0;
    let nearField = Infinity;
    for (const o of st.agents) {
      if (!o.onPitch || o.team === a.team || o.line === 0) continue;
      const od = dist(o.x, o.y, a.x, a.y);
      if (od <= 5) near5++;
      if (od < nearField) nearField = od;
      if (Math.abs(o.x - gx) <= P.boxDepth && Math.abs(o.y - gy) <= P.boxWidth / 2) inBox++;
      const [cd, ct] = segDist(o.x, o.y, a.x, a.y, p.aimX, p.aimY);
      if (cd < 2 && ct > 0.02 && ct < 0.95) lane2++;
    }
    // GK 상태
    const hist = gkHist[1 - a.team as 0 | 1];
    const cur = hist[hist.length - 1];
    const e = gk ? segDist(gk.x, gk.y, a.x, a.y, gx, gy)[0] : 0;
    const eTgt = gk ? segDist(gk.tx, gk.ty, a.x, a.y, gx, gy)[0] : 0;
    // 목표가 지금 목표로 바뀐 뒤 지난 시간 (목표가 1.5 m 넘게 움직인 마지막 틱)
    let tgtAge = 0;
    let gkMoved = 0;
    if (gk && hist.length) {
      let j = hist.length - 1;
      while (j > 0 && dist(hist[j]!.tx, hist[j]!.ty, gk.tx, gk.ty) <= 1.5) j--;
      tgtAge = st.t - hist[j]!.t;
      gkMoved = dist(hist[j]!.x, hist[j]!.y, gk.x, gk.y);
    }
    // 앞 장면
    const r = recv.get(a.idx);
    const fresh = r && r.t >= a.ballT - 0.05;
    const held = fresh ? st.t - r!.t : -1;
    const fl = fresh ? r!.fl : null;
    const passD = fl ? dist(fl.fromX, fl.fromY, fl.toX, fl.toY) : -1;
    // 컷백: 패스 출발점이 골라인 쪽(슈터보다 골에 2 m 넘게 가깝고) 측면(옆 거리 ≥ 10 m)
    const cut = !!fl && Math.abs(fl.fromX - gx) < Math.abs(a.x - gx) - 2 && Math.abs(fl.fromY - gy) >= 10;
    const thr = !!fl?.through;
    const sincePass = fl ? st.t - fl.t0 : -1;
    const T = st.teams[a.team];
    const counter = st.possOrigin === 'open' && st.t - T.wonAt <= 8 && T.wonAt > 0;
    const rebound = st.lastShotT[a.team] > 0 && st.t - st.lastShotT[a.team] <= 3 && st.t - st.lastShotT[a.team] > 0.05;
    const solo = e0.m.blockers === 0 && nearField >= 3;
    // 장면 이름 (앞의 것이 우선)
    const scene = st.restart ? '리스타트'
      : rebound ? '리바운드(3초)'
      : !fresh ? '탈취·루즈볼'
      : fl!.air || fl!.kind === 'cross' ? '크로스·공중'
      : cut ? '컷백'
      : held <= 0.6 ? (thr ? '침투 받고 바로' : passD >= 25 ? '롱패스 받고 바로' : '패스 받고 바로')
      : thr ? '침투 받고 몰고'
      : held <= 1.6 ? '패스 받고 1초' : '받고 몰고 가기';
    // 가운데 선 덮는 정도 (빈 골 보정 기준) · GK 규칙이 지금 주는 목표
    const ctxC = { ...e0.m.ctx, ty: gy, corner: 0, gk: gk ? { x: gk.x, y: gk.y, vx: gk.vx, vy: gk.vy } : null, stop: gk ? gk.gk?.attrs.shotStopping ?? 50 : 50, body: gk?.body.gkSave ?? 0 };
    const coverC = coverOf(ctxC);
    let eRule = 0;
    let gkToRule = 0;
    if (gk) {
      const [sx, sy, su] = [gk.tx, gk.ty, gk.urgent];
      keeperTarget(st, gk);
      eRule = segDist(gk.tx, gk.ty, a.x, a.y, gx, gy)[0];
      gkToRule = dist(gk.x, gk.y, gk.tx, gk.ty);
      gk.tx = sx; gk.ty = sy; gk.urgent = su;
    }
    // 최근 1.5초 GK 속도·flightSet
    let sp15 = 0;
    let spMax = 0;
    let fsWin = 0;
    let nw = 0;
    for (const h of hist) {
      if (st.t - h.t > 1.5) continue;
      sp15 += h.sp; spMax = Math.max(spMax, h.sp); fsWin += h.fs; nw++;
    }
    if (nw) { sp15 /= nw; fsWin /= nw; }
    // GK 자리 규칙 분기 (keeperTarget 과 같은 조건)
    const K2 = ENGINE.keeper;
    const gd = gk ? dist(a.x, a.y, gx, gy) : 0;
    const inBoxOwner = Math.abs(a.x - gx) <= P.boxDepth && Math.abs(a.y - gy) <= P.boxWidth / 2;
    const rush = gk && inBoxOwner && gd < K2.rushDist ? 1 : 0;
    const setB = gk && !rush && gd < K2.setDist ? 1 : 0;
    const cAng = Math.abs(a.y - gy) <= K2.setCentral * Math.abs(a.x - gx) ? 1 : 0;
    const cBehind = st.agents.some((o) => o.onPitch && o.team !== a.team && o.line !== 0 && dist(o.x, o.y, gx, gy) < gd - K2.setBehind) ? 1 : 0;
    const cFar = gd >= K2.setFrom ? 1 : 0;
    const setLine = setB && K2.setLine && cFar && cAng && cBehind ? 1 : 0;
    const uL = Math.hypot(a.x - gx, a.y - gy) || 1;
    const ix = gx + ((a.x - gx) / uL) * 3;
    const iy = gy + ((a.y - gy) / uL) * 3;
    rec.push({
      cAng, cBehind, cFar, angR: Math.abs(a.y - gy) / Math.max(0.1, Math.abs(a.x - gx)),
      sp15, spMax, fsWin, gkMax: gk ? gk.maxSpeed : 0, gkOff: gk ? dist(gk.x, gk.y, ix, iy) : 0, rush, setB, setLine, sweeper: gk?.gk?.type === 'sweeper' ? 1 : 0,
      p, xg: p.xg ?? 0, d: p.d, cover: e0.cover, coverC, shY: Math.abs(a.y - gy), ot: st.t < a.otUntil ? 1 : 0, eRule, gkToRule,
      scene: counter ? `${scene}+역습` : scene, held, passD, passAir: !!fl?.air, cut, thr,
      blockers: e0.m.blockers, near5, inBox, lane2,
      e, gkToTgt: gk ? dist(gk.x, gk.y, gk.tx, gk.ty) : 0, eTgt, gkDepth: gk ? Math.abs(gk.x - gx) : 0, gkLat: gk ? Math.abs(gk.y - gy) : 0,
      gkSp: gk ? Math.hypot(gk.vx, gk.vy) : 0, urgent: gk?.urgent ? 1 : 0, fs: cur?.fs ?? 0, tgtAge, gkMoved, sincePass,
    });
    void solo;
  };

  while (!s.done) {
    m.step();
    // 가설 탐침: GK 이동 목표 덮어쓰기 (다음 틱 이동에 쓰인다 — 오프더볼 갱신이 오면 엔진 규칙으로 돌아간다)
    if (GKSET && !s.restart && !s.done) {
      for (const tm of [0, 1] as const) {
        const g = keeperOf(s, tm);
        if (!g || s.teams[tm].gkChase) continue;
        const o = s.ball.owner >= 0 ? s.agents[s.ball.owner]! : null;
        if (!o || o.team === tm) continue;
        const K3 = ENGINE.keeper;
        const [ogx, ogy] = oppGoal(attackDir(o.team, s.half));
        const gd = dist(o.x, o.y, ogx, ogy);
        if (gd < 0.5 || gd >= K3.setDist) continue;
        const P3 = ENGINE.pitch;
        const inB = Math.abs(o.x - ogx) <= P3.boxDepth && Math.abs(o.y - ogy) <= P3.boxWidth / 2;
        const rushNow = inB && gd < K3.rushDist;
        // 닿을 수 있는 각 좁히기인가 (GKSET 3): GK 가 지금 자리에서 rushGap 자리까지 오는 시간
        const reachT = (dist(g.x, g.y, o.x + ((ogx - o.x) / gd) * K3.rushGap, o.y + ((ogy - o.y) / gd) * K3.rushGap)) / Math.max(1, g.maxSpeed);
        if (rushNow && (GKSET < 3 || reachT <= RUSHT)) continue; // 엔진 rush 목표 그대로
        const behind = s.agents.some((q) => q.onPitch && q.team === tm && q.line !== 0 && dist(q.x, q.y, ogx, ogy) < gd - K3.setBehind);
        const base = g.gk?.type === 'sweeper' ? K3.sweeperMin : K3.classicMin;
        const depth = GKSET === 2 || GKSET === 4 ? (gd >= K3.setFrom && behind && K3.setLine && Math.abs(o.y - ogy) <= K3.setCentral * Math.abs(o.x - ogx) ? Math.min(base, K3.setDepth) : base) : (gd >= K3.setFrom && behind ? Math.min(base, K3.setDepth) : base);
        g.tx = ogx + ((o.x - ogx) / gd) * depth;
        g.ty = Math.max(ogy - P3.goalWidth / 2 - 1, Math.min(ogy + P3.goalWidth / 2 + 1, ogy + ((o.y - ogy) / gd) * depth));
        g.urgent = true;
      }
    }
    // GK 표본 (최근 4초)
    for (const tm of [0, 1] as const) {
      const g = keeperOf(s, tm);
      if (!g) continue;
      const f = s.ball.flight;
      const fs = ENGINE.keeper.flightSet && f && !s.restart && (f.outcome === 'receive' || f.outcome === 'aerial') && s.agents[f.passer]?.team !== tm ? 1 : 0;
      const H = gkHist[tm];
      H.push({ t: s.t, x: g.x, y: g.y, tx: g.tx, ty: g.ty, sp: Math.hypot(g.vx, g.vy), urgent: g.urgent ? 1 : 0, fs });
      while (H.length > 45) H.shift();
    }
    // 패스 수신 기록: 소유가 바뀐 틱에 그 선수가 '받아서' 얻었으면 최근 비행 중 받는 선수가 그 선수인 것
    const fl = s.ball.flight;
    if (fl && fl !== prevFl && fl.kind !== 'shot') { recent.push(fl); while (recent.length > 12) recent.shift(); }
    const own = s.ball.owner;
    if (own >= 0 && own !== prevOwner) {
      const a = s.agents[own]!;
      let got: Flight | null = null;
      if (a.gotBy === 'receive') for (let j = recent.length - 1; j >= 0; j--) if (recent[j]!.receiver === own) { got = recent[j]!; break; }
      if (got) recv.set(own, { fl: got, t: s.t });
      else recv.delete(own);
    }
    prevOwner = own;
    prevFl = fl;
  }
}

const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const per = (n: number) => (n / N / 2).toFixed(2);
const avg = (R: Rec[], g: (r: Rec) => number) => (R.length ? R.reduce((t, r) => t + g(r), 0) / R.length : NaN);

const isGoal = (r: Rec) => r.p.outcome === 'goal';
const isOn = (r: Rec) => r.p.outcome === 'goal' || r.p.outcome === 'save';

function row(lab: string, R: Rec[], all = rec.length): void {
  const on = R.filter(isOn);
  const g = R.filter(isGoal).length;
  console.log(
    `${lab.padEnd(22)} 슛 ${per(R.length).padStart(5)}/팀(${((R.length / Math.max(1, all)) * 100).toFixed(1)}%) · 골 ${per(g).padStart(5)} · 유효 ${per(on.length).padStart(5)}`
    + ` · 유효중골 ${R.length ? ((g / Math.max(1, on.length)) * 100).toFixed(0) : '-'}% · 슛당골 ${R.length ? ((g / R.length) * 100).toFixed(1) : '-'}%`
    + ` · xG ${f2(avg(R, (r) => r.xg))} · 가운데cover ${f2(avg(R, (r) => r.coverC))} · 거리 ${f2(avg(R, (r) => r.d))}(옆 ${f2(avg(R, (r) => r.shY))})`
    + ` · 5 m 안 ${f2(avg(R, (r) => r.near5))} · 콘 ${f2(avg(R, (r) => r.blockers))}`,
  );
}

console.log(`c78m-chance${GKSET ? ` · GKSET=${GKSET}${GKSET === 3 ? ` RUSHT=${RUSHT}` : ''}` : ''} · ${N}경기 ${HR}:${AR} · 발 슛 ${rec.length}(팀당 ${per(rec.length)}) · 골 ${per(rec.filter(isGoal).length)}\n`);

console.log('■ 1. GK 덮는 정도 구간 (가운데 선 기준 = 빈 골 보정이 쓰는 값)');
for (const [lo, hi, lab] of [[0, 0.5, '가운데 cover < 0.5'], [0.5, 0.9, '0.5~0.9'], [0.9, 1.01, '0.9+(덮임)']] as [number, number, string][]) {
  row(lab, rec.filter((r) => r.coverC >= lo && r.coverC < hi));
}
console.log('  (구석 선 기준)');
for (const [lo, hi, lab] of [[0, 0.5, '  구석 cover < 0.5'], [0.5, 0.9, '  0.5~0.9'], [0.9, 1.01, '  0.9+']] as [number, number, string][]) {
  row(lab, rec.filter((r) => r.cover >= lo && r.cover < hi));
}

console.log('\n■ 2. 앞 장면별 (전체)');
const scenes = [...new Set(rec.map((r) => r.scene))].sort((a, b) => rec.filter((r) => r.scene === b).length - rec.filter((r) => r.scene === a).length);
for (const sc of scenes) row(sc, rec.filter((r) => r.scene === sc));

console.log('\n■ 3. 앞 장면별 — GK 선 밖(cover < 0.5) 슛만 (이 찬스의 출처)');
const open0 = rec.filter((r) => r.coverC < 0.5);
for (const sc of scenes) {
  const R = open0.filter((r) => r.scene === sc);
  if (!R.length) continue;
  row(sc, R, open0.length);
}

console.log('\n■ 4. GK 선 밖 원인 분해 (cover < 0.5)');
const causeOf = (r: Rec) => (r.eRule > 2 ? '규칙 목표가 선 밖(자리 규칙)' : r.eTgt > 2 ? '옛 목표(갱신 전)가 선 밖' : r.gkToTgt > 1.5 ? '목표는 선 위, GK 가 아직 못 감(이동)' : '목표·GK 다 선 위인데 덮지 못함(다이빙 범위)');
for (const c of ['규칙 목표가 선 밖(자리 규칙)', '옛 목표(갱신 전)가 선 밖', '목표는 선 위, GK 가 아직 못 감(이동)', '목표·GK 다 선 위인데 덮지 못함(다이빙 범위)']) {
  const R = open0.filter((r) => causeOf(r) === c);
  if (!R.length) continue;
  row(c, R, open0.length);
  console.log(`    └ e ${f2(avg(R, (r) => r.e))} m · GK→목표 ${f2(avg(R, (r) => r.gkToTgt))} m · 목표→선 ${f2(avg(R, (r) => r.eTgt))} m · 규칙목표→선 ${f2(avg(R, (r) => r.eRule))} m(GK→규칙목표 ${f2(avg(R, (r) => r.gkToRule))} m) · 깊이 ${f2(avg(R, (r) => r.gkDepth))} 옆 ${f2(avg(R, (r) => r.gkLat))}`
    + ` · GK 속도 ${f2(avg(R, (r) => r.gkSp))}(1.5초 평균 ${f2(avg(R, (r) => r.sp15))} 최고 ${f2(avg(R, (r) => r.spMax))} / 능력 ${f2(avg(R, (r) => r.gkMax))}) · 이상자리에서 ${f2(avg(R, (r) => r.gkOff))} m`
    + ` · urgent ${f2(avg(R, (r) => r.urgent))} · 비행중자리(1.5초) ${f2(avg(R, (r) => r.fsWin))} · 분기 rush ${f2(avg(R, (r) => r.rush))}/set ${f2(avg(R, (r) => r.setB))}/슛거리깊이 ${f2(avg(R, (r) => r.setLine))} · 스위퍼 ${f2(avg(R, (r) => r.sweeper))} · 목표 나이 ${f2(avg(R, (r) => r.tgtAge))} s(그 사이 ${f2(avg(R, (r) => r.gkMoved))} m 이동)`
    + ` · 앞 패스 뒤 ${f2(avg(R.filter((r) => r.sincePass >= 0), (r) => r.sincePass))} s · 받고 ${f2(avg(R.filter((r) => r.held >= 0), (r) => r.held))} s`);
}

console.log('\n■ 5. 받고 슛까지 시간 (원터치 여부)');
for (const [lo, hi, lab] of [[-1.5, 0, '탈취·루즈볼'], [0, 0.4, '받고 0~0.4 s'], [0.4, 0.8, '0.4~0.8 s'], [0.8, 1.6, '0.8~1.6 s'], [1.6, 99, '1.6 s+']] as [number, number, string][]) {
  row(lab, rec.filter((r) => r.held > lo && r.held <= hi));
}

console.log('\n■ 6. 수비 인원 민감도 (미해결 3·4·5)');
console.log('  5 m 안 상대 필드 선수');
for (const n of [0, 1, 2, 3]) row(n === 3 ? '  3명+' : `  ${n}명`, rec.filter((r) => (n === 3 ? r.near5 >= 3 : r.near5 === n)));
console.log('  슛 선 2 m 안(막는 자리)');
for (const n of [0, 1, 2]) row(n === 2 ? '  2명+' : `  ${n}명`, rec.filter((r) => (n === 2 ? r.lane2 >= 2 : r.lane2 === n)));
console.log('  상대 박스 안 수비 인원 (12 m 안 슛만)');
const inb = rec.filter((r) => r.d < 12);
for (const [lo, hi, lab] of [[0, 4, '  0~3명'], [4, 6, '  4~5명'], [6, 99, '  6명+']] as [number, number, string][]) {
  row(lab, inb.filter((r) => r.inBox >= lo && r.inBox < hi), inb.length);
}

console.log('\n■ 7. 앞 패스 거리 (미해결 2 연결) — GK 선 밖 슛의 앞 패스');
for (const [lo, hi, lab] of [[0, 10, '0~10 m'], [10, 25, '10~25 m'], [25, 99, '25 m+']] as [number, number, string][]) {
  const A = rec.filter((r) => r.passD >= lo && r.passD < hi);
  const O = open0.filter((r) => r.passD >= lo && r.passD < hi);
  console.log(`  앞 패스 ${lab.padEnd(8)} 슛 ${per(A.length)}/팀 · 그중 GK 선 밖 ${A.length ? ((O.length / A.length) * 100).toFixed(1) : '-'}% · 골 ${per(A.filter(isGoal).length)} · 슛당골 ${A.length ? ((A.filter(isGoal).length / A.length) * 100).toFixed(1) : '-'}%`);
}

console.log('\n■ 8. 12 m 안/밖 × cover');
for (const [lab, R] of [['12 m 안', rec.filter((r) => r.d < 12)], ['12 m 밖', rec.filter((r) => r.d >= 12)]] as [string, Rec[]][]) {
  console.log(` ${lab}`);
  for (const [lo, hi, l2] of [[0, 0.5, '  cover < 0.5'], [0.5, 0.9, '  0.5~0.9'], [0.9, 1.01, '  0.9+']] as [number, number, string][]) {
    row(l2, R.filter((r) => r.coverC >= lo && r.coverC < hi), R.length);
  }
}
console.log('\n■ 9. GK 자리 규칙 분기별 (전체 발 슛)');
for (const [lab, fn] of [['각 좁히기(rush)', (r: Rec) => !!r.rush], ['자세잡기 + 슛거리깊이', (r: Rec) => !!r.setLine], ['자세잡기(깊이 규칙 안 걸림)', (r: Rec) => !!r.setB && !r.setLine], ['그 밖(먼 공)', (r: Rec) => !r.rush && !r.setB]] as [string, (r: Rec) => boolean][]) {
  const R = rec.filter(fn);
  row(lab, R);
  console.log(`    └ GK 깊이 ${f2(avg(R, (r) => r.gkDepth))} 옆 ${f2(avg(R, (r) => r.gkLat))} · 이상자리에서 ${f2(avg(R, (r) => r.gkOff))} m · e ${f2(avg(R, (r) => r.e))} · 규칙목표→선 ${f2(avg(R, (r) => r.eRule))} · GK→목표 ${f2(avg(R, (r) => r.gkToTgt))} · 선 밖 비율 ${((R.filter((r) => r.coverC < 0.5).length / Math.max(1, R.length)) * 100).toFixed(1)}%`);
}

console.log('\n■ 11. 자세잡기 분기에서 슛거리깊이 규칙이 안 걸리는 이유 (rush 밖 · 깊이 규칙 미적용 슛)');
const noRule = rec.filter((r) => r.setB && !r.setLine);
for (const [lab, fn] of [
  ['각도만 실패(측면)', (r: Rec) => !r.cAng && !!r.cBehind && !!r.cFar],
  ['골 쪽 수비만 없음', (r: Rec) => !!r.cAng && !r.cBehind && !!r.cFar],
  ['거리 < setFrom', (r: Rec) => !r.cFar],
  ['각도·수비 둘 다', (r: Rec) => !r.cAng && !r.cBehind && !!r.cFar],
] as [string, (r: Rec) => boolean][]) {
  const R = noRule.filter(fn);
  if (!R.length) continue;
  row(lab, R, noRule.length);
  console.log(`    └ 각도비 ${f2(avg(R, (r) => r.angR))} · GK 깊이 ${f2(avg(R, (r) => r.gkDepth))} 옆 ${f2(avg(R, (r) => r.gkLat))} · 규칙목표→선 ${f2(avg(R, (r) => r.eRule))} · 선 밖 비율 ${((R.filter((x) => x.coverC < 0.5).length / R.length) * 100).toFixed(1)}%`);
}

console.log('\n■ 10. 원터치 실행 배수가 걸린 슛(otUntil)');
row('원터치', rec.filter((r) => r.ot === 1));
row('그 밖', rec.filter((r) => r.ot === 0));
process.exit(0);
