// @ts-nocheck — 진단 스크립트 (엔진관리자14, 미해결 3 구조 진단)
// 상성표(c78s-matrix `out=파일.json`)를 "행 강도(가법) + 칸 상호작용(잔차)" 로 분해한다.
//   득실차 d(A,B) ≈ s(A) − s(B) 최소제곱 → s = 성향이 모두에게 똑같이 강한/약한 몫(행 레버), 잔차 = 그 짝에서만 나는 몫(상호작용 레버).
//   가법 모형에서는 어떤 순환(게겐>티키>직선>블록>게겐)의 합도 0 이다 — 순환 칸은 상호작용으로만 만들 수 있다.
// 실행: npx vite-node scripts/diag/c78z-fit.ts -- 기준.json [변형.json ...]   (둘 이상이면 기준 대비 행·상호작용 변화도 찍는다)
import { readFileSync } from 'node:fs';

const files = process.argv.slice(2).filter((a) => a !== '--');
if (!files.length) { console.log('json 파일을 주세요'); process.exit(1); }
type Row = { a: string; b: string; n: number; gf: number; ga: number };
const load = (f: string): Row[] => JSON.parse(readFileSync(f, 'utf8'));
const CYCLES: string[][] = [
  ['gegenpress', 'tikitaka', 'direct', 'block'],
  ['tikitaka', 'direct', 'block'],
  ['gegenpress', 'tikitaka', 'counter'],
];

function solve(A: number[][], b: number[]): number[] {
  // 정규방정식 (AᵀA) s = Aᵀb, 가우스 소거
  const m = A[0]!.length;
  const M = Array.from({ length: m }, () => new Array(m + 1).fill(0));
  for (let r = 0; r < A.length; r++) for (let i = 0; i < m; i++) { for (let j = 0; j < m; j++) M[i]![j] += A[r]![i]! * A[r]![j]!; M[i]![m] += A[r]![i]! * b[r]!; }
  for (let i = 0; i < m; i++) {
    let p = i; for (let r = i + 1; r < m; r++) if (Math.abs(M[r]![i]!) > Math.abs(M[p]![i]!)) p = r;
    [M[i], M[p]] = [M[p]!, M[i]!];
    const piv = M[i]![i]!; if (Math.abs(piv) < 1e-12) continue;
    for (let j = i; j <= m; j++) M[i]![j] /= piv;
    for (let r = 0; r < m; r++) if (r !== i) { const f = M[r]![i]!; for (let j = i; j <= m; j++) M[r]![j] -= f * M[i]![j]!; }
  }
  return M.map((row) => row[m]!);
}

function fit(rows: Row[]) {
  const names = [...new Set(rows.flatMap((r) => [r.a, r.b]))];
  const idx = new Map(names.map((t, i) => [t, i]));
  const A: number[][] = []; const b: number[] = [];
  for (const r of rows) { const row = new Array(names.length).fill(0); row[idx.get(r.a)!] = 1; row[idx.get(r.b)!] = -1; A.push(row); b.push((r.gf - r.ga) / r.n); }
  A.push(new Array(names.length).fill(1)); b.push(0); // Σs = 0
  const s = solve(A, b);
  const d = new Map<string, number>(); const res = new Map<string, number>();
  rows.forEach((r, i) => { const key = `${r.a}/${r.b}`; d.set(key, b[i]!); res.set(key, b[i]! - (s[idx.get(r.a)!]! - s[idx.get(r.b)!]!)); });
  const rms = Math.sqrt([...res.values()].reduce((x, y) => x + y * y, 0) / rows.length);
  const cell = (x: string, y: string) => d.has(`${x}/${y}`) ? d.get(`${x}/${y}`)! : d.has(`${y}/${x}`) ? -d.get(`${y}/${x}`)! : NaN;
  const cycles = CYCLES.map((c) => ({ c, sum: c.reduce((t, x, i) => t + cell(x, c[(i + 1) % c.length]!), 0) }));
  return { names, s: new Map(names.map((t) => [t, s[idx.get(t)!]!])), d, res, rms, cycles };
}

const f = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2);
const base = fit(load(files[0]!));
console.log(`기준 ${files[0]}: 행 강도(가법) ${[...base.s].map(([t, v]) => `${t} ${f(v)}`).join(' · ')}`);
console.log(`  상호작용 RMS ${base.rms.toFixed(3)} (칸 SE 와 비슷하면 거의 가법) · 순환 합: ${base.cycles.map((c) => `${c.c.join('>')} ${f(c.sum)}`).join(' · ')}`);
for (const [k, v] of base.d) console.log(`  ${k.padEnd(24)} 관측 ${f(v)}  가법 ${f(v - base.res.get(k)!)}  상호작용 ${f(base.res.get(k)!)}${Math.abs(base.res.get(k)!) > 0.14 ? ' *' : ''}`);
for (const file of files.slice(1)) {
  const v = fit(load(file));
  console.log(`\n변형 ${file}: 행 강도 변화 ${v.names.map((t) => `${t} ${f((v.s.get(t) ?? 0) - (base.s.get(t) ?? 0))}`).join(' · ')}`);
  console.log(`  상호작용 RMS ${base.rms.toFixed(3)} → ${v.rms.toFixed(3)} · 순환 합: ${v.cycles.map((c) => `${c.c.join('>')} ${f(c.sum)}`).join(' · ')}`);
  for (const [k, x] of v.d) console.log(`  ${k.padEnd(24)} 관측 ${f(base.d.get(k) ?? NaN)} → ${f(x)}  (행 몫 ${f((x - v.res.get(k)!) - ((base.d.get(k) ?? 0) - (base.res.get(k) ?? 0)))} · 상호작용 몫 ${f(v.res.get(k)! - (base.res.get(k) ?? 0))})`);
}
