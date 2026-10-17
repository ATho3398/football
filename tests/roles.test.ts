// E3.7 역할 확장 (E.21, 부록 C.33): 역할 31개, 공용 움직임 모듈, 포메이션 3종 + 커스텀, 시그니처 카드 데이터, 세이브 12 → 13
import { describe, expect, it } from 'vitest';
import { myMatchPosition, newGame, playRound, SAVE_FORMAT_VERSION } from '../src/game';
import { buildMyMatch, MY_ID } from '../src/engine/adapter';
import {
  cellPos, customLabel, customProblem, customSlots, FORMATION_SLOTS, FORMATIONS, nearestCell, presetCells,
} from '../src/formations';
import { formationLabel, moveSlot, previewLineup, slotPos, startCustom, validTactics, withFormation } from '../src/myTactics';
import { deserialize, serialize } from '../src/save';
import { LEGACY_ROLE_IDS, ROLE_KEYS, ROLE_NAMES_KO, ROLE_OPTIONS, ROLES } from '../src/engine/roles';
import { SIGNATURE_CARDS } from '../src/signatureCards';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createTeamRoster, rosterRating } from '../src/roster';
import { tacticsVM } from '../src/ui/viewModels';
import { tacticsView } from '../src/ui/views/tactics';

const game = (pos: 'ST' | 'CM' | 'CB' = 'ST', seed = 'roles') => newGame({ mode: 'prospect', position: pos, seed, difficulty: 'normal' });

describe('역할 31개 (E.6, E.21 1번)', () => {
  it('포지션군별 역할 수: 윙 5, ST 4, CAM 5, CM 5, CDM 4, 풀백 4, CB 4 = 31', () => {
    const ids = Object.entries(ROLE_OPTIONS).filter(([g]) => g !== 'GK').flatMap(([, xs]) => xs);
    expect(ids).toHaveLength(31);
    expect(new Set(ids).size).toBe(31);
    for (const id of ids) {
      expect(ROLES[id]).toBeDefined();
      expect(ROLE_NAMES_KO[id]).toBeTruthy();
      expect(ROLE_KEYS[id]).toHaveLength(3);
    }
  });

  it('모듈: ① 빈 공간 라움도이터·프리롤·섀도, ② 줄 사이 펄스 나인·하프백·리베로·인버티드 풀백, ③④ 크랙형 윙어·엔간체·레지스타', () => {
    const has = (m: string) => Object.values(ROLES).filter((r) => r.modules.includes(m as never)).map((r) => r.id).sort();
    expect(has('space')).toEqual(['freeRole', 'raumdeuter', 'shadowStriker']);
    expect(has('between')).toEqual(['falseNine', 'halfBack', 'invertedFullback', 'libero']);
    expect(has('demand')).toEqual(['crackWinger', 'enganche', 'regista']);
    expect(has('exempt')).toEqual(['crackWinger', 'enganche', 'freeRole', 'regista']);
  });

  it('시그니처 카드 31장은 역할마다 1장, 모두 희귀, 10경기 해금 (데이터만)', () => {
    expect(SIGNATURE_CARDS).toHaveLength(31);
    expect(new Set(SIGNATURE_CARDS.map((c) => c.role)).size).toBe(31);
    for (const c of SIGNATURE_CARDS) {
      expect(ROLES[c.role]).toBeDefined();
      expect(c.rarity).toBe('rare');
      expect(c.unlockMatches).toBe(10);
    }
  });
});

describe('포메이션 8종과 커스텀 (E.5, E.5.1)', () => {
  it('프리셋 8종, 슬롯 11개, GK 1명', () => {
    expect(FORMATIONS).toHaveLength(8);
    for (const f of FORMATIONS) {
      expect(FORMATION_SLOTS[f]).toHaveLength(11);
      expect(FORMATION_SLOTS[f].filter((s) => s.pos === 'GK')).toHaveLength(1);
    }
  });

  it('격자 칸 포지션: 최전방 측면 칸은 없고, 2선 중앙은 CF, 수비형 미드 측면은 윙백', () => {
    expect(cellPos(5 * 5 + 2)).toBe('ST');
    expect(nearestCell(0.72, 0.1)).not.toBe(25);
    expect(cellPos(4 * 5 + 2)).toBe('CF');
    expect(cellPos(1 * 5 + 0)).toBe('LWB');
    expect(cellPos(3 * 5 + 4)).toBe('RW');
  });

  it('프리셋을 칸으로 옮기면 배치 규칙을 지키고 포지션이 대체로 같다', () => {
    for (const f of FORMATIONS) {
      const cells = presetCells(f);
      expect(customProblem(cells)).toBeNull();
      const same = customSlots(cells).filter((s, i) => s.pos === FORMATION_SLOTS[f][i]!.pos).length;
      expect(same).toBeGreaterThanOrEqual(9);
    }
    expect(customLabel(presetCells('4-4-2'))).toBe('4-4-2');
  });

  it('배치 규칙: 수비 3명 미만, 같은 칸 2명, 공격 0명은 안 된다', () => {
    const c = presetCells('4-3-3');
    expect(customProblem([...c.slice(0, 1), 12, ...c.slice(2)])).toBeNull();
    const twoDef = presetCells('3-4-3').map((x, i) => (i === 1 ? 12 : x));
    expect(customProblem(twoDef)).toContain('수비');
    const dup = c.map((x, i) => (i === 2 ? c[3]! : x));
    expect(customProblem(dup)).toContain('한 칸');
    const noAtt = c.map((x, i) => (i === 8 ? 16 : i === 9 ? 17 : i === 10 ? 18 : x));
    expect(customProblem(noAtt)).toContain('공격');
  });

  it('끌어다 놓기: 빈 칸이면 옮기고, 다른 선수 칸이면 서로 바꾸고, 규칙을 어기면 그대로', () => {
    const g = game('ST');
    const t0 = withFormation(g.tactics, '4-3-3');
    const t = startCustom(t0);
    const st = t.custom!.indexOf(27);
    expect(st).toBeGreaterThan(0);
    // ST 를 2선 중앙(CF)으로
    const moved = moveSlot(t, st, 22);
    expect(moved.problem).toBeNull();
    expect(slotPos(moved.tactics, st)).toBe('CF');
    // 서로 바꾸기 (LW ↔ RW)
    const lw = t.custom!.findIndex((c) => cellPos(c) === 'LW');
    const rw = t.custom!.findIndex((c) => cellPos(c) === 'RW');
    const sw = moveSlot(t, lw, t.custom![rw]!);
    expect(sw.tactics.custom![rw]).toBe(t.custom![lw]);
    // 수비 3명 미만이 되면 막는다 (CB 둘을 공격형 미드로)
    const cb = t.custom!.findIndex((c, i) => i > 0 && cellPos(c) === 'CB');
    const one = moveSlot(t, cb, 17);
    expect(one.problem).toBeNull();
    const cb2 = one.tactics.custom!.findIndex((c, i) => i > 0 && cellPos(c) === 'CB');
    const bad = moveSlot(one.tactics, cb2, 16);
    expect(bad.problem).toContain('수비');
    expect(bad.tactics).toBe(one.tactics);
    expect(validTactics(moved.tactics)).toBe(true);
    expect(formationLabel(moved.tactics)).toContain('커스텀');
  });

  it('커스텀 대형으로 경기를 치르고 내 선수는 그 칸 포지션으로 뛴다', () => {
    const g = game('ST', 'roles-custom');
    const t = startCustom(withFormation(g.tactics, '4-3-3'));
    const st = t.custom!.indexOf(27);
    g.tactics = { ...moveSlot(t, st, 22).tactics, mySlot: st };
    expect(myMatchPosition(g)).toBe('CF');
    const lineup = previewLineup(g.tactics, g.rosters[g.player.teamId]!, { name: '나', attrs: g.player.attributes });
    expect(lineup[st]!.pos).toBe('CF');
    const fx = g.league.schedule[0]!.find((f) => f.home === g.player.teamId || f.away === g.player.teamId)!;
    const sim = buildMyMatch({
      myRoster: g.rosters[g.player.teamId]!, oppRoster: g.rosters[fx.home === g.player.teamId ? fx.away : fx.home]!, myRating: 75, oppRating: 75, home: true,
      me: { position: 'ST', attributes: g.player.attributes, fatigue: 0, form: 0 }, plan: { started: true, minutes: { start: 0, end: 90 } },
      difficulty: 'normal', seed: 5, worldSeed: g.worldSeed, myTactics: g.tactics,
    });
    const me = sim.state.agents.find((a) => a.id === MY_ID)!;
    expect(me.pos).toBe('CF');
    expect(me.line).toBe(3);
    const r = sim.runToEnd();
    expect(r.homeGoals + r.awayGoals).toBeGreaterThanOrEqual(0);
    playRound(g);
  });

  it('전술 화면: 커스텀 탭과 편집 버튼, 편집 중 슬롯은 끌 수 있다', () => {
    const g = game('ST');
    const draft = startCustom(g.tactics);
    g.guide.tacticsDetailOpen = true;
    const vm = tacticsVM(g, { draft, pickMe: false, sheet: null, sheetPick: null, edit: true, moving: null });
    expect(vm.formation).toBe('custom');
    expect(vm.formations.at(-1)!.id).toBe('custom');
    const html = tacticsView(vm);
    expect(html).toContain('data-drag=');
    expect(html).toContain('편집 끝');
    expect(html).toContain('is-edit');
  });
});

describe('세이브 12 → 13 (E.21 1번)', () => {
  it('예전 역할 id 는 새 이름으로, 커스텀은 없음', () => {
    expect(SAVE_FORMAT_VERSION).toBe(25);
    const g = game('CM', 'roles-mig');
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 12;
    delete raw.tactics.custom;
    raw.tactics.roles = raw.tactics.roles.map((_: unknown, i: number) => (i === 9 ? 'linkUp' : i === 6 ? 'advanced8' : i === 1 ? 'invertedFullback' : null));
    const back = deserialize(JSON.stringify(raw));
    expect(back.tactics.custom).toBeNull();
    expect(back.tactics.roles[9]).toBe(LEGACY_ROLE_IDS.linkUp);
    expect(back.tactics.roles[6]).toBe('mezzala');
    expect(back.tactics.roles[1]).toBe('invertedFullback');
  });

  it('예전 역할 id 로 만든 엔진 입력도 새 역할로 읽는다', () => {
    const r = createTeamRoster({ id: 'vx', rating: 75 }, 'w', 2018, []);
    const setup = teamSetupFromRoster(r, rosterRating(r), 75);
    setup.lineup[9]!.role = 'linkUp';
    const s = createMatch({ home: setup, away: teamSetupFromRoster(r, rosterRating(r), 75), mode: 'auto', difficulty: 'normal', seed: 1, bigMatch: false });
    expect(s.state.agents[9]!.role.id).toBe('falseNine');
  });
});
