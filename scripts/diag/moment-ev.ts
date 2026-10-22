// 진단 (엔진 관리자 9대, pending 145 ①): 결정 순간 선택지의 기대 평점(optionValue)이 "안전" 쪽으로 쏠리는지 센다. 엔진 코드는 건드리지 않는다.
// npx vite-node scripts/diag/moment-ev.ts -- [포지션군당 선수 수=2] [라운드 수=3] [rating.경로=값 ...]
//   분류: 슛 / 전진(전진 패스·침투·크로스·컷백·몰고 가기·돌파) / 안전(옆·백패스·유지·버티기·걷어내기). 백패스 = 라벨 '백패스'.
//   재는 것: 정지마다 봇 최선(EV 최대)의 분류, 분류별 EV 평균·최댓값, "가장 좋은 공격 선택지 EV − 가장 좋은 안전 선택지 EV" 분포, 확률 구간별 EV.
import { ENGINE } from '../../src/engine/config';
import { newGame, roundMatch, selectableRealPlayers } from '../../src/game';
import { playMyMatch } from '../../src/engine/adapter';
import { bestChoice, optionValue, type MomentPolicy, type MomentOption } from '../../src/engine/moments';
import { posGroup } from '../../src/roster';
import { setEnvironmentFixed } from '../../src/weather';

const allArgs = process.argv.slice(2).filter((a) => a !== '--');
for (const a of allArgs.filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string];
  const path = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>;
  for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>;
  o[path[path.length - 1]!] = Number(v);
}
const args = allArgs.filter((x) => !x.includes('='));
setEnvironmentFixed(true);
const perGroup = Number(args[0] ?? 2);
const rounds = Number(args[1] ?? 3);
const groups = ['ST', 'WING', 'CAM', 'CM', 'CDM', 'FB', 'CB'];
const pool = selectableRealPlayers();
const picks = groups.flatMap((g) => pool.filter((p) => posGroup(p.position) === g).slice(0, perGroup));
type Cls = 'shot' | 'attack' | 'safe';
const cls = (o: MomentOption): Cls => {
  const a = o.action as string;
  if (a === 'shoot' || o.chain) return 'shot';
  if (a === 'through' || a === 'cross' || a === 'cutback' || a === 'dribble' || a === 'carry') return 'attack';
  if (a === 'pass' && o.label.includes('전진')) return 'attack';
  return 'safe';
};
const G: Record<string, { stops: number; best: Record<Cls, number>; bestBack: number; gap: number[]; ev: Record<Cls, number[]>; back: number[]; hasAtt: number; hasBack: number; p: Record<Cls, number[]> }> = {};
const g0 = () => ({ stops: 0, best: { shot: 0, attack: 0, safe: 0 }, bestBack: 0, gap: [] as number[], ev: { shot: [], attack: [], safe: [] } as Record<Cls, number[]>, back: [] as number[], hasAtt: 0, hasBack: 0, p: { shot: [], attack: [], safe: [] } as Record<Cls, number[]> });
let cur = 'ALL';
const bot: MomentPolicy = (m) => {
  const c = bestChoice(m, Infinity);
  if (m.type === 'onball' && m.options.length) {
    for (const key of [cur, 'ALL']) {
      const r = (G[key] ??= g0());
      r.stops++;
      let bi = 0, bv = -Infinity, bestAtt = -Infinity, bestSafe = -Infinity;
      m.options.forEach((o, i) => {
        if (o.kind === 'card') return;
        const v = optionValue(o); const k = cls(o);
        r.ev[k].push(v); if (o.p !== null) r.p[k].push(o.p);
        if (o.label.includes('백패스')) r.back.push(v);
        if (k === 'safe') bestSafe = Math.max(bestSafe, v); else bestAtt = Math.max(bestAtt, v);
        if (v > bv) { bv = v; bi = i; }
      });
      const bo = m.options[bi]!;
      r.best[cls(bo)]++;
      if (bo.label.includes('백패스')) r.bestBack++;
      if (Number.isFinite(bestAtt)) r.hasAtt++;
      if (m.options.some((o) => o.label.includes('백패스'))) r.hasBack++;
      if (Number.isFinite(bestAtt) && Number.isFinite(bestSafe)) r.gap.push(bestAtt - bestSafe);
      const own = m.options.some((o) => o.down <= ENGINE.rating.dangerLost * ENGINE.rating.scale + 1e-6 && o.down < 0);
      if (key !== 'ALL') continue;
      const zk = key + (own ? ' 자기 1/3' : ' 그 밖');
      const z = (G[zk] ??= g0()); z.stops++; z.best[cls(bo)]++; if (bo.label.includes('백패스')) z.bestBack++;
      if (Number.isFinite(bestAtt) && Number.isFinite(bestSafe)) z.gap.push(bestAtt - bestSafe);
    }
  }
  return c;
};
for (const p of picks) {
  cur = posGroup(p.position);
  const g = newGame({ mode: 'real', playerId: p.id, seed: `mev-${p.id}`, difficulty: 'normal' });
  for (let k = 0; k < rounds && g.phase === 'season'; k++) {
    const rm = roundMatch(g);
    playMyMatch({ ...rm.input, control: { mode: 'direct', stop: (process.env.STOP ?? 'important') as 'all' | 'important' | 'critical', policy: bot } });
  }
}
const f = (x: number, k = 3) => (Number.isFinite(x) ? x.toFixed(k) : '-');
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '-');
console.log(`moment-ev · ${picks.length}명 × ${rounds}라운드 · rating forwardPass ${ENGINE.rating.forwardPass} pass ${ENGINE.rating.pass} lost ${ENGINE.rating.lost} keyPass ${ENGINE.rating.keyPass}`);
for (const key of ['ALL', 'ALL 자기 1/3', 'ALL 그 밖', ...groups]) {
  const r = G[key]; if (!r) continue;
  console.log(`${key}: 정지 ${r.stops} · 봇 최선 슛 ${pct(r.best.shot, r.stops)} / 공격 ${pct(r.best.attack, r.stops)} / 안전 ${pct(r.best.safe, r.stops)} (백패스 ${pct(r.bestBack, r.stops)}) · 공격 선택지 있음 ${pct(r.hasAtt, r.stops)} · 백패스 있음 ${pct(r.hasBack, r.stops)}`);
  console.log(`   EV 평균 슛 ${f(avg(r.ev.shot))} · 공격 ${f(avg(r.ev.attack))} · 안전 ${f(avg(r.ev.safe))} · 백패스 ${f(avg(r.back))} | 확률 평균 슛 ${f(avg(r.p.shot), 2)} · 공격 ${f(avg(r.p.attack), 2)} · 안전 ${f(avg(r.p.safe), 2)} | 최선 공격 − 최선 안전 EV: 평균 ${f(avg(r.gap))} · 공격이 낫다 ${pct(r.gap.filter((x) => x > 0).length, r.gap.length)}`);
}
// C.77t (44h-k §9.17): 슛 선택지 확률(= 판단 xG) 꼭대기 — 0.3+ · 0.4+ · 0.5+ 비율과 최댓값
{
  const ps = G.ALL?.p.shot ?? [];
  const share = (t: number) => pct(ps.filter((x) => x >= t).length, ps.length);
  console.log(`슛 선택지 ${ps.length}개 · 확률 0.3+ ${share(0.3)} · 0.4+ ${share(0.4)} · 0.5+ ${share(0.5)} · 최대 ${f(ps.length ? Math.max(...ps) : NaN, 2)}`);
}
