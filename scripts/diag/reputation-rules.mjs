// 위상 감점 규칙 오프라인 재계산 (부록 C.25, C.27: 티어 하한 p.floor, 출전 시간 부족 p.minShort, 레드카드 p.red). scripts/balance-reputation.ts 가 저장한 커리어 기록(JSON)으로 규칙별 위상 경로를 다시 계산한다
// 사용: import { load, simulate, metrics, BASE } from "./reputation-rules.mjs" (node, 의존성 없음)
import { readFileSync } from 'node:fs';
export const load = (f) => JSON.parse(readFileSync(f, 'utf8'));
const R = { max: 1000, from: 0.9, decay: 0.02, badge: 30 };
const CUTS = [250, 550, 900];
const floorOf = (rep) => CUTS.filter((c) => rep >= c).at(-1) ?? 0;
export function simulate(run, p) {
  // 티어 하한: 감점 뒤 값이 감점 전 티어의 컷 밑이면 컷으로 (p.floor)
  const cut = (before, after) => (p.floor ? Math.max(Math.min(before, floorOf(before)), after) : after);
  let rep = 0, streak = 0, prevAvg = null;
  const byAge = { 17: 0 }; const seasonInfo = [];
  for (const s of run.seasons) {
    const start = rep; let matchPen = 0, penMatches = 0;
    const rel = prevAvg !== null ? prevAvg - p.relOff : p.relFallback;
    const thr = p.thr === 'rel' ? rel : p.thr === 'relmin' ? Math.min(p.absThr, rel) : p.thr;
    for (const r of s.ratings) {
      if ((p.a > 0 || p.pct > 0) && r < thr && s.age >= (p.minAge ?? 0)) {
        streak++;
        if (streak >= 2) { let pen = Math.min(p.penCap, p.a * (streak - 1)) + rep * Math.min(p.pctCap ?? 0, (p.pct ?? 0) * (streak - 1)); if (p.int) pen = Math.round(pen); const before = rep; rep = cut(before, Math.max(0, rep - pen)); matchPen += before - rep; penMatches++; }
      } else streak = 0;
    }
    if (p.seasonReset) streak = 0;
    const cap = p.lateCap != null && s.age >= p.lateAge ? p.lateCap : p.cap;
    const gain = Math.min(cap ?? Infinity, s.baseXp * R.from + s.personal);
    const decay = p.lateDecay != null && s.age >= p.lateAge ? p.lateDecay : R.decay;
    { const before = rep; rep = Math.min(R.max, Math.round(rep * (1 - decay) + gain)); if (p.floor) rep = Math.max(floorOf(before), rep); }
    const repBase = rep;
    let rankPen = 0;
    if (p.rank !== 'none' && s.age >= (p.rankMinAge ?? 0)) {
      const below = p.rank === 'rel' ? s.pos - s.expected - p.relTol : s.pos - p.rankCut + 1;
      if (below > 0) rankPen = Math.min(p.rankCap, p.b * below) + rep * Math.min(p.rankPctCap ?? 0, (p.rankPct ?? 0) * below); if (p.int) rankPen = Math.round(rankPen);
      const before = rep; rep = cut(before, Math.max(0, rep - rankPen)); rankPen = before - rep;
    }
    let shortPen = 0;
    if (p.minShort && s.totalMinutes) {
      const share = s.minutes / s.totalMinutes;
      const steps = share < p.minShort.min ? Math.ceil((p.minShort.min - share) / p.minShort.step - 1e-9) : 0;
      const before = rep; rep = cut(before, rep - Math.round(repBase * Math.min(p.minShort.max, p.minShort.per * steps))); shortPen = before - rep;
    }
    if (p.red && s.reds) { const before = rep; rep = cut(before, rep - Math.round(repBase * Math.min(p.red.max, p.red.per * s.reds))); rankPen += before - rep; }
    rep = Math.min(R.max, rep + s.badges * R.badge);
    byAge[s.age + 1] = rep;
    const avg = s.ratings.length ? s.ratings.reduce((t, x) => t + x, 0) / s.ratings.length : null;
    if (s.ratings.length >= 10) prevAvg = avg;
    seasonInfo.push({ age: s.age, avg, apps: s.ratings.length, matchPen, rankPen, shortPen, share: s.totalMinutes ? s.minutes / s.totalMinutes : 1, penMatches, fell: matchPen > 0, net: rep - start });
  }
  return { byAge, seasonInfo };
}
const median = (xs) => { const a = [...xs].sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
export function metrics(data, p) {
  const out = {};
  const all = [];
  for (const strat of ['best', 'random']) for (const tier of ['normal', 'special', 'topClass', 'worldClass', 'legendary']) {
    const rs = data.runs.filter((r) => r.strategy === strat && r.tier === tier).map((r) => simulate(r, p));
    if (!rs.length) continue;
    all.push(...rs);
    out[`${strat}.${tier}`] = {
      med30: median(rs.map((r) => r.byAge[30] ?? 0)),
      wc30: rs.filter((r) => Object.entries(r.byAge).some(([a, v]) => +a <= 30 && v >= 900)).length / rs.length,
      wc35: rs.filter((r) => (r.byAge[35] ?? 0) >= 900).length / rs.length,
      med35: median(rs.map((r) => r.byAge[35] ?? 0)),
    };
  }
  const seasons = all.flatMap((r) => r.seasonInfo).filter((s) => s.apps >= 10);
  const avgs = seasons.map((s) => s.avg).sort((a, b) => a - b);
  const q75 = avgs[Math.floor(avgs.length * 0.75)];
  const top = seasons.filter((s) => s.avg >= q75);
  const mean = (xs) => xs.reduce((t, x) => t + x, 0) / Math.max(1, xs.length);
  out.fellShare = mean(seasons.map((s) => (s.fell ? 1 : 0)));
  out.netDownShare = mean(seasons.map((s) => (s.net < 0 ? 1 : 0)));
  out.topPen = mean(top.map((s) => s.matchPen + s.rankPen + (s.shortPen ?? 0)));
  out.penMatches = mean(seasons.map((s) => s.penMatches));
  out.shortShare = mean(seasons.map((s) => (s.shortPen > 0 ? 1 : 0)));
  out.allPen = mean(seasons.map((s) => s.matchPen + s.rankPen + (s.shortPen ?? 0)));
  out.topMatchPen = mean(top.map((s) => s.matchPen));
  out.topRankPen = mean(top.map((s) => s.rankPen));
  return out;
}
export const BASE = { thr: 7.0, a: 0, penCap: 0, rank: 'none', b: 0, rankCap: 0, cap: 110, lateCap: null, lateAge: 31, relOff: 0.5, relFallback: 6.5, relTol: 0, rankCut: 4 };
