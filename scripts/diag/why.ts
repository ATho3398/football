// 행동 이유 기록 (C.77w, 공통 규칙 로드맵 1단계): 측정 훅(src/engine/probe.ts)만 켜서 엔진 결과는 그대로 두고, 행동이 왜 그렇게 나왔는지 표로 센다.
// ⒜ 침투 패스 안 함: 동료가 침투 중(runUntil)인데 소유자가 침투 패스를 안 골랐다 → 후보 없음 / 안 보임(시야) / 선택 풀 탈락(1위와 효용 차) / 풀 안에서 안 뽑힘
// ⒝ 수비 늦음: 상대 슛 순간 3 m 안 우리 필드 선수 0 → 맡은 수비(추적 배정, 없으면 목표가 슈터에 가장 가까운 선수)의 목표가 슈터에서 6 m+ = 배정 없음 / 2.5~6 m = 목표 오차 / 그 안 = 이동 지연(목표까지 거리)
// ⒞ 좋은 찬스(xG 0.3+) 실패: 블록 / 빗나감 / 선방
// ⒟ 백패스(2 m+ 뒤로 짧은 패스): 실수 후보에서 뽑힘(isMistake, gap 밖) / 전방 대안 없음(앞 5 m+ 성공 0.6+ 패스·침투 후보가 안 보임) / 위험 판단(전방 대안이 있는데 gap 안에서 백패스)
// npx vite-node scripts/diag/why.ts -- [경기수=20] [홈레이팅=75] [원정레이팅=75] [경로=값 ...]
import { ENGINE } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { attackDir } from '../../src/engine/pitch';
import { probe, type ShotProbe } from '../../src/engine/probe';
import { createTeamRoster, rosterRating } from '../../src/roster';

const allArgs = process.argv.slice(2).filter((a) => a !== '--');
// 경로=값 인자로 ENGINE 상수 덮어쓰기 (C.77x)
for (const a of allArgs.filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string];
  const path = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>;
  for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>;
  o[path[path.length - 1]!] = Number(v);
}
const args = allArgs.filter((x) => !x.includes('='));
const N = Number(args[0] ?? 20), HR = Number(args[1] ?? 75), AR = Number(args[2] ?? 75);

const through = { decisions: 0, none: 0, hidden: 0, outGap: [] as number[], notPicked: 0, picked: 0 };
const back = { n: 0, mistake: 0, noFwd: 0, risk: 0, riskFwdP: [] as number[], riskGap: [] as number[], escape: 0, keep: 0, sw: 0, noise: 0, none: 0 };
// C.77y '안 보임' 분해: 가려진 침투 후보마다 몸 방향 밖·전환 거리(scan) 여부·등지고 받음·패서 시야, 침투(runner·runUntil) 단위로 한 번도 안 보였는가
const hid = { cands: 0, outCone: 0, back: 0, vision: [] as number[], pSee: [] as number[], visAll: [] as number[] };
const runs = new Map<string, { seen: boolean; looks: number }>();
const late = { shots: 0, pressed: 0, unassigned: 0, aimErr: [] as number[], moveLag: [] as number[] };
const shots: ShotProbe[] = [];

probe.decide = (s, { a, cands, vis, pool, chosen, maxU, gap }) => {
  const dir = attackDir(a.team, s.half);
  // ⒜ 동료 침투 중인 소유 결정 (상대 진영)
  if ((a.x - 52.5) * dir > 0 && s.agents.some((o) => o.onPitch && o.team === a.team && o !== a && s.t < o.runUntil)) {
    through.decisions++;
    if (chosen.type === 'through') through.picked++;
    else {
      const all = cands.filter((c) => c.type === 'through');
      const seen = vis.filter((c) => c.type === 'through');
      const O = ENGINE.onball;
      const sp = Math.hypot(a.vx, a.vy);
      const [fx, fy] = a.backToGoal ? [-dir, 0] : sp > 0.5 ? [a.vx / sp, a.vy / sp] : [dir, 0];
      const v = (a.attrs.vision - 50) / 50;
      for (const c of all) {
        if (seen.includes(c)) continue;
        hid.cands++;
        const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 1;
        const ang = (Math.acos(Math.max(-1, Math.min(1, (dx * fx + dy * fy) / d))) * 180) / Math.PI;
        const out = ang > (O.visionCone + O.visionConeSlope * (a.attrs.vision - 50)) / 2 || Math.abs(dy) > O.switchDist;
        if (out) hid.outCone++;
        if (a.backToGoal) hid.back++;
        hid.vision.push(a.attrs.vision);
        const pT = Math.max(0.05, Math.min(1, O.throughSeeBase + O.throughSeeSlope * v));
        hid.pSee.push((out ? Math.max(0.05, Math.min(1, O.scanBase + O.scanSlope * v)) : 1) * pT);
      }
      for (const c of all) {
        const r = s.agents[c.receiver]!;
        const key = `${s.seed}:${r.idx}:${r.runUntil.toFixed(2)}`;
        const e = runs.get(key) ?? { seen: false, looks: 0 };
        e.looks++;
        if (seen.includes(c)) e.seen = true;
        runs.set(key, e);
      }
      if (!all.length) through.none++;
      else if (!seen.length) through.hidden++;
      else if (!pool.some((c) => c.type === 'through')) through.outGap.push(maxU - Math.max(...seen.map((c) => c.u)));
      else through.notPicked++;
    }
  }
  // ⒟ 백패스
  if (chosen.type === 'pass' && (chosen.x - a.x) * dir < -2) {
    back.n++;
    const fwd = vis.filter((c) => (c.type === 'pass' || c.type === 'through') && (c.x - a.x) * dir >= 5 && c.p >= 0.6);
    const bk = chosen.back;
    if (!bk) back.none++;
    else if (bk.escape >= bk.keep && bk.escape >= bk.sw && bk.escape > 0) back.escape++;
    else if (bk.keep >= bk.sw && bk.keep > 0) back.keep++;
    else if (bk.sw > 0) back.sw++;
    else back.noise++;
    if (chosen.u < maxU - gap) back.mistake++;
    else if (!fwd.length) back.noFwd++;
    else {
      back.risk++;
      const best = fwd.reduce((x, y) => (y.u > x.u ? y : x));
      back.riskFwdP.push(best.p);
      back.riskGap.push(best.u - chosen.u);
    }
  }
};

probe.shot = (s, p) => {
  shots.push(p);
  if (p.kind === 'pk' || p.kind === 'fk') return;
  // ⒝ 수비 늦음
  late.shots++;
  if (p.press3 > 0) {
    late.pressed++;
    return;
  }
  const defs = s.agents.filter((o) => o.onPitch && o.team !== p.team && o.line !== 0);
  const tgt = (o: (typeof defs)[number]) => Math.hypot(o.tx - p.x, o.ty - p.y);
  // 맡은 수비 = 슈터를 추적 배정(trackIdx)한 선수, 없으면 목표가 슈터에 가장 가까운 선수. 그 목표도 6 m+ 이면 배정 없음
  const A = defs.find((o) => o.trackIdx === p.shooter) ?? defs.reduce((x, y) => (tgt(y) < tgt(x) ? y : x));
  if (tgt(A) > 6) {
    late.unassigned++;
    return;
  }
  if (tgt(A) > 2.5) late.aimErr.push(tgt(A));
  else late.moveLag.push(Math.hypot(A.x - A.tx, A.y - A.ty));
};

for (let i = 0; i < N; i++) {
  const h = createTeamRoster({ id: `h${i}`, rating: HR }, `wy-h${i}`, 2018, []); const a = createTeamRoster({ id: `a${i}`, rating: AR }, `wy-a${i}`, 2018, []);
  const m = createMatch({ home: teamSetupFromRoster(h, rosterRating(h), HR, `wyh${i}`), away: teamSetupFromRoster(a, rosterRating(a), AR, `wya${i}`), mode: 'auto', difficulty: 'normal', seed: 9100 + i, bigMatch: false, neutral: true });
  while (!m.state.done) m.step();
}

const pc = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : '-');
const avg = (x: number[]) => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : NaN);
const med = (x: number[]) => (x.length ? [...x].sort((a, b) => a - b)[Math.floor(x.length / 2)]! : NaN);
const f = (x: number, k = 2) => (Number.isFinite(x) ? x.toFixed(k) : '-');
console.log(`why (C.77w 행동 이유) · ${N}경기 ${HR}:${AR}\n`);
const tNo = through.decisions - through.picked;
console.log(`⒜ 침투 패스 안 함 (동료 침투 중 상대 진영 결정 ${through.decisions}, 경기당 ${f(through.decisions / N, 1)}) · 침투 패스 고름 ${pc(through.picked, through.decisions)}`);
console.log('| 이유 | 수 | 비율(안 함 중) |\n|---|---|---|');
console.log(`| 후보 없음 | ${through.none} | ${pc(through.none, tNo)} |`);
console.log(`| 안 보임(시야) | ${through.hidden} | ${pc(through.hidden, tNo)} |`);
console.log(`| 선택 풀 탈락 (1위와 효용 차 중앙값 ${f(med(through.outGap), 3)}, 평균 ${f(avg(through.outGap), 3)}) | ${through.outGap.length} | ${pc(through.outGap.length, tNo)} |`);
console.log(`| 풀 안에서 안 뽑힘 | ${through.notPicked} | ${pc(through.notPicked, tNo)} |`);

console.log(`\n⒝ 수비 늦음 (상대 필드 슛 ${late.shots}, 3 m 안 압박 있음 ${pc(late.pressed, late.shots)})`);
const lateN = late.shots - late.pressed;
console.log('| 이유 | 수 | 비율(압박 없음 중) | 값 |\n|---|---|---|---|');
console.log(`| 배정 없음 (목표가 슈터 6 m 안인 수비 없음) | ${late.unassigned} | ${pc(late.unassigned, lateN)} | - |`);
console.log(`| 목표 오차 (목표–슈터 2.5~6 m) | ${late.aimErr.length} | ${pc(late.aimErr.length, lateN)} | 평균 ${f(avg(late.aimErr), 1)} m |`);
console.log(`| 이동 지연 (목표는 맞음) | ${late.moveLag.length} | ${pc(late.moveLag.length, lateN)} | 목표까지 평균 ${f(avg(late.moveLag), 1)} m |`);

const big = shots.filter((x) => (x.kind === 'foot' || x.kind === 'header') && (x.xg ?? 0) >= 0.3);
const fail = big.filter((x) => x.outcome !== 'goal');
console.log(`\n⒞ 좋은 찬스(xG 0.3+) ${big.length} (경기당 ${f(big.length / N)}) · 골 ${pc(big.length - fail.length, big.length)} · 실패 ${fail.length}`);
console.log('| 이유 | 수 | 비율(실패 중) |\n|---|---|---|');
for (const [k, name] of [['block', '블록'], ['miss', '빗나감'], ['save', '선방']] as const) console.log(`| ${name} | ${fail.filter((x) => x.outcome === k).length} | ${pc(fail.filter((x) => x.outcome === k).length, fail.length)} |`);

console.log(`\n⒟ 백패스 ${back.n} (경기당 ${f(back.n / N, 1)})`);
console.log('| 이유 | 수 | 비율 | 값 |\n|---|---|---|---|');
console.log(`| 실수 후보에서 뽑힘 (isMistake, gap 밖) | ${back.mistake} | ${pc(back.mistake, back.n)} | - |`);
console.log(`| 전방 대안 없음 | ${back.noFwd} | ${pc(back.noFwd, back.n)} | - |`);
console.log(`| 위험 판단 (전방 대안 있음, gap 안) | ${back.risk} | ${pc(back.risk, back.n)} | 전방 최선 성공 ${f(avg(back.riskFwdP))} · 효용 차 ${f(avg(back.riskGap), 3)} |`);
console.log(`| (C.77y 가치 항 최대 성분) 압박 탈출 ${back.escape} · 보존 ${back.keep} · 전환 ${back.sw} · 그 밖(잡음·비용만) ${back.noise} · 가치 항 없음(옛 동작) ${back.none} | | | |`);
const runList = [...runs.values()];
const never = runList.filter((r) => !r.seen);
console.log(`\n(C.77y) '안 보임' 분해: 가려진 침투 후보 ${hid.cands} · 몸 방향 밖/전환 ${pc(hid.outCone, hid.cands)} · 등지고 받음 ${pc(hid.back, hid.cands)} · 패서 시야 평균 ${f(avg(hid.vision), 1)} · 보일 확률 평균 ${f(avg(hid.pSee))}`);
console.log(`  침투 단위: ${runList.length}회 (소유자 결정 평균 ${f(avg(runList.map((r) => r.looks)), 1)}회) · 한 번도 안 보임 ${pc(never.length, runList.length)} (그중 결정 1회뿐 ${pc(never.filter((r) => r.looks === 1).length, never.length)})`);
