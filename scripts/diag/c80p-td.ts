// @ts-nocheck — 진단 스크립트 (C.80p, 엄격 타입 검사 제외)
// 티키 대 직선 원인 측정: 양 팀 슛·골을 '소유 사슬 시작'(재개 · 상대 진영/중간/자기 ⅓ 탈취)·사슬 길이(초·패스)·사슬 안 롱패스(30 m+)·반대 전환 여부로 분류,
//   팀별 오픈 플레이 상실 자리(⅓) · 상실 뒤 15초 안 상대 슛/골, xG.
// 메인 스레드 · 상태 읽기만. 실행: npx vite-node scripts/diag/c80p-td.ts -- [경기수=40] A B [seed=41000] [json=파일] [경로=값 …]
import { writeFileSync } from 'node:fs';
import { setEnvironmentFixed } from '../../src/weather';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { FORMATION_SLOTS } from '../../src/formations';
import { createMatch } from '../../src/engine/sim';
import { ENGINE } from '../../src/engine/config';
import { tacticsOf } from '../../src/engine/tactics';
import { W, attackDir } from '../../src/engine/pitch';
import { probe } from '../../src/engine/probe';

setEnvironmentFixed(true);
const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
const specs: string[] = [];
let n = 40, seed0 = 41000, json = '';
for (const a of all) {
  if (a.startsWith('seed=')) seed0 = Number(a.slice(5));
  else if (a.startsWith('json=')) json = a.slice(5);
  else if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
  else specs.push(a);
}
for (const [path, v] of Object.entries(overrides)) {
  const keys = path.split('.'); let o = ENGINE as any;
  for (const k of keys.slice(0, -1)) o = o[k];
  o[keys[keys.length - 1]!] = v;
}
const tac = (spec: string) => {
  const [t, lv] = spec.split('@');
  const levels = lv ? { lineHeight: Number(lv[0]), pressing: Number(lv[1]), style: Number(lv[2]), width: Number(lv[3]) } : undefined;
  return tacticsOf(t as any, levels as any);
};
function build(side: string, seed: number, spec: string) {
  const roster = createTeamRoster({ id: `v${side}${seed}`, rating: 75 }, `eng-${side}-75-${seed}`, 2018, []);
  roster.formation = '4-4-2';
  const setup = teamSetupFromRoster(roster, rosterRating(roster), 75, `w${seed}`);
  const before = setup.tactics.tendency;
  setup.tactics = { ...setup.tactics, ...tac(spec) };
  if (setup.tactics.tendency !== before) {
    const slots = FORMATION_SLOTS[roster.formation];
    for (const p of setup.lineup) delete p.role;
    fillRoles(setup, (slot) => slots[slot]!.pos);
  }
  return setup;
}
const [A, B] = specs as [string, string];
const mk = () => ({ g: 0, sh: 0, xg: 0, poss: 0, loss: [0, 0, 0], lossSh: [0, 0, 0], lossG: [0, 0, 0], lossXg: [0, 0, 0],
  rs: {} as Record<string, number>, cls: {} as Record<string, { sh: number; xg: number; g: number }>, passes: 0, longs: 0, chains: 0, oppHalfT: 0, finalThirdT: 0 });
const R = [mk(), mk()]; // 0 = A, 1 = B
let side: number[] = [0, 1];
let curS: any = null;
let chain: any = null;
const add = (r: any, k: string, xg: number, g: number) => { const c = (r.cls[k] ??= { sh: 0, xg: 0, g: 0 }); c.sh++; c.xg += xg; c.g += g; };
const nx = (s: any, team: number, x: number) => attackDir(team, s.half) === 1 ? x / 105 : 1 - x / 105;
const shots: any[] = [];
let lastR: any = null;
probe.shot = (s, p) => { (p as any).chain = chain && chain.team === p.team ? { ...chain } : null; (p as any).sp = lastR && lastR.team === p.team && s.t - lastR.t <= 14 && ['corner', 'freeKick', 'throwIn'].includes(lastR.type) ? lastR.type : null; shots.push(p); };
for (let k = 0; k < n; k++) {
  const seed = seed0 + k;
  const ta = build('a', seed, A), tb = build('b', seed, B);
  const aHome = k % 2 === 0;
  const m = createMatch({ home: aHome ? ta : tb, away: aHome ? tb : ta, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  const s = m.state; curS = s;
  const who = (team: number) => (team === 0) === aHome ? 0 : 1; // 0 = A
  chain = null; shots.length = 0; lastR = null;
  let lastFl: any = null, sawRestart = true;
  const losses: { t: number; team: number; z: number }[] = [];
  while (!s.done) {
    m.step();
    if (s.restart) { sawRestart = true; if (!lastR || lastR.obj !== s.restart) { lastR = { obj: s.restart, type: s.restart.type, team: s.restart.team, t: s.t }; R[who(s.restart.team)].rs[s.restart.type] = (R[who(s.restart.team)].rs[s.restart.type] ?? 0) + 1; } } else if (lastR) lastR.t = Math.min(lastR.t, s.t);
    const o = s.ball.owner;
    if (o >= 0) {
      const a = s.agents[o]!;
      if (!chain || chain.team !== a.team) {
        if (chain && !sawRestart) { // 상실(오픈 플레이)
          const lz = nx(s, chain.team, a.x) ; // 상실팀 기준 = 1 - 탈취팀 기준
          const z = Math.min(2, Math.max(0, Math.floor(lz * 3)));
          losses.push({ t: s.t, team: chain.team, z });
          R[who(chain.team)].loss[z]++;
        }
        const x = nx(s, a.team, a.x);
        chain = { team: a.team, t0: s.t, start: sawRestart ? 'restart' : x < 1 / 3 ? 'win-own' : x < 2 / 3 ? 'win-mid' : 'win-opp', passes: 0, long: 0, sw: 0 };
        R[who(a.team)].chains++;
      }
      sawRestart = false;
      R[who(a.team)].poss++;
      const x = nx(s, a.team, a.x);
      if (x > 0.5) R[who(a.team)].oppHalfT++;
      if (x > 2 / 3) R[who(a.team)].finalThirdT++;
    }
    const fl = s.ball.flight;
    if (fl && fl !== lastFl && fl.passer >= 0 && (fl.kind === 'pass' || fl.kind === 'long') && chain && s.agents[fl.passer]!.team === chain.team) {
      chain.passes++; R[who(chain.team)].passes++;
      const d = Math.hypot(fl.toX - fl.fromX, fl.toY - fl.fromY);
      if (d >= 30) { chain.long++; R[who(chain.team)].longs++; }
      if (Math.abs(fl.toY - fl.fromY) >= 25 && (fl.toY - W / 2) * (fl.fromY - W / 2) < 0) chain.sw++;
    }
    lastFl = fl;
  }
  for (const p of shots) {
    const r = R[who(p.team)];
    const g = p.outcome === 'goal' ? 1 : 0; const xg = p.xg ?? 0;
    r.sh++; r.xg += xg; r.g += g;
    const c = p.chain;
    let k1 = 'none';
    if (c) {
      const dt = p.t - c.t0;
      const fast = dt <= 10 ? 'fast' : 'slow';
      k1 = `${c.start}|${fast}|${c.long ? 'long' : 'nolong'}${c.sw ? '+sw' : ''}`;
    }
    if (p.sp) k1 = 'SP-' + p.sp; if (p.kind === 'fk' || p.kind === 'pk') k1 = p.kind; else if (p.kind === 'header') k1 = 'H:' + k1;
    add(r, k1, xg, g);
    // 상실 뒤 15초 안 슛
    const l = [...losses].reverse().find((L) => L.team !== p.team && p.t - L.t >= 0 && p.t - L.t <= 15);
    if (l) { const rl = R[who(l.team)]; rl.lossSh[l.z]++; rl.lossXg[l.z] += xg; rl.lossG[l.z] += g; }
  }
}
const f = (v: number, d = 2) => (v / n).toFixed(d);
console.log(`\n${A} 대 ${B} ${n}경기 seed ${seed0} 덮어쓰기 ${JSON.stringify(overrides)}`);
for (const [i, nm] of [[0, A], [1, B]] as const) {
  const r = R[i]; const tp = R[0].poss + R[1].poss;
  console.log(`[${nm}] 득 ${f(r.g)} · 슛 ${f(r.sh, 1)} · xG ${f(r.xg)} · xG/슛 ${(r.xg / r.sh).toFixed(3)} · 점유 ${(100 * r.poss / tp).toFixed(1)}% · 상대진영 소유 ${(100 * r.oppHalfT / r.poss).toFixed(0)}% · 마지막⅓ ${(100 * r.finalThirdT / r.poss).toFixed(0)}% · 패스 ${f(r.passes, 0)} · 30m+ ${f(r.longs, 1)} · 사슬 ${f(r.chains, 0)}`);
  console.log(`   오픈 상실 자기/중간/상대 ⅓: ${r.loss.map((v) => f(v, 1)).join(' / ')} · 그 뒤 15초 상대 슛 ${r.lossSh.map((v) => f(v, 2)).join(' / ')} · 골 ${r.lossG.map((v) => f(v, 3)).join(' / ')} · xG ${r.lossXg.map((v) => f(v, 3)).join(' / ')}`);
  const rows = Object.entries(r.cls).sort((p, q) => q[1].g - p[1].g || q[1].xg - p[1].xg);
  for (const [k1, c] of rows) console.log(`   ${k1.padEnd(32)} 슛 ${f(c.sh)} · xG ${f(c.xg, 3)} · 골 ${f(c.g, 3)}`);
}
if (json) writeFileSync(json, JSON.stringify({ A, B, n, seed0, overrides, R }));
process.exit(0);
