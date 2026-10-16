// 득점 분포 점검 (C.29, planning-pending 12): 실제 로스터 리그 시즌 10개 이상에서
//   ① 리그 시즌당 30골 이상 선수 평균 0.5~1명 ② 득점왕 중앙값 25~35골 (개별 40골대 허용)
//   참고: 최다 득점 팀 ≤120, 케인 22~38, 포지션군별 최다 득점자
// 실행: npm run balance:scoring [-- 시즌 수(기본 10)]   ①② 밖이면 종료 코드 1
export {};
const nSeasons = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 10);
process.env.SWEEP_N = '0';
process.env.SWEEP_D = '0';
process.env.SWEEP_D15 = '0';
process.env.SWEEP_LEAGUE = String(nSeasons);
process.env.SWEEP_RESP = '0';
const { analyze, buildSets, runSets } = await import('./engine/suite');
const t0 = Date.now();
const sets = buildSets('sweep').filter((s) => s.name.startsWith('league:'));
const res = await runSets(sets, '득점 분포');
const r = analyze('sweep', res, (Date.now() - t0) / 1000);
const fails: string[] = [];
for (const row of r.rows) {
  if (!row.section.startsWith('실제 선수 시즌')) continue;
  const ok = row.value >= row.lo && row.value <= row.hi;
  console.log(`${ok ? '✓' : '✗'} ${row.label}: ${row.value.toFixed(row.digits)} (목표 ${row.target})${row.note ? ` — ${row.note}` : ''}`);
  if ((row.key === 'lgOver30' || row.key === 'lgBootMed') && !ok) fails.push(row.label);
}
const topGF = r.rows.find((x) => x.key === 'lgTopGF');
const tops = (topGF?.note ?? '').split(', ').map((t) => Number(t.split(' ')[1]));
console.log(`최다 득점 팀 최대 ${Math.max(...tops)} (참고 ≤120)`);
for (const e of r.extra) if (e.startsWith('포지션군') || e.startsWith('실제 시즌')) console.log(e);
console.log(`\n${nSeasons}시즌 ${((Date.now() - t0) / 1000).toFixed(0)}초 — ${fails.length ? `실패: ${fails.join(', ')}` : '득점 분포 통과'}`);
process.exit(fails.length ? 1 : 0);
