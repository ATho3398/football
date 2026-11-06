// 진단 (C.76z, 미해결 2): 고른 롱볼(30 m+)이 어떤 경로로 뽑혔는지 — 효용 1위 gap 안 / 뒤로 가는 '실수 후보' / 시야 가림 뒤 1위, 받는 선수 줄, 앞/뒤.
// 실행: npx vite-node scripts/diag/long-why.ts -- [경기수=20] [홈=76] [원정=76] [경로=값 ...]
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import type { Flight } from '../../src/engine/state';
import { attackDir, dist } from '../../src/engine/pitch';
import { candidates, visible } from '../../src/engine/onball';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { BALANCED } from '../engine/job';
import { ENGINE } from '../../src/engine/config';

const all = process.argv.slice(2).filter((a) => a !== '--');
for (const a of all.filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string];
  const path = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>;
  for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>;
  o[path[path.length - 1]!] = Number(v);
}
const args = all.filter((x) => !x.includes('='));
const N = Number(args[0] ?? 20);
const RH = Number(args[1] ?? 76);
const RA = Number(args[2] ?? 76);
const mk = (side: string, i: number, rating: number, opp: number) => {
  const r = createTeamRoster({ id: `v${side}${i}`, rating }, `diagC-${side}-${rating}-${i}`, 2018, []);
  r.formation = '4-2-3-1';
  const s = teamSetupFromRoster(r, rosterRating(r), opp, `wC${i}`);
  s.tactics = { ...s.tactics, ...BALANCED };
  return s;
};
const O = ENGINE.onball;
const C = { n: 0, back: 0, inGapAll: 0, inGapVis: 0, mistakeOnly: 0, topVis: 0, passerLine: [0, 0, 0, 0], recvLine: [0, 0, 0, 0], fromOwnHalf: 0, nShort: 0, shortInGapVis: 0, longCands: 0, shortCands: 0, visLong: 0, visShort: 0, poolLong: 0, poolShort: 0, decisions: 0 };
for (let i = 0; i < N; i++) {
  const m = createMatch({ home: mk('a', i, RH, RA), away: mk('b', i, RA, RH), mode: 'auto', difficulty: 'normal', seed: 7000 + i, bigMatch: false, neutral: true });
  const s = m.state;
  let cur: Flight | null = null;
  while (!s.done) {
    m.step();
    const fl = s.ball.flight;
    if (cur && fl !== cur) cur = null;
    if (fl && fl !== cur && fl.aimD !== undefined && fl.passer >= 0 && !fl.fromCross && fl.kind !== 'clear') {
      cur = fl;
      const a = s.agents[fl.passer]!;
      const dir = attackDir(a.team, s.half);
      const cs = candidates(s, a);
      const vis = cs.map((c, k) => visible(s, a, c, k));
      let maxAll = -Infinity, maxVis = -Infinity;
      cs.forEach((c, k) => { maxAll = Math.max(maxAll, c.u); if (vis[k]) maxVis = Math.max(maxVis, c.u); });
      if (!Number.isFinite(maxVis)) maxVis = maxAll;
      // 후보 풀 구성 (롱/숏 패스 후보 수, 보이는 수, gap 안 수)
      C.decisions++;
      cs.forEach((c, k) => {
        if (c.receiver < 0 || c.type === 'layoff') return;
        const d = dist(a.x, a.y, c.x, c.y);
        const long = d >= 30;
        if (long) C.longCands++; else C.shortCands++;
        if (vis[k]) { if (long) C.visLong++; else C.visShort++; }
        const back = (c.x - a.x) * dir < -2;
        if (vis[k] && (c.u >= maxVis - O.plausibleGap || (c.type === 'pass' && back))) { if (long) C.poolLong++; else C.poolShort++; }
      });
      const ch = cs.find((c) => c.receiver === fl.receiver && c.receiver >= 0 && c.type !== 'layoff');
      if (!ch) continue;
      if (fl.aimD < 30) { C.nShort++; if (ch.u >= maxVis - O.plausibleGap) C.shortInGapVis++; continue; }
      C.n++;
      const back = (ch.x - a.x) * dir < -2;
      if (back) C.back++;
      if (ch.u >= maxAll - O.plausibleGap) C.inGapAll++;
      if (ch.u >= maxVis - O.plausibleGap) C.inGapVis++; else if (ch.type === 'pass' && back) C.mistakeOnly++;
      if (ch.u >= maxVis - 1e-9) C.topVis++;
      C.passerLine[Math.min(3, a.line)]!++;
      const rc = s.agents[fl.receiver]!;
      C.recvLine[Math.min(3, rc.line)]!++;
      const ax = dir > 0 ? a.x : 105 - a.x;
      if (ax < 52.5) C.fromOwnHalf++;
    }
  }
}
const p = (x: number, n = C.n) => ((100 * x) / Math.max(1, n)).toFixed(0) + '%';
console.log(`\n== 롱볼(30 m+) 선택 경로 (${N}경기, ${RH} 대 ${RA}) — 롱볼 ${C.n}회 (경기당 ${(C.n / N).toFixed(1)}), 숏 ${C.nShort}회 ==`);
console.log(`뒤로(−2 m 이상) ${p(C.back)} · 전체 1위 gap 안 ${p(C.inGapAll)} · 보이는 1위 gap 안 ${p(C.inGapVis)} · gap 밖인데 뒤로 가는 실수 후보로 들어옴 ${p(C.mistakeOnly)} · 보이는 1위였음 ${p(C.topVis)}`);
console.log(`찬 선수 줄 GK/DEF/MID/FW ${C.passerLine.map((x) => p(x)).join('/')} · 받는 줄 ${C.recvLine.map((x) => p(x)).join('/')} · 자기 진영에서 ${p(C.fromOwnHalf)}`);
console.log(`숏패스 중 보이는 1위 gap 안 ${p(C.shortInGapVis, C.nShort)}`);
console.log(`결정당 패스 후보: 롱 ${(C.longCands / C.decisions).toFixed(1)} (보임 ${(C.visLong / C.decisions).toFixed(1)}, 풀 ${(C.poolLong / C.decisions).toFixed(2)}) · 숏 ${(C.shortCands / C.decisions).toFixed(1)} (보임 ${(C.visShort / C.decisions).toFixed(1)}, 풀 ${(C.poolShort / C.decisions).toFixed(2)})`);
process.exit(0);
