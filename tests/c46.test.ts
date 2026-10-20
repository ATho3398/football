import { afterEach, describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { autoMarket, newGame, playRound, SAVE_FORMAT_VERSION, startNextSeason, type GameState } from '../src/game';
import { deserialize, serialize } from '../src/save';
import { squadCount, squadRule, withinRules } from '../src/squad';
import { financeTier, marketValue, npcValue, remainingBudget, seasonBudgets, tierLabel, wageBill, wageCap } from '../src/finance';
import { isOutside, makeOfferSet, makeOffers, myValue, runNpcWindow } from '../src/transfer';
import { renewalCheck } from '../src/startClub';

function finishSeason(g: GameState): void {
  while (g.phase === 'season') playRound(g, { engine: 'quick' });
}

const caps = BALANCE.finance.wageCap as Record<string, number>;
const savedCaps = { ...caps };
afterEach(() => Object.assign(caps, savedCaps));

describe('리그별 로스터 인원 (C.46, pending 62.1)', () => {
  it('6개 리그 표가 있고 PL = 최소 18 · 최대 25 + 21세 이하 5 · 비자국 육성 17', () => {
    expect(Object.keys(BALANCE.squad.leagues)).toHaveLength(6);
    expect(squadRule('pl')).toEqual({ min: 18, max: 25, u21Extra: 5, nonHomegrownMax: 17 });
  });

  it('시즌 3개를 진행해도 모든 팀이 규칙 범위 안 (21세 초과 ≤ 25, 전체 ≤ 30, 18명 이상, 비자국 육성 ≤ 17), 시작 평균 25 안팎', () => {
    const g = newGame({ mode: 'prospect', position: 'CM', seed: 'c46-range', difficulty: 'normal' });
    const start = Object.values(g.rosters).map((r) => r.players.length);
    const avg = start.reduce((a, b) => a + b, 0) / start.length;
    expect(avg).toBeGreaterThanOrEqual(24.5);
    expect(avg).toBeLessThanOrEqual(26.5);
    for (let s = 0; s < 3; s++) {
      finishSeason(g);
      for (const r of Object.values(g.rosters)) expect(withinRules(r.players), `${r.teamId} 시즌 ${s}`).toBe(true);
      autoMarket(g, 'stay');
      startNextSeason(g);
    }
    for (const r of Object.values(g.rosters)) {
      const c = squadCount(r.players);
      expect(c.total).toBeGreaterThanOrEqual(22);
      expect(c.total).toBeLessThanOrEqual(30);
    }
  });
});

describe('구단 재정 (C.46, pending 62.2)', () => {
  it('등급: 빅클럽 6팀, 리그 밖은 레이팅으로, 화면 문구는 등급 이름만', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c46-tier', difficulty: 'normal' });
    expect(g.league.teams.filter((t) => financeTier(t.id) === 'big').map((t) => t.id).sort()).toEqual(['ars', 'che', 'liv', 'mci', 'mun', 'tot']);
    expect(financeTier('x:bar')).toBe('big');
    expect(tierLabel('hud')).toBe('하위');
    // 예산 = 등급 + 순위 상금, 시작 연봉 총액은 상한 안
    expect(g.finance?.season).toBe(2018);
    const b = seasonBudgets(g.league, { mci: 1, hud: 20 });
    expect(b.mci! - BALANCE.finance.budget.big).toBe(20 * BALANCE.finance.prizePerRank);
    for (const t of g.league.teams) expect(wageBill(g.rosters, t.id, t.rating)).toBeLessThan(wageCap(t.id));
  });

  it('몸값: 자유계약·만료(남은 계약 0년) = 0, OVR·잠재력이 높을수록, 나이가 많을수록 낮게, 상한 안', () => {
    expect(marketValue({ ovr: 88, age: 25, yearsLeft: 0 })).toBe(0);
    const v = (o: Partial<Parameters<typeof marketValue>[0]>) => marketValue({ ovr: 80, age: 26, yearsLeft: 3, ...o });
    expect(v({ ovr: 85 })).toBeGreaterThan(v({}));
    expect(v({ age: 32 })).toBeLessThan(v({}));
    expect(v({ peak: 88 })).toBeGreaterThan(v({}));
    expect(v({ yearsLeft: 1 })).toBeLessThan(v({}));
    expect(v({ ovr: 99, age: 19, peak: 99, reputation: 1000 })).toBeLessThanOrEqual(BALANCE.finance.value.maxValue);
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c46-val', difficulty: 'normal' });
    const p = Object.values(g.rosters)[0]!.players[0]!;
    expect(npcValue({ ...p, contractEnd: 2019 }, 2019)).toBe(0);
    // 내 선수: 자유계약 신분이면 0
    expect(myValue(g)).toBeGreaterThan(0);
    g.market.free = true;
    expect(myValue(g)).toBe(0);
  });

  it('예산이 없는 팀은 몸값 있는 선수를 영입하지 않는다 (자유계약은 가능), 연봉 여력이 없는 팀은 아무도 영입하지 않는다', () => {
    const g = newGame({ mode: 'prospect', position: 'CB', seed: 'c46-afford', difficulty: 'normal' });
    finishSeason(g);
    // finishSeason 이 여름 이적시장까지 돌렸다: 기록에 쓴 돈이 남은 예산을 넘지 않는다
    for (const t of g.league.teams) expect(remainingBudget(g, t.id, g.league.season + 1)).toBeGreaterThanOrEqual(0);
    // 다음 해 같은 상태에서 예산 0 + 하위 등급 연봉 상한 0 으로 겨울 이적시장
    const h = newGame({ mode: 'prospect', position: 'CB', seed: 'c46-afford2', difficulty: 'normal' });
    h.finance = { season: h.league.season + 1, budgets: Object.fromEntries(h.league.teams.map((t) => [t.id, 0])) };
    caps.low = 0;
    const recs = runNpcWindow(h, 'summer');
    expect(recs.length).toBeGreaterThan(0);
    // 예산 0: 산 돈은 그 이적시장에 판 몸값 × saleShare 를 넘지 않는다
    const spent: Record<string, number> = {};
    const sold: Record<string, number> = {};
    for (const r of recs) {
      spent[r.to] = (spent[r.to] ?? 0) + (r.fee ?? 0);
      sold[r.from] = (sold[r.from] ?? 0) + (r.fee ?? 0);
      expect(financeTier(r.to) === 'low' && !isOutside(r.to)).toBe(false);
    }
    for (const t of h.league.teams) expect(spent[t.id] ?? 0).toBeLessThanOrEqual((sold[t.id] ?? 0) * BALANCE.finance.saleShare);
    expect(recs.some((r) => !isOutside(r.to) && !r.fee)).toBe(true);
  });

  it('내 선수 제안: 감당 못 하는 팀은 제안하지 않고, 제안 연봉은 그 팀 연봉 여력 안', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c46-offer', difficulty: 'normal' });
    finishSeason(g);
    // 계약 마지막 해 (C.48: 남은 계약이 길면 제안이 적다)
    g.market.contract.until = g.league.season + 1;
    const set = makeOfferSet(g, 'summer', 'x');
    const base = set.offers.filter((o) => o.kind === 'transfer');
    expect(base.length + set.refused.length).toBeGreaterThan(0);
    for (const o of base) {
      const t = g.league.teams.find((x) => x.id === o.teamId)!;
      expect(o.wage * 52).toBeLessThanOrEqual(wageCap(t.id) - wageBill(g.rosters, t.id, g.nextRatings?.[t.id] ?? t.rating) + 52 * 50);
    }
    // 예산이 모두 0 이면 몸값이 있는 케인에게는 이적 제안이 없다
    expect(myValue(g)).toBeGreaterThan(0);
    for (const id of Object.keys(g.finance!.budgets)) g.finance!.budgets[id] = 0;
    expect(makeOffers(g, 'summer', 'y').filter((o) => o.kind === 'transfer')).toHaveLength(0);
    expect(makeOfferSet(g, 'summer', 'y').refused).toHaveLength(0);
  });

  it('재계약 판정 (pending 68, 커스텀 선수): 연봉 여력이 없으면 실패, 있으면 통과, 랜덤 유망주는 판정 없음', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c46-renew', difficulty: 'normal' });
    g.market.contract.until = 2018;
    finishSeason(g);
    if (!g.market.renewal) return;
    expect(renewalCheck(g).fails).toBe(false);
    // 랜덤 유망주는 판정하지 않는다 (allPlayers false), 커스텀이면 판정
    caps[financeTier(g.player.teamId)] = 0;
    expect(renewalCheck(g).fails).toBe(false);
    g.player.custom = true as never;
    caps[financeTier(g.player.teamId)] = 0;
    expect(renewalCheck(g)).toEqual({ fails: true, why: 'wage' });
  });
});

describe('세이브 25 → 26 (C.46)', () => {
  it('구단 예산이 생기고 로스터는 새 규칙으로 다시 만들어진다, 왕복 그대로', () => {
    const g = newGame({ mode: 'prospect', position: 'LW', seed: 'c46-save', difficulty: 'normal' });
    finishSeason(g);
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 25;
    delete raw.finance;
    for (const r of raw.transfers) delete r.fee;
    const back = deserialize(JSON.stringify(raw));
    expect(back.saveFormat).toBe(SAVE_FORMAT_VERSION);
    expect(SAVE_FORMAT_VERSION).toBe(53);
    expect(back.finance?.season).toBe(g.league.season + 1);
    expect(Object.keys(back.finance!.budgets)).toHaveLength(20);
    for (const r of Object.values(back.rosters)) expect(withinRules(r.players)).toBe(true);
    const again = deserialize(serialize(g));
    expect(again.finance).toEqual(g.finance);
    expect(again.rosters).toEqual(g.rosters);
  });
});
