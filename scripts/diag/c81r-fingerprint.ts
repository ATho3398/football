// 진단 (C.81r): 평점만 바꾼 패치의 지문 확인 — 새 코드로 다시 돈 역할 성분(c81r-role-parts) 과 옛 코드 성분을 같은 (역할, 시드)로 맞춰
// ① 경기 결과·골 시각(fp) ② 평점 성분 ③ 새 평점 = 옛 성분으로 새 가중 다시 계산한 평점 이 모두 같은지 센다.
// 실행: npx vite-node scripts/diag/c81r-fingerprint.ts -- <옛.json> <새.json>
import { readFileSync } from 'node:fs';
import { isNoContrib, ratingFromParts, type RatingParts } from '../../src/engine/rating';

type Row = { g: string; role: string; seed: number; fp: string; rating: number; min: number; parts: RatingParts; ex: Record<string, number> };
const [a, b] = process.argv.slice(2).filter((x) => x !== '--');
const old = new Map((JSON.parse(readFileSync(a!, 'utf8')) as Row[]).map((r) => [`${r.role}:${r.seed}`, r]));
const neu = JSON.parse(readFileSync(b!, 'utf8')) as Row[];
let n = 0, fp = 0, parts = 0, same = 0, changed = 0;
for (const r of neu) {
  const o = old.get(`${r.role}:${r.seed}`);
  if (!o) continue;
  n++;
  if (o.fp === r.fp) fp++;
  // 옛 성분에 수비 기록(블록·걷어내기)을 붙이면 새 성분과 같아야 한다
  const op = { ...o.parts, role: o.role, ...(o.ex.blocks ? { blocks: o.ex.blocks } : {}), ...(o.ex.clear ? { clearances: o.ex.clear } : {}), ...(o.ex.dClear ? { dangerClearances: o.ex.dClear } : {}) };
  if (JSON.stringify(Object.entries(op).sort()) === JSON.stringify(Object.entries(r.parts).sort())) parts++;
  // 측정 성분은 경기 중 성분이라 무기여 감점(경기 종료 평점에만)이 없다 — 45분 이상 무기여면 붙인다
  const fin = { ...op, ...(r.min >= 45 && isNoContrib(op as RatingParts) ? { noContrib: 1 } : {}) } as RatingParts;
  if (Math.abs(ratingFromParts(fin) - r.rating) < 1e-9) same++;
  if (Math.abs(o.rating - r.rating) > 1e-9) changed++;
}
console.log(`맞춘 경기 ${n}: 경기 결과·골 시각 같음 ${fp} · 평점 성분 같음 ${parts} · 새 평점 = 옛 성분 새 가중 ${same} · 평점이 바뀐 경기 ${changed}`);
process.exit(fp === n && parts === n && same === n ? 0 : 1);
