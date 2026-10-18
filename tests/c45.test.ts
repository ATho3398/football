// C.45 34단계: 신체·양발, 장단점, 커스텀 생성, 노화·은퇴, 등번호, 짧은 이름 범위, 약발 강화, 세이브 23 → 24
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { bodyMods, NEUTRAL_MODS, realBody, rollBody, weakFootMul } from '../src/body';
import { autoCustom, baseAttributes, customBudget, customCap, customOvr, customRaise, spentPoints, validCustom } from '../src/custom';
import { canAddTag, CREATE_TAGS, injuryMul, rollTags, seasonRemovals, tagPoints, TAGS } from '../src/tags';
import { applyAging } from '../src/growth';
import { FIELD_ATTRIBUTES, type FieldAttributes } from '../src/attributes';
import { createRng } from '../src/rng';
import { buyWeakFoot, endDay, isMatchDay, myShirt, newGame, playOthers, playRound, setDayTraining, type CustomSpec } from '../src/game';
import { deserialize, serialize } from '../src/save';
import { shortNames } from '../src/names';
import { replayPlayers } from '../src/replay';
import { teamSetupFromRoster } from '../src/engine/setup';
import { injuryChance } from '../src/injury';

const pk = (...ids: string[]) => ids.map((id) => ({ id: id as never, perm: true }));
const flat = (v: number) => Object.fromEntries(FIELD_ATTRIBUTES.map((a) => [a, v])) as FieldAttributes;

describe('신체·양발 (C.45 1번)', () => {
  it('가상 선수 신체는 id 로 늘 같고, CB·ST·GK 가 윙·공미보다 크다', () => {
    expect(rollBody('v:x:1', 'CB')).toEqual(rollBody('v:x:1', 'CB'));
    const avgH = (pos: 'CB' | 'LW' | 'GK' | 'CAM' | 'ST') => {
      let t = 0;
      for (let i = 0; i < 400; i++) t += rollBody(`h${i}`, pos).height;
      return t / 400;
    };
    expect(avgH('CB')).toBeGreaterThan(avgH('LW') + 6);
    expect(avgH('GK')).toBeGreaterThan(avgH('CAM') + 8);
    expect(avgH('ST')).toBeGreaterThan(avgH('LW'));
    for (let i = 0; i < 200; i++) {
      const b = rollBody(`w${i}`, 'CM');
      expect(b.weakFoot).toBeGreaterThanOrEqual(1);
      expect(b.weakFoot).toBeLessThanOrEqual(5);
    }
  });

  it('실제 선수: 데이터 키·몸무게·주발, both → 오른발 약발 5', () => {
    expect(realBody('son')).toEqual({ height: 183, weight: 78, foot: 'right', weakFoot: 5 });
    expect(realBody('salah')!.foot).toBe('left');
    expect(realBody('van-dijk')!.height).toBe(193);
    expect(realBody('nobody')).toBeUndefined();
  });

  it('약발 배율: 오른발잡이가 오른쪽(공격 방향 기준)으로 차면 약발, 왼쪽·정면은 그대로, 짧은 패스는 영향 없음', () => {
    const m = bodyMods({ height: 180, weight: 75, foot: 'right', weakFoot: 1 });
    // dir +1: 오른쪽 = +y
    expect(weakFootMul(m, 1, 0, 20)).toBeCloseTo(0.75, 6);
    expect(weakFootMul(m, 1, 0, -20)).toBe(1);
    expect(weakFootMul(m, 1, 20, 1)).toBe(1);
    expect(weakFootMul(m, -1, 0, -20)).toBeCloseTo(0.75, 6);
    expect(weakFootMul(m, 1, 0, 8, true)).toBe(1);
    expect(weakFootMul(m, 1, 0, 40, true)).toBeCloseTo(0.75, 6);
    expect(weakFootMul({ ...m, weakFoot: 5 }, 1, 0, 20)).toBe(1);
    expect(weakFootMul(NEUTRAL_MODS, 1, 0, 20)).toBe(1);
  });

  it('키·몸무게 보정: 큰 선수 공중볼 +, 무거운 선수 근력 + 민첩 −, 한도 안', () => {
    const tall = bodyMods({ height: 205, weight: 105, foot: 'right', weakFoot: 3 });
    const small = bodyMods({ height: 165, weight: 60, foot: 'right', weakFoot: 3 });
    expect(tall.aerial).toBe(BALANCE.body.aerialMax);
    expect(small.aerial).toBeLessThan(0);
    expect(tall.strength).toBeGreaterThan(0);
    expect(tall.quickness).toBeGreaterThan(0);
    expect(Math.abs(tall.gkClaim)).toBeLessThanOrEqual(BALANCE.body.gkReachMax);
  });
});

describe('장단점 (C.45 2번)', () => {
  it('장점 최대 2·단점 최대 3, 서로 배타, 플레이 전용 태그는 생성 때 못 고름', () => {
    expect(canAddTag(pk('ironMan', 'starQuality'), 'consistent')).toBe(false);
    expect(canAddTag(pk('glass'), 'ironMan')).toBe(false);
    expect(canAddTag(pk('glass', 'troublemaker', 'mediaShy'), 'homesick')).toBe(false);
    expect(canAddTag(pk('glass', 'troublemaker'), 'mediaShy')).toBe(true);
    for (const id of ['evergreen', 'bigGame', 'academy', 'oneClubMan', 'eternal'] as const) expect(canAddTag([], id)).toBe(false);
    expect(CREATE_TAGS).not.toContain('evergreen');
  });

  it('생성 비용: 영구 ×1.5, 해제형 ×0.6, 생성 전용은 늘 영구', () => {
    const c = BALANCE.tags.cost;
    expect(tagPoints('glass', true)).toBe(Math.round(c.glass! * 1.5));
    expect(tagPoints('glass', false)).toBe(Math.round(c.glass! * 0.6));
    expect(tagPoints('ironMan', true)).toBe(-Math.round(c.ironMan! * 1.5));
    expect(tagPoints('linguist', false)).toBe(tagPoints('linguist', true));
  });

  it('해제형 태그는 시즌 끝 조건에 떨어지고 영구는 남는다', () => {
    const season = { apps: 30, starts: 30, injuries: 0, reds: 0, yellows: 2, slumpPenalty: 0, trainingXp: 120 };
    const p = { age: 25, season, tags: [{ id: 'glass' as const, perm: false, season: 2018 }, { id: 'troublemaker' as const, perm: true, season: 2018 }] };
    const gone = seasonRemovals(p, false);
    expect(gone.map((t) => t.id)).toEqual(['glass']);
    expect(p.tags.map((t) => t.id)).toEqual(['troublemaker']);
  });

  it('랜덤 장단점 0~2개, 배타 규칙 지킴', () => {
    const counts = [0, 0, 0];
    for (let i = 0; i < 300; i++) {
      const t = rollTags(createRng(i + 1));
      counts[t.length]!++;
      for (const x of t) expect(TAGS[x.id].source).not.toBe('play');
      expect(new Set(t.map((x) => x.id)).size).toBe(t.length);
    }
    expect(counts[0]! > 0 && counts[1]! > 0 && counts[2]! > 0).toBe(true);
  });

  it('유리몸 ×1.5·철강왕 ×0.6 이 부상 확률에 걸린다', () => {
    const p = { attributes: flat(60), age: 22, fatigue: 0 };
    const base = injuryChance(p, 90, 'normal');
    expect(injuryChance({ ...p, tags: [{ id: 'glass', perm: true, season: 2018 }] }, 90, 'normal')).toBeCloseTo(base * 1.5, 9);
    expect(injuryChance({ ...p, tags: [{ id: 'ironMan', perm: false, season: 2018 }] }, 90, 'normal')).toBeCloseTo(base * 0.6, 9);
    expect(injuryMul({ tags: [] })).toBe(1);
  });
});

describe('커스텀 생성 (C.45 2번)', () => {
  it('기본 40 + 58P (C.49), 칸 단위 비용 1/2/3, 키가 크면 속도 상한 −·공중 상한 +', () => {
    const P = BALANCE.custom.points;
    expect(P).toBe(58);
    expect(customBudget(17, [])).toBe(P);
    expect(customBudget(23, [])).toBe(P + 6 * BALANCE.custom.pointsPerYear);
    expect(customBudget(15, [])).toBe(P - 2 * BALANCE.custom.pointsPerYearYounger);
    expect(customBudget(17, pk('glass'))).toBe(P + tagPoints('glass', true));
    expect(customBudget(17, [{ id: 'ironMan', perm: false }])).toBe(P + tagPoints('ironMan', false));
    expect(customCap('pace', 195)).toBeLessThan(customCap('pace', 170));
    expect(customCap('heading', 195)).toBeGreaterThan(customCap('heading', 170));
    const a = customRaise(baseAttributes(), 'shooting', 4, P, 180);
    expect(a.shooting).toBe(60);
    expect(spentPoints(a)).toBe(1 + 1 + 1 + 2);
    expect(customRaise(a, 'shooting', -1, P, 180).shooting).toBe(55);
    // 자동 배분 17세 OVR 은 랜덤 생성 범위(52~60) 안
    const ovr = customOvr(autoCustom('ST', P, 180), 'ST');
    expect(ovr).toBeGreaterThanOrEqual(BALANCE.newGame.startOvr.min - 1);
    expect(ovr).toBeLessThanOrEqual(BALANCE.newGame.startOvr.max + 1);
  });

  it('newGame custom: 고른 값 그대로, 포인트 초과면 거부', () => {
    const attrs = autoCustom('CB', customBudget(19, pk('glass')), 192);
    const spec: CustomSpec = {
      name: '테스트', position: 'CB', age: 19, attributes: attrs, body: { height: 192, weight: 88, foot: 'left', weakFoot: 2 },
      tags: pk('glass'), nationality: 'Japan', appearance: 'eastAsian', pixelHair: 'brown',
    };
    expect(validCustom(attrs, customBudget(19, pk('glass')), 192)).toBe(true);
    const g = newGame({ mode: 'custom', custom: spec, seed: 'cu1', difficulty: 'normal' });
    expect(g.player).toMatchObject({ name: '테스트', age: 19, position: 'CB', nationality: 'Japan', appearance: 'eastAsian', custom: true });
    expect(g.player.tags).toEqual([{ id: 'glass', perm: true, season: 2018 }]);
    expect(g.player.body).toEqual({ height: 192, weight: 88, foot: 'left', weakFoot: 2 });
    expect(g.player.attributes).toEqual(attrs);
    expect(() => newGame({ mode: 'custom', custom: { ...spec, attributes: flat(75) }, seed: 'cu1', difficulty: 'normal' })).toThrow();
  });

  it('랜덤 유망주도 신체·장단점이 붙고 기존 능력치·팀은 그대로 (별도 시드)', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'pros', difficulty: 'normal' });
    expect(g.player.body.height).toBeGreaterThan(150);
    expect(g.player.tags.length).toBeLessThanOrEqual(2);
    const g2 = newGame({ mode: 'prospect', position: 'ST', seed: 'pros', difficulty: 'normal' });
    expect(g2.player).toEqual(g.player);
  });
});

describe('노화·은퇴 (C.45 3번)', () => {
  const decline = (age: number, mul = 1) => {
    let t = 0;
    for (let i = 0; i < 40; i++) {
      const a = flat(70);
      applyAging(a, age, createRng(i + 7), 'ST', mul);
      t += FIELD_ATTRIBUTES.reduce((s, k) => s + 70 - a[k], 0);
    }
    return t / 40;
  };
  it('38세부터 더 크게, 41세부터 더 크게, 노익장 ×0.6', () => {
    expect(decline(38)).toBeGreaterThan(decline(37) * 1.4);
    expect(decline(41)).toBeGreaterThan(decline(38) * 1.2);
    expect(decline(39, 0.6)).toBeLessThan(decline(39) * 0.75);
  });
  it('38세부터 지구력·속도·가속이 더 많이 떨어진다', () => {
    let speed = 0, other = 0;
    for (let i = 0; i < 60; i++) {
      const a = flat(70);
      applyAging(a, 39, createRng(i + 3), 'CM');
      speed += 70 - a.pace;
      other += 70 - a.strength;
    }
    expect(speed).toBeGreaterThan(other);
  });
});

describe('등번호 (C.45 4번)', () => {
  it('팀 안에서 겹치지 않고 실제 선수는 실제 번호, 리플레이 번호 = 등번호', () => {
    const g = newGame({ mode: 'real', playerId: 'son', seed: 'shirt', difficulty: 'normal' });
    expect(g.player.shirt).toBe(7);
    expect(myShirt(g)).toBe(7);
    for (const r of Object.values(g.rosters)) {
      const nums = r.players.map((p) => p.shirt);
      expect(nums.every((n) => typeof n === 'number')).toBe(true);
      expect(new Set(nums).size).toBe(nums.length);
    }
    const liv = g.rosters.liv!;
    expect(liv.players.find((p) => p.id === 'salah')!.shirt).toBe(11);
    const setup = teamSetupFromRoster(liv, 80, 80);
    const rp = replayPlayers(setup, teamSetupFromRoster(g.rosters.che!, 80, 80));
    const salah = rp.find((p) => p.id === 'salah');
    if (salah) expect(salah.number).toBe(11);
  });
});

describe('짧은 이름 겹침 범위 (C.45 6번)', () => {
  it('같은 짧은 이름이라도 한 명단에 한 명이면 첫 글자 없음', () => {
    const world = shortNames([{ id: 'a', name: 'John Walker', nameKo: '존 워커' }, { id: 'b', name: 'Kyle Walker', nameKo: '카일 워커' }]);
    expect(world.get('a')).toBe('J.워커');
    const match = shortNames([{ id: 'a', name: 'John Walker', nameKo: '존 워커' }, { id: 'c', name: 'Harry Kane', nameKo: '해리 케인' }]);
    expect(match.get('a')).toBe('워커');
  });
});

describe('약발 강화 (C.45 1번)', () => {
  it('포인트 10 으로 +1 (C.49), 5 면 더 못 올림', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'wf', difficulty: 'normal' });
    g.player.body = { ...g.player.body, weakFoot: 4 };
    g.player.unspentPoints = BALANCE.weakFoot.pointCost - 1;
    expect(buyWeakFoot(g)).toBe(false);
    g.player.unspentPoints = BALANCE.weakFoot.pointCost * 2;
    expect(buyWeakFoot(g)).toBe(true);
    expect(g.player.body.weakFoot).toBe(5);
    expect(buyWeakFoot(g)).toBe(false);
    expect(g.player.unspentPoints).toBe(BALANCE.weakFoot.pointCost);
  });

  it('약발 훈련: 게이지가 차면 +1, 시즌 최대 +1', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'wft', difficulty: 'normal' });
    g.player.body = { ...g.player.body, weakFoot: 2 };
    let days = 0;
    while (days < 120) {
      if (isMatchDay(g)) playRound(g, { engine: 'quick' });
      else {
        setDayTraining(g, g.calendar.date, 'weakFoot');
        playOthers(g, 'quick');
        endDay(g);
      }
      days++;
    }
    expect(g.player.body.weakFoot).toBe(3);
    expect(g.player.weakFootTrain!.gained).toBe(1);
  });
});

describe('세이브 23 → 24 (C.45 7번)', () => {
  it('신체·장단점·등번호·도트 직접 바꾸기 기본값, 왕복', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'mig24', difficulty: 'normal' });
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 23;
    delete raw.player.body;
    delete raw.player.tags;
    delete raw.player.shirt;
    delete raw.pixelOverrides;
    const back = deserialize(JSON.stringify(raw));
    expect(back.saveFormat).toBe(39);
    expect(back.player.body).toEqual(realBody('kane'));
    expect(back.player.tags).toEqual([]);
    expect(back.player.clubRun).toMatchObject({ club: 'tot', first: true });
    expect(back.player.shirt).toBe(10);
    expect(back.pixelOverrides).toEqual({ players: {}, kits: {} });
    expect(serialize(deserialize(serialize(back)))).toBe(serialize(back));
  });
});

describe('시작 소속·1군 테스트·스토리 태그 (C.45 10·12·13번)', () => {
  const spec = (age: number, start: CustomSpec['start']): CustomSpec => ({
    position: 'ST', age, attributes: autoCustom('ST', customBudget(age, []), 180), body: { height: 180, weight: 75, foot: 'right', weakFoot: 3 },
    tags: [], nationality: 'England', appearance: 'white', start,
  });

  it('15~18세 유스 구단: 그 구단 1군 콜업, 테스트 중 출전 보장, 3~5경기 뒤 판정', () => {
    const g = newGame({ mode: 'custom', custom: spec(17, { kind: 'youth', club: 'liv' }), seed: 'trial1', difficulty: 'normal' });
    expect(g.player.teamId).toBe('liv');
    expect(g.player.youth).toEqual({ club: 'liv' });
    expect(g.trial).toMatchObject({ teamId: 'liv', games: 0 });
    let n = 0;
    while (g.trial && n < 6) {
      const r = playRound(g, { engine: 'quick' });
      if (!g.player.injury && !r.injured) expect(r.result.started).toBe(true);
      n++;
    }
    expect(g.trial).toBeNull();
    expect(n).toBeGreaterThanOrEqual(BALANCE.startClub.trialGames);
    expect(n).toBeLessThanOrEqual(BALANCE.startClub.trialMaxGames);
    expect(g.market.free).toBe(true);
    expect(g.market.offers!.length).toBeGreaterThanOrEqual(3);
  });

  it('판정 규칙: 아주 좋음 합격, 아주 나쁨 방출, 그 사이 연장', async () => {
    const { trialVerdict } = await import('../src/startClub');
    const g = newGame({ mode: 'custom', custom: spec(16, { kind: 'youth', club: 'bur' }), seed: 'trial2', difficulty: 'normal' });
    const t = (ratings: number[], goals: number, assists: number) => ({ teamId: 'bur', games: ratings.length, ratings, goals, assists, extended: false });
    expect(trialVerdict(g, t([7.2, 7.1, 7.0], 0, 0))).toBe('pass');
    expect(trialVerdict(g, t([6.2, 6.0, 6.1], 2, 1))).toBe('pass');
    expect(trialVerdict(g, t([5.5, 5.8, 5.9], 0, 0))).toBe('fail');
    expect(trialVerdict(g, t([6.4, 6.5, 6.6], 0, 0))).toBe('extend');
    expect(['pass', 'fail']).toContain(trialVerdict(g, t([6.4, 6.5, 6.6, 6.5, 6.5], 0, 0)));
  });

  it('합격 제안: 유스 구단 연봉이 다른 팀 평균보다 낮고, 수락하면 아카데미 출신·친정 선택 태그', async () => {
    const { afterTrialMatch } = await import('../src/startClub');
    const { acceptMyOffer } = await import('../src/game');
    const g = newGame({ mode: 'custom', custom: spec(17, { kind: 'youth', club: 'sou' }), seed: 'trial3', difficulty: 'normal' });
    for (let k = 0; k < 3; k++) afterTrialMatch(g, { minutes: 90, rating: 7.5, goals: 1, assists: 0 });
    const offers = g.market.offers!;
    const own = offers.findIndex((o) => o.youth);
    expect(own).toBe(0);
    expect(offers[0]!.teamId).toBe('sou');
    const others = offers.slice(1);
    expect(others.length).toBeGreaterThanOrEqual(BALANCE.startClub.rivalOffers[0]);
    expect(offers[0]!.wage).toBeLessThan(others.reduce((t, o) => t + o.wage, 0) / others.length);
    acceptMyOffer(g, 0);
    expect(g.player.teamId).toBe('sou');
    expect(g.market.free).toBe(false);
    expect(g.player.tags.map((t) => t.id)).toEqual(['academy', 'homeChoice']);
    expect(g.player.tags[0]!.name).toBe('스테이플우드 출신');
  });

  it('소속팀 없음: 영입 제안 3개 이상, 모두 거절 불가, 수락하면 그 팀', async () => {
    const { declineOffers } = await import('../src/transfer');
    const { acceptMyOffer } = await import('../src/game');
    const g = newGame({ mode: 'custom', custom: spec(21, { kind: 'none', youthClub: 'random' }), seed: 'none1', difficulty: 'normal' });
    expect(g.player.youth?.random).toBe(true);
    expect(g.market.free).toBe(true);
    expect(g.market.offers!.length).toBeGreaterThanOrEqual(3);
    declineOffers(g);
    expect(g.market.offers!.length).toBeGreaterThanOrEqual(3);
    const to = g.market.offers![0]!.teamId;
    acceptMyOffer(g, 0);
    expect(g.player.teamId).toBe(to);
    expect(g.market.offers).toBeNull();
  });

  it('19~23세 소속팀 선택: 바로 그 팀, 유스 서사', () => {
    const g = newGame({ mode: 'custom', custom: spec(20, { kind: 'club', club: 'wat' }), seed: 'club1', difficulty: 'normal' });
    expect(g.player.teamId).toBe('wat');
    expect(g.player.youth).toEqual({ club: 'wat' });
    expect(g.trial ?? null).toBeNull();
    expect(g.market.contract.teamId).toBe('wat');
  });
});

describe('원클럽맨·영원한 <구단> (C.45 14번 기준 수정)', () => {
  it('실제 선수: 유스 = 지금 구단이고 8시즌 이상이면 영원한 <구단>, 이적하면 떨어진다', async () => {
    const { acceptOffer } = await import('../src/transfer');
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'eternal', difficulty: 'normal' });
    expect(g.player.youth).toEqual({ club: 'tot' });
    expect(g.player.tags.map((t) => t.name)).toContain('영원한 토트넘 홋스퍼');
    g.market.offers = [{ teamId: 'che', kind: 'transfer', years: 3, wage: 1000, start: 0.8, interest: 0 }];
    acceptOffer(g, 0, () => 0);
    expect(g.player.tags.some((t) => t.id === 'eternal' || t.id === 'oneClubMan')).toBe(false);
    expect(g.player.clubRun).toMatchObject({ club: 'che', first: false });
  });
  it('재계약 3번이면 원클럽맨 (유스가 다른 구단)', async () => {
    const { onRenewal } = await import('../src/startClub');
    const g = newGame({ mode: 'real', playerId: 'salah', seed: 'onec', difficulty: 'normal' });
    expect(g.player.tags).toEqual([]);
    for (let k = 0; k < 3; k++) onRenewal(g);
    expect(g.player.tags.map((t) => t.id)).toEqual(['oneClubMan']);
  });
});

describe('NPC 유스·커리어 태그 (C.45 14번)', () => {
  it('실제 선수 유스는 경력 표, 생성 선수는 id 로 늘 같고, 시즌 끝에 새 태그가 뉴스로', async () => {
    const { npcYouth, npcCareerTag } = await import('../src/npcTags');
    const { playSeasonQuick } = { playSeasonQuick: (g: ReturnType<typeof newGame>) => { while (g.phase === 'season') playRound(g, { engine: 'quick' }); } };
    const g = newGame({ mode: 'real', playerId: 'son', seed: 'npc-tags', difficulty: 'normal' });
    expect(npcYouth(g, { id: 'rashford', real: true })).toBe('mun');
    const v = g.rosters.liv!.players.find((p) => !p.real)!;
    expect(npcYouth(g, v)).toBe(npcYouth(g, v));
    const rash = g.rosters.mun!.players.find((p) => p.id === 'rashford')!;
    expect(npcCareerTag(g, rash, 'mun')).toBeNull(); // 2015 입단 → 2018 4시즌
    const messiLike = g.rosters.tot!.players.find((p) => p.id === 'kane');
    if (messiLike) expect(npcCareerTag(g, messiLike, 'tot')).toBe('영원한 토트넘 홋스퍼');
    playSeasonQuick(g);
    expect(Array.isArray(g.tagNews)).toBe(true);
  });
});
