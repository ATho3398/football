// 진단 (C.77s): rating-parts JSON 으로 포지션군별 평균 델타 합(= center 후보)·평점·소극적 백패스·위험 감수 실패를 본다 (선발 45분 이상)
// npx vite-node scripts/diag/c77s-center.ts -- <rating-parts.json>
import { readFileSync } from 'node:fs';
import { ENGINE } from '../../src/engine/config';
import { ratingDelta, ratingFromParts, type RatingParts } from '../../src/engine/rating';

const file = process.argv.slice(2).filter((a) => a !== '--')[0] ?? 'rating-parts.json';
type Row = RatingParts & { starter: boolean; min: number; rating: number };
const rows = (JSON.parse(readFileSync(file, 'utf8')) as Row[]).filter((r) => r.starter && r.min >= 45);
const groups = ['GK', 'CB', 'FB', 'CDM', 'CM', 'CAM', 'WING', 'ST'];
/** 규칙 전 (C.77s 전): 소극적 감점·위험 감수 완화를 뺀 같은 경기 (엔진 행동은 같다) */
const old = (r: Row): Row => ({ ...r, passive: 0, riskLost: 0 });
const mean = (xs: number[]) => xs.reduce((t, x) => t + x, 0) / Math.max(1, xs.length);
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };
console.log('군   n    델타    center  평점   소극N  감점받음%  소극감점(평점)  위험실패  | 규칙 전 델타 평점');
for (const g of groups) {
  const rs = rows.filter((r) => r.group === g);
  const pen = rs.map((r) => (r.passive ? Math.max(ENGINE.rating.passiveMax, r.passive * ENGINE.rating.passive) * ENGINE.rating.scale : 0));
  console.log(`${g.padEnd(4)} ${String(rs.length).padStart(4)} ${mean(rs.map((r) => ratingDelta(r))).toFixed(3).padStart(7)} ${(ENGINE.rating.center[g] ?? 0).toFixed(2).padStart(7)} ${mean(rs.map((r) => ratingFromParts(r))).toFixed(2).padStart(6)} ${mean(rs.map((r) => r.passiveN ?? 0)).toFixed(2).padStart(6)} ${(100 * mean(rs.map((r) => (r.passive ? 1 : 0)))).toFixed(0).padStart(8)}% ${mean(pen).toFixed(3).padStart(12)} ${mean(rs.map((r) => r.riskLost ?? 0)).toFixed(2).padStart(9)}  | ${mean(rs.map((r) => ratingDelta(old(r)))).toFixed(3)} ${mean(rs.map((r) => ratingFromParts(old(r)))).toFixed(2)}`);
}
const all = rows.map((r) => ratingFromParts(r));
const allOld = rows.map((r) => ratingFromParts(old(r)));
console.log(`전체 평점 ${mean(all).toFixed(2)} σ ${sd(all).toFixed(2)} (n ${rows.length}) · 규칙 전 ${mean(allOld).toFixed(2)} σ ${sd(allOld).toFixed(2)}`);
