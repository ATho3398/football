import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import {
  acceptMyOffer, autoMarket, endDay, isMatchDay, newGame, playOthers, playRound, rebuildRosters, SAVE_FORMAT_VERSION, startNextSeason, type GameState,
} from '../src/game';
import { deserialize, serialize } from '../src/save';
import { naturalOvr, type Rosters } from '../src/roster';
import {
  isOutside, makeOffers, marketPending, moveIntents, releaseChance, renewContract, requestEligibility, requestTransfer, runNpcWindow, transferScore,
  wageFor, weakMovePenalty, winterDeadline,
} from '../src/transfer';
import { isoDate } from '../src/calendar';

/** 시즌 끝까지 (빠른 경기) */
function finishSeason(g: GameState): void {
  while (g.phase === 'season') playRound(g, { engine: 'quick' });
}

const rosterKey = (r: Rosters) => JSON.stringify(Object.keys(r).sort().map((k) => [k, r[k]!.players.map((p) => [p.id, p.age, naturalOvr(p), p.contractEnd, p.loyalty, p.joined])]));

describe('NPC 이적 점수 (18.6, 부록 C.42)', () => {
  it('push − resist: 계약 만료·출전 부족·낮은 충성도일수록 점수가 높다', () => {
    const base = { ovr: 75, teamRating: 75, age: 26, loyalty: 60, years: 2, expiring: false, minutesShare: 0.8, rank: 10, winter: false };
    const s0 = transferScore(base).score;
    expect(s0).toBe(-(60 * 0.5 + 4));
    expect(transferScore({ ...base, expiring: true }).score).toBe(s0 + 25);
    expect(transferScore({ ...base, expiring: true, winter: true }).score).toBe(s0 + 12);
    expect(transferScore({ ...base, minutesShare: 0.3 }).score).toBe(s0 + 20);
    expect(transferScore({ ...base, ovr: 80 }).score).toBe(s0 + 15);
    expect(transferScore({ ...base, ovr: 70 }).score).toBe(s0); // 야망은 0 아래로 안 내려간다
    expect(transferScore({ ...base, loyalty: 20 }).score).toBe(s0 + 20);
    expect(transferScore({ ...base, years: 20 }).score).toBe(-(30 + 15));
    expect(transferScore({ ...base, expiring: true, minutesShare: 0.2 }).why).toBe('contract');
  });

  it('여름 이적시장: 이동은 리그 NPC 의 몇 %, 팀당 시즌 영입 2명 이하, 팀은 24명 유지, 낮은 충성도·만료에 집중', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'tr-npc', difficulty: 'normal' });
    finishSeason(g);
    const summer = g.transfers.filter((r) => r.w === 'summer');
    const total = Object.values(g.rosters).reduce((t, r) => t + r.players.length, 0);
    expect(total).toBe(20 * 24);
    expect(summer.length).toBeGreaterThan(total * 0.03);
    expect(summer.length).toBeLessThan(total * 0.2);
    const byTeam: Record<string, number> = {};
    for (const r of g.transfers.filter((x) => x.season === g.league.season + 1 && !isOutside(x.to))) byTeam[r.to] = (byTeam[r.to] ?? 0) + 1;
    expect(Math.max(0, ...Object.values(byTeam))).toBeLessThanOrEqual(BALANCE.transfer.maxSignings);
    for (const r of Object.values(g.rosters)) expect(r.players.length).toBe(24);
    for (const r of summer) expect(r.fill).toBeDefined();
  });

  it('겨울 이적시장은 1월 31일이 끝날 때, 팀 레이팅은 로스터 변화만큼 바로 바뀐다', () => {
    const g = newGame({ mode: 'prospect', position: 'CM', seed: 'tr-winter', difficulty: 'normal' });
    const deadline = winterDeadline(g.league.season);
    while (g.calendar.date <= deadline) {
      if (isMatchDay(g)) playRound(g, { engine: 'quick' });
      else { playOthers(g, 'quick'); endDay(g); }
    }
    const winter = g.transfers.filter((r) => r.w === 'winter');
    expect(winter.length).toBeGreaterThan(0);
    expect(winter.every((r) => r.season === g.league.season)).toBe(true);
    // 재생성: 시드 + 기록 재적용이 지금 로스터와 같다
    const rebuilt = rebuildRosters(g.worldSeed, undefined, g.roster.updates, g.npcs, g.transfers);
    expect(rosterKey(rebuilt)).toBe(rosterKey(g.rosters));
  });

  it('여러 시즌 뒤에도 세이브 → 불러오기 로스터가 같다 (시드 재생성 + 이적 기록)', () => {
    const g = newGame({ mode: 'real', playerId: 'son', seed: 'tr-save', difficulty: 'normal' });
    for (let s = 0; s < 3; s++) {
      finishSeason(g);
      autoMarket(g, 'stay');
      startNextSeason(g);
    }
    for (let k = 0; k < 25; k++) playRound(g, { engine: 'quick' });
    const back = deserialize(serialize(g));
    expect(back.transfers.length).toBe(g.transfers.length);
    expect(rosterKey(back.rosters)).toBe(rosterKey(g.rosters));
    expect(serialize(back)).toBe(serialize(g));
  });

  it('이적 의향 목록은 이번 이적 시즌에 온 선수를 빼고, 확률은 0~1', () => {
    const g = newGame({ mode: 'prospect', position: 'CB', seed: 'tr-int', difficulty: 'normal' });
    const xs = moveIntents(g, 'summer');
    expect(xs.length).toBe(480);
    expect(xs.every((x) => x.p > 0 && x.p < 1)).toBe(true);
    runNpcWindow(g, 'summer');
    const moved = new Set(g.transfers.map((r) => r.id));
    expect(moveIntents(g, 'summer').some((x) => moved.has(x.player.id))).toBe(false);
  });
});

describe('내 선수 이적과 계약 (18.10, 부록 C.42)', () => {
  it('답하지 않고 다음 시즌으로 가면 제안은 거절, 만료 계약은 기본 재계약', () => {
    const g = newGame({ mode: 'prospect', position: 'LW', seed: 'tr-auto', difficulty: 'normal' });
    g.market.contract.until = 2018;
    const team = g.player.teamId;
    finishSeason(g);
    expect(marketPending(g)).toBe(true);
    startNextSeason(g);
    expect(g.player.teamId).toBe(team);
    expect(g.market.contract.until).toBeGreaterThanOrEqual(2019);
    expect(marketPending(g)).toBe(false);
  });

  it('주급 곡선 (19.11): 위상 앵커 그대로, 팀·OVR 로 ±15%', () => {
    expect(wageFor(0, 75, 75)).toBe(500);
    expect(wageFor(150, 75, 75)).toBe(2000);
    expect(wageFor(600, 75, 75)).toBe(15000);
    expect(wageFor(1000, 75, 75)).toBe(30000);
    expect(wageFor(600, 95, 90)).toBe(17250);
    expect(wageFor(600, 50, 60)).toBe(12750);
  });

  it('새 게임 계약: 가상 유망주 3년, 비시즌 제안 3~5개(+임대), 수락하면 새 팀·새 계약', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'tr-me', difficulty: 'normal' });
    expect(g.market.contract).toMatchObject({ teamId: g.player.teamId, from: 2018, until: 2020 });
    finishSeason(g);
    const n = g.market.offers?.length ?? 0;
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThanOrEqual(5 + 2);
    expect(marketPending(g)).toBe(true);
    const o = g.market.offers!.find((x) => x.kind === 'transfer')!;
    const from = g.player.teamId;
    acceptMyOffer(g, g.market.offers!.indexOf(o));
    expect(g.player.teamId).toBe(o.teamId);
    expect(g.market.contract).toMatchObject({ teamId: o.teamId, from: 2019, until: 2019 + o.years - 1, wage: o.wage });
    expect(g.market.moves.at(-1)).toMatchObject({ from, to: o.teamId, season: 2019 });
    expect(marketPending(g)).toBe(false);
    startNextSeason(g);
    expect(g.player.teamId).toBe(o.teamId);
    playRound(g, { engine: 'quick' });
    expect(g.player.history.at(-1)!.teamId).toBe(from);
  });

  it('계약 만료 → 재계약(연장) 또는 FA, 재계약하면 그 연수만큼', () => {
    const g = newGame({ mode: 'prospect', position: 'CM', seed: 'tr-renew', difficulty: 'normal' });
    g.market.contract.until = 2018;
    finishSeason(g);
    expect(g.market.renewal).not.toBeNull();
    g.market.offers = null;
    expect(marketPending(g)).toBe(true);
    const y = g.market.renewal!.years[0]!;
    renewContract(g, y);
    expect(g.market.contract.from).toBe(2019);
    expect(g.market.contract.until).toBe(2019 + y - 1);
    expect(marketPending(g)).toBe(false);
  });

  it('이적 요청: 주전·팀 수준이면 못 하고, 출전 부족이면 가능. 놓아줄 확률 70% (+만료 100%) − 1위 30%p', () => {
    const g = newGame({ mode: 'real', playerId: 'son', seed: 'tr-req', difficulty: 'normal' });
    for (let k = 0; k < 10; k++) playRound(g, { engine: 'quick' });
    const el = requestEligibility(g);
    const s = g.player.season;
    if (el.ok) expect(['출전 시간이 부족해요', '내 위상이 팀 수준을 넘었어요']).toContain(el.reason);
    else expect(Math.min(s.starts, s.minutes / 90) / g.matchLog.length).toBeGreaterThanOrEqual(0.4);
    // 출전 부족으로 만든다
    g.player.season.starts = 0;
    g.player.season.minutes = 0;
    expect(requestEligibility(g).ok).toBe(true);
    const ch = releaseChance(g);
    expect([0.4, 0.7]).toContain(Math.round(ch * 10) / 10);
    g.market.contract.until = g.league.season;
    expect([0.7, 1]).toContain(Math.round(releaseChance(g) * 10) / 10);
    const r = requestTransfer(g);
    expect(g.market.request).toEqual({ season: g.league.season, accepted: r.accepted });
    expect(requestEligibility(g).ok).toBe(false);
    if (r.accepted) {
      // 1월 1일에 제안
      while (g.calendar.date < isoDate(g.league.season + 1, 1, 1) && !marketPending(g)) {
        if (isMatchDay(g)) playRound(g, { engine: 'quick' });
        else { playOthers(g, 'quick'); endDay(g); }
      }
      expect(g.market.offers?.length).toBeGreaterThanOrEqual(3);
      expect(g.market.offerWindow).toBe('winter');
    }
  });

  it('임대: 21세 이하 + 출전 부족이면 임대 제안, 수락하면 1시즌 뒤 원 소속팀으로', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'tr-loan', difficulty: 'normal' });
    finishSeason(g);
    // 지난 시즌 출전 부족으로 만들고 제안을 다시 받는다
    g.player.history.at(-1)!.minutes = 0;
    g.market.offers = makeOffers(g, 'summer', 'loan-test');
    const i = g.market.offers.findIndex((o) => o.kind === 'loan');
    expect(i).toBeGreaterThanOrEqual(0);
    const parent = g.player.teamId;
    const loanTeam = g.market.offers[i]!.teamId;
    acceptMyOffer(g, i);
    expect(g.player.teamId).toBe(loanTeam);
    expect(g.market.contract.teamId).toBe(parent);
    expect(g.market.contract.loan).toEqual({ parent, until: 2019 });
    startNextSeason(g);
    finishSeason(g);
    expect(g.player.teamId).toBe(parent);
    expect(g.market.contract.loan).toBeNull();
    expect(g.market.moves.at(-1)).toMatchObject({ back: true, to: parent });
  });

  it('약팀 이적 위상 감점 (D.19): 3 이상 낮으면 차이만큼 1%씩, 최대 5%', () => {
    expect(weakMovePenalty(400, 80, 78)).toBe(0);
    expect(weakMovePenalty(400, 80, 77)).toBe(4);
    expect(weakMovePenalty(400, 80, 75)).toBe(12);
    expect(weakMovePenalty(400, 85, 70)).toBe(20);
  });

  it('세이브 20 → 21: 이적 기록 없음, 계약 = 지금 팀, 제안 없음', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'mig21', difficulty: 'normal' });
    for (let k = 0; k < 3; k++) playRound(g, { engine: 'quick' });
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 20;
    delete raw.transfers;
    delete raw.market;
    for (const v of Object.values(raw.playerStats) as number[][]) v.length = 4;
    const back = deserialize(JSON.stringify(raw));
    expect(SAVE_FORMAT_VERSION).toBe(25);
    expect(back.saveFormat).toBe(25);
    expect(back.transfers).toEqual([]);
    expect(back.market.contract.teamId).toBe(g.player.teamId);
    expect(back.market.offers).toBeNull();
    finishSeason(back);
    expect(back.market.offers?.length).toBeGreaterThanOrEqual(3);
  });
});
