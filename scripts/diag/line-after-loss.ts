// 진단 (엔진 관리자 8대, §9.14.2 게겐 뒷공간): 열린 경기에서 공을 잃은 순간부터 그 팀 수비 줄(line 1)이 얼마나 빨리 내려오는지 잰다.
// 실행: npx vite-node scripts/diag/line-after-loss.ts -- [경기수=20] [홈전술=gegenpress] [원정전술=counter] [포메이션=4-3-3] [경로=값 ...]
//   잃은 팀 기준: t0(잃는 순간)·+1·+2·+3초의 수비 줄 평균 깊이(자기 골에서 m)와 오프사이드 라인, 공보다 앞(상대 골 쪽)에 있던 자기 선수 수,
//   잃은 뒤 4초 안에 상대가 침투 패스를 시도/수신했는지, 잃은 뒤 8초 안 상대 슈팅. 전환은 오픈 플레이 소유 교체(리스타트 제외)만.
import { ENGINE, ENGINE_VERSION } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { offsideLine } from '../../src/engine/offball';
import { tacticsOf, type Level } from '../../src/engine/tactics';
import type { Tendency } from '../../src/engine/types';
import { attackDir, dist, ownGoal, toNorm, L } from '../../src/engine/pitch';
import type { TeamSetup } from '../../src/engine/types';
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
const HOME = args[1] ?? 'gegenpress';
const AWAY = args[2] ?? 'counter';
const FORMATION = (args[3] ?? '4-3-3') as Formation;
const tacOf = (spec: string) => { const [tn, lv] = spec.split('@') as [Tendency, string | undefined]; const levels = lv ? { lineHeight: Number(lv[0]) as Level, pressing: Number(lv[1]) as Level, style: Number(lv[2]) as Level, width: Number(lv[3]) as Level } : undefined; return tacticsOf(tn, levels); };
const mk = (side: string, i: number, spec: string): TeamSetup => {
  const r = createTeamRoster({ id: `v${side}${i}`, rating: 75 }, `diagL-${side}-${i}`, 2018, []);
  r.formation = FORMATION;
  const s = teamSetupFromRoster(r, rosterRating(r), 75, `wL${i}`);
  s.tactics = tacOf(spec);
  const slots = FORMATION_SLOTS[s.formation];
  for (const p of s.lineup) delete p.role;
  fillRoles(s, (slot) => slots[slot]!.pos);
  return s;
};

const OFFS = [0, 0.5, 1, 1.5, 2, 3, 4];
interface Acc { n: number; line: number[]; off: number[]; ahead: number[]; through4: number; recv4: number; shot8: number; lossX: number }
const accs: [Acc, Acc] = [0, 1].map(() => ({ n: 0, line: OFFS.map(() => 0), off: OFFS.map(() => 0), ahead: OFFS.map(() => 0), through4: 0, recv4: 0, shot8: 0, lossX: 0 })) as [Acc, Acc];
interface Ep { team: 0 | 1; t0: number; done: boolean[]; through: boolean; recv: boolean; shot: boolean }

function lineDepth(s: ReturnType<typeof createMatch>['state'], team: 0 | 1): [number, number, number] {
  const dir = attackDir(team, s.half);
  const [gx, gy] = ownGoal(dir);
  let sum = 0, n = 0, ahead = 0;
  const [bnx] = toNorm(s.ball.x, s.ball.y, dir);
  for (const a of s.agents) {
    if (!a.onPitch || a.team !== team || a.line === 0) continue;
    if (a.line === 1) { sum += dist(a.x, a.y, gx, gy); n++; }
    if (toNorm(a.x, a.y, dir)[0] > bnx + 0.02) ahead++;
  }
  const opp = (1 - team) as 0 | 1;
  // 상대의 오프사이드 라인 = 우리 둘째 수비수, 우리 골에서 m
  const ol = (1 - offsideLine(s, opp)) * L;
  return [n ? sum / n : 0, ol, ahead];
}

for (let i = 0; i < N; i++) {
  const m = createMatch({ home: mk('H', i, HOME), away: mk('A', i, AWAY), mode: 'auto', difficulty: 'normal', seed: 8800 + i, bigMatch: false, neutral: true });
  const s = m.state;
  const eps: Ep[] = [];
  let prevPoss = s.possTeam;
  const shotsPrev = [s.teams[0].stats.shots, s.teams[1].stats.shots];
  let throughPrev = -1;
  while (!s.done) {
    m.step();
    const t = s.t;
    // 침투 패스 시도·수신 감지: 비행 중 kick.kind
    const fl = s.ball.flight;
    const thr = fl && fl.through ? fl.receiver : -1;
    if (s.possTeam !== prevPoss) {
      if (!s.restart && s.possOrigin === 'open') {
        const loser = prevPoss as 0 | 1;
        const dir = attackDir(loser, s.half);
        const [bnx] = toNorm(s.ball.x, s.ball.y, dir);
        accs[loser].lossX += bnx * L;
        eps.push({ team: loser, t0: t, done: OFFS.map(() => false), through: false, recv: false, shot: false });
        accs[loser].n++;
      }
      prevPoss = s.possTeam;
    }
    for (const ep of eps) {
      const dt = t - ep.t0;
      if (dt > 8.5) continue;
      const opp = (1 - ep.team) as 0 | 1;
      OFFS.forEach((o, k) => {
        if (!ep.done[k] && dt >= o - 1e-9) {
          ep.done[k] = true;
          const [ld, ol, ah] = lineDepth(s, ep.team);
          const A = accs[ep.team]; A.line[k] = (A.line[k] ?? 0) + ld; A.off[k] = (A.off[k] ?? 0) + ol; A.ahead[k] = (A.ahead[k] ?? 0) + ah;
        }
      });
      if (dt <= 4 && thr >= 0 && thr !== throughPrev && s.agents[thr]!.team === opp && !ep.through) { ep.through = true; accs[ep.team].through4++; }
      if (dt <= 4 && !ep.recv && s.ball.owner >= 0 && s.agents[s.ball.owner]!.team === opp && ep.through && !fl) {
        // 침투 뒤 받음 (대략: 침투 비행이 끝나고 상대 소유)
        ep.recv = true; accs[ep.team].recv4++;
      }
      if (dt <= 8 && !ep.shot && s.teams[opp].stats.shots > shotsPrev[opp]!) { ep.shot = true; accs[ep.team].shot8++; }
    }
    throughPrev = thr;
    shotsPrev[0] = s.teams[0].stats.shots; shotsPrev[1] = s.teams[1].stats.shots;
    // 에피소드가 쌓이지 않게 오래된 것 제거
    while (eps.length && t - eps[0]!.t0 > 9) eps.shift();
  }
}
const f = (x: number, k = 1) => x.toFixed(k);
console.log(`line-after-loss · ${N}경기 ${FORMATION} 홈 ${HOME} 대 원정 ${AWAY} (엔진 ${ENGINE_VERSION})`);
([0, 1] as const).forEach((team) => {
  const a = accs[team];
  const tac = team === 0 ? HOME : AWAY;
  console.log(`\n[${tac}] 오픈 플레이 소유 상실 ${f(a.n / N)}/경기 · 잃은 지점 자기 골에서 ${f(a.lossX / a.n)} m`);
  console.log(`  잃은 뒤 t = ${OFFS.map((o) => `${o}s`).join(' / ')}`);
  console.log(`  수비 줄 깊이(자기 골에서 m): ${a.line.map((v) => f(v / a.n)).join(' / ')}`);
  console.log(`  상대 오프사이드 라인(둘째 수비수, m): ${a.off.map((v) => f(v / a.n)).join(' / ')}`);
  console.log(`  공보다 앞(상대 골 쪽)에 있는 우리 선수 수: ${a.ahead.map((v) => f(v / a.n)).join(' / ')}`);
  console.log(`  잃은 뒤 4초 안 상대 침투 패스 시도 ${f((100 * a.through4) / a.n)}% · 그중 받음 ${f((100 * a.recv4) / Math.max(1, a.through4))}% · 8초 안 상대 슈팅 ${f((100 * a.shot8) / a.n)}%`);
});
