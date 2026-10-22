// C.62 (35단계 5-1): 감독 신뢰도·면담·감독 데이터, 이적 요청 신뢰도 훅, 태그 5-1 효과, 시즌 기록 이름, 티어 배지
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { MANAGERS } from '../data/managers';
import { dayPlan, endDay, isMatchDay, newGame, playOthers, playRound, SAVE_FORMAT_VERSION, type GameState } from '../src/game';
import {
  addTrust, afterMyMatch, competition, ensureManager, holdMeeting, managerDayEnd, meetingDue, meetingOptions, renewalTrust, scaleDelta, startChance,
  startTrust, trainingXpMul, trustTerm, type MatchTrustInput,
} from '../src/manager';
import { requestEligibility } from '../src/transfer';
import { deserialize, SaveFormatError, serialize } from '../src/save';
import { teamDetailVM } from '../src/ui/detailVM';
import { competitionVM, meetingVM } from '../src/ui/managerVM';
import { competitionSection, meetingView } from '../src/ui/views/manager';
import { homeVM, scorersVM } from '../src/ui/viewModels';
import { homeView } from '../src/ui/views/home';
import { teamDetailView } from '../src/ui/views/detail';
import type { PlayerTag } from '../src/tags';
import { slotsOf } from '../src/formations';

const M = BALANCE.manager;
const base = (o: Partial<MatchTrustInput> = {}): MatchTrustInput => ({
  minutes: 90, started: true, rating: 6.5, goals: 0, assists: 0, outcome: 'draw', yellows: 0, red: false, injured: false, suspended: false, slotOvr: 80, bestOvr: 80, ...o,
});

function toMatchDay(g: GameState): void {
  for (let i = 0; i < 40 && !isMatchDay(g); i++) {
    playOthers(g, 'quick');
    endDay(g);
  }
}

const tag = (id: PlayerTag['id'], club?: string): PlayerTag => ({ id, perm: true, season: 2018, ...(club ? { club } : {}) });

describe('감독 데이터 (C.62, C.53 남은 질문 1)', () => {
  it('PL 20팀 모두 감독·성향·홈구장, 팀 상세에 나온다', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c62-data', difficulty: 'normal' });
    for (const t of g.league.teams) expect(MANAGERS[t.id]?.nameKo).toBeTruthy();
    const vm = teamDetailVM(g, 'liv')!;
    expect(vm.manager).toEqual({ name: '위르겐 클롭', style: '주전 고정', stadium: '안필드' });
    expect(teamDetailView(vm, 'overview', true)).toContain('감독 위르겐 클롭');
  });
});

describe('감독 신뢰도 (18.2)', () => {
  it('새 팀 시작 40~60, 친정 선택 +5, 팀이 바뀌면 다시 시작', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c62-start', difficulty: 'normal' });
    const t0 = startTrust(g, g.player.teamId);
    expect(t0).toBeGreaterThanOrEqual(M.startMin);
    expect(t0).toBeLessThanOrEqual(M.startMax + M.styles.youthStart);
    g.player.tags.push(tag('homeChoice', g.player.teamId));
    expect(startTrust(g, g.player.teamId)).toBe(Math.min(100, t0 + M.tags.homeChoiceStart));
    ensureManager(g).trust = 90;
    g.player.teamId = g.league.teams.find((t) => t.id !== g.player.teamId)!.id;
    expect(ensureManager(g).trust).toBeLessThanOrEqual(M.startMax + M.tags.homeChoiceStart);
  });

  it('경기 뒤: 평점·골·도움·승패·경고·퇴장, 교체 절반, 부상·정지·벤치는 변화 없음', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c62-delta', difficulty: 'normal' });
    g.player.teamId = 'ars'; // 실용 감독 (성향 배율 없음)
    const m = ensureManager(g);
    const run = (x: Partial<MatchTrustInput>) => { m.trust = 50; afterMyMatch(g, base(x)); return Math.round((m.trust - 50) * 10) / 10; };
    expect(run({ rating: 7.4 })).toBe(2);
    expect(run({ rating: 5.8, outcome: 'loss' })).toBe(-3);
    expect(run({ rating: 7.0, goals: 2, assists: 1, outcome: 'win' })).toBe(2 + 3 + 1);
    expect(run({ goals: 3, assists: 2 })).toBe(M.involvementMax);
    expect(run({ red: true, yellows: 1 })).toBe(-5);
    expect(run({ yellows: 1 })).toBe(-1);
    expect(run({ started: false, minutes: 20, rating: 7.5 })).toBe(1);
    expect(run({ injured: true, rating: 9 })).toBe(0);
    expect(run({ suspended: true })).toBe(0);
    expect(run({ minutes: 0, started: false, rating: null })).toBe(0);
    // 감독 기억 감쇠: 90 → 무난한 경기 → 50 쪽으로
    m.trust = 90;
    afterMyMatch(g, base());
    expect(m.trust).toBeCloseTo(90 - 40 * M.reversion, 5);
    expect(m.log.at(-1)?.why).toBe('무난한 경기');
  });

  it('태그·감독 성향 배율: 문제아 ×1.2, 원클럽맨 ×0.8, 영원한 ×0.7, 컬트 히어로 ×1.1, 엄격 ×1.25, 주전 고정 ×0.8', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c62-scale', difficulty: 'normal' });
    g.player.teamId = 'ars';
    g.player.tags = [];
    expect(scaleDelta(g, -10)).toBe(-10);
    g.player.tags = [tag('troublemaker')];
    expect(scaleDelta(g, -10)).toBeCloseTo(-12);
    g.player.tags = [tag('oneClubMan', 'ars')];
    expect(scaleDelta(g, -10)).toBeCloseTo(-8);
    g.player.tags = [tag('eternal', 'ars')];
    expect(scaleDelta(g, -10)).toBeCloseTo(-7);
    g.player.tags = [tag('cultHero', 'ars')];
    expect(scaleDelta(g, 10)).toBeCloseTo(11);
    expect(scaleDelta(g, -10)).toBe(-10);
    g.player.tags = [tag('cultHero', 'che')];
    expect(scaleDelta(g, 10)).toBe(10);
    g.player.tags = [];
    g.player.teamId = 'mun';
    expect(scaleDelta(g, -10)).toBeCloseTo(-12.5);
    g.player.teamId = 'liv';
    expect(scaleDelta(g, 10)).toBeCloseTo(8);
  });

  it('감독 불화 민감: 신뢰도가 떨어진 경기 다음 경기 폼 −', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c62-sens', difficulty: 'normal' });
    g.player.tags.push(tag('managerSensitive'));
    afterMyMatch(g, base({ rating: 5, outcome: 'loss' }));
    expect(ensureManager(g).upset).toBe(true);
    afterMyMatch(g, base({ rating: 7.5, outcome: 'win' }));
    expect(ensureManager(g).upset).toBe(false);
  });

  it('선발 확률: 신뢰도가 높을수록 오르고, 선호 슬롯 보장 = 1, 주전 보장 = 최소 85%', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c62-chance', difficulty: 'normal' });
    const m = ensureManager(g);
    const rating = 75;
    m.trust = 10;
    const lo = startChance(g, 72, rating, 0);
    m.trust = 95;
    const hi = startChance(g, 72, rating, 0);
    expect(hi).toBeGreaterThan(lo);
    expect(trustTerm(100) - trustTerm(0)).toBeCloseTo(6);
    m.trust = 10;
    m.perks.start = 3;
    expect(startChance(g, 50, rating, 0)).toBe(M.meeting.startFloor);
    m.perks.slot = 2;
    expect(startChance(g, 50, rating, 0)).toBe(1);
    // 출전 경기마다 줄어든다
    afterMyMatch(g, base());
    expect(m.perks).toMatchObject({ start: 2, slot: 1 });
  });

  it('주전 경쟁: 나 + 경쟁자 2명 선발 점수 (NPC 신뢰도 60)', () => {
    const g = newGame({ mode: 'real', playerId: 'son', seed: 'c62-comp', difficulty: 'normal' });
    const rows = competition(g, 'ST', 2);
    expect(rows).toHaveLength(3);
    expect(rows.filter((r) => r.me)).toHaveLength(1);
    for (const r of rows.filter((x) => !x.me)) expect(r.trust).toBeCloseTo(trustTerm(M.npcTrust), 5);
    expect(rows[0]!.total).toBeGreaterThanOrEqual(rows[2]!.total);
  });
});

describe('감독 면담 (18.3)', () => {
  it('낮은 신뢰: 30 미만 14일 → 열림, 더 노력하겠다 = +5 · 훈련 XP ×1.2 · 오늘 휴식', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c62-low', difficulty: 'normal' });
    toMatchDay(g);
    playOthers(g, 'quick');
    playRound(g, { engine: 'quick' });
    const m = ensureManager(g);
    m.trust = 20;
    for (let d = 0; d < M.meeting.lowDays + 1 && !m.meeting; d++) {
      if (isMatchDay(g)) playRound(g, { engine: 'quick' });
      else { playOthers(g, 'quick'); endDay(g); }
      m.trust = 20;
      managerDayEnd(g);
    }
    expect(m.meeting).toBe('low');
    const opts = meetingOptions(g, 'low', requestEligibility(g, true));
    expect(opts.map((o) => o.id)).toEqual(['effort', 'request', 'complain']);
    while (isMatchDay(g)) playRound(g, { engine: 'quick' });
    const vm = meetingVM(g)!;
    expect(vm.kind).toBe('low');
    const html = meetingView(vm, 'effort');
    expect(html).toContain('감독 면담');
    expect(html).toContain('data-act="meet-ok"');
    const r = holdMeeting(g, 'effort');
    expect(r.title).toBeTruthy();
    expect(m.trust).toBe(25);
    expect(m.meeting).toBeNull();
    expect(dayPlan(g)).toBe('rest');
    expect(trainingXpMul(g, g.calendar.date)).toBe(M.meeting.effortXp);
    // 쿨다운 동안 다시 열리지 않는다
    managerDayEnd(g);
    expect(meetingDue(g)).not.toBe('low');
  });

  it('보상 면담: 신뢰도 80+ 반 시즌 한 번, 선호 슬롯·카드 선택권·주전 보장', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c62-reward', difficulty: 'normal' });
    const m = ensureManager(g);
    m.trust = 85;
    managerDayEnd(g);
    expect(m.meeting).toBe('reward');
    const picks = g.cards.picks.length;
    holdMeeting(g, 'card');
    expect(g.cards.picks.length).toBe(picks + 1);
    managerDayEnd(g);
    expect(m.meeting).toBeNull();
    // 다음 반 시즌에는 다시
    g.league.round = M.meeting.midRound;
    managerDayEnd(g);
    expect(m.meeting).toBe('reward');
    holdMeeting(g, 'slot');
    expect(m.perks.slot).toBe(M.meeting.slotGames);
  });

  it('포지션 제안: 최고 포지션보다 5 이상 낮은 슬롯으로 3경기 → 따르면 내 위치 이동 · 신뢰도 +3', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c62-pos', difficulty: 'normal' });
    const m = ensureManager(g);
    // 수비 자리로 옮겨 뛴 것으로
    const cb = slotsOf(g.tactics.formation, g.tactics.custom).findIndex((x) => x.pos === 'CB');
    expect(cb).toBeGreaterThanOrEqual(0);
    g.tactics = { ...g.tactics, mySlot: cb };
    for (let k = 0; k < M.meeting.posGames; k++) afterMyMatch(g, base({ slotOvr: 60, bestOvr: 80 }));
    managerDayEnd(g);
    expect(m.meeting).toBe('position');
    const before = m.trust;
    holdMeeting(g, 'follow');
    expect(competitionVM(g)!.pos).not.toMatch(/^(CB|LB|RB)$/);
    expect(m.trust).toBe(Math.min(100, before + M.meeting.posTrust));
  });
});

describe('이적 요청 신뢰도 훅 (C.42 requestEligibility)', () => {
  it('신뢰도 35 미만이면 요청 가능, 면담에서는 신뢰도와 상관없이', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c62-req', difficulty: 'normal' });
    toMatchDay(g);
    playOthers(g, 'quick');
    playRound(g, { engine: 'quick' });
    const m = ensureManager(g);
    m.trust = 60;
    expect(requestEligibility(g).ok).toBe(false);
    expect(requestEligibility(g, true).ok).toBe(true);
    m.trust = 30;
    const el = requestEligibility(g);
    expect(el.ok).toBe(true);
    expect(el.reason).toContain('감독 신뢰도');
  });

  it('재계약 보정: 저니맨·신뢰도 낮음은 실패 확률 +, 높음은 실패를 뒤집을 수 있음 (판정 받는 선수만)', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c62-renew', difficulty: 'normal' });
    ensureManager(g).trust = 50;
    expect(renewalTrust(g, false)).toBe(false);
    let fails = 0;
    for (let s = 0; s < 200; s++) {
      g.league.season = 2018 + s;
      g.player.tags = [tag('journeyman')];
      ensureManager(g).trust = 20;
      if (renewalTrust(g, false)) fails++;
    }
    expect(fails / 200).toBeGreaterThan(0.2);
    expect(fails / 200).toBeLessThan(0.5);
  });
});

describe('화면·세이브 (C.62)', () => {
  it('홈 주전 경쟁 카드 · 면담 띠 문구 · 세이브 왕복 · 옛 세이브(31)는 이어 할 수 없음', () => {
    const g = newGame({ mode: 'real', playerId: 'son', seed: 'c62-ui', difficulty: 'normal' });
    for (let r = 0; r < 2; r++) {
      toMatchDay(g);
      playOthers(g, 'quick');
      playRound(g, { engine: 'quick' });
    }
    const vm = competitionVM(g)!;
    expect(vm.rows).toHaveLength(3);
    expect(vm.log.length).toBeGreaterThan(0);
    const html = homeView(homeVM(g), '', competitionSection(vm));
    expect(html).toContain('주전 경쟁 · ');
    expect(html).toContain('감독 신뢰도');
    expect(html).toContain('선발 확률');
    addTrust(g, 5, '테스트');
    const back = deserialize(serialize(g));
    expect(back.saveFormat).toBe(SAVE_FORMAT_VERSION);
    expect(SAVE_FORMAT_VERSION).toBe(57);
    expect(back.manager).toEqual(g.manager);
    // 옛 세이브(31)는 이어 할 수 없음
    const old = JSON.parse(serialize(g));
    old.saveFormat = 31;
    expect(() => deserialize(JSON.stringify(old))).toThrow(SaveFormatError);
  });

  it('시즌 기록 이름 (pending 96 ④): 리그를 떠난 선수도 이름으로', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c62-names', difficulty: 'normal' });
    for (let r = 0; r < 3; r++) {
      toMatchDay(g);
      playOthers(g, 'engine');
      playRound(g, { engine: 'quick' });
    }
    const top = scorersVM(g, 50).find((s) => !s.me)!;
    expect(top).toBeTruthy();
    expect(g.statNames?.[top.id]?.[0]).toBe(top.name);
    // 리그를 떠난 것처럼 로스터에서 뺀다
    for (const r of Object.values(g.rosters)) r.players = r.players.filter((p) => p.id !== top.id);
    const again = scorersVM(g, 50).find((s) => s.id === top.id)!;
    expect(again.name).toBe(top.name);
    expect(again.name).not.toBe(top.id);
  });
});

describe('버전 (C.62)', () => {
  it('부록 C 소절 · 단계 형식 (C.63부터는 그 패치 테스트에서 값)', async () => {
    const { PATCH_LABEL, STAGE_LABEL } = await import('../src/version');
    expect(PATCH_LABEL).toMatch(/^C\.\d+[a-z]?$/);
    expect(STAGE_LABEL).toMatch(/^\d+[a-z]?단계$/);
  });
});
