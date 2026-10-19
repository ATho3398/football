// C.42 이적 측정 (18.6·18.10): NPC 시즌당 이동 비율, 충성도·계약 만료 집중, 팀 레이팅 분산 추이, 재생성 일치,
// 내 선수 제안 수·커리어 이적 횟수(정책별)·30세 OVR·위상.
// 실행: npm run balance:transfer -- [커리어 수(기본 12)] [시즌 수(기본 10)]
import { autoMarket, newGame, playRound, rebuildRosters, startNextSeason, type GameState } from '../src/game';
import { naturalOvr, teamRatings } from '../src/roster';
import { isOutside, type TransferRec } from '../src/transfer';
import { playerOvr } from '../src/growth';
import { PLAYABLE_POSITIONS } from '../src/positions';
import { autoAllocate } from '../src/growth';

import { BALANCE } from '../src/config/balance';
import { setEnvironmentFixed } from '../src/weather';

// 측정은 맑음·보통 심판 고정 (부록 C.74a): 기존 기준 그대로 비교
setEnvironmentFixed(true);
// TR_OFF=1: 이적 끄고 기준선 (팀 레이팅 분산 비교)
if (process.env.TR_OFF) Object.assign(BALANCE.transfer.windowShare, { summer: 0, winter: 0 });
const args = process.argv.filter((a) => /^\d+$/.test(a)).map(Number);
const CAREERS = args[0] ?? 12;
const SEASONS = args[1] ?? 10;
const avg = (xs: number[]) => (xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : 0);
const sd = (xs: number[]) => Math.sqrt(avg(xs.map((x) => (x - avg(xs)) ** 2)));
const median = (xs: number[]) => { const v = [...xs].sort((a, b) => a - b); return v.length ? (v.length % 2 ? v[(v.length - 1) / 2]! : (v[v.length / 2 - 1]! + v[v.length / 2]!) / 2) : 0; };

interface SeasonRow { moved: number; total: number; intoLeague: number; out: number; winter: number; lowLoy: number; lowLoyMoved: number; exp: number; expMoved: number; real: number; ratingSd: number; ratingTop: number; ratingLow: number; whys: Record<string, number> }

function snapshot(g: GameState) {
  const all = Object.values(g.rosters).flatMap((r) => r.players.map((p) => ({ id: p.id, loy: p.loyalty, exp: p.contractEnd <= g.league.season + 1 })));
  return new Map(all.map((x) => [x.id, x]));
}

function career(i: number, policy: 'stay' | 'best') {
  const position = PLAYABLE_POSITIONS[i % PLAYABLE_POSITIONS.length]!;
  const g = newGame({ mode: 'prospect', position, seed: `tr-${i}`, difficulty: 'normal' });
  const rows: SeasonRow[] = [];
  let offers = 0;
  let offerSeasons = 0;
  const ovrByAge: Record<number, number> = {};
  const rosterDelta: number[] = [];
  const leagueDelta: number[] = [];
  let prevRoster = teamRatings(g.rosters);
  let prevLeague = Object.fromEntries(g.league.teams.map((t) => [t.id, t.rating]));
  const repByAge: Record<number, number> = {};
  for (let s = 0; s < SEASONS && g.phase !== 'retired'; s++) {
    const snap = snapshot(g);
    const n0 = g.transfers.length;
    while (g.phase === 'season') { playRound(g, { engine: 'quick' }); autoAllocate(g.player); }
    const recs: TransferRec[] = g.transfers.slice(n0);
    const lowIds = [...snap.values()].filter((x) => x.loy < 40);
    const expIds = [...snap.values()].filter((x) => x.exp);
    const movedIds = new Set(recs.map((r) => r.id));
    const ratings = g.league.teams.map((t) => t.rating);
    const whys: Record<string, number> = {};
    for (const r of recs) whys[r.why] = (whys[r.why] ?? 0) + 1;
    rows.push({
      moved: recs.length, total: snap.size, intoLeague: recs.filter((r) => !isOutside(r.to)).length, out: recs.filter((r) => isOutside(r.to)).length,
      winter: recs.filter((r) => r.w === 'winter').length, lowLoy: lowIds.length, lowLoyMoved: lowIds.filter((x) => movedIds.has(x.id)).length,
      exp: expIds.length, expMoved: expIds.filter((x) => movedIds.has(x.id)).length, real: recs.filter((r) => r.real).length,
      ratingSd: sd(ratings), ratingTop: Math.max(...ratings), ratingLow: Math.min(...ratings), whys,
    });
    ovrByAge[g.player.age] = playerOvr(g.player);
    repByAge[g.player.age] = g.player.reputation;
    if (g.phase !== 'offseason') break;
    offers += g.market.offers?.length ?? 0;
    offerSeasons++;
    autoMarket(g, policy);
    startNextSeason(g);
    const nowRoster = teamRatings(g.rosters);
    for (const id of Object.keys(nowRoster)) rosterDelta.push(nowRoster[id]! - prevRoster[id]!);
    for (const t of g.league.teams) leagueDelta.push(t.rating - prevLeague[t.id]!);
    prevRoster = nowRoster;
    prevLeague = Object.fromEntries(g.league.teams.map((t) => [t.id, t.rating]));
  }
  // 재생성 일치
  const rebuilt = rebuildRosters(g.worldSeed, g.player.realPlayerId, g.roster.updates, g.npcs, g.transfers);
  const key = (r: typeof g.rosters) => JSON.stringify(Object.keys(r).sort().map((k) => [k, r[k]!.players.map((p) => [p.id, p.age, naturalOvr(p), p.contractEnd, p.loyalty, p.joined])]));
  const same = key(rebuilt) === key(g.rosters);
  const moves = g.market.moves.filter((m) => !m.back).length;
  return { rosterDelta, leagueDelta, rows, offers: offers / Math.max(1, offerSeasons), same, moves, ovrByAge, repByAge, badges: g.player.badges.map((b) => b.id) };
}

for (const policy of ['stay', 'best'] as const) {
  const t0 = Date.now();
  const runs = Array.from({ length: CAREERS }, (_, i) => career(i, policy));
  const rows = runs.flatMap((r) => r.rows);
  console.log(`\n[${policy}] 커리어 ${CAREERS} × ${SEASONS}시즌 (${((Date.now() - t0) / 1000).toFixed(0)}초)`);
  const rate = avg(rows.map((r) => r.moved / r.total));
  console.log(`  NPC 시즌당 이동 ${avg(rows.map((r) => r.moved)).toFixed(1)}명 / ${avg(rows.map((r) => r.total)).toFixed(0)}명 = ${(rate * 100).toFixed(1)}% (목표 5~15%) · 리그 안 ${avg(rows.map((r) => r.intoLeague)).toFixed(1)} · 리그 밖 ${avg(rows.map((r) => r.out)).toFixed(1)} · 겨울 ${avg(rows.map((r) => r.winter)).toFixed(1)} · 실제 선수 ${avg(rows.map((r) => r.real)).toFixed(1)}`);
  const lowRate = rows.reduce((t, r) => t + r.lowLoyMoved, 0) / Math.max(1, rows.reduce((t, r) => t + r.lowLoy, 0));
  const expRate = rows.reduce((t, r) => t + r.expMoved, 0) / Math.max(1, rows.reduce((t, r) => t + r.exp, 0));
  console.log(`  집중: 충성도 40 미만 이동률 ${(lowRate * 100).toFixed(1)}% · 계약 만료 이동률 ${(expRate * 100).toFixed(1)}% · 전체 ${(rate * 100).toFixed(1)}% (배수 ${(lowRate / rate).toFixed(1)} / ${(expRate / rate).toFixed(1)})`);
  const whys: Record<string, number> = {};
  for (const r of rows) for (const [k, v] of Object.entries(r.whys)) whys[k] = (whys[k] ?? 0) + v;
  console.log(`  이유: ${Object.entries(whys).map(([k, v]) => `${k} ${v}`).join(' / ')}`);
  for (const s of [0, 4, SEASONS - 1]) {
    const rs = runs.map((r) => r.rows[s]).filter(Boolean) as SeasonRow[];
    if (rs.length) console.log(`  ${s + 1}시즌 팀 레이팅: 표준편차 ${avg(rs.map((r) => r.ratingSd)).toFixed(2)} · 최고 ${avg(rs.map((r) => r.ratingTop)).toFixed(1)} · 최저 ${avg(rs.map((r) => r.ratingLow)).toFixed(1)}`);
  }
  console.log(`  내 선수: 비시즌 제안 평균 ${avg(runs.map((r) => r.offers)).toFixed(1)}개 · 커리어 이적 ${avg(runs.map((r) => r.moves)).toFixed(1)}회 · 30세 OVR ${avg(runs.map((r) => r.ovrByAge[30] ?? 0).filter(Boolean)).toFixed(1)} · 위상 중앙값 ${median(runs.map((r) => r.repByAge[30] ?? 0).filter(Boolean)).toFixed(0)} · 한 팀 배지 ${runs.filter((r) => r.badges.includes('oneClub10')).length}/${runs.length}`);
  console.log(`  시즌 간 팀 레이팅 변화 σ: 로스터만 ${sd(runs.flatMap((r) => r.rosterDelta)).toFixed(2)} · 리그(팀 컨디션 σ ${BALANCE.roster.seasonFormSd} 포함) ${sd(runs.flatMap((r) => r.leagueDelta)).toFixed(2)}`);
  console.log(`  재생성 일치 ${runs.filter((r) => r.same).length}/${runs.length}`);
}
