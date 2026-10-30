// 진단 (C.79u): quick 600 동레이팅 득점만 소수 넷째 자리까지 (balance-quick 과 같은 표본) — 실행: npx vite-node scripts/diag/c79u-goals.ts
export {};
process.env.SWEEP_N ??= '600'; process.env.SWEEP_D ??= '0'; process.env.SWEEP_D15 ??= '0'; process.env.SWEEP_LEAGUE ??= '0'; process.env.SWEEP_RESP ??= '0';
const { analyze, buildSets, runSets } = await import('../engine/suite');
const sets = buildSets('sweep').filter((s) => !s.name.startsWith('sens:'));
const res = await runSets(sets, '측정');
const r = analyze('sweep', res, 0) as unknown as { rows: { key: string; value: number }[] };
for (const m of r.rows.filter((x) => ['goals', 'shots', 'onTarget'].includes(x.key))) console.log(m.key, m.value.toFixed(4));
process.exit(0);
