// C.81x 프로파일 요약: .cpuprofile(node --cpu-prof) 은 함수별 자기 시간 ms/경기, .heapprofile(c81x-allocprof) 은 할당 자리별 MB/경기
// 사용: node scripts/diag/c81x-profsum.mjs <프로파일> <경기 수 N> [함수 이름…  → cpuprofile 이면 그 함수의 줄별 틱]
import fs from 'node:fs';
const file = process.argv[2];
const N = Number(process.argv[3] ?? 20);
const p = JSON.parse(fs.readFileSync(file, 'utf8'));
const want = new Set(process.argv.slice(4));
if (file.endsWith('.heapprofile')) {
  const self = new Map();
  let total = 0;
  const walk = (n, stack) => {
    const k = `${n.callFrame.functionName || '(anon)'}:${n.callFrame.lineNumber}`;
    const sz = n.selfSize || 0;
    total += sz;
    if (sz) { const key = `${k}  <- ${stack.slice(-2).join(' <- ')}`; self.set(key, (self.get(key) || 0) + sz); }
    for (const c of n.children || []) walk(c, [...stack, k]);
  };
  walk(p.head, []);
  console.log(`sampled total ${(total / 1048576 / N).toFixed(1)} MB/match`);
  for (const [k, v] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(`${(v / 1048576 / N).toFixed(2).padStart(7)} MB  ${((100 * v) / total).toFixed(1).padStart(5)}%  ${k}`);
} else {
  const byId = new Map(p.nodes.map((n) => [n.id, n]));
  const self = new Map();
  let total = 0;
  for (let i = 0; i < p.samples.length; i++) {
    const n = byId.get(p.samples[i]);
    const k = `${n.callFrame.functionName || '(anon)'} ${(n.callFrame.url || '').split('/').pop()}:${n.callFrame.lineNumber}`;
    self.set(k, (self.get(k) || 0) + p.timeDeltas[i]);
    total += p.timeDeltas[i];
  }
  const warm = Math.max(1, N - 1);
  console.log(`total ${(total / 1000 / warm).toFixed(0)} ms/match (self, 온 경기 기준 N-1)`);
  for (const [k, v] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(`${(v / 1000 / warm).toFixed(1).padStart(7)} ms  ${((100 * v) / total).toFixed(1).padStart(5)}%  ${k}`);
  for (const n of p.nodes) {
    const fn = n.callFrame.functionName;
    if (!want.has(fn) || !n.positionTicks) continue;
    const tot = n.positionTicks.reduce((a, b) => a + b.ticks, 0);
    console.log(`== ${fn} (${tot} ticks)`);
    for (const pt of [...n.positionTicks].sort((a, b) => b.ticks - a.ticks).slice(0, 10)) console.log(`  line ${pt.line}: ${pt.ticks}`);
  }
}
