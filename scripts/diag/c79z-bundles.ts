// 진단 (엔진관리자22 c79z): 동레이팅 표준 표본(engine:check 경량 = 시드 1000~1119 = quick 600 의 첫 120)을 120경기 묶음으로 나눠 득점·슈팅·유효·전환을 묶음별로 잰다.
// 실행: WORKERS=2 npx vite-node scripts/diag/c79z-bundles.ts -- [묶음수=5] [묶음크기=120] [시작=0] [경로=값 ...]
export {};
const argv = process.argv.slice(2).filter((a) => a !== '--');
const nums = argv.filter((a) => !a.includes('=')).map(Number);
const B = nums[0] ?? 5, SZ = nums[1] ?? 120, S0 = nums[2] ?? 0;
const overrides = Object.fromEntries(argv.filter((a) => a.includes('=')).map((a) => { const [k, v] = a.split('=') as [string, string]; return [k, Number(v)]; }));
const { neutralJob, runSets } = await import('../engine/suite');
const o = Object.keys(overrides).length ? { overrides } : {};
const sets = Array.from({ length: B }, (_, k) => ({ name: `b${k}`, jobs: Array.from({ length: SZ }, (_, i) => neutralJob(S0 + k * SZ + i, o)) }));
const res = await runSets(sets, '묶음');
type M = { team: { goals: number; shots: number; shotsOnTarget: number; goalPaths: number[]; farBinOn: number[]; farBinSaves: number[] }[] };
const all: M[] = [];
const line = (name: string, ms: M[]) => {
  const tg = ms.flatMap((m) => m.team.map((t) => t.goals));
  const g = tg.reduce((a, b) => a + b, 0) / tg.length;
  const sd = Math.sqrt(tg.reduce((a, b) => a + (b - g) ** 2, 0) / tg.length);
  // 팀당 득점 평균의 SE: 한 경기 두 팀 값을 독립으로 보고 2N 표본
  const se = sd / Math.sqrt(tg.length);
  const sh = ms.flatMap((m) => m.team.map((t) => t.shots)).reduce((a, b) => a + b, 0) / tg.length;
  const on = ms.flatMap((m) => m.team.map((t) => t.shotsOnTarget)).reduce((a, b) => a + b, 0) / tg.length;
  const gp = [0, 0, 0, 0, 0, 0, 0]; const fo = [0, 0, 0, 0, 0, 0], fs = [0, 0, 0, 0, 0, 0];
  for (const m of ms) for (const t of m.team) { t.goalPaths.forEach((v, k) => (gp[k]! += v)); t.farBinOn.forEach((v, k) => (fo[k]! += v)); t.farBinSaves.forEach((v, k) => (fs[k]! += v)); }
  const band = (k: number) => `${((100 * (fs[k]! + fs[k + 1]!)) / Math.max(1, fo[k]! + fo[k + 1]!)).toFixed(1)}%`;
  console.log(`${name}\t경기 ${ms.length}\t득점 ${g.toFixed(3)} ± ${se.toFixed(3)}\t슈팅 ${sh.toFixed(2)}\t유효 ${on.toFixed(2)}\t전환 ${((100 * g) / on).toFixed(1)}%\t골 경로(패스·돌파·코너·FK·PK·리바운드·기타)/팀 ${gp.map((v) => (v / tg.length).toFixed(3)).join('·')}\t12 m 밖 선방 12~16.5/16.5~25/25+ ${band(0)}/${band(2)}/${band(4)} (유효/팀 ${((fo[0]! + fo[1]!) / tg.length).toFixed(2)}/${((fo[2]! + fo[3]!) / tg.length).toFixed(2)}/${((fo[4]! + fo[5]!) / tg.length).toFixed(2)})`);
};
console.log(`덮어쓰기 ${JSON.stringify(overrides)}`);
for (let k = 0; k < B; k++) { const ms = res.get(`b${k}`) as unknown as M[]; all.push(...ms); line(`시드 ${1000 + S0 + k * SZ}~${1000 + S0 + k * SZ + SZ - 1}`, ms); }
line('전체', all);
process.exit(0);
