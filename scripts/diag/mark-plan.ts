// 마크 배정 진단 (C.75d, 44c-b): 골 35 m 안 공격수의 2.5 m 안 수비 2명+ 원인, 5 m 안 없음 원인, 맡은 수비수 교체 빈도
// npx vite-node scripts/diag/mark-plan.ts -- [경기수] [대형] [홈 전술] [원정 전술] [경로=값 ...]
import { ENGINE } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { tacticsOf } from '../../src/engine/tactics';
import type { Tendency, TeamSetup } from '../../src/engine/types';
import { attackDir, dist, ownGoal } from '../../src/engine/pitch';
import { ballRank } from '../../src/engine/offball';
import { FORMATION_SLOTS, type Formation } from '../../src/formations';
import { createTeamRoster, rosterRating } from '../../src/roster';

const allArgs = process.argv.slice(2).filter((a) => a !== '--');
for (const a of allArgs.filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string];
  const path = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>;
  for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>;
  o[path[path.length - 1]!] = Number(v);
}
const args = allArgs.filter((x) => !x.includes('='));
const N = Number(args[0] ?? 20);
const FORMATION = (args[1] ?? '4-2-3-1') as Formation;
const mk = (side: string, i: number, tn: string): TeamSetup => {
  const r = createTeamRoster({ id: `v${side}${i}`, rating: 75 }, `diagD-${side}-${i}`, 2018, []);
  r.formation = FORMATION;
  const s = teamSetupFromRoster(r, rosterRating(r), 75, `wD${i}`);
  s.tactics = tacticsOf(tn as Tendency);
  const slots = FORMATION_SLOTS[s.formation];
  for (const p of s.lineup) delete p.role;
  fillRoles(s, (slot) => slots[slot]!.pos);
  return s;
};
const K = ['자기 마커', '남의 마커', '압박 rank0', 'rank1', '줄1 자유', '줄2 자유', '줄3'] as const;
const dbl = [0, 0, 0, 0, 0, 0, 0];
let dblN = 0, attN = 0;
const un = { noMarker: 0, markerFar: 0, total: 0, tgtFar: 0, line1: 0, line2: 0, fresh: 0 };
let churnN = 0, churnC = 0, mkN = 0, mkC = 0, nearIsMk = 0, nearChMk = [0, 0, 0];
for (let g = 0; g < N; g++) {
  const m = createMatch({ home: mk('h', g, args[2] ?? 'balanced'), away: mk('a', g, args[3] ?? 'balanced'), mode: 'auto', difficulty: 'normal', seed: 7000 + g, bigMatch: false, neutral: true });
  const s = m.state;
  const near = new Map<number, number>(), marker = new Map<number, number>();
  let lastPoss = -1;
  while (!s.done) {
    m.step();
    if (s.tick % 10 !== 0 || s.restart || s.ball.owner < 0 || s.ball.flight) continue;
    const owner = s.agents[s.ball.owner]!;
    if (owner.line === 0) continue;
    if (s.possSince !== lastPoss) { near.clear(); marker.clear(); lastPoss = s.possSince; }
    const def = (1 - owner.team) as 0 | 1;
    const [gx, gy] = ownGoal(attackDir(def, s.half));
    const D = s.agents.filter((o) => o.onPitch && o.team === def && o.line !== 0);
    for (const a of s.agents) {
      if (!a.onPitch || a.team !== owner.team || a.line === 0 || a === owner) continue;
      if (dist(a.x, a.y, gx, gy) >= 35) { near.delete(a.idx); marker.delete(a.idx); continue; }
      attN++;
      const close = D.filter((d) => dist(d.x, d.y, a.x, a.y) <= 2.5);
      if (close.length >= 2) {
        dblN++;
        for (const d of close) {
          const r = ballRank(s, d, s.ball.x, s.ball.y);
          const k = d.markIdx === a.idx ? 0 : d.markIdx >= 0 ? 1 : r === 0 ? 2 : r === 1 ? 3 : d.line === 1 ? 4 : d.line === 2 ? 5 : 6;
          dbl[k]!++;
        }
      }
      let best = Infinity, bi = -1;
      for (const d of D) { const dd = dist(d.x, d.y, a.x, a.y); if (dd < best) { best = dd; bi = d.idx; } }
      const mk1 = D.find((d) => d.markIdx === a.idx);
      if (best > 5) { un.total++; if (!mk1) un.noMarker++; else { un.markerFar++; if (dist(mk1.tx, mk1.ty, a.x, a.y) > 5) un.tgtFar++; if (mk1.line === 1) un.line1++; else un.line2++; if (mk1.markUntil - s.t > 0.4) un.fresh++; } }
      if (mk1 && mk1.idx === bi) nearIsMk++;
      const pn = near.get(a.idx); if (pn !== undefined) { churnN++; if (pn !== bi) { churnC++; nearChMk[mk1 ? (mk1.idx === bi || mk1.idx === pn ? 0 : 1) : 2]!++; } } near.set(a.idx, bi);
      const mi = mk1 ? mk1.idx : -1; const pm = marker.get(a.idx); if (pm !== undefined) { mkN++; if (pm !== mi) mkC++; } marker.set(a.idx, mi);
    }
  }
}
const pct = (a: number, b: number) => `${((100 * a) / Math.max(1, b)).toFixed(0)}%`;
const tot = dbl.reduce((a, b) => a + b, 0);
console.log(`골 35 m 안 공격수 표본 ${attN}: 2.5 m 안 2명+ ${pct(dblN, attN)} — 원인 ${K.map((k, i) => `${k} ${pct(dbl[i]!, tot)}`).join(' · ')}`);
console.log(`5 m 안 없음 ${pct(un.total, attN)} — 마커 없음 ${pct(un.noMarker, un.total)} · 마커 5 m 밖 ${pct(un.markerFar, un.total)} (그중 목표도 5 m 밖 ${pct(un.tgtFar, un.markerFar)} · 줄1 ${pct(un.line1, un.markerFar)} · 줄2 ${pct(un.line2, un.markerFar)} · 막 배정 ${pct(un.fresh, un.markerFar)})`);
console.log(`가장 가까운 수비수 교체 (같은 소유 안) 분당 ${(60 * churnC / Math.max(1, churnN)).toFixed(1)} · 맡은 수비수 교체 분당 ${(60 * mkC / Math.max(1, mkN)).toFixed(1)} · 가장 가까운 = 마커 ${pct(nearIsMk, attN)} · 교체 중 마커 관련 ${pct(nearChMk[0]!, churnC)} / 마커 무관 ${pct(nearChMk[1]!, churnC)} / 마커 없음 ${pct(nearChMk[2]!, churnC)}`);
