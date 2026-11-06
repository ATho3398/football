// C.81w: 저장본 다른 리그(내 리그 뺌) 팀 득점 분포 — 리그별 경기당 최다 득점 팀 GF/경기 · 상위 3팀 평균 · 리그 평균, 1위 득점자 골 / 그 팀 GF
import { readdirSync, readFileSync } from 'node:fs';
import type { GameState } from '../../src/game';
import { sortedTable } from '../../src/league';
import type { OtherLeague } from '../../src/otherLeagues';
const dirs = process.argv.slice(2).filter((a) => a !== '--');
const acc: Record<string, { top: number[]; top3: number[]; avg: number[]; lead: number[]; leadSh: number[] }> = {};
for (const dir of dirs) for (const f of readdirSync(dir).filter((f) => /^(all|mine)-.*-s\d+\.json$/.test(f)).sort()) {
  const mode = f.split('-')[0]!;
  const g = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as GameState;
  const my = (g.league as { id: string }).id;
  for (const lg of (g.otherLeagues ?? []) as OtherLeague[]) {
    if (lg.id === my) continue;
    const t = sortedTable(lg).map((r) => ({ id: r.teamId, gf: r.gf / Math.max(1, r.played) })).sort((a, b) => b.gf - a.gf);
    const st = Object.entries(lg.stats ?? {}).sort((a, b) => (b[1][0] ?? 0) - (a[1][0] ?? 0))[0];
    const k = `${mode}:${lg.id}`;
    const A = (acc[k] ??= { top: [], top3: [], avg: [], lead: [], leadSh: [] });
    A.top.push(t[0]!.gf); A.top3.push((t[0]!.gf + t[1]!.gf + t[2]!.gf) / 3); A.avg.push(t.reduce((s, x) => s + x.gf, 0) / t.length);
    const team = lg.names?.[st![0]]?.[1];
    const row = sortedTable(lg).find((r) => r.teamId === team);
    A.lead.push(st![1][0] ?? 0); A.leadSh.push((st![1][0] ?? 0) / Math.max(1, row?.gf ?? 1));
  }
}
const m = (xs: number[]) => (xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(2);
console.log('| 모드:리그 | n | 1위팀 GF/경기 | 상위3 | 평균 | 득점 1위 골(기록 전체) | 1위 / 팀 GF |');
for (const [k, A] of Object.entries(acc).sort()) console.log(`| ${k} | ${A.top.length} | ${m(A.top)} | ${m(A.top3)} | ${m(A.avg)} | ${m(A.lead)} | ${m(A.leadSh)} |`);
