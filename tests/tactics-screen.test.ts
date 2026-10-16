// 전술 설정과 저장 (E.19, E3.6, 부록 C.32)
import { describe, expect, it } from 'vitest';
import { myMatchPosition, newGame, playRound, SAVE_FORMAT_VERSION } from '../src/game';
import { buildMyMatch, MY_ID } from '../src/engine/adapter';
import { FORMATION_SLOTS } from '../src/formations';
import {
  customized, defaultSlot, fitOf, migratedTactics, previewLineup, slotPos, teamDefaultTactics, teamRoles, validTactics, withFormation, withTendency,
} from '../src/myTactics';
import { deserialize, serialize } from '../src/save';
import { LEVELS, tendencyLevels } from '../src/engine/tactics';
import { TEAM_TACTICS } from '../src/engine/teamData';
import { isUnlocked } from '../src/unlocks';
import { tacticsVM } from '../src/ui/viewModels';
import { tacticsView } from '../src/ui/views/tactics';

const game = (pos: 'ST' | 'CM' | 'CB' = 'ST', seed = 'tac') => newGame({ mode: 'prospect', position: pos, seed, difficulty: 'normal' });

describe('내 팀 전술 기본값 (E.19 저장)', () => {
  it('새 게임은 팀 데이터 전술(성향·포메이션) + 주 포지션 슬롯', () => {
    const g = game('CM');
    const data = TEAM_TACTICS[g.player.teamId];
    expect(g.tactics.formation).toBe(data?.formation ?? g.rosters[g.player.teamId]!.formation);
    expect(g.tactics.tendency).toBe(data?.tendency ?? 'balanced');
    expect(myMatchPosition(g)).toBe('CM');
    expect(g.tactics.levels).toEqual(tendencyLevels(g.tactics.tendency));
    expect(validTactics(g.tactics)).toBe(true);
  });

  it('주 포지션이 포메이션에 없으면 같은 포지션군, 없으면 가장 가까운 슬롯', () => {
    expect(FORMATION_SLOTS['4-4-2'][defaultSlot('4-4-2', 'LW')]!.pos).toBe('LM');
    expect(FORMATION_SLOTS['4-4-2'][defaultSlot('4-4-2', 'CAM')]!.pos).not.toBe('GK');
    expect(FORMATION_SLOTS['3-5-2'][defaultSlot('3-5-2', 'LB')]!.pos).toBe('LWB');
  });

  it('포메이션을 바꾸면 내 슬롯은 같은 포지션으로 옮기고 역할은 추천으로', () => {
    const g = game('ST');
    const t = withFormation({ ...g.tactics, formation: '4-4-2', mySlot: 9, roles: g.tactics.roles.map((_, i) => (i === 9 ? 'targetMan' : null)) }, '4-3-3');
    expect(slotPos(t, t.mySlot)).toBe('ST');
    expect(t.roles.every((r) => r === null)).toBe(true);
  });

  it('성향 바꾸기: 기본값으로 / 성향만', () => {
    const g = game();
    const t = { ...g.tactics, levels: { ...g.tactics.levels, width: 0 as const }, roles: g.tactics.roles.map((_, i) => (i === 1 ? 'coverCB' : null)) };
    expect(customized(t).roles).toBe(1);
    const reset = withTendency(t, 'block', true);
    expect(reset.levels).toEqual(tendencyLevels('block'));
    expect(customized(reset)).toEqual({ details: 0, roles: 0 });
    const keep = withTendency(t, 'block', false);
    expect(keep.roles[1]).toBe('coverCB');
  });

  it('적합도: 리그 평균 +3 이상 잘 맞음, −3 이하 안 맞음, 균형은 보통', () => {
    expect(fitOf(75, 71)).toBe('good');
    expect(fitOf(68, 71)).toBe('bad');
    expect(fitOf(72, 71)).toBe('ok');
    expect(fitOf(null, null)).toBe('ok');
  });
});

describe('엔진 연결 (E.19 ②③)', () => {
  it('내 선수는 고른 슬롯에, 성향·세부 전술 값과 슬롯 역할이 그대로 들어간다', () => {
    const g = game('ST');
    const roster = g.rosters[g.player.teamId]!;
    const t = { ...withFormation(g.tactics, '4-3-3', roster), tendency: 'counter' as const, levels: { lineHeight: 0, pressing: 2, style: 1, width: 2 } as const };
    const cm = FORMATION_SLOTS['4-3-3'].findIndex((s) => s.pos === 'CM');
    t.mySlot = cm;
    t.roles = t.roles.map((_, i) => (i === cm ? 'advanced8' : i === 1 ? 'invertedFullback' : null));
    const opp = Object.keys(g.rosters).find((id) => id !== g.player.teamId)!;
    const sim = buildMyMatch({
      myRoster: roster, oppRoster: g.rosters[opp]!, myRating: 75, oppRating: 75, home: true,
      me: { position: 'ST', attributes: g.player.attributes, fatigue: 0, form: 0 }, plan: { started: true, minutes: { start: 0, end: 90 } },
      difficulty: 'normal', seed: 1, worldSeed: g.worldSeed, myTactics: t,
    });
    const home = sim.state.input.home;
    expect(home.formation).toBe('4-3-3');
    expect(home.tactics).toMatchObject({ tendency: 'counter', lineHeight: LEVELS.lineHeight[0], pressing: LEVELS.pressing[2], style: LEVELS.style[1], width: LEVELS.width[2] });
    const me = home.lineup.find((p) => p.id === MY_ID)!;
    expect(me.slot).toBe(cm);
    expect(me.position).toBe('CM');
    expect(me.role).toBe('advanced8');
    expect(home.lineup.find((p) => p.slot === 1)!.role).toBe('invertedFullback');
    // 역할을 고르지 않은 슬롯은 성향 추천 (역습 CB = 커버 CB)
    const cb = home.lineup.find((p) => p.position === 'CB')!;
    expect(cb.role).toBe('coverCB');
  });

  it('주 포지션 밖 슬롯이면 그 포지션 OVR 로 선발 판정하고 경기 목록에 그 포지션으로 남는다', () => {
    const g = game('ST', 'off-slot');
    g.tactics = { ...g.tactics, mySlot: FORMATION_SLOTS[g.tactics.formation].findIndex((s) => s.pos === 'CB') };
    const before = g.player.proficiency.CB;
    const r = playRound(g);
    expect(r.ovr).toBeLessThan(g.player.attributes ? 60 : 0);
    expect(g.matchLog[0]!.position).toBe('CB');
    if (r.result.minutes > 0) expect(g.player.proficiency.CB).toBeGreaterThan(before);
  });
});

describe('추천 역할 (부록 C.32)', () => {
  it('티키타카 투톱이면 연계형은 한 명만, 다른 ST 는 능력치 기본 역할', () => {
    const g = game('CM');
    const t = { ...g.tactics, tendency: 'tikitaka' as const, formation: '4-4-2' as const, mySlot: 6, roles: Array(11).fill(null) };
    const a = g.player.attributes;
    const roles = teamRoles(t, FORMATION_SLOTS['4-4-2'].map((s) => (s.pos === 'GK' ? undefined : a)));
    expect(roles.filter((r) => r === 'linkUp')).toHaveLength(1);
    // 직접 고르면 둘 다 연계형도 된다
    const both = teamRoles({ ...t, roles: t.roles.map((_, i) => (i === 9 || i === 10 ? 'linkUp' : null)) }, FORMATION_SLOTS['4-4-2'].map((s) => (s.pos === 'GK' ? undefined : a)));
    expect(both.filter((r) => r === 'linkUp')).toHaveLength(2);
  });
});

describe('세이브 (SAVE_FORMAT_VERSION 12)', () => {
  it('전술이 저장되고 다시 불러온다', () => {
    const g = game();
    g.tactics = { ...g.tactics, tendency: 'block', levels: { lineHeight: 0, pressing: 0, style: 2, width: 0 } };
    const back = deserialize(serialize(g));
    expect(back.tactics).toEqual(g.tactics);
    expect(SAVE_FORMAT_VERSION).toBe(12);
  });

  it('11 → 12: 균형 + 팀 데이터 포메이션 + 주 포지션 슬롯', () => {
    const g = game('CM', 'mig');
    const raw = JSON.parse(serialize(g));
    delete raw.tactics;
    raw.saveFormat = 11;
    const back = deserialize(JSON.stringify(raw));
    expect(back.tactics).toEqual(migratedTactics(g.player.teamId, back.rosters[g.player.teamId], 'CM'));
    expect(back.tactics.tendency).toBe('balanced');
    const hasCm = FORMATION_SLOTS[back.tactics.formation].some((s) => s.pos === 'CM');
    expect(myMatchPosition(back)).toBe(hasCm ? 'CM' : FORMATION_SLOTS[back.tactics.formation][defaultSlot(back.tactics.formation, 'CM')]!.pos);
  });

  it('잘못된 전술 값은 기본값으로 고친다', () => {
    const g = game();
    const raw = JSON.parse(serialize(g));
    raw.tactics = { ...raw.tactics, mySlot: 0 };
    expect(deserialize(JSON.stringify(raw)).tactics.mySlot).not.toBe(0);
  });
});

describe('전술 화면 (I.16, 21.3)', () => {
  it('3경기 뒤 열리고, 기본은 성향만, "자세히"를 펼치면 포메이션·역할·세부 전술', () => {
    const g = game();
    for (let i = 0; i < 3; i++) playRound(g, { engine: 'quick' });
    expect(isUnlocked(g.guide, 'tactics')).toBe(true);
    const ui = { draft: structuredClone(g.tactics), pickMe: false, sheet: null, sheetPick: null };
    const closed = tacticsView(tacticsVM(g, ui));
    expect(closed).toContain('전술 성향');
    expect(closed).not.toContain('③ 세부 전술');
    g.guide.tacticsDetailOpen = true;
    const vm = tacticsVM(g, { ...ui, sheet: 1 });
    expect(vm.slots).toHaveLength(11);
    expect(vm.slots.filter((s) => s.me)).toHaveLength(1);
    expect(vm.sheet?.options.length).toBeGreaterThan(1);
    const open = tacticsView(vm);
    expect(open).toContain('③ 세부 전술');
    expect(open).toContain('역할 고르기');
    expect(vm.dirty).toBe(false);
    expect(tacticsVM(g, { ...ui, draft: { ...ui.draft, levels: { ...ui.draft.levels, width: ui.draft.levels.width === 0 ? 1 : 0 } } }).dirty).toBe(true);
  });

  it('미리보기 라인업: 내 슬롯에 내 선수, 나머지는 OVR 순 자동', () => {
    const g = game('ST');
    const lu = previewLineup(g.tactics, g.rosters[g.player.teamId]!, { name: g.player.name, attrs: g.player.attributes });
    expect(lu[g.tactics.mySlot]!.me).toBe(true);
    expect(lu[g.tactics.mySlot]!.name).toBe(g.player.name);
    expect(lu.filter((s) => s.playerId).length).toBe(10);
  });

  it('팀 데이터 전술과 이전 세이브 변환은 성향만 다르다', () => {
    const g = game();
    const r = g.rosters[g.player.teamId];
    const a = teamDefaultTactics(g.player.teamId, r, 'ST');
    const b = migratedTactics(g.player.teamId, r, 'ST');
    expect(a.formation).toBe(b.formation);
    expect(a.mySlot).toBe(b.mySlot);
  });
});

describe('조사 (으)로', () => {
  it('받침 있으면 으로, 없거나 ㄹ이면 로', async () => {
    const { roJosa } = await import('../src/ui/views/common');
    expect(roJosa('자동')).toBe('으로');
    expect(roJosa('골잡이')).toBe('로');
    expect(roJosa('타겟맨')).toBe('으로');
    expect(roJosa('직선(롱볼)')).toBe('으로');
    expect(roJosa('수비 블록')).toBe('으로');
    expect(roJosa('티키타카')).toBe('로');
    expect(roJosa('스타일')).toBe('로');
  });
});
