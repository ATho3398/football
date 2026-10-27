// 진단 (엔진관리자12, C.78s 질문 3): 선수 적합도 효과 — 같은 OVR(포지션 OVR 정확값 보존)에서 성향에 맞는 능력치를 +d, 나머지를 그만큼 내린 선수단(맞음)과
// 거꾸로(안 맞음)를 균형 상대(조정 없음)와 붙인다. 대조: 같은 능력치 이동을 균형 전술로 했을 때 차이. 선수빨 = (X 맞음 − X 안 맞음) − (균형 맞음_X − 균형 안 맞음_X).
// 실행: npx vite-node scripts/diag/c78s-fit.ts -- [경기수=200] [d=10] [성향…]   (기본 tikitaka counter direct block gegenpress)
import type { AttrMod, MatchJob, MatchOut } from '../engine/job';
import { runJobs } from '../engine/pool';
import { std } from '../engine/suite';
import { tacticsOf } from '../../src/engine/tactics';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { FORMATION_SLOTS } from '../../src/formations';
import { FIELD_ATTRIBUTES, type FieldAttribute } from '../../src/attributes';
import { attributeOvrWeight, positionOvrExact, type FieldPosition } from '../../src/positions';
import type { Tendency } from '../../src/engine/types';

const all = process.argv.slice(2).filter((a) => a !== '--');
let n = 200, d = 10;
const tends: Tendency[] = [];
for (const a of all) {
  if (a.startsWith('d=')) d = Number(a.slice(2));
  else if (/^\d+$/.test(a)) n = Number(a);
  else tends.push(a as Tendency);
}
if (!tends.length) tends.push('tikitaka', 'counter', 'direct', 'block', 'gegenpress');
type G = 'CB' | 'FB' | 'MID' | 'WING' | 'ST';
const grp = (p: string): G => (p === 'CB' ? 'CB' : p === 'LB' || p === 'RB' ? 'FB' : p === 'CM' || p === 'CDM' ? 'MID' : p === 'ST' ? 'ST' : 'WING');
/** 성향별 맞는 능력치 (사용자 정의, planning-pending 146) */
const FIT: Record<string, Partial<Record<G, FieldAttribute[]>>> = (() => {
  const tiki: FieldAttribute[] = ['shortPassing', 'vision', 'ballControl', 'composure', 'offTheBall'];
  return {
    tikitaka: { CB: tiki, FB: tiki, MID: tiki, WING: tiki, ST: tiki },
    counter: { CB: ['pace', 'acceleration', 'defensivePositioning'], FB: ['pace', 'acceleration', 'defensivePositioning'], MID: ['tackling', 'interception', 'dribbling', 'longPassing', 'crossing', 'stamina'], WING: ['pace', 'acceleration', 'dribbling'], ST: ['pace', 'acceleration', 'offTheBall', 'bigMatch', 'composure'] },
    direct: { CB: ['longPassing'], FB: ['longPassing', 'crossing'], MID: ['longPassing', 'crossing'], WING: ['crossing', 'ballControl', 'strength'], ST: ['ballControl', 'strength', 'jumping', 'heading'] },
    block: { CB: ['marking', 'defensivePositioning', 'tackling', 'strength', 'jumping', 'heading'], FB: ['marking', 'defensivePositioning', 'tackling', 'interception'], MID: ['marking', 'defensivePositioning', 'tackling', 'interception'], WING: ['workRate', 'stamina', 'marking'], ST: ['strength', 'jumping', 'heading'] },
    gegenpress: { CB: ['stamina', 'workRate', 'acceleration', 'tackling'], FB: ['stamina', 'workRate', 'acceleration', 'tackling'], MID: ['stamina', 'workRate', 'acceleration', 'tackling'], WING: ['stamina', 'workRate', 'acceleration', 'tackling'], ST: ['stamina', 'workRate', 'acceleration', 'tackling'] },
  };
})();
/** 한 팀(시드)에서 같은 OVR 로 fit 능력치 ±d · 나머지 ∓δ 하는 mods. sign +1 맞음 / −1 안 맞음 */
function fitMods(team: 0 | 1, side: string, seed: number, rating: number, tend: string, sign: 1 | -1, devs: number[]): AttrMod[] {
  const roster = createTeamRoster({ id: `v${side}${seed}`, rating }, `eng-${side}-${rating}-${seed}`, 2018, []);
  roster.formation = '4-4-2';
  const setup = teamSetupFromRoster(roster, rosterRating(roster), rating, `w${seed}`);
  const slots = FORMATION_SLOTS['4-4-2'];
  const mods: AttrMod[] = [];
  for (const p of setup.lineup) {
    const pos = slots[p.slot]!.pos;
    if (pos === 'GK') continue;
    const fp = pos as FieldPosition;
    const F = FIT[tend]![grp(pos)] ?? [];
    if (!F.length) continue;
    const next = { ...p.attrs };
    let dF = 0;
    for (const k of F) { const v = Math.max(1, Math.min(99, next[k] + sign * d)); dF += attributeOvrWeight(fp, k) * (v - next[k]); next[k] = v; }
    const O = FIELD_ATTRIBUTES.filter((k) => !F.includes(k) && attributeOvrWeight(fp, k) > 0);
    // 나머지를 같은 양만큼 반대로 (경계에 걸리면 두세 번 나눠 맞춘다)
    for (let it = 0; it < 4 && Math.abs(dF) > 1e-6; it++) {
      const free = O.filter((k) => (dF > 0 ? next[k] > 1 : next[k] < 99));
      const wsum = free.reduce((t, k) => t + attributeOvrWeight(fp, k), 0);
      if (!wsum) break;
      const delta = -dF / wsum;
      for (const k of free) { const v = Math.max(1, Math.min(99, next[k] + delta)); dF += attributeOvrWeight(fp, k) * (v - next[k]); next[k] = v; }
    }
    devs.push(positionOvrExact(next, fp) - positionOvrExact(p.attrs, fp));
    for (const k of FIELD_ATTRIBUTES) if (next[k] !== p.attrs[k]) mods.push({ team, slot: p.slot, attrs: [k], delta: next[k] - p.attrs[k] });
  }
  return mods;
}
const devs: number[] = [];
type Set_ = { tend: string; tac: string; sign: 1 | -1 };
const sets: Set_[] = tends.flatMap((t) => [{ tend: t, tac: t, sign: 1 }, { tend: t, tac: t, sign: -1 }, { tend: t, tac: 'balanced', sign: 1 }, { tend: t, tac: 'balanced', sign: -1 }] as Set_[]);
const jobs: MatchJob[] = [];
for (const st of sets) for (let k = 0; k < n; k++) {
  const seed = 51000 + k;
  const me = std('a', seed, 75, '4-4-2', tacticsOf(st.tac as Tendency));
  const op = std('b', seed, 75, '4-4-2', tacticsOf('balanced'));
  const meTeam = (k % 2 ? 0 : 1) as 0 | 1;
  const mods = fitMods(meTeam, 'a', seed, 75, st.tend, st.sign, devs);
  jobs.push(meTeam === 0 ? { kind: 'match', seed, neutral: true, home: me, away: op, mods } : { kind: 'match', seed, neutral: true, home: op, away: me, mods });
}
const outs = await runJobs<MatchOut>(jobs, { label: `적합도 ${jobs.length}경기` });
const gd = sets.map((_, i) => {
  const xs = outs.slice(i * n, (i + 1) * n);
  const v = xs.map((m, k) => (k % 2 ? m.homeGoals - m.awayGoals : m.awayGoals - m.homeGoals));
  const gf = xs.reduce((t, m, k) => t + (k % 2 ? m.homeGoals : m.awayGoals), 0) / n;
  return { v, gf, mean: v.reduce((a, b) => a + b, 0) / n };
});
const se = (a: number[], b: number[]) => { const dd = a.map((x, i) => x - b[i]!); const m = dd.reduce((s, x) => s + x, 0) / dd.length; return Math.sqrt(dd.reduce((s, x) => s + (x - m) ** 2, 0) / dd.length / dd.length); };
console.log(`\n적합도 d=${d}, ${n}경기씩, 75 대 75 균형, OVR 변화 최대 |${Math.max(...devs.map(Math.abs)).toFixed(3)}|`);
console.log('| 성향 | X 맞음 득실 | X 안 맞음 | X 차 (±SE) | 균형 맞음_X | 균형 안 맞음_X | 균형 차 | 선수빨(차의 차) | X 맞음 득점 |');
tends.forEach((t, i) => {
  const [a, b, c, e] = [gd[4 * i]!, gd[4 * i + 1]!, gd[4 * i + 2]!, gd[4 * i + 3]!];
  const dx = a.mean - b.mean, db = c.mean - e.mean;
  const inter = a.v.map((x, k) => x - b.v[k]! - c.v[k]! + e.v[k]!);
  const im = inter.reduce((s, x) => s + x, 0) / n, ise = Math.sqrt(inter.reduce((s, x) => s + (x - im) ** 2, 0) / n / n);
  console.log(`| ${t} | ${a.mean.toFixed(2)} | ${b.mean.toFixed(2)} | ${dx.toFixed(2)} (±${se(a.v, b.v).toFixed(2)}) | ${c.mean.toFixed(2)} | ${e.mean.toFixed(2)} | ${db.toFixed(2)} | ${im >= 0 ? '+' : ''}${im.toFixed(2)} (±${ise.toFixed(2)}) | ${a.gf.toFixed(2)} |`);
});
process.exit(0);
