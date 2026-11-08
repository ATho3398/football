// C.80a 측정: 엔진 NPC 경기의 선수별 카드율 (포지션군·팀 성향·홈/원정). 빠른 경기 카드 굴림 수치(BALANCE.discipline.npcQuick)의 근거
// 실행: npx vite-node scripts/c80a-cards.ts -- [경기 수, 기본 200]
import { newGame, otherJob, selectableRealPlayers } from '../src/game';
import { npcTeamSetup } from '../src/engine/setup';
import { createMatch } from '../src/engine/sim';
import { posGroup, type TeamRoster } from '../src/roster';
import { rosterTendency } from '../src/npcFit';

const N = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 200);
const g = newGame({ mode: 'real', playerId: selectableRealPlayers()[0]!.id, seed: 'c80a', difficulty: 'normal' });
type Acc = { min: number; y: number; r: number; y2: number };
const acc = (): Acc => ({ min: 0, y: 0, r: 0, y2: 0 });
const byGroup: Record<string, Acc> = {};
const byTend: Record<string, Acc> = {};
const bySide = [acc(), acc()];
let n = 0;
const t0 = Date.now();
outer: for (let r = 0; r < g.league.schedule.length; r++) {
  for (let i = 0; i < g.league.schedule[r]!.length; i++) {
    if (n >= N) break outer;
    const m = otherJob(g, r, i).input;
    const home = npcTeamSetup(m.home, m.homeRating, m.awayRating, m.worldSeed, m.seed, m.leagueAvg, m.cond, m.styles?.[0] ?? 'neutral');
    const away = npcTeamSetup(m.away, m.awayRating, m.homeRating, m.worldSeed, m.seed, m.leagueAvg, m.cond, m.styles?.[1] ?? 'neutral');
    const res = createMatch({ home, away, mode: 'auto', difficulty: 'normal', seed: m.seed, bigMatch: false, ...(m.env ? { env: m.env } : {}) }).runToEnd();
    const rosters: TeamRoster[] = [m.home, m.away];
    for (const p of res.players) {
      if (p.minutes <= 0) continue;
      const gr = posGroup(p.position);
      const td = rosterTendency(rosters[p.team]!, m.worldSeed);
      for (const a of [(byGroup[gr] ??= acc()), (byTend[td] ??= acc()), bySide[p.team]!]) {
        a.min += p.minutes; a.y += p.red && p.yellows >= 2 ? 0 : p.yellows; a.r += p.red ? 1 : 0; a.y2 += p.red && p.yellows >= 2 ? 1 : 0;
      }
    }
    n++;
  }
}
const per90 = (a: Acc) => `옐로/90 ${(a.y / a.min * 90).toFixed(4)} 레드/90 ${(a.r / a.min * 90).toFixed(4)} (경고누적 ${a.y2}) 분 ${a.min}`;
console.log(`${n}경기 ${((Date.now() - t0) / 1000).toFixed(0)}초`);
for (const [k, a] of Object.entries(byGroup)) console.log('포지션', k, per90(a));
for (const [k, a] of Object.entries(byTend)) console.log('성향', k, per90(a));
bySide.forEach((a, k) => console.log(k ? '원정' : '홈', per90(a)));
const all = Object.values(byGroup).reduce((t, a) => ({ min: t.min + a.min, y: t.y + a.y, r: t.r + a.r, y2: t.y2 + a.y2 }), acc());
console.log('전체', per90(all), `팀당 경기 옐로 ${(all.y / n / 2).toFixed(2)} 레드 ${(all.r / n / 2).toFixed(3)}`);
