// C.80d 측정: 엔진 NPC 리그 경기의 팀당 경기 파울·옐로·레드(직접·경고 누적)·득점. 심판 수치를 덮어써서 비교
// 실행: npx vite-node scripts/c80d-cards.ts -- [경기 수, 기본 200] [from=시작 경기] [yellowShare=0.3 redShare=0.008 secondYellow=0.5 bookedCare=0.5]
import { newGame, otherJob, selectableRealPlayers } from '../src/game';
import { ENGINE } from '../src/engine/config';
import { npcTeamSetup } from '../src/engine/setup';
import { createMatch } from '../src/engine/sim';

const args = process.argv.slice(2);
const N = Number(args.find((a) => /^\d+$/.test(a)) ?? 200);
const kv = Object.fromEntries(args.filter((a) => a.includes('=')).map((a) => a.split('=') as [string, string]));
const from = Number(kv.from ?? 0);
const R = ENGINE.referee as unknown as Record<string, number>;
for (const k of ['yellowShare', 'redShare', 'secondYellow', 'bookedCare']) if (kv[k]) R[k] = Number(kv[k]);
if (kv.restartCard) (ENGINE.restart as unknown as Record<string, number[]>).card = [Number(kv.restartCard), Number(kv.restartCard)];
const g = newGame({ mode: 'real', playerId: selectableRealPlayers()[0]!.id, seed: kv.seed ?? 'c80a', difficulty: 'normal' });
let n = 0, idx = 0, fouls = 0, y = 0, red = 0, y2 = 0, goals = 0, adv = 0, live = 0;
const t0 = Date.now();
outer: for (let r = 0; r < g.league.schedule.length; r++) {
  for (let i = 0; i < g.league.schedule[r]!.length; i++) {
    if (idx++ < from) continue;
    if (n >= N) break outer;
    const m = otherJob(g, r, i).input;
    const home = npcTeamSetup(m.home, m.homeRating, m.awayRating, m.worldSeed, m.seed, m.leagueAvg, m.cond, m.styles?.[0] ?? 'neutral');
    const away = npcTeamSetup(m.away, m.awayRating, m.homeRating, m.worldSeed, m.seed, m.leagueAvg, m.cond, m.styles?.[1] ?? 'neutral');
    const res = createMatch({ home, away, mode: 'auto', difficulty: 'normal', seed: m.seed, bigMatch: false, ...(m.env ? { env: m.env } : {}) }).runToEnd();
    for (const t of res.teamStats) { fouls += t.fouls; adv += t.advantages; }
    goals += res.homeGoals + res.awayGoals;
    live += res.liveSeconds;
    for (const p of res.players) {
      const second = p.red && p.yellows >= 2;
      y += p.yellows; red += p.red ? 1 : 0; y2 += second ? 1 : 0;
    }
    n++;
  }
}
const per = (v: number) => (v / n / 2).toFixed(3);
console.log(`${n}경기(from ${from}) ${((Date.now() - t0) / 1000).toFixed(0)}초 ${JSON.stringify(kv)}`);
console.log(`RESULT n=${n} 팀당경기 파울 ${per(fouls)} 옐로(전체) ${per(y)} 레드(전체) ${per(red)} 직접레드 ${per(red - y2)} 경고누적 ${per(y2)} 득점 ${per(goals)} 어드밴티지 ${per(adv)} 실경기 ${(live / n / 60).toFixed(2)}분 파울/실경기분 ${(fouls / 2 / (live / 60)).toFixed(4)}`);
