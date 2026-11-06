// C.81w 골든부츠: 저장본(c81m-run all|mine)마다 리그별 득점 1위 골(이력서 풀, bootCoef 리그만)·골든부츠 1위 리그.
// 내 리그만 쪽은 내 리그 = 엔진, 나머지 = 빠른 진행. 섞어 뽑기(부트스트랩): 엔진 1위 분포(전부 엔진 저장본) 대 빠른 1위 분포(내 리그만 저장본의 다른 리그)로
// "내 리그 1위가 다른 빅5 + 1.5 리그 1위 × 계수 최대보다 큰" 확률을 모드별로 계산.
// 실행: npx vite-node scripts/diag/c81w-boot.ts -- <dir>... (파일 이름 all-*/mine-*)
import { readdirSync, readFileSync } from 'node:fs';
import type { GameState } from '../../src/game';
import { buildResumes, eligible } from '../../src/awards';
import { BALANCE } from '../../src/config/balance';

const dirs = process.argv.slice(2).filter((a) => a !== '--');
const boot = BALANCE.awards.defs.goldenBoot!;
const coef = BALANCE.awards.bootCoef;
type Rec = { mode: string; my: string; top: Record<string, number>; win: string };
const recs: Rec[] = [];
for (const dir of dirs) for (const f of readdirSync(dir).filter((f) => /^(all|mine)-.*-s\d+\.json$/.test(f)).sort()) {
  const mode = f.split('-')[0]!;
  const g = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as GameState;
  const my = (g.league as { id: string }).id;
  const rs = buildResumes(g).filter((r) => !r.me && eligible(boot, r) && r.goals > 0);
  const top: Record<string, number> = {};
  for (const r of rs) if (coef[r.lg] !== undefined) top[r.lg] = Math.max(top[r.lg] ?? 0, r.goals);
  const win = Object.entries(top).sort((a, b) => b[1] * coef[b[0]]! - a[1] * coef[a[0]]!)[0]![0];
  recs.push({ mode, my, top, win });
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : NaN);
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };
for (const mode of ['all', 'mine']) {
  const R = recs.filter((r) => r.mode === mode);
  if (!R.length) continue;
  const p = mean(R.map((r) => (r.win === r.my ? 1 : 0)));
  console.log(`${mode}: 시즌 ${R.length} · 골든부츠 1위 내 리그 ${p.toFixed(3)} ± ${Math.sqrt(p * (1 - p) / R.length).toFixed(3)}`);
  const lgs = [...new Set(R.flatMap((r) => Object.keys(r.top)))].sort();
  // 리그별 1위 골: 엔진(내 리그 또는 all) / 빠른(mine 의 다른 리그)
  console.log('  리그 1위 골 (내 리그 | 다른 리그): ' + lgs.map((lg) => {
    const a = R.filter((r) => r.my === lg && r.top[lg]).map((r) => r.top[lg]!);
    const b = R.filter((r) => r.my !== lg && r.top[lg]).map((r) => r.top[lg]!);
    return `${lg} ${mean(a).toFixed(1)}(${a.length}) | ${mean(b).toFixed(1)}±${sd(b).toFixed(1)}(${b.length})`;
  }).join(' · '));
}
// 부트스트랩: 내 리그 1위 = all 모드 같은 리그 1위 표본(엔진), 다른 리그 = (a) all 모드 다른 리그 1위 (b) mine 모드 다른 리그 1위
const pools = (mode: string, eng: boolean) => {
  const o: Record<string, number[]> = {};
  for (const r of recs.filter((x) => x.mode === mode)) for (const [lg, v] of Object.entries(r.top)) if ((lg === r.my) === eng || mode === 'all') (o[lg] ??= []).push(v);
  return o;
};
const E = pools('all', true); const Qo = pools('mine', false);
let s = 1;
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
const pick = (xs: number[]) => xs[Math.floor(rnd() * xs.length)]!;
for (const my of ['pl', 'laliga', 'seriea', 'bundesliga', 'ligue1']) {
  if (!E[my]?.length) continue;
  const res = [E, Qo].map((O) => {
    let w = 0; const N = 20000;
    for (let i = 0; i < N; i++) {
      const me = pick(E[my]!) * coef[my]!;
      let best = 0;
      for (const [lg, xs] of Object.entries(O)) if (lg !== my && xs.length) best = Math.max(best, pick(xs) * coef[lg]!);
      if (me > best || (me === best && rnd() < 0.5)) w++;
    }
    return (w / N).toFixed(3);
  });
  console.log(`부트스트랩 내 리그 ${my}: 다른 리그 엔진 ${res[0]} · 다른 리그 빠른 ${res[1]}`);
}
