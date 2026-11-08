// C.81w 진단: 저장본(c81m-run) 다른 리그(내 리그 뺌)마다 포지션군별 — 이력서 풀 인원·풀 골, 리그 기록 전체 골(시즌 끝 로스터 군), 로스터에 없는 id 골
// 실행: npx vite-node scripts/diag/c81w-pool.ts -- <snapDir> [prefix=all|mine] [maxSeason=99]
import { readdirSync, readFileSync } from 'node:fs';
import type { GameState } from '../../src/game';
import { buildResumes } from '../../src/awards';
import { leagueTeamRoster, type OtherLeague } from '../../src/otherLeagues';
import { posGroup } from '../../src/roster';

const args = process.argv.slice(2).filter((a) => a !== '--');
const dir = args[0]!;
const pre = args[1] ?? 'all';
const maxS = Number(args[2] ?? 99);
const MAJOR = ['pl', 'laliga', 'seriea', 'bundesliga', 'ligue1'];
const cat = (lg: string) => (MAJOR.includes(lg) ? lg : 'rest');
type C = { n: number; poolG: number; allG: number; teams: number; nAll: number };
const acc: Record<string, C> = {};
let miss = 0; let tot = 0; let files = 0;
for (const f of readdirSync(dir).filter((f) => new RegExp(`^${pre}-.*-s(\\d+)\\.json$`).test(f)).sort()) {
  const s = Number(/-s(\d+)\.json$/.exec(f)![1]);
  if (s > maxS) continue;
  files++;
  const g = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as GameState;
  const my = (g.league as { id: string }).id;
  const rs = buildResumes(g).filter((x) => !x.me && x.lg !== my);
  for (const r of rs) { const k = `${cat(r.lg)}:${r.group}`; const a = (acc[k] ??= { n: 0, poolG: 0, allG: 0, teams: 0, nAll: 0 }); a.n++; a.poolG += r.goals; }
  for (const lg of (g.otherLeagues ?? []) as OtherLeague[]) {
    if (lg.id === my) continue;
    const grp = new Map<string, string>();
    for (const t of lg.teams) for (const p of leagueTeamRoster(g.worldSeed, t.id, t.rating, lg.season, g.npcs).players) grp.set(p.id, posGroup(p.position));
    for (const G of ['CB', 'FB', 'CDM', 'CM', 'CAM', 'WING', 'ST']) { const k = `${cat(lg.id)}:${G}`; (acc[k] ??= { n: 0, poolG: 0, allG: 0, teams: 0, nAll: 0 }).teams += lg.teams.length; }
    for (const [id, x] of Object.entries(lg.stats ?? {})) {
      const gl = x[0] ?? 0; tot += gl;
      const G = grp.get(id);
      if (!G) { miss += gl; continue; }
      const k = `${cat(lg.id)}:${G}`;
      const a = (acc[k] ??= { n: 0, poolG: 0, allG: 0, teams: 0, nAll: 0 }); a.allG += gl; if (gl > 0) a.nAll++;
    }
  }
}
console.log(`files ${files} · 로스터 밖 id 골 비율 ${(miss / Math.max(1, tot)).toFixed(3)}`);
console.log('| 리그:군 | 풀 인원/팀 | 풀 골/팀 | 전체 골/팀 | 풀 몫 | 풀 평균 |');
for (const [k, a] of Object.entries(acc).sort()) {
  if (k.endsWith(':GK')) continue;
  const T = a.teams || 1;
  console.log(`| ${k} | ${(a.n / T).toFixed(2)} | ${(a.poolG / T).toFixed(2)} | ${(a.allG / T).toFixed(2)} | ${(a.poolG / Math.max(1e-9, a.allG)).toFixed(2)} | ${(a.poolG / Math.max(1, a.n)).toFixed(2)} |`);
}
