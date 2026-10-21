// C.74c (43단계 c): 동료 호흡(케미) · 상대 분석 리포트 · 패스 받는 빈도 — 엔진은 실행 배율(·패스 대상 선택 가중)만
import { afterEach, describe, expect, it } from 'vitest';
import { BALANCE, BALANCE_VERSION } from '../src/config/balance';
import { ENGINE_VERSION } from '../src/engine/config';
import { MY_ID, playMyMatch } from '../src/engine/adapter';
import { resolveRapport } from '../src/engine/rapport';
import { myScoutReport, newGame, playRound, roundMatch, SAVE_FORMAT_VERSION, selectableRealPlayers, type GameState } from '../src/game';
import { chemAfterMatch, chemFrac, chemPassMul, chemSeasonEnd, ensureChem, markerOf, passTargetMul, rapportInput, scoutReport, topChemMates } from '../src/rapport';
import { deserialize, migrate, serialize } from '../src/save';
import { prepVM } from '../src/ui/prepVM';
import { playerVM } from '../src/ui/viewModels';
import { prepView } from '../src/ui/views/prep';
import { playerView } from '../src/ui/views/player';
import { ChoiceButton } from '../src/ui/components';
import { PATCH_LABEL, STAGE_LABEL } from '../src/version';
import { setEnvironmentFixed } from '../src/weather';
import type { PlayerStats } from '../src/engine/types';

afterEach(() => setEnvironmentFixed(false));

const game = (seed = 'c74c') => newGame({ mode: 'real', playerId: selectableRealPlayers()[0]!.id, seed, difficulty: 'normal' });
const full = BALANCE.chemistry.fullMinutes;

/** 같은 입력, 시작부터 90분 */
function input(g: GameState, seed: number) {
  const rm = roundMatch(g);
  const i = { ...rm.input, seed, plan: { started: true, minutes: { start: 0, end: 90 } } };
  delete i.rapport;
  return i;
}
const mates = (g: GameState) => g.rosters[g.player.teamId]!.players.map((p) => p.id);
const all = (g: GameState, v: number) => Object.fromEntries(mates(g).map((id) => [id, v]));

describe('엔진 (호흡 0·관계 보통·리포트 없음 = 이전 엔진)', () => {
  it('rapport 없음 = 빈 rapport = 모두 1: 같은 시드 같은 경기', () => {
    const g = game();
    const a = playMyMatch(input(g, 21));
    const b = playMyMatch({ ...input(g, 21), rapport: {} });
    const c = playMyMatch({ ...input(g, 21), rapport: { chem: all(g, 1), toMe: all(g, 1) } });
    for (const x of [b, c]) {
      expect(x.engine.teamStats).toEqual(a.engine.teamStats);
      expect(x.my).toEqual(a.my);
    }
    expect(resolveRapport({ chem: { x: 1 }, toMe: { y: 1 } })).toBeNull();
    expect(resolveRapport(undefined)).toBeNull();
  });

  it('호흡·패스 받는 빈도·리포트는 결정적이고 기준과 다르다', () => {
    const g = game();
    const rp = { chem: all(g, chemPassMul(full)), toMe: all(g, passTargetMul(100, full)) };
    const a = playMyMatch({ ...input(g, 22), rapport: rp });
    const b = playMyMatch({ ...input(g, 22), rapport: rp });
    const base = playMyMatch(input(g, 22));
    expect(b.engine.teamStats).toEqual(a.engine.teamStats);
    expect(a.engine.teamStats).not.toEqual(base.engine.teamStats);
  });
});

describe('동료 호흡', () => {
  it('배율 1 ~ 1 + maxPass, 비율 0~1', () => {
    expect(chemPassMul(0)).toBe(1);
    expect(chemPassMul(full * 3)).toBeCloseTo(1 + BALANCE.chemistry.maxPass, 10);
    expect(chemFrac(full / 2)).toBeCloseTo(0.5, 10);
    expect(BALANCE.chemistry.maxPass).toBeLessThanOrEqual(0.04);
  });

  it('같이 뛴 분이 쌓이고, 이적하면 0, 시즌 끝에 떠난 동료는 지운다', () => {
    const g = game();
    const [m1, m2] = mates(g);
    const st = (id: string, team: 0 | 1, minutes: number) => ({ id, team, minutes }) as PlayerStats;
    chemAfterMatch(g, [st(MY_ID, 0, 60), st(m1!, 0, 90), st(m2!, 0, 30), st('opp', 1, 90)], 0, MY_ID);
    chemAfterMatch(g, [st(MY_ID, 0, 90), st(m1!, 0, 90)], 0, MY_ID);
    expect(g.chem!.mins[m1!]).toBe(150);
    expect(g.chem!.mins[m2!]).toBe(30);
    expect(g.chem!.mins.opp).toBeUndefined();
    const top = topChemMates(g);
    expect(top[0]!.id).toBe(m1);
    expect(top.length).toBeLessThanOrEqual(BALANCE.chemistry.top);
    g.chem!.mins.gone = 500;
    chemSeasonEnd(g);
    expect(g.chem!.mins.gone).toBeUndefined();
    g.player.teamId = g.league.teams.find((t) => t.id !== g.player.teamId)!.id;
    expect(Object.keys(ensureChem(g).mins)).toHaveLength(0);
  });

  it('playRound 뒤 호흡이 쌓이고 세이브 왕복, 41 세이브는 호흡 없이 43 으로', () => {
    const g = game('c74c-r');
    for (let i = 0; i < 2; i++) playRound(g);
    const back = deserialize(serialize(g));
    expect(back.chem).toEqual(g.chem);
    expect(SAVE_FORMAT_VERSION).toBe(56);
    const old = JSON.parse(serialize(g));
    old.saveFormat = 41;
    delete old.chem;
    expect(migrate(old).saveFormat).toBe(56);
  });
});

describe('패스 받는 빈도', () => {
  it('관계 보통·호흡 0 = 1, 나쁨 −10%, 좋음+호흡 최대 +10% 안', () => {
    expect(passTargetMul(BALANCE.passTarget.mid, 0)).toBe(1);
    expect(passTargetMul(0, 0)).toBeCloseTo(0.9, 10);
    expect(passTargetMul(100, full)).toBeCloseTo(1.1, 10);
    for (const t of [0, 30, 60, 90, 100]) for (const m of [0, full]) {
      const v = passTargetMul(t, m);
      expect(v).toBeGreaterThanOrEqual(0.9 - 1e-9);
      expect(v).toBeLessThanOrEqual(1.1 + 1e-9);
    }
  });
});

describe('상대 분석 리포트', () => {
  it('나를 맡을 수비수 약점 1~2개, 상대 선발 중 맞상대 자리', () => {
    const g = game();
    const opp = g.league.teams.find((t) => t.id !== g.player.teamId)!.id;
    const r = scoutReport(g.rosters[opp]!, 'ST')!;
    expect(r).not.toBeNull();
    expect(r.position).toBe(markerOf(g.rosters[opp]!, 'ST')!.position);
    expect(r.weak.length).toBeGreaterThanOrEqual(1);
    expect(r.weak.length).toBeLessThanOrEqual(2);
    expect(r.actions.length).toBeGreaterThan(0);
    expect(scoutReport(g.rosters[opp]!, 'GK')).toBeNull();
    expect(BALANCE.scouting.mul).toBeGreaterThanOrEqual(1.03);
    expect(BALANCE.scouting.mul).toBeLessThanOrEqual(1.05);
  });

  it('측정 고정이면 리포트·호흡·관계 모두 꺼지고 roundMatch 입력에 rapport 가 없다', () => {
    const g = game();
    ensureChem(g).mins[mates(g)[0]!] = full;
    expect(roundMatch(g).input.rapport).toBeDefined();
    setEnvironmentFixed(true);
    expect(roundMatch(g).input.rapport).toBeUndefined();
    expect(myScoutReport(g)).toBeNull();
    expect(rapportInput(g, g.rosters[g.player.teamId]!, null)).toBeUndefined();
  });
});

describe('화면', () => {
  it('경기 준비 상대 분석 칸 · 선수 기록 탭 호흡 좋은 동료 · 결정 순간 "약점 공략" 칩', () => {
    const g = game();
    const vm = prepVM(g)!;
    expect(vm.scout).not.toBeNull();
    expect(prepView(vm)).toContain('상대 분석');
    expect(prepView(vm)).toContain('약점 공략');
    ensureChem(g).mins[mates(g)[0]!] = 1200;
    const pv = playerVM(g);
    expect(pv.chem).toHaveLength(1);
    const html = playerView(pv, { tab: 'record', body: '', market: null, points: 0, retired: false });
    expect(html).toContain('호흡 좋은 동료');
    const btn = ChoiceButton({ act: 'x', kind: 'safe', name: '돌파', chance: 50, success: { text: 'a', rating: '+0.1' }, fail: { text: 'b', rating: '-0.1' }, exploit: true });
    expect(btn).toContain('약점 공략');
  });

  it('버전', () => {
    expect(PATCH_LABEL).toMatch(/^C\.7[4-9]/);
    expect(STAGE_LABEL).toMatch(/^4\d단계$/);
    expect(ENGINE_VERSION).toBeGreaterThanOrEqual(22);
    expect(BALANCE_VERSION).toBeGreaterThanOrEqual(53);
  });
});
