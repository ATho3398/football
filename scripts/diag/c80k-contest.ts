// @ts-nocheck — 진단 스크립트 (C.80k, 엄격 타입 검사 제외)
// 땅볼 수신 경합(receiveWin) 1건마다 probe.receive 로 기록: 받는 선수 점수(볼컨 .5 + (근력+몸 근력) .3 + 민첩 .2) 4분위별 받음률을
// 같은 수비 조건(박스 안/밖 · 받는 선수 5 m 안 상대 수 1/2/3+ · 경합 거리 3칸) 칸으로 묶어 칸 크기 가중으로 표준화한다(자리 섞임 제거).
// 실행: npx vite-node scripts/diag/c80k-contest.ts -- [경기수=24] [seed=41000] [경로=값 …]   (성향 짝 6개를 돌아가며)
import { setEnvironmentFixed } from '../../src/weather';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { FORMATION_SLOTS } from '../../src/formations';
import { createMatch } from '../../src/engine/sim';
import { ENGINE } from '../../src/engine/config';
import { tacticsOf } from '../../src/engine/tactics';
import { probe } from '../../src/engine/probe';

setEnvironmentFixed(true);
const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
let n = 24;
let seed0 = 41000;
for (const a of all) {
  if (a.startsWith('seed=')) seed0 = Number(a.slice(5));
  else if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
}
for (const [path, v] of Object.entries(overrides)) {
  const keys = path.split('.'); let o = ENGINE as any;
  for (const k of keys.slice(0, -1)) o = o[k];
  o[keys[keys.length - 1]!] = v;
}
const PAIRS = [['tikitaka', 'balanced'], ['tikitaka', 'gegenpress'], ['balanced', 'block'], ['direct', 'counter'], ['gegenpress', 'block'], ['tikitaka', 'direct']];
function build(side: string, seed: number, rating: number, spec: string, opp: number) {
  const roster = createTeamRoster({ id: `v${side}${seed}`, rating }, `eng-${side}-${rating}-${seed}`, 2018, []);
  roster.formation = '4-4-2';
  const setup = teamSetupFromRoster(roster, rosterRating(roster), opp, `w${seed}`);
  const before = setup.tactics.tendency;
  setup.tactics = { ...setup.tactics, ...tacticsOf(spec as any) };
  if (setup.tactics.tendency !== before) {
    const slots = FORMATION_SLOTS[roster.formation];
    for (const p of setup.lineup) delete p.role;
    fillRoles(setup, (slot) => slots[slot]!.pos);
  }
  return setup;
}
const score = (a) => a.attrs.ballControl * 0.5 + (a.attrs.strength + a.body.strength) * 0.3 + a.attrs.agility * 0.2;
const dscore = (d) => d.attrs.marking * 0.5 + d.attrs.tackling * 0.3 + d.attrs.defensivePositioning * 0.2;
const rec: any[] = [];
probe.receive = (s, rc, def, dd, inBox, p, won) => {
  let n5 = 0;
  for (const o of s.agents) if (o.onPitch && o.team !== rc.team && o.line !== 0 && Math.hypot(o.x - rc.x, o.y - rc.y) <= 5) n5++;
  rec.push({ sc: score(rc), ds: dscore(def), dd, inBox, p, won: won ? 1 : 0, n5 });
};
let goals = 0;
for (let k = 0; k < n; k++) {
  const seed = seed0 + k;
  const [A, B] = PAIRS[k % PAIRS.length]!;
  const ratings = [[75, 75], [72, 78], [78, 72]][Math.floor(k / PAIRS.length) % 3]!;
  const ta = build('a', seed, ratings[0], A, ratings[1]);
  const tb = build('b', seed, ratings[1], B, ratings[0]);
  const aHome = k % 2 === 0;
  const m = createMatch({ home: aHome ? ta : tb, away: aHome ? tb : ta, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  while (!m.state.done) m.step();
  goals += m.state.teams[0].stats.goals + m.state.teams[1].stats.goals;
}
const q = (xs: number[], f: number) => xs[Math.min(xs.length - 1, Math.floor(xs.length * f))]!;
function report(name: string, rs: any[]) {
  if (!rs.length) return;
  const scs = rs.map((r) => r.sc).sort((a, b) => a - b);
  const cut = [q(scs, 0.25), q(scs, 0.5), q(scs, 0.75)];
  const qi = (v) => (v < cut[0] ? 0 : v < cut[1] ? 1 : v < cut[2] ? 2 : 3);
  const cell = (r) => `${r.inBox ? 'in' : 'out'}|${Math.min(3, r.n5)}|${r.dd < 1 ? 0 : r.dd < 1.75 ? 1 : 2}`;
  const cells = new Map<string, any[]>();
  for (const r of rs) { const c = cell(r); if (!cells.has(c)) cells.set(c, []); cells.get(c)!.push(r); }
  // 칸별 4분위 받음률 → 칸 크기 가중 평균 (그 칸에 그 4분위가 없으면 그 칸은 그 4분위 평균에서 빠짐)
  const std = [0, 1, 2, 3].map((Q) => {
    let w = 0, s = 0;
    for (const xs of cells.values()) { const ys = xs.filter((r) => qi(r.sc) === Q); if (ys.length < 3) continue; s += xs.length * ys.reduce((t, r) => t + r.won, 0) / ys.length; w += xs.length; }
    return (100 * s) / Math.max(1, w);
  });
  const raw = [0, 1, 2, 3].map((Q) => { const ys = rs.filter((r) => qi(r.sc) === Q); return [ys.length, (100 * ys.reduce((t, r) => t + r.won, 0)) / Math.max(1, ys.length), ys.reduce((t, r) => t + r.p, 0) / Math.max(1, ys.length)]; });
  const tot = (100 * rs.reduce((t, r) => t + r.won, 0)) / rs.length;
  console.log(`${name}: ${rs.length}건 (${(rs.length / n).toFixed(1)}/경기) 받음 ${tot.toFixed(1)}% · 평균 P ${(rs.reduce((t, r) => t + r.p, 0) / rs.length).toFixed(3)} · 4분위 기준 ${cut.map((c) => c.toFixed(1)).join('/')}`);
  console.log(`  날것 Q1..Q4: ${raw.map(([c, w, p]) => `${w.toFixed(1)}%(P ${p.toFixed(2)}, ${c})`).join(' · ')}`);
  console.log(`  같은 수비 조건 표준화 Q1..Q4: ${std.map((v) => v.toFixed(1)).join(' · ')} → Q4−Q1 ${(std[3] - std[0]).toFixed(1)} %p`);
}
console.log(`\n${n}경기 seed ${seed0} 덮어쓰기 ${JSON.stringify(overrides)} 득점 ${(goals / n).toFixed(2)}`);
report('전체', rec);
report('박스 밖', rec.filter((r) => !r.inBox));
report('박스 안', rec.filter((r) => r.inBox));
console.log('JSON ' + JSON.stringify({ n, seed0, overrides, rec: rec.map((r) => [+r.sc.toFixed(1), +r.ds.toFixed(1), +r.dd.toFixed(2), r.inBox ? 1 : 0, +r.p.toFixed(3), r.won, r.n5]) }));
process.exit(0);
