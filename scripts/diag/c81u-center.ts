// 진단 (C.81u): 일반 표본(rating-parts 720 … 20000)에서 새 평점 식(수비 기록 칸 + 새 roleCenter)의 8군 평균이
// 지금 main 설정(새 칸 가중 0 · 옛 roleCenter)과 같게 center 를 다시 맞춘다.
// 실행: RJSON='{"roleCenter":{...}}' npx vite-node scripts/diag/c81u-center.ts -- <gen.json>
import { readFileSync } from 'node:fs';
import { ENGINE } from '../../src/engine/config';
import { isNoContrib, ratingFromParts, type RatingParts } from '../../src/engine/rating';

type GenRow = RatingParts & { str: number; team: number; starter: boolean; min: number };
const f = process.argv.slice(2).filter((a) => a !== '--')[0]!;
const gen = (JSON.parse(readFileSync(f, 'utf8')) as GenRow[]).filter((r) => r.team === 0 && r.starter && r.min >= 45)
  .map((r) => ({ ...r, ...(isNoContrib(r) ? { noContrib: 1 } : {}) }) as GenRow);
type R_ = typeof ENGINE.rating;
const G = ['GK', 'CB', 'FB', 'CDM', 'CM', 'CAM', 'WING', 'ST'];
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
function stats(R: R_) {
  const cells = new Map<string, number[]>();
  for (const r of gen) { const k = `${r.str}:${r.group}`; if (!cells.has(k)) cells.set(k, []); cells.get(k)!.push(ratingFromParts(r, R)); }
  const keys = [...cells.keys()];
  const ca = (ks: string[], fn: (x: number) => number = (x) => x) => avg(ks.map((k) => avg(cells.get(k)!.map(fn))));
  const mu = ca(keys);
  return { mu, sd: Math.sqrt(ca(keys, (x) => (x - mu) ** 2)), gm: Object.fromEntries(G.map((g) => [g, ca(keys.filter((k) => k.endsWith(`:${g}`)))])) as Record<string, number> };
}
const R0 = ENGINE.rating;
const old = stats({ ...R0, pressWon: 0, offsideWon: 0, lineMin: 0 });
const R: R_ = { ...R0, ...(process.env.RJSON ? JSON.parse(process.env.RJSON) : {}), center: { ...R0.center } };
for (let it = 0; it < 5; it++) { const g = stats(R).gm; for (const k of G) R.center[k] = R.center[k]! + (g[k]! - old.gm[k]!) / R.scale; }
for (const k of G) R.center[k] = Math.round(R.center[k]! * 100) / 100;
const nw = stats(R);
console.log('center ' + JSON.stringify(R.center));
console.log(`전: 평균 ${old.mu.toFixed(3)} σ ${old.sd.toFixed(3)} | ` + G.map((g) => `${g} ${old.gm[g]!.toFixed(2)}`).join(' '));
console.log(`후: 평균 ${nw.mu.toFixed(3)} σ ${nw.sd.toFixed(3)} | ` + G.map((g) => `${g} ${nw.gm[g]!.toFixed(2)}`).join(' '));
process.exit(0);
