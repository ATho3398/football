// 진단 (C.78r): rating-parts JSON 으로 engine:check 평점 가드(칸 가중 평균·σ·포지션 8군·ST 무득점)를 다시 계산하고, center·scale 후보를 맞춘다
// npx vite-node scripts/diag/c78r-rating-fit.ts -- <rating-parts.json> [scale] [ST 목표]
import { readFileSync } from 'node:fs';
import { ENGINE } from '../../src/engine/config';
import { ratingFromParts, type RatingParts } from '../../src/engine/rating';

const args = process.argv.slice(2).filter((a) => a !== '--');
type Row = RatingParts & { str: number; team: number; starter: boolean; min: number; rating: number; m: number };
const rows = JSON.parse(readFileSync(args[0] ?? 'rating-parts.json', 'utf8')) as Row[];
const G = ['GK', 'CB', 'FB', 'CDM', 'CM', 'CAM', 'WING', 'ST'];
const avg = (xs: number[]) => xs.reduce((t, x) => t + x, 0) / Math.max(1, xs.length);
const R0 = ENGINE.rating;
type Cfg = Omit<typeof R0, "scale" | "center"> & { scale: number; center: Record<string, number> };
function guards(R: Cfg) {
  const home = rows.filter((r) => r.team === 0 && r.starter && r.min >= 45);
  const cells = new Map<string, number[]>();
  for (const r of home) {
    const k = `${r.str}:${r.group}`;
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k)!.push(ratingFromParts(r, R as unknown as typeof R0));
  }
  const keys = G.flatMap((g) => [0, 1, 2].map((s) => `${s}:${g}`)).filter((k) => cells.get(k)?.length);
  const cellAvg = (ks: string[], f: (x: number) => number = (x) => x) => avg(ks.map((k) => avg(cells.get(k)!.map(f))));
  const mu = cellAvg(keys);
  const sd = Math.sqrt(cellAvg(keys, (x) => (x - mu) ** 2));
  const gm = Object.fromEntries(G.map((g) => [g, cellAvg(keys.filter((k) => k.endsWith(`:${g}`)))]));
  const st0 = avg(rows.filter((r) => r.starter && r.min >= 85 && r.group === 'ST' && r.goals === 0).map((r) => ratingFromParts(r, R as unknown as typeof R0)));
  return { mu, sd, gm, st0 };
}
const show = (tag: string, R: Cfg) => {
  const g = guards(R);
  const ok = (v: number, lo: number, hi: number) => (v >= lo && v <= hi ? '✓' : '✗');
  console.log(`${tag}: 평균 ${g.mu.toFixed(2)}${ok(g.mu, 6.2, 6.8)} σ ${g.sd.toFixed(2)}${ok(g.sd, 0.7, 0.9)} ST0 ${g.st0.toFixed(2)}${ok(g.st0, 5.9, 10)} | ` + G.map((k) => `${k} ${g.gm[k]!.toFixed(2)}${ok(g.gm[k]!, 6.3, 6.7)}`).join(' '));
  return g;
};
show('지금', R0);
// center 맞추기: 그룹 평균이 목표(기본 6.5, ST 는 인자)에 오도록 반복 (반올림·clamp 때문에 몇 번)
const scale = Number(args[1] ?? R0.scale);
const stT = Number(args[2] ?? 6.6);
const R: Cfg = { ...R0, scale, center: { ...R0.center } };
for (let it = 0; it < 6; it++) {
  const g = guards(R);
  for (const k of G) R.center[k] = R.center[k]! + (g.gm[k]! - (k === 'ST' ? stT : 6.5)) / R.scale;
}
show(`맞춤 scale ${scale}`, R);
console.log('center ' + JSON.stringify(Object.fromEntries(G.map((k) => [k, Math.round(R.center[k]! * 100) / 100]))));
const Rr: Cfg = { ...R, center: Object.fromEntries(G.map((k) => [k, Math.round(R.center[k]! * 100) / 100])) };
show('반올림', Rr);
