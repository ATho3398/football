// 진단 (C.81r): c81r-role-parts 가 저장한 역할별 평점 성분으로 ① 역할별 평점 − 포지션군 평균과 성분별 기여 분해,
// ② 평점 가중 후보(ENGINE.rating 덮어쓰기)로 다시 계산한 역할 표를 낸다. 경기를 다시 돌리지 않는다(평점은 경기 행동에 쓰이지 않음).
// 실행: npx vite-node scripts/diag/c81r-role-fit.ts -- <parts.json ...> [경로=값 ...]   예: passKnee=30 passTail=0.5
import { readFileSync } from 'node:fs';
import { ENGINE } from '../../src/engine/config';
import { isNoContrib, ratingDelta, ratingFromParts, type RatingParts } from '../../src/engine/rating';
import { ROLE_NAMES_KO, ROLE_OPTIONS } from '../../src/engine/roles';

type Row = { g: string; role: string; seed: number; rating: number; min: number; parts: RatingParts; ex: Record<string, number> };
const args = process.argv.slice(2).filter((a) => a !== '--');
const files = args.filter((a) => !a.includes('='));
const over: Record<string, number> = Object.fromEntries(args.filter((a) => a.includes('=')).map((a) => { const [k, v] = a.split('='); return [k!, Number(v)]; }));
const rows: Row[] = files.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')) as Row[]);
const R0 = ENGINE.rating;
const R = { ...R0, ...(process.env.RJSON ? JSON.parse(process.env.RJSON) : {}), ...over, center: { ...R0.center } } as typeof R0;
for (const [k, v] of Object.entries(over)) if (k.startsWith('center.')) R.center[k.slice(7)] = v;

// 성분 분해 (행동 델타 단위 × scale = 평점 단위). 합은 ratingDelta 와 같다
function terms(p: RatingParts, Rc: typeof R0): Record<string, number> {
  const risk = p.riskLost ?? 0;
  const full = ratingDelta(p, Rc);
  const t: Record<string, number> = {
    pass: full - ratingDelta({ ...p, passes: 0, forward: 0 }, Rc),
    key: p.keyPasses * Rc.keyPass,
    shot: Math.max(0, p.onTarget - p.goals) * Rc.onTarget,
    goalAst: p.goals * Rc.goal + p.assists * Rc.assist,
    drib: p.dribbles * Rc.dribble,
    def: full - ratingDelta({ ...p, tackles: 0, interceptions: 0, aerials: 0, ...(p.blocks !== undefined ? { blocks: 0, clearances: 0, dangerClearances: 0 } : {}) } as RatingParts, Rc),
    lost: (p.lost - p.dangerLost - p.attackLost - risk) * Rc.lost + p.attackLost * Rc.lost * Rc.attackLostFactor + risk * Rc.lost * Rc.riskLostFactor + p.dangerLost * Rc.dangerLost + (p.passive ? Math.max(Rc.passiveMax, p.passive * Rc.passive) : 0),
    disc: p.fouls * Rc.foul + p.offsides * Rc.offside + p.yellows * Rc.yellow + p.red * Rc.red,
    team: p.conceded * Rc.conceded + p.saves * Rc.save + p.cleanSheet * Rc.cleanSheet + (p.result > 0 ? Rc.win : p.result < 0 ? Rc.loss : Rc.draw),
    misc: (p.card ?? 0) + (p.relief ?? 0) + (p.noContrib ? p.noContrib * Rc.noContrib : 0),
  };
  return t;
}
const KEYS = ['pass', 'key', 'shot', 'goalAst', 'drib', 'def', 'lost', 'disc', 'team', 'misc'];
const sgn = (v: number, d = 2) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}`;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
// 측정 성분은 경기 중 성분이라 무기여 감점(경기 종료 평점에만 붙음)이 빠져 있다 — 45분 이상이면 붙인다
const withEx = (r: Row): RatingParts => {
  const p = { ...r.parts, role: r.role, blocks: r.ex.blocks, clearances: r.ex.clear, dangerClearances: r.ex.dClear } as RatingParts;
  return r.min >= 45 && isNoContrib(p) ? { ...p, noContrib: 1 } : p;
};

let worst = 0;
const groups = [...new Set(rows.map((r) => r.g))];
console.log(`표본 ${rows.length}경기, 덮어쓰기 ${JSON.stringify(over)}`);
for (const g of groups) {
  const roles = ROLE_OPTIONS[g]!.filter((x) => rows.some((r) => r.role === x));
  const stat = roles.map((role) => {
    const xs = rows.filter((r) => r.g === g && r.role === role);
    const rt = xs.map((r) => ratingFromParts(withEx(r), R));
    const now = avg(xs.map((r) => r.rating));
    const m = avg(rt);
    const sd = Math.sqrt(avg(rt.map((x) => (x - m) ** 2)));
    const tm = Object.fromEntries(KEYS.map((k) => [k, avg(xs.map((r) => terms(withEx(r), R)[k]!)) * R.scale]));
    const raw = { passes: avg(xs.map((r) => r.parts.passes)), fwd: avg(xs.map((r) => r.parts.forward)), def: avg(xs.map((r) => r.parts.tackles + r.parts.interceptions)), blk: avg(xs.map((r) => (r.ex.blocks ?? 0) + (r.ex.clear ?? 0))) };
    return { role, n: xs.length, now, m, se: sd / Math.sqrt(xs.length), tm, raw };
  });
  const gNow = avg(stat.map((s) => s.now)), gM = avg(stat.map((s) => s.m));
  const gT = Object.fromEntries(KEYS.map((k) => [k, avg(stat.map((s) => s.tm[k]!))]));
  if (process.env.QUIET) { console.log(`${g} ${gM.toFixed(2)}: ` + stat.map((s) => `${ROLE_NAMES_KO[s.role]} ${sgn(s.m - gM)}`).join(' · ')); for (const s of stat) worst = Math.max(worst, Math.abs(s.m - gM)); continue; }
  console.log(`\n### ${g} (군 평균: 저장 평점 ${gNow.toFixed(2)} → 새 ${gM.toFixed(2)})`);
  console.log(`| 역할 | n | 저장 대비 | 새 평점 | 새 대비 | ±SE | ${KEYS.join(' | ')} | 패스 수 | 전진 | 태클+인터 | 블록+걷기 |`);
  console.log(`|---|---|---|---|---|---|${KEYS.map(() => '---').join('|')}|---|---|---|---|`);
  for (const s of stat) {
    worst = Math.max(worst, Math.abs(s.m - gM));
    console.log(`| ${ROLE_NAMES_KO[s.role]} | ${s.n} | ${sgn(s.now - gNow)} | ${s.m.toFixed(2)} | ${sgn(s.m - gM)} | ${s.se.toFixed(2)} | ${KEYS.map((k) => sgn(s.tm[k]! - gT[k]!)).join(' | ')} | ${s.raw.passes.toFixed(1)} | ${s.raw.fwd.toFixed(1)} | ${s.raw.def.toFixed(2)} | ${s.raw.blk.toFixed(2)} |`);
  }
}
console.log(`\n최대 |새 대비| = ${worst.toFixed(3)}`);

// 사용자 선수 관점 (SEASON=1): 같은 선수·같은 팀·같은 상대(같은 시드)에서 역할만 바꾼 38경기 시즌 평균 평점 — 저장 평점(지금)과 새 가중
if (process.env.SEASON) {
  console.log('\n### 시즌(38경기) 평균 평점 — 같은 시드 묶음, 역할 − 군 평균 (평균 · 시즌 간 표준편차 · 가장 큰 시즌 차)');
  console.log('| 군 | 역할 | 시즌 수 | 지금 시즌 평균 | 지금 차 | 새 시즌 평균 | 새 차 | 새 차 σ(시즌) | 새 차 최대 |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const g of groups) {
    const roles = ROLE_OPTIONS[g]!.filter((x) => rows.some((r) => r.role === x));
    const by = roles.map((role) => rows.filter((r) => r.g === g && r.role === role).sort((a, b) => a.seed - b.seed));
    const nS = Math.floor(Math.min(...by.map((x) => x.length)) / 38);
    const season = (xs: Row[], j: number, f: (r: Row) => number) => avg(xs.slice(j * 38, (j + 1) * 38).map(f));
    const oldS = by.map((xs) => Array.from({ length: nS }, (_, j) => season(xs, j, (r) => r.rating)));
    const newS = by.map((xs) => Array.from({ length: nS }, (_, j) => season(xs, j, (r) => ratingFromParts(withEx(r), R))));
    const gOld = Array.from({ length: nS }, (_, j) => avg(oldS.map((s) => s[j]!)));
    const gNew = Array.from({ length: nS }, (_, j) => avg(newS.map((s) => s[j]!)));
    roles.forEach((role, i) => {
      const dO = oldS[i]!.map((v, j) => v - gOld[j]!), dN = newS[i]!.map((v, j) => v - gNew[j]!);
      const mN = avg(dN);
      console.log(`| ${g} | ${ROLE_NAMES_KO[role]} | ${nS} | ${avg(oldS[i]!).toFixed(2)} | ${sgn(avg(dO))} | ${avg(newS[i]!).toFixed(2)} | ${sgn(mN)} | ${Math.sqrt(avg(dN.map((x) => (x - mN) ** 2))).toFixed(2)} | ${sgn(dN.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0))} |`);
    });
  }
}
