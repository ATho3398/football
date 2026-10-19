// 날씨·심판 효과 측정 (부록 C.74a): 같은 시드 경기 묶음을 날씨별·심판 성향별로 돌려 맑음·보통 심판 대비 변화를 본다.
// 실행 배율만 바뀌므로 (판단 무수정) 같은 시드 비교로 효과 크기를 바로 읽을 수 있다. 목표 범위 밖이면 --check 에서 종료 코드 1
// npm run balance:weather              (기본 경기 100개 × 설정 9개, 프로세스 WORKERS(기본 4)개로 나눠 돈다)
// npm run balance:weather -- --n 200   표본 늘리기
// npm run balance:weather -- --season  실제 시즌 혼합(날씨·심판 켬) 참고값도 출력

import { BALANCE } from '../src/config/balance';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import type { MatchEnv } from '../src/engine/env';
import type { TeamStats } from '../src/engine/types';
import { newGame, selectableRealPlayers } from '../src/game';
import { teamById } from '../src/league';
import { weatherEnv, weatherFor, WEATHER_KINDS, WEATHER_KO, setEnvironmentFixed, type WeatherKind } from '../src/weather';
import { refereeFor } from '../src/referees';
import { spawn } from 'node:child_process';

const argv = process.argv;
const nIdx = argv.indexOf('--n');
const N = nIdx >= 0 ? Number(argv[nIdx + 1]) : 100;
const partIdx = argv.indexOf('--part');
const PART = partIdx >= 0 ? Number(argv[partIdx + 1]) : -1;
const PARTS = Math.max(1, Number(process.env.WORKERS ?? 4));
const check = argv.includes('--check');

setEnvironmentFixed(true);
const g = newGame({ mode: 'real', playerId: selectableRealPlayers()[0]!.id, seed: 'weather-bench', difficulty: 'normal' });
const ids = g.league.teams.map((t) => t.id);
const avg = g.league.teams.reduce((t, x) => t + x.rating, 0) / ids.length;

interface Agg {
  passes: number; passOk: number; long: number; longOk: number; crosses: number; crossOk: number; dribbles: number; dribbleOk: number;
  tackles: number; tackleOk: number; onTarget: number; saves: number; goals: number; yellows: number; reds: number; fouls: number; adv: number;
  fk: number; stamina: number; staminaN: number; matches: number; ms: number;
}
const empty = (): Agg => ({
  passes: 0, passOk: 0, long: 0, longOk: 0, crosses: 0, crossOk: 0, dribbles: 0, dribbleOk: 0, tackles: 0, tackleOk: 0, onTarget: 0, saves: 0,
  goals: 0, yellows: 0, reds: 0, fouls: 0, adv: 0, fk: 0, stamina: 0, staminaN: 0, matches: 0, ms: 0,
});

function add(a: Agg, t: TeamStats): void {
  a.passes += t.passes; a.passOk += t.passesCompleted; a.long += t.longPasses; a.longOk += t.longCompleted;
  a.crosses += t.crosses; a.crossOk += t.crossesCompleted; a.dribbles += t.dribbles; a.dribbleOk += t.dribblesWon;
  a.tackles += t.tackles; a.tackleOk += t.tacklesWon; a.onTarget += t.shotsOnTarget; a.saves += t.saves; a.goals += t.goals;
  a.yellows += t.yellows; a.reds += t.reds; a.fouls += t.fouls; a.adv += t.advantages;
}

/** k 번째 경기의 두 팀 */
function pairAt(k: number) {
  const h = ids[k % ids.length]!;
  const w = ids[(k * 7 + 3) % ids.length]!;
  const away = w === h ? ids[(k + 1) % ids.length]! : w;
  const hr = teamById(g.league, h).rating;
  const ar = teamById(g.league, away).rating;
  return { home: teamSetupFromRoster(g.rosters[h]!, hr, ar, g.worldSeed, undefined, avg), away: teamSetupFromRoster(g.rosters[away]!, ar, hr, g.worldSeed, undefined, avg) };
}

function run(env: Partial<MatchEnv> | undefined, part = -1): Agg {
  const a = empty();
  for (let k = 0; k < N; k++) {
    if (part >= 0 && k % PARTS !== part) continue;
    const t0 = performance.now();
    const sim = createMatch({ ...pairAt(k), mode: 'auto', difficulty: 'normal', seed: 7400 + k, bigMatch: false, ...(env ? { env } : {}) });
    const r = sim.runToEnd();
    a.ms = Math.max(a.ms, performance.now() - t0);
    add(a, r.teamStats[0]);
    add(a, r.teamStats[1]);
    a.fk += r.events.filter((e) => e.type === 'freeKick' && e.params?.direct).length;
    for (const x of sim.state.agents) if (x.onPitch) { a.stamina += x.stamina; a.staminaN++; }
    a.matches++;
  }
  return a;
}

const ratio = (x: number, y: number) => (y > 0 ? x / y : 0);
type Metric = { key: string; ko: string; v: (a: Agg) => number };
const M: Record<string, Metric> = {
  pass: { key: 'pass', ko: '패스 성공률', v: (a) => ratio(a.passOk, a.passes) },
  long: { key: 'long', ko: '롱패스 성공률', v: (a) => ratio(a.longOk, a.long) },
  cross: { key: 'cross', ko: '크로스 성공률', v: (a) => ratio(a.crossOk, a.crosses) },
  dribble: { key: 'dribble', ko: '드리블 성공률', v: (a) => ratio(a.dribbleOk, a.dribbles) },
  tackle: { key: 'tackle', ko: '태클 성공률', v: (a) => ratio(a.tackleOk, a.tackles) },
  save: { key: 'save', ko: '선방률', v: (a) => ratio(a.saves, a.onTarget) },
  goals: { key: 'goals', ko: '경기당 골', v: (a) => ratio(a.goals, a.matches) },
  stamina: { key: 'stamina', ko: '종료 스태미나', v: (a) => ratio(a.stamina, a.staminaN) },
  yellows: { key: 'yellows', ko: '경기당 경고', v: (a) => ratio(a.yellows, a.matches) },
  adv: { key: 'adv', ko: '경기당 어드밴티지', v: (a) => ratio(a.adv, a.matches) },
};

/** 날씨별 목표: 맑음 대비 상대 변화 % [하한, 상한] (pending 75: 실행 성공률 ±3~8% 수준) */
const TARGETS: Partial<Record<WeatherKind, [string, number, number][]>> = {
  rain: [['pass', -6, -1], ['tackle', 1, 10]],
  wind: [['long', -12, -3], ['cross', -15, -3]],
  heat: [['stamina', -15, -3]],
  snow: [['dribble', -10, -3], ['pass', -5, -0.3]],
};
/** 심판: [카드 배율, 경고 변화 목표 하한·상한 %] */
const REF_TARGETS: [string, string, number, number, number][] = [
  ['strict', '카드 엄격 (최대)', BALANCE.referee.card[1], 12, 40],
  ['lenient', '카드 관대 (최소)', BALANCE.referee.card[0], -30, -8],
];

/** 측정 설정: [이름, env] (0 = 맑음·보통 심판 기준) */
const CONFIGS: [string, Partial<MatchEnv> | undefined][] = [
  ['clear', undefined],
  ...WEATHER_KINDS.filter((k) => k !== 'clear' && k !== 'cloudy').map((k) => [k, weatherEnv(k)] as [string, Partial<MatchEnv>]),
  ['strict', { card: BALANCE.referee.card[1] }],
  ['lenient', { card: BALANCE.referee.card[0] }],
  ['flow', { advantage: BALANCE.referee.advantage[1] }],
  ['whistle', { advantage: BALANCE.referee.advantage[0] }],
];

/** 부분 실행: 경기 k ≡ PART (mod PARTS) 만 돌려 설정별 합계를 JSON 으로 */
function runPart(part: number): Record<string, Agg> {
  // 예열 (JIT): 첫 경기는 시간 측정에서 뺀다
  void createMatch({ ...pairAt(0), mode: 'auto', difficulty: 'normal', seed: 1, bigMatch: false }).runToEnd();
  const out: Record<string, Agg> = {};
  for (const [name, env] of CONFIGS) out[name] = run(env, part);
  return out;
}

function merge(a: Agg, b: Agg): Agg {
  const o = { ...a };
  for (const k of Object.keys(b) as (keyof Agg)[]) o[k] = k === 'ms' ? Math.max(a.ms, b.ms) : a[k] + b[k];
  return o;
}

async function runAll(): Promise<Record<string, Agg>> {
  const procs = Array.from({ length: PARTS }, (_, i) => new Promise<Record<string, Agg>>((res, rej) => {
    const c = spawn('npx', ['vite-node', 'scripts/balance-weather.ts', '--', '--n', String(N), '--part', String(i)], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, WORKERS: String(PARTS) } });
    let buf = '';
    c.stdout.on('data', (d) => (buf += d));
    c.on('close', (code) => {
      const line = buf.split('\n').find((l) => l.startsWith('PART '));
      if (code !== 0 || !line) rej(new Error(`부분 ${i} 실패 (${code})`));
      else res(JSON.parse(line.slice(5)));
    });
  }));
  const parts = await Promise.all(procs);
  const out: Record<string, Agg> = {};
  for (const p of parts) for (const [k, v] of Object.entries(p)) out[k] = out[k] ? merge(out[k]!, v) : v;
  return out;
}

if (PART >= 0) {
  console.log(`PART ${JSON.stringify(runPart(PART))}`);
  process.exit(0);
}

const t0 = Date.now();
const res = await runAll();
const base = res.clear!;
const pct = (x: number, b: number) => (b ? ((x - b) / b) * 100 : 0);
const fmt = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(1)}%`;
const fails: string[] = [];
const all = ['pass', 'long', 'cross', 'dribble', 'tackle', 'save', 'goals', 'stamina'];
console.log(`[날씨] 같은 시드 ${N}경기 × 날씨별 (맑음 대비 변화)`);
console.log(`| 날씨 | ${all.map((k) => M[k]!.ko).join(' | ')} | 판정 |`);
console.log(`|---|${all.map(() => '---').join('|')}|---|`);
console.log(`| 맑음 (기준) | ${all.map((k) => (k === 'goals' || k === 'stamina' ? M[k]!.v(base).toFixed(2) : (M[k]!.v(base) * 100).toFixed(1) + '%')).join(' | ')} | - |`);
let maxMs = 0;
for (const a of Object.values(res)) maxMs = Math.max(maxMs, a.ms);
for (const kind of WEATHER_KINDS.filter((k) => k !== 'clear' && k !== 'cloudy')) {
  const a = res[kind]!;
  const ok: string[] = [];
  for (const [key, lo, hi] of TARGETS[kind] ?? []) {
    const d = pct(M[key]!.v(a), M[key]!.v(base));
    const pass = d >= lo && d <= hi;
    ok.push(`${M[key]!.ko} ${fmt(d)} ${pass ? '✓' : `✗ (목표 ${lo}~${hi}%)`}`);
    if (!pass) fails.push(`${WEATHER_KO[kind]} ${M[key]!.ko} ${fmt(d)} (목표 ${lo}~${hi}%)`);
  }
  console.log(`| ${WEATHER_KO[kind]} | ${all.map((k) => fmt(pct(M[k]!.v(a), M[k]!.v(base)))).join(' | ')} | ${ok.join(' · ')} |`);
}

const perFoul = (a: Agg) => ratio(a.yellows + a.reds, a.fouls);
console.log(`\n[심판] 같은 시드 ${N}경기 (보통 심판: 경기당 경고 ${M.yellows!.v(base).toFixed(2)} · 파울당 카드 ${perFoul(base).toFixed(3)} · 어드밴티지 ${M.adv!.v(base).toFixed(2)})`);
console.log('| 심판 | 배율 | 경기당 경고 | 파울당 카드 | 변화 (파울당 카드) | 판정 |');
console.log('|---|---|---|---|---|---|');
for (const [name, ko, mul, lo, hi] of REF_TARGETS) {
  const a = res[name]!;
  const d = pct(perFoul(a), perFoul(base));
  const pass = d >= lo && d <= hi;
  if (!pass) fails.push(`${ko} 파울당 카드 ${fmt(d)} (목표 ${lo}~${hi}%)`);
  console.log(`| ${ko} | 카드 ×${mul} | ${M.yellows!.v(a).toFixed(2)} | ${perFoul(a).toFixed(3)} | ${fmt(d)} | ${pass ? '✓' : `✗ (목표 ${lo}~${hi}%)`} |`);
}
for (const [name, ko, mul] of [['flow', '흐름 중시 (최대)', BALANCE.referee.advantage[1]], ['whistle', '자주 끊음 (최소)', BALANCE.referee.advantage[0]]] as const) {
  const a = res[name]!;
  console.log(`| ${ko} | 어드밴티지 ×${mul} | ${M.yellows!.v(a).toFixed(2)} | 어드밴티지 ${M.adv!.v(a).toFixed(2)} | ${fmt(pct(M.adv!.v(a), M.adv!.v(base)))} (어드밴티지) | 참고 |`);
}
console.log(`\n경기 계산 최대 ${Math.round(maxMs)} ms (2초 이내 ${maxMs < 2000 ? '✓' : '✗'}) · 전체 ${Math.round((Date.now() - t0) / 1000)}초 · 프로세스 ${PARTS}개`);
if (maxMs >= 2000) fails.push(`경기 계산 ${Math.round(maxMs)} ms`);

if (argv.includes('--season')) {
  // 실제 시즌 혼합 (참고값): 날씨·심판을 켜고 한 세계의 2시즌 날씨 분포·심판 배정
  setEnvironmentFixed(false);
  const count: Record<string, number> = {};
  const refs: Record<string, number> = {};
  let total = 0;
  for (const season of [2018, 2019]) {
    for (const t of ids) {
      for (let m = 0; m < 12; m++) {
        const month = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5][m % 10]!;
        const y = month >= 8 ? season : season + 1;
        const date = `${y}-${String(month).padStart(2, '0')}-${String(3 + m * 2).padStart(2, '0')}` as never;
        const w = weatherFor(g.worldSeed, date, t);
        count[w] = (count[w] ?? 0) + 1;
        const r = refereeFor(g.worldSeed, date, t);
        refs[r.nameKo] = (refs[r.nameKo] ?? 0) + 1;
        total++;
      }
    }
  }
  console.log(`\n[시즌 혼합 참고] 날씨 분포 (${total}경기): ${WEATHER_KINDS.map((k) => `${WEATHER_KO[k]} ${(((count[k] ?? 0) / total) * 100).toFixed(1)}%`).join(' · ')}`);
  console.log(`심판 ${Object.keys(refs).length}명 배정`);
}

console.log(fails.length ? `\n[날씨·심판] 목표 밖 ${fails.length}개:\n  ${fails.join('\n  ')}` : '\n[날씨·심판] 모두 목표 범위 안');
if (check && fails.length) process.exit(1);
process.exit(0);
