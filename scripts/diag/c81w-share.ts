// C.81w 진단: 엔진 저장본(c81m-run all) 다른 리그 로스터를 pickLineup 선발·벤치·그 밖으로 나눠 포지션군별 실제 출전 몫 분포 — 풀 문턱(minShare) 통과율 · 평균 몫 · 골 몫
// 실행: npx vite-node scripts/diag/c81w-share.ts -- <snapDir> [prefix=all]
import { readdirSync, readFileSync } from 'node:fs';
import type { GameState } from '../../src/game';
import { leagueTeamRoster, type OtherLeague } from '../../src/otherLeagues';
import { sortedTable } from '../../src/league';
import { posGroup, pickLineup } from '../../src/roster';
import { BALANCE } from '../../src/config/balance';

const args = process.argv.slice(2).filter((a) => a !== '--');
const dir = args[0]!;
const pre = args[1] ?? 'all';
const thr = Math.min(BALANCE.awards.minShare, BALANCE.awards.youngMinShare);
type A = { n: number; pass: number; sh: number; g: number; teams: number; xs: number[] };
const acc: Record<string, A> = {};
let teams = 0;
for (const f of readdirSync(dir).filter((f) => new RegExp(`^${pre}-.*-s\\d+\\.json$`).test(f)).sort()) {
  const g = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as GameState;
  const my = (g.league as { id: string }).id;
  for (const lg of (g.otherLeagues ?? []) as OtherLeague[]) {
    if (lg.id === my) continue;
    const played = new Map(sortedTable(lg).map((r) => [r.teamId, r.played]));
    for (const t of lg.teams) {
      teams++;
      const ro = leagueTeamRoster(g.worldSeed, t.id, t.rating, lg.season, g.npcs);
      const lu = pickLineup(ro);
      const st = new Set(lu.slots.map((x) => x.playerId)); const bn = new Set(lu.bench);
      const P = played.get(t.id) ?? 38;
      for (const p of ro.players) {
        const cls = st.has(p.id) ? 'S' : bn.has(p.id) ? 'B' : 'O';
        const k = `${posGroup(p.position)}:${cls}`;
        const a = (acc[k] ??= { n: 0, pass: 0, sh: 0, g: 0, teams: 0, xs: [] });
        const x = lg.stats?.[p.id];
        const sh = (x?.[2] ?? 0) / P;
        a.n++; a.sh += sh; a.xs.push(Math.min(1, sh)); if (sh >= thr) a.pass++; a.g += x?.[0] ?? 0;
      }
    }
  }
}
console.log(`teams ${teams} thr ${thr}`);
console.log('| 군:구분 | 인원/팀 | 평균 몫 | 문턱 통과율 | 통과/팀 | 골/팀 |');
for (const [k, a] of Object.entries(acc).sort()) console.log(`| ${k} | ${(a.n / teams).toFixed(2)} | ${(a.sh / a.n).toFixed(2)} | ${(a.pass / a.n).toFixed(2)} | ${(a.pass / teams).toFixed(2)} | ${(a.g / teams).toFixed(2)} |`);
// shareQ (BALANCE.awards.estimate.shareQ) 모양: 군 → [선발, 벤치, 그 밖] 각 5분위 [5, 25, 50, 75, 95%]
const Q = [0.05, 0.25, 0.5, 0.75, 0.95];
const qs = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return Q.map((q) => +s[Math.min(s.length - 1, Math.floor(q * s.length))]!.toFixed(2)); };
const out: Record<string, number[][]> = {};
for (const g of ['GK', 'CB', 'FB', 'CDM', 'CM', 'CAM', 'WING', 'ST']) out[g] = ['S', 'B', 'O'].map((c) => qs(acc[`${g}:${c}`]?.xs ?? [0]));
console.log(JSON.stringify(out));
