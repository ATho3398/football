// 진단 (C.78b): 게겐 팀이 공을 잃은 뒤 8초 동안 탈취 팀(균형)의 결정 종류·전진 비율·결정 위치, 8초 안 슛/다시 잃음/8초 끝 공 위치. 엔진 코드는 바꾸지 않는다.
// npx vite-node scripts/diag/c78b-win8.ts -- [경기수=20] [경로=값 ...]
import { ENGINE } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { tacticsOf } from '../../src/engine/tactics';
import type { Tendency, TeamSetup } from '../../src/engine/types';
import { probe } from '../../src/engine/probe';
import { attackDir, toNorm } from '../../src/engine/pitch';
import { FORMATION_SLOTS } from '../../src/formations';
import { createTeamRoster, rosterRating } from '../../src/roster';

const allArgs = process.argv.slice(2).filter((a) => a !== '--');
for (const a of allArgs.filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string];
  const path = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>;
  for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>;
  o[path[path.length - 1]!] = Number(v);
}
const N = Number(allArgs.filter((x) => !x.includes('='))[0] ?? 20);
const mk = (side: string, i: number, tn: Tendency): TeamSetup => {
  const r = createTeamRoster({ id: `v${side}${i}`, rating: 75 }, `diagR-${side}-${i}`, 2018, []);
  r.formation = '4-4-2';
  const s = teamSetupFromRoster(r, rosterRating(r), 75, `wR${i}`);
  s.tactics = tacticsOf(tn);
  const slots = FORMATION_SLOTS[s.formation];
  for (const p of s.lineup) delete p.role;
  fillRoles(s, (slot) => slots[slot]!.pos);
  return s;
};
const D = { n: 0, types: {} as Record<string, number>, fwd: 0, nx: [0, 0, 0, 0], ot: 0 };
const E = { n: 0, shot: 0, lost: 0, endNx: [] as number[], firstDecT: [] as number[], passes: [] as number[] };
let ep: { team: 0 | 1; t0: number; shot: boolean; lost: boolean; first: number; passes: number } | null = null;
probe.decide = (s, { a, chosen }) => {
  if (!ep || a.team !== ep.team || s.t - ep.t0 > 8) return;
  D.n++;
  D.types[chosen.type] = (D.types[chosen.type] ?? 0) + 1;
  if (chosen.ot) D.ot++;
  const dir = attackDir(a.team, s.half);
  const ax = toNorm(a.x, a.y, dir)[0];
  if (chosen.receiver >= 0 && toNorm(chosen.x, chosen.y, dir)[0] > ax + 0.03) D.fwd++;
  if (chosen.type === 'carry' || chosen.type === 'dribble') if (toNorm(chosen.x, chosen.y, dir)[0] > ax + 0.03) D.fwd++;
  D.nx[Math.min(3, Math.floor(ax * 4))]!++;
  if (ep.first < 0) ep.first = s.t - ep.t0;
  if (chosen.receiver >= 0) ep.passes++;
};
for (let i = 0; i < N; i++) {
  const home = i % 2 === 0;
  const m = createMatch({ home: mk('H', i, home ? 'gegenpress' : 'balanced'), away: mk('A', i, home ? 'balanced' : 'gegenpress'), mode: 'auto', difficulty: 'normal', seed: 41000 + i, bigMatch: false, neutral: true });
  const s = m.state;
  const geg = home ? 0 : 1;
  const win = (1 - geg) as 0 | 1;
  let prevPoss = s.possTeam;
  let shotsPrev = 0;
  const close = () => {
    if (!ep) return;
    E.n++;
    if (ep.shot) E.shot++;
    if (ep.lost) E.lost++;
    if (ep.first >= 0) E.firstDecT.push(ep.first);
    E.passes.push(ep.passes);
    const dir = attackDir(win, s.half);
    E.endNx.push(toNorm(s.ball.x, s.ball.y, dir)[0]);
    ep = null;
  };
  while (!s.done) {
    m.step();
    if (s.possTeam !== prevPoss && !s.restart && s.possOrigin === 'open') {
      if (s.possTeam === win && (!ep || s.t - ep.t0 > 8)) { close(); ep = { team: win, t0: s.t, shot: false, lost: false, first: -1, passes: 0 }; shotsPrev = s.teams[win].stats.shots; }
      else if (ep && s.possTeam !== win && s.t - ep.t0 <= 8) ep.lost = true;
    }
    prevPoss = s.possTeam;
    if (ep && s.t - ep.t0 <= 8 && s.teams[win].stats.shots > shotsPrev) ep.shot = true;
    if (ep && s.t - ep.t0 > 8) close();
  }
  close();
}
const pc = (x: number, n: number) => `${((x / Math.max(1, n)) * 100).toFixed(1)}%`;
const avg = (x: number[]) => x.reduce((a, b) => a + b, 0) / Math.max(1, x.length);
console.log(`게겐이 잃은 뒤 8초 (${N}경기, 4-4-2 게겐 대 균형): 탈취 ${E.n} (${(E.n / N).toFixed(1)}/경기) · 8초 슛 ${pc(E.shot, E.n)} · 8초 안 다시 잃음 ${pc(E.lost, E.n)} · 첫 결정 ${avg(E.firstDecT).toFixed(2)} s · 패스 ${avg(E.passes).toFixed(1)}개 · 8초 끝 공 위치(탈취 팀 공격 방향 0~1) ${avg(E.endNx).toFixed(2)}`);
console.log(`탈취 팀 결정 ${D.n} (${(D.n / Math.max(1, E.n)).toFixed(1)}/탈취): 전진 ${pc(D.fwd, D.n)} · 원터치 ${pc(D.ot, D.n)} · 위치 1/4 별 ${D.nx.map((x) => pc(x, D.n)).join('/')} · 종류 ${Object.entries(D.types).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v, D.n)}`).join(' · ')}`);
