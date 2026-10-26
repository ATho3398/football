// 진단 (C.78p 엔진관리자11 질문 3, 미해결 2): 짧은 패스(0~10 m)가 적고 롱패스(30 m+)가 많은 이유를 결정 순간에서 본다. 엔진 코드는 바꾸지 않는다(probe.decide 훅만).
// 오픈 플레이 필드 선수 결정마다: 가장 가까운 동료 거리 · 10 m 안 패스 후보 수 · 고른 행동 · 롱(30 m+)을 고를 때 짧은(<15 m, p ≥ 0.85) 후보가 있었나와 그 효용 차 ·
// 후보 거리 구간별 평균 성공 확률·가치·효용 · 선택 비율을 낸다.
// 실행: npx vite-node scripts/diag/c78p-pass.ts -- [경기수=30] [레이팅=75] [경로=값 ...]
import { ENGINE } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { probe } from '../../src/engine/probe';
import { attackDir, dist, toNorm } from '../../src/engine/pitch';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { BALANCED } from '../engine/job';

const all = process.argv.slice(2).filter((a) => a !== '--');
for (const a of all.filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string];
  const path = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>;
  for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>;
  o[path[path.length - 1]!] = Number(v);
}
const args = all.filter((x) => !x.includes('='));
const N = Number(args[0] ?? 30);
const R = Number(args[1] ?? 75);
const mk = (side: string, i: number) => {
  const r = createTeamRoster({ id: `v${side}${i}`, rating: R }, `diagC-${side}-${R}-${i}`, 2018, []);
  r.formation = '4-2-3-1';
  const s = teamSetupFromRoster(r, rosterRating(r), R, `wC${i}`);
  s.tactics = { ...s.tactics, ...BALANCED };
  return s;
};
const BINS = [0, 10, 20, 30, 40, 51];
const bin = (d: number) => { let b = 0; while (b + 1 < BINS.length - 1 && d >= BINS[b + 1]!) b++; return b; };
const PASS = new Set(['pass', 'through', 'cutback', 'layoff', 'long', 'back']);
let dec = 0, passDec = 0;
const nearHist = [0, 0, 0, 0, 0]; // 가장 가까운 동료 0~6 · 6~10 · 10~14 · 14~20 · 20+
const has10: [number, number] = [0, 0]; // 10 m 안 패스 후보 있는 결정 · 그중 10 m 안 패스를 고름
const cand = BINS.slice(0, -1).map(() => ({ n: 0, p: 0, v: 0, u: 0, du: 0, chosen: 0, best: 0 }));
let longCh = 0, longAlt = 0, longAltDu = 0, longPress = 0;
let shortAvailWhenMid = 0, mid = 0;
const typeCount = new Map<string, number>();
// 짧은 후보의 가치 대비 소유자 자리 가치 (전진 이득)
let shortGain = 0, shortGainN = 0, midGain = 0, midGainN = 0;
probe.decide = (st, p) => {
  const a = p.a;
  if (a.line === 0 || st.possOrigin !== 'open') return;
  dec++;
  typeCount.set(p.chosen.type, (typeCount.get(p.chosen.type) ?? 0) + 1);
  let nd = 99;
  for (const m of st.agents) if (m.onPitch && m.team === a.team && m !== a && m.line !== 0) nd = Math.min(nd, dist(m.x, m.y, a.x, a.y));
  nearHist[nd < 6 ? 0 : nd < 10 ? 1 : nd < 14 ? 2 : nd < 20 ? 3 : 4]!++;
  const passes = p.cands.filter((c) => c.receiver >= 0 && PASS.has(c.type));
  const maxU = Math.max(...p.cands.map((c) => c.u));
  for (const c of passes) {
    const d = dist(a.x, a.y, c.x, c.y);
    const b = cand[bin(d)]!;
    b.n++; b.p += c.p; b.v += c.value; b.u += c.u; b.du += maxU - c.u;
    if (c === p.chosen) b.chosen++;
    if (c.u === maxU) b.best++;
    const dir = attackDir(a.team, st.half);
    const g = (toNorm(c.x, c.y, dir)[0] - toNorm(a.x, a.y, dir)[0]) * 105;
    if (d < 10) { shortGain += g; shortGainN++; } else if (d < 30) { midGain += g; midGainN++; }
  }
  const short = passes.filter((c) => dist(a.x, a.y, c.x, c.y) < 10);
  if (short.length) { has10[0]++; if (short.includes(p.chosen)) has10[1]++; }
  if (p.chosen.receiver >= 0 && PASS.has(p.chosen.type)) {
    passDec++;
    const d = dist(a.x, a.y, p.chosen.x, p.chosen.y);
    const alt = passes.filter((c) => dist(a.x, a.y, c.x, c.y) < 15 && c.p >= 0.85);
    if (d >= 30) {
      longCh++;
      if (alt.length) { longAlt++; longAltDu += p.chosen.u - Math.max(...alt.map((c) => c.u)); }
      let od = 99;
      for (const o of st.agents) if (o.onPitch && o.team !== a.team) od = Math.min(od, dist(o.x, o.y, a.x, a.y));
      if (od < 4) longPress++;
    } else if (d >= 10) { mid++; if (short.length) shortAvailWhenMid++; }
  }
};
for (let i = 0; i < N; i++) {
  const m = createMatch({ home: mk('a', i), away: mk('b', i), mode: 'auto', difficulty: 'normal', seed: 7000 + i, bigMatch: false, neutral: true });
  while (!m.state.done) m.step();
}
const pc = (x: number, d: number) => (d ? ((100 * x) / d).toFixed(1) : '–');
console.log(`\n== 패스 결정 분해 (${N}경기, ${R}:${R}, 4-2-3-1 균형) — 결정 ${(dec / N / 2).toFixed(0)}/팀·경기, 패스 선택 ${pc(passDec, dec)}% ==`);
console.log(`가장 가까운 동료: 0~6 ${pc(nearHist[0]!, dec)} · 6~10 ${pc(nearHist[1]!, dec)} · 10~14 ${pc(nearHist[2]!, dec)} · 14~20 ${pc(nearHist[3]!, dec)} · 20+ ${pc(nearHist[4]!, dec)} %`);
console.log(`10 m 안 패스 후보가 있는 결정 ${pc(has10[0], dec)}% · 그때 10 m 안 패스를 고름 ${pc(has10[1], has10[0])}%`);
console.log(`중거리(10~30 m) 패스를 고를 때 10 m 안 후보 있음 ${pc(shortAvailWhenMid, mid)}%`);
console.log(`롱(30 m+) 선택 ${pc(longCh, passDec)}% (패스 중) · 그때 15 m 안 p≥0.85 후보 있음 ${pc(longAlt, longCh)}% (효용 차 롱−짧음 평균 ${(longAltDu / Math.max(1, longAlt)).toFixed(4)}) · 4 m 안 압박 ${pc(longPress, longCh)}%`);
console.log(`전진 이득(후보 받는 곳 − 소유자, m): 10 m 안 ${(shortGain / Math.max(1, shortGainN)).toFixed(1)} · 10~30 m ${(midGain / Math.max(1, midGainN)).toFixed(1)}`);
console.log('| 후보 거리 | 후보/결정 | 평균 p | 평균 가치 | 평균 효용 | 최고와 효용 차 | 최고 효용 비율 % | 선택 비율 % |');
cand.forEach((b, i) => console.log(`| ${BINS[i]}~${BINS[i + 1]} | ${(b.n / dec).toFixed(2)} | ${(b.p / b.n).toFixed(3)} | ${(b.v / b.n).toFixed(4)} | ${(b.u / b.n).toFixed(4)} | ${(b.du / b.n).toFixed(4)} | ${pc(b.best, b.n)} | ${pc(b.chosen, b.n)} |`));
console.log('고른 행동:', [...typeCount.entries()].sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${pc(v, dec)}`).join(' · '));
process.exit(0);
