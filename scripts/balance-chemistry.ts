// 동료 호흡·상대 분석·패스 받는 빈도 효과 측정 (부록 C.74c): 내 선수가 뛰는 같은 시드 경기 묶음을 설정별로 돌려 기준(호흡 0·관계 보통·리포트 없음) 대비 변화를 본다.
// 실행 배율(호흡·약점 공략)은 판단 무수정, 패스 받는 빈도는 선택 가중만이라 같은 시드 비교로 효과 크기를 읽는다. 목표 밖이면 --check 에서 종료 코드 1
// npm run balance:chemistry              (기본 경기 120개 = 내 선수 4명 × 30, 설정 6개, 프로세스 WORKERS(기본 4)개)
// npm run balance:chemistry -- --n 240   표본 늘리기

import { BALANCE } from '../src/config/balance';
import { playMyMatch, type EngineMatchInput } from '../src/engine/adapter';
import type { RapportInput } from '../src/engine/rapport';
import type { PlayerStats } from '../src/engine/types';
import { newGame, roundMatch, selectableRealPlayers, type GameState } from '../src/game';
import { teamById } from '../src/league';
import { chemPassMul, passTargetMul, scoutReport, type ScoutReport } from '../src/rapport';
import { setEnvironmentFixed } from '../src/weather';
import { spawn } from 'node:child_process';

const argv = process.argv;
const nIdx = argv.indexOf('--n');
const N = nIdx >= 0 ? Number(argv[nIdx + 1]) : 120;
const partIdx = argv.indexOf('--part');
const PART = partIdx >= 0 ? Number(argv[partIdx + 1]) : -1;
const PARTS = Math.max(1, Number(process.env.WORKERS ?? 4));
const check = argv.includes('--check');

setEnvironmentFixed(true);
// 내 선수 4명 (포지션이 다른 실제 선수): 공격수 · 윙어 · 미드필더 · 수비수
const WANT = [['ST', 'CF'], ['LW', 'RW', 'LM', 'RM'], ['CM', 'CAM', 'CDM'], ['CB', 'LB', 'RB']];
const real = selectableRealPlayers();
const worlds: GameState[] = WANT.map((ps, i) => {
  const p = real.find((x) => ps.includes(x.position))!;
  return newGame({ mode: 'real', playerId: p.id, seed: `chem-bench-${i}`, difficulty: 'normal' });
});

interface Agg {
  matches: number; ms: number; msSum: number;
  passes: number; passOk: number; received: number; minutes: number;
  /** 내 팀 패스 성공 (내가 뛴 경기 전체) — 받은 패스 몫 = received / teamOk */
  teamOk: number;
  /** 리포트 약점 행동 시도 / 성공 (기준 설정에도 같은 리포트로 센다) */
  exTry: number; exOk: number;
}
const empty = (): Agg => ({ matches: 0, ms: 0, msSum: 0, passes: 0, passOk: 0, received: 0, minutes: 0, teamOk: 0, exTry: 0, exOk: 0 });

/** 약점 행동별 시도·성공 (내 경기 기록) */
function exploitCount(my: PlayerStats, r: ScoutReport): [number, number] {
  let t = 0;
  let o = 0;
  const acts = new Set(r.actions);
  if (acts.has('pass')) { t += my.passes - my.throughPasses; o += my.passesCompleted - my.throughCompleted; }
  if (acts.has('through')) { t += my.throughPasses; o += my.throughCompleted; }
  if (acts.has('dribble')) { t += my.dribbles; o += my.dribblesWon; }
  if (acts.has('shoot')) { t += my.shots; o += my.shotsOnTarget; }
  if (acts.has('cross')) { t += my.crosses; o += my.crossesCompleted; }
  if (acts.has('header')) { t += my.aerialDuels; o += my.aerialsWon; }
  return [t, o];
}

type Cfg = 'base' | 'chemMax' | 'relBad' | 'relGood' | 'relGoodChem' | 'scout';
const ALL_CFGS: Cfg[] = ['base', 'chemMax', 'relBad', 'relGood', 'relGoodChem', 'scout'];
/** CHEM_CFGS=relBad,relGood 처럼 일부만 (기준은 늘 포함) */
const CFGS: Cfg[] = process.env.CHEM_CFGS ? ['base', ...(process.env.CHEM_CFGS.split(',') as Cfg[]).filter((c) => c !== 'base')] : ALL_CFGS;

/** k 번째 경기: 세계 k % 4, 상대 (k 기반), 시드 */
function matchAt(k: number): { input: EngineMatchInput; report: ScoutReport | null; g: GameState } {
  const g = worlds[k % worlds.length]!;
  const rm = roundMatch(g);
  const ids = g.league.teams.map((t) => t.id).filter((id) => id !== g.player.teamId);
  const opp = ids[(k * 7 + 3) % ids.length]!;
  const oppRoster = g.rosters[opp]!;
  setEnvironmentFixed(false);
  const report = scoutReport(oppRoster, rm.input.me.position);
  setEnvironmentFixed(true);
  const input: EngineMatchInput = {
    ...rm.input, oppRoster, oppRating: teamById(g.league, opp).rating, home: k % 2 === 0, seed: 7700 + k,
    plan: { started: true, minutes: { start: 0, end: 90 } },
  };
  delete input.rapport;
  return { input, report, g };
}

function rapportFor(cfg: Cfg, g: GameState, report: ScoutReport | null): RapportInput | undefined {
  const mates = g.rosters[g.player.teamId]!.players.map((p) => p.id);
  const full = BALANCE.chemistry.fullMinutes;
  const all = (v: number) => Object.fromEntries(mates.map((id) => [id, v]));
  switch (cfg) {
    case 'base': return undefined;
    case 'chemMax': return { chem: all(chemPassMul(full)) };
    case 'relBad': return { toMe: all(passTargetMul(0, 0)) };
    case 'relGood': return { toMe: all(passTargetMul(100, 0)) };
    case 'relGoodChem': return { chem: all(chemPassMul(full)), toMe: all(passTargetMul(100, full)) };
    case 'scout': return report ? { scout: { defender: report.defenderId, actions: report.actions, mul: BALANCE.scouting.mul } } : undefined;
  }
}

function runPart(part: number): Record<Cfg, Agg> {
  const out = Object.fromEntries(CFGS.map((c) => [c, empty()])) as Record<Cfg, Agg>;
  // 예열 (JIT)
  void playMyMatch(matchAt(0).input);
  for (let k = 0; k < N; k++) {
    if (part >= 0 && k % PARTS !== part) continue;
    const { input, report, g } = matchAt(k);
    for (const cfg of CFGS) {
      const rp = rapportFor(cfg, g, report);
      const t0 = performance.now();
      const o = playMyMatch({ ...input, ...(rp ? { rapport: rp } : {}) });
      const a = out[cfg];
      const dt = performance.now() - t0;
      a.ms = Math.max(a.ms, dt);
      a.msSum += dt;
      a.matches++;
      const my = o.my;
      if (!my) continue;
      a.passes += my.passes; a.passOk += my.passesCompleted; a.received += my.received; a.minutes += my.minutes;
      a.teamOk += o.engine.teamStats[o.side].passesCompleted;
      if (report) {
        const [t, ok] = exploitCount(my, report);
        a.exTry += t; a.exOk += ok;
      }
    }
  }
  return out;
}

function merge(a: Agg, b: Agg): Agg {
  const o = { ...a };
  for (const k of Object.keys(b) as (keyof Agg)[]) o[k] = k === 'ms' ? Math.max(a.ms, b.ms) : a[k] + b[k];
  return o;
}

async function runAll(): Promise<Record<Cfg, Agg>> {
  const procs = Array.from({ length: PARTS }, (_, i) => new Promise<Record<Cfg, Agg>>((res, rej) => {
    const c = spawn('npx', ['vite-node', 'scripts/balance-chemistry.ts', '--', '--n', String(N), '--part', String(i)], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, WORKERS: String(PARTS) } });
    let buf = '';
    c.stdout.on('data', (d) => (buf += d));
    c.on('close', (code) => {
      const line = buf.split('\n').find((l) => l.startsWith('PART '));
      if (code !== 0 || !line) rej(new Error(`부분 ${i} 실패 (${code})`));
      else res(JSON.parse(line.slice(5)));
    });
  }));
  const parts = await Promise.all(procs);
  const out = {} as Record<Cfg, Agg>;
  for (const p of parts) for (const [k, v] of Object.entries(p) as [Cfg, Agg][]) out[k] = out[k] ? merge(out[k], v) : v;
  return out;
}

if (PART >= 0) {
  console.log(`PART ${JSON.stringify(runPart(PART))}`);
  process.exit(0);
}

const t0 = Date.now();
const res = await runAll();
const ratio = (x: number, y: number) => (y > 0 ? x / y : 0);
const pct = (x: number, b: number) => (b ? ((x - b) / b) * 100 : 0);
const fmt = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(1)}%`;
const passRate = (a: Agg) => ratio(a.passOk, a.passes);
const recv90 = (a: Agg) => ratio(a.received * 90, a.minutes);
/** 내 팀 패스 성공 중 내가 받은 몫 (점유율 차이를 덜 탄다) */
const share = (a: Agg) => ratio(a.received, a.teamOk);
const exRate = (a: Agg) => ratio(a.exOk, a.exTry);
const base = res.base;

/** [설정, 이름, 지표, 목표 하한, 상한 (%)] */
const ROWS: [Cfg, string, 'pass' | 'share' | 'ex', number, number][] = [
  ['chemMax', `호흡 최대 (전원 ×${chemPassMul(BALANCE.chemistry.fullMinutes)})`, 'pass', 1.5, 5],
  ['relBad', `팀 관계 나쁨 (0, 받는 빈도 ×${passTargetMul(0, 0).toFixed(2)})`, 'share', -12, -2],
  ['relGood', `팀 관계 좋음 (100, ×${passTargetMul(100, 0).toFixed(2)})`, 'share', 2, 12],
  ['relGoodChem', `관계 좋음 + 호흡 최대 (×${passTargetMul(100, BALANCE.chemistry.fullMinutes).toFixed(2)})`, 'share', 2, 12],
  ['scout', `상대 분석 리포트 (약점 행동 ×${BALANCE.scouting.mul})`, 'ex', 1.5, 6],
];
const V = { pass: passRate, share, ex: exRate };
const KO = { pass: '내 패스 성공률', share: '팀 패스 중 받은 몫', ex: '약점 행동 성공률' };
const fails: string[] = [];
console.log(`[호흡·리포트·패스 받는 빈도] 같은 시드 ${N}경기 (내 선수 4명 × ${N / 4}), 기준 = 호흡 0·관계 보통·리포트 없음`);
console.log(`기준: 내 패스 성공률 ${(passRate(base) * 100).toFixed(1)}% · 90분당 받은 패스 ${recv90(base).toFixed(1)} · 팀 패스 중 받은 몫 ${(share(base) * 100).toFixed(1)}% · 약점 행동 성공률 ${(exRate(base) * 100).toFixed(1)}% (시도 ${base.exTry})`);
console.log('| 설정 | 내 패스 성공률 | 90분당 받은 패스 | 팀 패스 중 받은 몫 | 약점 행동 성공률 | 판정(목표) |');
console.log('|---|---|---|---|---|---|');
for (const [cfg, ko, key, lo, hi] of ROWS) {
  const a = res[cfg];
  if (!a) continue;
  const d = pct(V[key](a), V[key](base));
  const pass = d >= lo && d <= hi;
  if (!pass) fails.push(`${ko} ${KO[key]} ${fmt(d)} (목표 ${lo}~${hi}%)`);
  console.log(`| ${ko} | ${fmt(pct(passRate(a), passRate(base)))} | ${fmt(pct(recv90(a), recv90(base)))} | ${fmt(pct(share(a), share(base)))} | ${fmt(pct(exRate(a), exRate(base)))} | ${KO[key]} ${fmt(d)} ${pass ? '✓' : '✗'} (${lo}~${hi}) |`);
}
let maxMs = 0;
let sumMs = 0;
let nMs = 0;
for (const a of Object.values(res)) { maxMs = Math.max(maxMs, a.ms); sumMs += a.msSum; nMs += a.matches; }
console.log(`\n경기 계산 평균 ${Math.round(sumMs / Math.max(1, nMs))} ms · 최대 ${Math.round(maxMs)} ms (2초 이내 ${maxMs < 2000 ? '✓' : '✗'}) · 전체 ${Math.round((Date.now() - t0) / 1000)}초 · 프로세스 ${PARTS}개`);
if (maxMs >= 2000) fails.push(`경기 계산 ${Math.round(maxMs)} ms`);
console.log(fails.length ? `\n[호흡·리포트] 목표 밖 ${fails.length}개:\n  ${fails.join('\n  ')}` : '\n[호흡·리포트] 모두 목표 범위 안');
if (check && fails.length) process.exit(1);
process.exit(0);
