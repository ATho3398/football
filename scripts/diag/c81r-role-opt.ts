// 진단 (C.81r): 역할별 평점 쏠림을 줄이는 평점 가중(포지션군별 패스 체감 무릎·꼬리, 수비 행동 가중)을 좌표 하강으로 찾는다.
// 역할 표본(c81r-role-parts) 으로 역할 − 군 평균 최대 |차| 를 줄이고, 일반 표본(rating-parts, ex 포함)으로 center 를 다시 맞춰
// 포지션군 평균을 지금 값 그대로 두고 σ 가드(0.7~0.9, 여유 0.74)를 지킨다.
// 실행: npx vite-node scripts/diag/c81r-role-opt.ts -- <rating-parts.json> <role-parts.json ...>
import { readFileSync } from 'node:fs';
import { ENGINE } from '../../src/engine/config';
import { isNoContrib, ratingFromParts, type RatingParts } from '../../src/engine/rating';

type RoleRow = { g: string; role: string; min: number; parts: RatingParts; ex: Record<string, number> };
type GenRow = RatingParts & { str: number; team: number; starter: boolean; min: number; ex: Record<string, number> };
const args = process.argv.slice(2).filter((a) => a !== '--');
const gen = (JSON.parse(readFileSync(args[0]!, 'utf8')) as GenRow[]).filter((r) => r.team === 0 && r.starter && r.min >= 45)
  .map((r) => ({ ...r, blocks: r.ex.blocks, clearances: r.ex.clear, dangerClearances: r.ex.dClear, ...(isNoContrib(r) ? { noContrib: 1 } : {}) }) as GenRow);
const roleRows = args.slice(1).flatMap((f) => JSON.parse(readFileSync(f, 'utf8')) as RoleRow[])
  .map((r) => ({ ...r, p: { ...r.parts, role: r.role, blocks: r.ex.blocks ?? 0, clearances: r.ex.clear ?? 0, dangerClearances: r.ex.dClear ?? 0 } as RatingParts }))
  // 무기여 감점 (경기 종료 평점에만 붙음, 측정 성분에는 없음)
  .map((r) => (r.min >= 45 && isNoContrib(r.p) ? { ...r, p: { ...r.p, noContrib: 1 } } : r));
type R_ = typeof ENGINE.rating;
const R0 = ENGINE.rating;
const G = ['GK', 'CB', 'FB', 'CDM', 'CM', 'CAM', 'WING', 'ST'];
const RG = ['CB', 'FB', 'CDM', 'CM', 'CAM', 'WING', 'ST'];
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

function genStats(R: R_) {
  const cells = new Map<string, number[]>();
  for (const r of gen) { const k = `${r.str}:${r.group}`; if (!cells.has(k)) cells.set(k, []); cells.get(k)!.push(ratingFromParts(r, R)); }
  const keys = [...cells.keys()];
  const cellAvg = (ks: string[], f: (x: number) => number = (x) => x) => avg(ks.map((k) => avg(cells.get(k)!.map(f))));
  const mu = cellAvg(keys);
  return { mu, sd: Math.sqrt(cellAvg(keys, (x) => (x - mu) ** 2)), gm: Object.fromEntries(G.map((g) => [g, cellAvg(keys.filter((k) => k.endsWith(`:${g}`)))])) as Record<string, number> };
}
// 목표 군 평균: 기본은 지금 설정, TARGET_JSON 이면 그 설정(예: 바꾸기 전 main 가중·center)으로 같은 표본을 잰 값
const target = genStats(process.env.TARGET_JSON ? ({ ...R0, ...JSON.parse(process.env.TARGET_JSON) } as R_) : R0).gm;
function refit(R: R_): R_ {
  const Rc = { ...R, center: { ...R.center } };
  for (let it = 0; it < 4; it++) { const g = genStats(Rc).gm; for (const k of G) Rc.center[k] = Rc.center[k]! + (g[k]! - target[k]!) / Rc.scale; }
  return Rc;
}
function roleDiffs(R: R_) {
  const out: { g: string; role: string; d: number }[] = [];
  for (const g of RG) {
    const roles = [...new Set(roleRows.filter((r) => r.g === g).map((r) => r.role))];
    const m = roles.map((role) => avg(roleRows.filter((r) => r.role === role).map((r) => ratingFromParts(r.p, R))));
    const gm = avg(m);
    roles.forEach((role, i) => out.push({ g, role, d: m[i]! - gm }));
  }
  return out;
}
function score(R: R_) {
  const ds = roleDiffs(R);
  const mx = Math.max(...ds.map((x) => Math.abs(x.d)));
  const ms = avg(ds.map((x) => x.d * x.d));
  // σ 지키기: 일반 표본 σ 가 SD_MIN 아래면 벌점 (center 다시 맞춘 뒤)
  const sd = process.env.SD_MIN ? genStats(refit(R)).sd : 1;
  const pen = Math.max(0, Number(process.env.SD_MIN ?? 0) - sd) * 10;
  // 원래 가중에서 멀어지는 벌점 (REG): 상대 변화 제곱합
  const reg = Number(process.env.REG ?? 0) * (['tackle', 'interception', 'keyPass', 'dribble', 'lost', 'scale'] as const).reduce((a, k) => a + ((R[k] as number) / (R0[k] as number) - 1) ** 2, 0)
    + Number(process.env.REG ?? 0) * (((R.block as number) / 0.1) ** 2 + ((R.clearance as number) / 0.1) ** 2);
  return { mx, ms, J: mx + 2 * ms + pen + reg, ds };
}

type P = { get: (R: R_) => number; set: (R: R_, v: number) => R_; step: number; lo: number; hi: number; name: string };
const LO_TAIL = Number(process.env.LO_TAIL ?? 0.25), KNEE_LO = Number(process.env.KNEE_LO ?? 0.5);
const meanOf = (key: 'passKnee' | 'forwardKnee', g: string) => avg(roleRows.filter((r) => r.g === g).map((r) => (key === 'forwardKnee' ? r.parts.forward : r.parts.passes - r.parts.forward)));
const pk = (key: 'passKnee' | 'forwardKnee', g: string): P => ({
  name: `${key}.${g}`, step: 2, lo: Math.round(meanOf(key, g) * KNEE_LO), hi: 120,
  get: (R) => (R[key] as Record<string, number>)[g] ?? 999,
  set: (R, v) => ({ ...R, [key]: { ...(R[key] as Record<string, number>), [g]: v } }),
});
const sc = (key: keyof R_, step: number, lo: number, hi: number): P => ({
  name: String(key), step, lo, hi, get: (R) => R[key] as number, set: (R, v) => ({ ...R, [key]: v }),
});
// 시작점: 군 평균 개수의 무릎
let R: R_ = { ...R0, passKnee: {}, forwardKnee: {}, passTail: Number(process.env.TAIL ?? Math.max(LO_TAIL, 0.3)), forwardTail: Number(process.env.TAIL ?? Math.max(LO_TAIL, 0.3)) };
const RULE = Number(process.env.RULE ?? 0);
for (const g of RG) {
  const xs = roleRows.filter((r) => r.g === g);
  if (RULE) {
    // 규칙: 무릎 = 그 군에서 패스가 가장 적은 역할의 평균 개수 × RULE
    const roles = [...new Set(xs.map((r) => r.role))];
    const lowest = (f: (r: RoleRow) => number) => (process.env.RULEMEAN ? avg : (v: number[]) => Math.min(...v))(roles.map((role) => avg(xs.filter((r) => r.role === role).map(f))));
    R = pk('passKnee', g).set(R, Math.round(lowest((r) => r.parts.passes - r.parts.forward) * RULE));
    R = pk('forwardKnee', g).set(R, Math.round(lowest((r) => r.parts.forward) * RULE));
    continue;
  }
  R = pk('passKnee', g).set(R, Math.round(avg(xs.map((r) => r.parts.passes - r.parts.forward)) * 0.8));
  R = pk('forwardKnee', g).set(R, Math.round(avg(xs.map((r) => r.parts.forward)) * 0.8));
}
if (process.env.NOOPT) { /* 규칙 그대로 */ }
if (process.env.RJSON) R = { ...R, ...JSON.parse(process.env.RJSON) };
const params: P[] = process.env.NOOPT || process.env.RJSON ? [] : [
  ...(process.env.RULE ? [] : RG.flatMap((g) => [pk('passKnee', g), pk('forwardKnee', g)])),
  ...(process.env.FIXTAIL ? [] : [sc('passTail', 0.05, LO_TAIL, 1), sc('forwardTail', 0.05, LO_TAIL, 1)]),
  sc('tackle', 0.02, 0.05, 0.3), sc('interception', 0.02, 0.05, 0.3), sc('block', 0.02, 0, 0.3), sc('clearance', 0.02, 0, 0.2),
  ...(process.env.MORE ? [sc('keyPass', 0.01, 0.08, 0.2), sc('dribble', 0.01, 0.05, 0.15), sc('lost', 0.005, -0.06, -0.02), sc('scale', 0.02, 0.8, 1.2)] : []),
];
let best = score(R);
console.log(`시작 최대 ${best.mx.toFixed(3)}`);
for (let round = 0; round < 6; round++) {
  let improved = false;
  for (const p of params) {
    for (const dir of [1, -1]) {
      for (;;) {
        const v = Math.round((p.get(R) + dir * p.step) * 1000) / 1000;
        if (v < p.lo || v > p.hi) break;
        const Rn = p.set(R, v);
        const s = score(Rn);
        if (s.J < best.J - 1e-4) { R = Rn; best = s; improved = true; } else break;
      }
    }
  }
  const Rf = refit(R);
  const gs = genStats(Rf);
  console.log(`라운드 ${round}: 최대 ${best.mx.toFixed(3)} rms ${Math.sqrt(best.ms).toFixed(3)} σ ${gs.sd.toFixed(3)}`);
  if (!improved) break;
}
if (process.env.ROLEC) {
  // 역할별 정규화: 가중 뒤 남은 역할 − 군 평균을 행동 델타 단위로 (0.01 반올림)
  const rc: Record<string, number> = {};
  for (const x of score(R).ds) rc[x.role] = Math.round((x.d / R.scale) * 100) / 100;
  R = { ...R, roleCenter: rc };
  best = score(R);
  console.log('roleCenter ' + JSON.stringify(rc));
}
const Rf = refit(R);
const gs = genStats(Rf);
const st0 = avg(gen.filter((r) => r.min >= 85 && r.group === 'ST' && r.goals === 0).map((r) => ratingFromParts(r, Rf)));
console.log(`ST 풀타임 무득점(홈 선발) ${st0.toFixed(2)} (지금 ${avg(gen.filter((r) => r.min >= 85 && r.group === 'ST' && r.goals === 0).map((r) => ratingFromParts(r, R0))).toFixed(2)})`);
console.log(JSON.stringify({ passKnee: R.passKnee, forwardKnee: R.forwardKnee, passTail: R.passTail, forwardTail: R.forwardTail, tackle: R.tackle, interception: R.interception, block: R.block, clearance: R.clearance, keyPass: R.keyPass, dribble: R.dribble, lost: R.lost, scale: R.scale }));
console.log('center ' + JSON.stringify(Object.fromEntries(G.map((k) => [k, Math.round(Rf.center[k]! * 100) / 100]))));
console.log(`일반 표본: 평균 ${gs.mu.toFixed(2)} σ ${gs.sd.toFixed(3)} (지금 ${genStats(R0).sd.toFixed(3)}${process.env.TARGET_JSON ? `, 목표 설정 ${genStats({ ...R0, ...JSON.parse(process.env.TARGET_JSON) } as R_).sd.toFixed(3)}` : ''}) | ` + G.map((g) => `${g} ${gs.gm[g]!.toFixed(2)}/${target[g]!.toFixed(2)}`).join(' '));
for (const x of best.ds) console.log(`${x.g} ${x.role} ${x.d >= 0 ? '+' : ''}${x.d.toFixed(2)}`);
