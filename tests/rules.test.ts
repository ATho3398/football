import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { MY_ID, playMyMatch, toMatchResult } from '../src/engine/adapter';
import { ENGINE } from '../src/engine/config';
import { effectiveTactics } from '../src/engine/offball';
import { attackDir, L, W } from '../src/engine/pitch';
import { checkAdvantage, foul, isOffside, offsideRisk } from '../src/engine/referee';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createMatch, createState, step } from '../src/engine/sim';
import type { SimState } from '../src/engine/state';
import type { EngineInput } from '../src/engine/types';
import { newGame, playRound } from '../src/game';
import { createTeamRoster } from '../src/roster';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'rules-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'rules-a', 2018, []);
const input = (seed: number, extra: Partial<EngineInput> = {}): EngineInput => ({
  home: teamSetupFromRoster(home, 75, 75),
  away: teamSetupFromRoster(away, 75, 75),
  mode: 'auto', difficulty: 'normal', seed, bigMatch: false, ...extra,
});

/** 킥오프 직후 상태 (리스타트 처리까지) */
function liveState(seed = 1): SimState {
  const s = createState(input(seed));
  while (s.restart || s.ball.owner < 0) step(s);
  return s;
}

describe('퇴장과 수적 열세 (E.10)', () => {
  it('퇴장하면 10명, 같은 줄 간격을 다시 나누고 전술이 바뀐다 (열세 라인/압박 −0.15, 우세 +0.05)', () => {
    // 강제 퇴장 1장만 보도록 경기 중 자연 퇴장(직접 레드, 두 번째 경고)은 이 테스트에서 끈다
    const R = ENGINE.referee as { redShare: number; secondYellow: number };
    const saved = { redShare: R.redShare, secondYellow: R.secondYellow };
    R.redShare = 0;
    R.secondYellow = 0;
    try {
      forcedRed();
    } finally {
      Object.assign(R, saved);
    }
  });
});

/** 10분에 홈 팀 미드필더 1명 강제 퇴장 뒤 인원·전술·대형 점검 */
function forcedRed(): void {
  const s = createState(input(3, { forceRed: { team: 0, minute: 10 } }));
  while (s.t < 10 * 60 + 1) step(s);
  const onPitch = (team: 0 | 1) => s.agents.filter((a) => a.onPitch && a.team === team);
  expect(onPitch(0)).toHaveLength(10);
  expect(onPitch(1)).toHaveLength(11);
  expect(s.teams[0].stats.reds).toBe(1);
  const base0 = s.teams[0].tactics;
  const base1 = s.teams[1].tactics;
  expect(effectiveTactics(s, 0).lineHeight).toBeCloseTo(Math.max(0, base0.lineHeight - ENGINE.referee.shortLine), 6);
  expect(effectiveTactics(s, 0).pressing).toBeCloseTo(Math.max(0, base0.pressing - ENGINE.referee.shortPress), 6);
  expect(effectiveTactics(s, 1).lineHeight).toBeCloseTo(Math.min(1, base1.lineHeight + ENGINE.referee.extraLine), 6);
  // 퇴장한 줄(미드)의 y 슬롯이 균등하다
  const mids = onPitch(0).filter((a) => a.line === 2).map((a) => a.sy).sort((x, y) => x - y);
  const gaps = mids.slice(1).map((y, i) => y - mids[i]!);
  for (const g of gaps) expect(g).toBeCloseTo(gaps[0]!, 6);
  while (!s.done) step(s);
  expect(s.agents.filter((a) => a.onPitch && a.team === 0).length).toBeLessThanOrEqual(10);
}

describe('오프사이드 (E.10)', () => {
  it('상대 진영에서 공과 뒤에서 두 번째 수비수보다 앞이면 오프사이드, 스로인/골킥/코너 직후 첫 패스는 면제', () => {
    const s = liveState(5);
    const team = 0 as const;
    const dir = attackDir(team, s.half);
    const passer = s.agents.find((a) => a.team === team && a.line === 2)!;
    const receiver = s.agents.find((a) => a.team === team && a.line === 3)!;
    const defenders = s.agents.filter((a) => a.team === 1);
    // 수비수 전부 상대 골에서 20 m (GK 는 골라인)
    const at = (nx: number) => (dir > 0 ? nx * L : (1 - nx) * L);
    for (const d of defenders) d.x = d.line === 0 ? at(0.99) : at(0.8);
    passer.x = at(0.5);
    s.ball.x = passer.x;
    receiver.x = at(0.85);
    receiver.y = W / 2;
    expect(isOffside(s, passer, receiver)).toBe(true);
    expect(offsideRisk(s, passer, receiver)).toBeGreaterThanOrEqual(0);
    receiver.x = at(0.78);
    expect(isOffside(s, passer, receiver)).toBe(false);
    // 자기 진영이면 면제
    receiver.x = at(0.45);
    expect(isOffside(s, passer, receiver)).toBe(false);
    receiver.x = at(0.85);
    s.exemptPass = true;
    expect(isOffside(s, passer, receiver)).toBe(false);
  });
});

describe('파울과 어드밴티지 (E.10)', () => {
  it('피해 팀 박스 안 파울은 PK, 공을 갖지 못한 팀이 당한 파울은 프리킥', () => {
    const s = liveState(7);
    const owner = s.agents[s.ball.owner]!;
    const victimTeam = owner.team;
    const fouler = s.agents.find((a) => a.onPitch && a.team !== victimTeam && a.line !== 0)!;
    const dir = attackDir(victimTeam, s.half);
    const boxX = dir > 0 ? L - 8 : 8;
    expect(foul(s, fouler, owner, boxX, W / 2)).toBe(true);
    expect(s.restart?.type).toBe('penalty');
    expect(s.restart?.team).toBe(victimTeam);
    expect(s.teams[fouler.team].stats.fouls).toBe(1);
  });

  it('어드밴티지 보류 중 4초 안에 소유를 잃으면 원래 위치 프리킥, 4초가 지나면 그대로 진행', () => {
    const s = liveState(9);
    const owner = s.agents[s.ball.owner]!;
    s.advantage = { t: s.t, team: owner.team, x: 50, y: 30, card: null, fouler: s.agents.find((a) => a.team !== owner.team)!.idx, value: 0.1 };
    s.possTeam = (1 - owner.team) as 0 | 1;
    checkAdvantage(s);
    expect(s.advantage).toBeNull();
    expect(s.restart).toMatchObject({ type: 'freeKick', team: owner.team });

    const s2 = liveState(9);
    const o2 = s2.agents[s2.ball.owner]!;
    s2.advantage = { t: s2.t - ENGINE.referee.advantageWindow - 0.5, team: o2.team, x: 50, y: 30, card: 'yellow', fouler: s2.agents.find((a) => a.team !== o2.team)!.idx, value: 0.1 };
    checkAdvantage(s2);
    expect(s2.advantage).toBeNull();
    expect(s2.restart).toBeNull();
    // 카드는 다음 중단 때
    expect(s2.pendingCards).toHaveLength(1);
  });

  it('경기 기록: 파울/카드/오프사이드/어드밴티지 이벤트 수가 통계와 같고 교체는 팀당 3명 이하', () => {
    for (const seed of [21, 22, 23]) {
      const r = createMatch(input(seed)).runToEnd();
      for (const team of [0, 1] as const) {
        const ev = (type: string) => r.events.filter((e) => e.type === type && e.team === team);
        const t = r.teamStats[team];
        expect(ev('foul').length).toBe(t.fouls);
        expect(ev('offside').length).toBe(t.offsides);
        expect(ev('advantage').length).toBe(t.advantages);
        expect(ev('card').filter((e) => e.params?.card === 'yellow').length).toBe(t.yellows);
        expect(ev('sub').length).toBeLessThanOrEqual(3);
      }
      for (const p of r.players) {
        expect(p.rating).toBeGreaterThanOrEqual(3);
        expect(p.rating).toBeLessThanOrEqual(10);
        expect(p.minutes).toBeLessThanOrEqual(90);
      }
    }
  });
});

describe('내 선수 출전 구간과 어댑터 (E.14, E.16)', () => {
  const base = {
    myRoster: home, oppRoster: away, myRating: 75, oppRating: 75, home: true,
    me: { position: 'ST' as const, attributes: home.players.find((p) => p.position === 'ST')!.attributes!, fatigue: 0, form: 0 },
    difficulty: 'normal' as const, seed: 77, worldSeed: 'w',
  };

  it('선발 90분 / 70분 교체 투입 / 30분 부상 교체 아웃', () => {
    const full = playMyMatch({ ...base, plan: { started: true, minutes: { start: 0, end: 90 } } });
    expect(full.my?.minutes).toBe(90);
    expect(full.result).toMatchObject({ started: true, minutes: 90 });
    const sub = playMyMatch({ ...base, plan: { started: false, minutes: { start: 70, end: 90 } } });
    // 교체 투입 뒤 퇴장당하면 그 시점까지만 뛴다
    const red = sub.engine.events.find((e) => e.type === 'card' && e.players[0] === MY_ID && e.params?.card === 'red');
    expect(sub.my!.minutes).toBeGreaterThanOrEqual(red ? Math.floor(red.t / 60) - 71 : 15);
    expect(sub.my!.minutes).toBeLessThanOrEqual(red ? Math.ceil(red.t / 60) - 69 : 25);
    const hurt = playMyMatch({ ...base, plan: { started: true, minutes: { start: 0, end: 30 } } });
    expect(hurt.my!.minutes).toBeGreaterThanOrEqual(28);
    expect(hurt.my!.minutes).toBeLessThanOrEqual(33);
    const none = playMyMatch({ ...base, plan: { started: false, minutes: null } });
    expect(none.my).toBeNull();
    expect(none.result).toMatchObject({ minutes: 0, rating: null, xp: BALANCE.matchXp.bench });
    expect(none.engine.players.find((p) => p.id === MY_ID)).toBeUndefined();
  });

  it('toMatchResult: 스코어/결과/평점/MOM/XP 를 기존 형식으로', () => {
    const out = playMyMatch({ ...base, plan: { started: true, minutes: { start: 0, end: 90 } } });
    const r = toMatchResult(out.engine, 0, true, 'normal');
    expect(r.goalsFor).toBe(out.engine.homeGoals);
    expect(r.goalsAgainst).toBe(out.engine.awayGoals);
    expect(r.outcome).toBe(r.goalsFor > r.goalsAgainst ? 'win' : r.goalsFor < r.goalsAgainst ? 'loss' : 'draw');
    expect(r.rating).toBe(out.my!.rating);
    expect(r.goals).toBe(out.my!.goals);
    expect(r.mom).toBe(r.rating! >= BALANCE.rating.momMin && r.outcome !== 'loss');
    const away = toMatchResult(out.engine, 1, true, 'normal');
    expect(away.goalsFor).toBe(out.engine.awayGoals);
  });
});

describe('playRound 엔진 연결 (E3)', () => {
  it('기본은 엔진 경기: 요약이 남고 순위표에 반영된다, 빠른 경기 옵션은 요약이 없다', () => {
    const g = newGame({ mode: 'prospect', position: 'CM', seed: 'e3', difficulty: 'normal' });
    const rep = playRound(g);
    expect(rep.engine).toBeDefined();
    expect(rep.engine!.possession).toBeGreaterThan(0);
    const row = g.league.table.find((r) => r.teamId === g.player.teamId)!;
    expect(row.played).toBe(1);
    expect(row.gf).toBe(rep.result.goalsFor);
    const quick = playRound(g, { engine: 'quick' });
    expect(quick.engine).toBeUndefined();
  });

  it('출장 정지: 다음 경기는 결장하고 훈련 XP 만, 정지는 1경기 소모', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'ban', difficulty: 'normal' });
    g.player.suspended = 1;
    const rep = playRound(g);
    expect(rep).toMatchObject({ suspended: true, result: { minutes: 0, rating: null } });
    expect(rep.result.xp).toBe(Math.round(BALANCE.matchXp.bench * BALANCE.difficulty.normal.xp));
    expect(g.player.suspended).toBe(0);
  });

  it('엔진으로 여러 라운드 연속 진행 (피로는 이동 거리에서, 기록 누적)', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'e3-run', difficulty: 'normal' });
    for (let i = 0; i < 6; i++) playRound(g);
    expect(g.league.round).toBe(6);
    expect(g.league.table.every((r) => r.played === 6)).toBe(true);
    const s = g.player.season;
    expect(s.apps).toBeGreaterThan(0);
    expect(s.ratingSum / s.apps).toBeGreaterThan(4);
    expect(g.player.fatigue).toBeGreaterThanOrEqual(0);
    expect(g.player.fatigue).toBeLessThan(BALANCE.fatigue.max);
  });
});
