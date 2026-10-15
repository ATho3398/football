// 묶음 측정 (E.22): 표준 표본(4-2-3-1)과 실제 로스터 시즌만 빠르게 돌려 모든 지표를 출력한다. 보고서는 쓰지 않는다.
export {};
// 실행: npm run balance:quick -- [경로=값 ...]   환경 변수: SWEEP_N(동레이팅, 기본 200) SWEEP_D(Δ±8, 100) SWEEP_D15(Δ±15, 200) SWEEP_LEAGUE(시즌, 3) SWEEP_RESP(ST 반응, 0)

process.env.SWEEP_N ??= '200';
process.env.SWEEP_D ??= '100';
process.env.SWEEP_D15 ??= '200';
process.env.SWEEP_LEAGUE ??= '3';
process.env.SWEEP_RESP ??= '0';
// 표본 크기는 suite 를 불러올 때 정해지므로 환경 변수를 먼저 넣고 불러온다
const { analyze, buildSets, runSets } = await import('./engine/suite');
const { printResult } = await import('./engine/report');
const overrides = Object.fromEntries(process.argv.slice(2).filter((a) => a.includes('=')).map((a) => {
  const [k, v] = a.split('=') as [string, string];
  return [k, Number(v)];
}));
const t0 = Date.now();
const sets = buildSets('sweep', Object.keys(overrides).length ? overrides : undefined).filter((s) => !s.name.startsWith('sens:'));
const res = await runSets(sets, '측정');
const r = analyze('sweep', res, (Date.now() - t0) / 1000);
printResult(r);
for (const x of r.responses) console.log(`  반응 ${x.target} ${x.metric}: ${x.change.toFixed(2)} (한계 ${x.bound.toFixed(2)}) ${x.pass ? '✓' : '✗'}`);
console.log(`\n${((Date.now() - t0) / 1000).toFixed(0)}초`);
process.exit(0);
