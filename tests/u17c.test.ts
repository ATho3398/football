// U17-c (C.83c): 17차 S08 경기 준비 · S09 결정 순간 · 하프타임 — 화면 숫자가 엔진과 같은 함수인지 (2절 6·7·10·11번)
import { afterEach, describe, expect, it } from 'vitest';
import { endDay, isMatchDay, newGame, nextFixture, playOthers, type GameState } from '../src/game';
import { teamById } from '../src/league';
import { npcInjuredOut, teamSetupFromRoster } from '../src/engine/setup';
import { fitGaps } from '../src/engine/fit';
import { ENGINE } from '../src/engine/config';
import { prepVM } from '../src/ui/prepVM';
import { prepView } from '../src/ui/views/prep';
import { attackOf, matchupOf, tacticFitPts } from '../src/ui/prepNumbers';
import { riskLevel, shownChance, shownEv } from '../src/ui/momentNumbers';
import { halftimeVM } from '../src/ui/viewModels';
import { halftimeView } from '../src/ui/views/tactics';
import { tendencyLevels } from '../src/engine/tactics';
import { setWideForTest } from '../src/ui/skin';
import { dock } from '../src/ui/views/common';
import type { MomentOption } from '../src/engine/moments';

afterEach(() => setWideForTest(null));
const toMatchDay = (g: GameState) => { while (g.phase === 'season' && !isMatchDay(g)) { playOthers(g, 'quick'); endDay(g); } };

describe('S08 경기 준비 — 상대 예상 계획 · 상성 = 엔진 (2절 11번)', () => {
  it('예상 계획 성향 = 엔진이 상대 팀을 세울 때(teamSetupFromRoster aiAdapt) 쓰는 성향', () => {
    for (const seed of ['u17c-a', 'u17c-b', 'u17c-c', 'u17c-d']) {
      const g = newGame({ mode: 'real', playerId: 'son', seed, difficulty: 'normal' });
      toMatchDay(g);
      const fx = nextFixture(g)!;
      const vm = prepVM(g)!;
      const L = g.league;
      const opp = teamById(L, fx.opponentId);
      const my = teamById(L, g.player.teamId);
      const leagueAvg = L.teams.reduce((t, x) => t + x.rating, 0) / L.teams.length;
      const setup = teamSetupFromRoster(g.rosters[opp.id]!, opp.rating, my.rating, g.worldSeed, npcInjuredOut(g.rosters[opp.id]!, undefined), leagueAvg, true);
      expect(vm.oppPlan!.tendency).toBe(setup.tactics.tendency);
      // 상성은 상대 기본 성향이 아니라 예상 계획으로
      expect(vm.matchup!.oppName).toBe(vm.oppPlan!.name);
    }
  });
  it('상성 칸 = ENGINE.matchup 표 (우리 → 상대, 상대 → 우리)', () => {
    // 값은 엔진 표에서 읽는다 (표가 바뀌어도 화면 = 표)
    const KO: Record<string, string> = { long: '롱패스', air: '공중볼', touch: '퍼스트 터치', short: '짧은 패스', keep: '공 지키기', run: '돌파', tackle: '태클' };
    const sgn = (v: number) => (v > 0 ? `\\+${v}` : `−${-v}`);
    const row = (ENGINE.matchup.tikitaka?.direct ?? {}) as Record<string, number>;
    const back = (ENGINE.matchup.direct?.tikitaka ?? {}) as Record<string, number>;
    const m = matchupOf('tikitaka', 'direct');
    for (const [k, v] of Object.entries(row)) if (v) expect(m.mine).toMatch(new RegExp(`${KO[k]}[^+−]*${sgn(v)}`));
    for (const [k, v] of Object.entries(back)) if (v) expect(m.theirs).toMatch(new RegExp(`${KO[k]}[^+−]*${sgn(v)}`));
    const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
    expect(m.tone).toBe(sum(row) > sum(back) ? 'up' : sum(row) < sum(back) ? 'down' : 'flat');
    expect(matchupOf('balanced', 'balanced')).toMatchObject({ mine: null, theirs: null, tone: 'flat' });
  });
  it('적합도 = 엔진 fitOnly 식(gain × fitGaps, ±cap) · 균형·블록은 보정 없음', () => {
    const g = newGame({ mode: 'real', playerId: 'son', seed: 'u17c-fit', difficulty: 'normal' });
    const players = g.rosters[g.player.teamId]!.players.filter((p) => p.position !== 'GK').slice(0, 10).map((p) => ({ pos: p.position, attrs: p.attributes! }));
    const gap = fitGaps(players).direct;
    expect(tacticFitPts('direct', players)).toBe(Math.round(Math.max(-16, Math.min(16, ENGINE.tacticFit.gain.direct.long * gap))));
    expect(tacticFitPts('balanced', players)).toBeNull();
    expect(tacticFitPts('block', players)).toBeNull();
  });
  it('공격 인원: 기준(stackCap.n) 이상이면 경고', () => {
    expect(attackOf(['GK', 'CB', 'CB', 'LB', 'RB', 'CM', 'CM', 'CDM', 'LW', 'RW', 'ST']).warn).toBe(false);
    const w = attackOf(['GK', 'CB', 'CB', 'LB', 'CM', 'CAM', 'CAM', 'LW', 'RW', 'ST', 'ST']);
    expect(w.n).toBeGreaterThanOrEqual(ENGINE.stackCap.n);
    expect(w.warn).toBe(true);
  });
  it('화면: 머리말 = 선발 가능성 % · 예상 계획 · 상성 · 경기 변수 · 정지 빈도 3단계 · 덱 격자 · PC 3열', () => {
    const g = newGame({ mode: 'real', playerId: 'son', seed: 'u17c-view', difficulty: 'normal' });
    toMatchDay(g);
    const vm = prepVM(g)!;
    const h = prepView(vm);
    expect(h).toContain('선발 가능성 ·');
    expect(h).toContain('예상 계획 ·');
    expect(h).toContain('상성 · 우리');
    expect(h).toContain('경기 변수');
    for (const l of ['모든 순간', '중요한 순간만', '결정적 순간만']) expect(h).toContain(l);
    expect(h).toContain('prep-v17');
    expect(h).not.toContain('prep-pc3');
    setWideForTest(true);
    expect(prepView(vm)).toContain('prep-pc3');
  });
  it('독 [다음] = 경기 (경기 준비): 라임 면 없음(is-flat) · [경기 시작]과 같은 동작', () => {
    const h = dock({ screen: 'prep', prog: { label: '경기', icon: 'match', act: 'prep-start', kind: 'match', flat: true }, tacticsOpen: true, points: 0, more: false });
    expect(h).toContain('is-flat');
    expect(h).toContain('data-act="prep-start"');
  });
});

const opt = (o: Partial<MomentOption>): MomentOption => ({ kind: 'balanced', action: 'cross', label: 'x', success: '', fail: '', up: 0, down: 0, p: 0.5, value: 0, to: { x: 0, y: 0 }, ref: 0, ...o }) as MomentOption;

describe('S09 결정 순간 — 위험 등급 · 기대 평점 (2절 6·7번)', () => {
  it('위험 등급 = 실패 시 내림만: ≤0.02 낮음 · 0.03~0.05 보통 · >0.05 높음', () => {
    expect(riskLevel(opt({ down: -0.02 }))).toBe('low');
    expect(riskLevel(opt({ down: -0.04 }))).toBe('mid'); // 디자인 "백패스 −0.04 낮음" 은 보통
    expect(riskLevel(opt({ down: -0.05 }))).toBe('mid');
    expect(riskLevel(opt({ down: -0.06 }))).toBe('high');
    expect(riskLevel(opt({ down: -0.01, p: 0.05 }))).toBe('low'); // 확률과 무관
    expect(riskLevel(opt({ p: null }))).toBeNull();
  });
  it('기대 평점 = p × 성공 + (1 − p) × 실패 (크로스 13% +0.11 / −0.01 → +0.01, 디자인 +0.06 아님)', () => {
    const cross = opt({ p: 0.13, up: 0.11, down: -0.01 });
    expect(shownChance(cross)).toBe(13);
    expect(shownEv(cross)).toBe(0.01);
  });
});

describe('S09-g 하프타임 — 성향 적합도 · 공격 인원 경고 · 주 버튼', () => {
  const base = { tendency: 'gegenpress' as const, levels: tendencyLevels('gegenpress') };
  const draft = { ...base, levels: { ...base.levels }, set: 0 };
  const g = newGame({ mode: 'real', playerId: 'son', seed: 'u17c-ht', difficulty: 'normal' });
  const on = g.rosters[g.player.teamId]!.players.filter((p) => p.position !== 'GK').slice(0, 10).map((p) => ({ pos: p.position, attrs: p.attributes! }));
  it('성향 6칸마다 적합도 · 바뀐 게 없으면 주 버튼 = [변경 없이 후반]', () => {
    const vm = halftimeVM(draft, base, ['A', 'B'], [0, 0], 0, on);
    expect(vm.tendencies.every((t) => t.fit)).toBe(true);
    expect(vm.tendencies.find((t) => t.id === 'balanced')!.fit).toBe('보정 없음');
    const h = halftimeView(vm);
    expect(h.match(/class="ht-fit/g)!.length).toBe(6);
    expect(h).toMatch(/po-btn--primary[^>]*data-act="ht-keep"|data-act="ht-keep"[^>]*>.*변경 없이 후반/);
  });
  it('공격 6명 이상이면 경고 줄', () => {
    const atk = on.map((p, i) => ({ ...p, pos: (i < 6 ? 'ST' : p.pos) as typeof p.pos }));
    const vm = halftimeVM(draft, base, ['A', 'B'], [0, 0], 0, atk);
    expect(vm.attackWarn).toContain('공격 인원');
    expect(halftimeView(vm)).toContain('ht-warn');
  });
});
