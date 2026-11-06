// 진단 (C.81u): 조건·역할별 평점 성분 분해(패스 · 전진 · 키패스 · 골도움 · 수비 · 상실 · 새 칸) — 역할 − 군 평균 (평점 단위)
// 실행: npx vite-node scripts/diag/c81u-parts.ts -- <성분.json> <군> [조건,...]
import { readFileSync } from 'node:fs';
import { ENGINE } from '../../src/engine/config';
import { ratingDelta, type RatingParts } from '../../src/engine/rating';
type Row = { c: string; g: string; role: string; parts: RatingParts };
const [f, g, cs] = process.argv.slice(2).filter((a) => a !== '--');
const rows = (JSON.parse(readFileSync(f!, 'utf8')) as Row[]).filter((r) => r.g === g && (!cs || cs.split(',').includes(r.c)));
const R0 = ENGINE.rating;
const Z = Object.fromEntries(Object.entries(R0).filter(([, v]) => typeof v === 'number').map(([k]) => [k, 0]));
const only = (keys: string[]) => ({ ...R0, ...Z, passKnee: R0.passKnee, forwardKnee: R0.forwardKnee, passTail: R0.passTail, forwardTail: R0.forwardTail, ...Object.fromEntries(keys.map((k) => [k, (R0 as Record<string, unknown>)[k]])) }) as typeof R0;
const P: [string, string[]][] = [['안전패스', ['pass']], ['전진', ['forwardPass']], ['키패스', ['keyPass']], ['골도움', ['goal', 'assist', 'onTarget']], ['수비', ['tackle', 'interception', 'aerial', 'block', 'clearance']], ['상실', ['lost', 'dangerLost']], ['새칸', ['pressWon', 'offsideWon', 'lineMin']]];
const avg = (x: number[]) => x.reduce((a, b) => a + b, 0) / Math.max(1, x.length);
for (const c of [...new Set(rows.map((r) => r.c))]) {
  const xs = rows.filter((r) => r.c === c);
  const roles = [...new Set(xs.map((r) => r.role))];
  const m = (role: string, R: typeof R0) => avg(xs.filter((r) => r.role === role).map((r) => ratingDelta({ ...r.parts, result: 0 }, R))) * R0.scale;
  const cnt = (role: string, k: (p: RatingParts) => number) => avg(xs.filter((r) => r.role === role).map((r) => k(r.parts)));
  console.log(`[${c}] ${P.map((p) => p[0]).join(' · ')} | 안전/전진 패스 수`);
  for (const role of roles) {
    const parts = P.map(([, ks]) => { const R = only(ks); return m(role, R) - avg(roles.map((o) => m(o, R))); });
    console.log(`  ${role.padEnd(18)} ${parts.map((v) => (v >= 0 ? '+' : '') + v.toFixed(2)).join(' ')} | ${cnt(role, (p) => p.passes - p.forward).toFixed(0)}/${cnt(role, (p) => p.forward).toFixed(0)}`);
  }
}
process.exit(0);
