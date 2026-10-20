import { describe, expect, it } from 'vitest';
import { MY_ID, MyMatchRun, playMyMatch } from '../src/engine/adapter';
import { ENGINE } from '../src/engine/config';
import { bestOption, intentShot, type Moment, type MomentPolicy } from '../src/engine/moments';
import type { Candidate } from '../src/engine/onball';
import { tacticsOf } from '../src/engine/tactics';
import { newGame, roundMatch, selectableRealPlayers } from '../src/game';
import { posGroup } from '../src/roster';
import { PATCH_LABEL, STAGE_LABEL } from '../src/version';

const startedRound = (grp: string) => {
  const p = selectableRealPlayers().find((x) => posGroup(x.position) === grp)!;
  const g = newGame({ mode: 'real', playerId: p.id, seed: `c75k-${p.id}`, difficulty: 'normal' });
  return roundMatch(g, { cards: false });
};

/** 화면 경기를 끝까지: 결정은 모두 맡기고, 하프타임은 tactics(null = 변경 없음) */
function playScreen(input: ReturnType<typeof startedRound>['input'], tactics: Parameters<MyMatchRun['halftime']>[0]) {
  const run = new MyMatchRun({ ...input, control: { mode: 'direct', stop: 'important' } });
  let halftimes = 0;
  for (let m = run.advance(); m; m = run.advance()) {
    if (m.type === 'halftime') {
      halftimes++;
      expect(m.options.length).toBe(0);
      run.halftime(tactics);
    } else run.resolve('delegate');
  }
  return { out: run.finish(), halftimes, run };
}

describe('C.75k 하프타임 전술 변경', () => {
  it('직접 모드 화면은 전반 끝에 한 번 멈추고, "변경 없음"은 정지 없는 같은 경기(맡기기 정책)와 결과가 같다', () => {
    for (const grp of ['ST', 'CB']) {
      const rm = startedRound(grp);
      const screen = playScreen(rm.input, null);
      expect(screen.halftimes).toBe(1);
      const pol = playMyMatch({ ...rm.input, control: { mode: 'direct', stop: 'important', policy: () => 'delegate' } });
      expect(screen.out.engine.homeGoals).toBe(pol.engine.homeGoals);
      expect(screen.out.engine.awayGoals).toBe(pol.engine.awayGoals);
      expect(screen.out.result.rating).toBe(pol.result.rating);
      expect(JSON.stringify(screen.out.engine.events)).toBe(JSON.stringify(pol.engine.events));
      expect(screen.out.engine.decisions.some((d) => d.scene === 'halftime')).toBe(false);
      // 카드 없는 경기에서 맡기기 = 자동 (C.75a 와 같은 비교)
      const auto = playMyMatch({ ...rm.input });
      expect(pol.result.rating).toBe(auto.result.rating);
      expect(pol.engine.homeGoals).toBe(auto.engine.homeGoals);
    }
  });

  it('자동 모드·정책 있는 직접 모드는 하프타임에 멈추지 않는다', () => {
    const rm = startedRound('CM');
    const auto = new MyMatchRun({ ...rm.input });
    expect(auto.advance()).toBeNull();
    const seen: Moment['type'][] = [];
    const pol: MomentPolicy = (m) => {
      seen.push(m.type);
      return 'delegate';
    };
    playMyMatch({ ...rm.input, control: { mode: 'direct', stop: 'all', policy: pol } });
    expect(seen.includes('halftime')).toBe(false);
  });

  it('전술을 바꾸면 후반 내 팀 전술(설정·현재)이 바뀌고 결정 기록에 한 줄', () => {
    const rm = startedRound('ST');
    const t = tacticsOf('gegenpress', { lineHeight: 2, pressing: 2, style: 2, width: 2 });
    const run = new MyMatchRun({ ...rm.input, control: { mode: 'direct', stop: 'important' } });
    let m = run.advance();
    while (m && m.type !== 'halftime') {
      run.resolve('delegate');
      m = run.advance();
    }
    expect(m?.type).toBe('halftime');
    const s = run.sim.state;
    run.halftime(t, '하프타임 전술 변경 · 테스트');
    expect(s.teams[run.side].setup.tactics).toEqual(t);
    expect(s.teams[run.side].tactics).toEqual(t);
    expect(s.moments.pending).toBeNull();
    expect(s.moments.log.at(-1)!.label).toBe('하프타임 전술 변경 · 테스트');
    expect(s.half).toBe(2);
    const out = run.finish();
    expect(out.engine.decisions.some((d) => d.scene === 'halftime')).toBe(true);
  });
});

describe('C.75k 몰고 가다 슛', () => {
  it('선택지: 표시 확률 = 몰고 가기 성공 × 도착점 xG × 할인, 4번째 줄, 봇이 고르면 다음 결정에서 슛', () => {
    const rm = startedRound('ST');
    let shown = 0;
    let picked = 0;
    let times: number[] = [];
    const pol: MomentPolicy = (m) => {
      const i = m.options.findIndex((o) => o.chain);
      if (i < 0) return bestOption(m);
      shown++;
      const o = m.options[i]!;
      expect(i).toBe(m.options.length - 1);
      expect(o.action).toBe('carry');
      expect(o.label).toBe('몰고 가다 슛');
      expect(o.p!).toBeLessThanOrEqual(o.chain!.p * ENGINE.moments.carryShootDiscount + 0.006);
      expect(o.value).toBeGreaterThanOrEqual(ENGINE.moments.shotKeepXg - 1e-9);
      picked++;
      times.push(m.t);
      return i;
    };
    let followed = 0;
    for (let k = 0; k < 6 && followed === 0; k++) {
      times = [];
      const out = playMyMatch({ ...rm.input, seed: rm.input.seed + k, control: { mode: 'direct', stop: 'all', policy: pol } });
      // 둘째 단: 고른 뒤 의도 시간(+ 반응) 안에 내 슛
      for (const t of times) if (out.engine.events.some((e) => e.type === 'shot' && e.players[0] === MY_ID && e.t > t && e.t <= t + ENGINE.moments.carryShootWindow + 1)) followed++;
    }
    expect(shown).toBeGreaterThan(0);
    expect(picked).toBe(shown);
    expect(followed).toBeGreaterThan(0);
  });

  it('의도: 시간이 지나거나 팀 소유가 바뀌면 버리고, 살아 있으면 가장 좋은 슛 후보', () => {
    const shot = (p: number): Candidate => ({ type: 'shoot', p, u: 0, x: 0, y: 0, receiver: -1, value: p });
    const pass: Candidate = { type: 'pass', p: 0.9, u: 1, x: 0, y: 0, receiver: 3, value: 0.2 };
    const a = { idx: 5, intent: { type: 'shoot', until: 12, poss: 7 } } as never as Parameters<typeof intentShot>[1];
    const s = { t: 11, possStartT: 7, ball: { owner: 5 } } as never as Parameters<typeof intentShot>[0];
    expect(intentShot(s, a, [pass, shot(0.1), shot(0.2)])!.p).toBe(0.2);
    expect(intentShot(s, a, [pass])).toBeNull();
    expect(intentShot({ ...s, possStartT: 9 } as typeof s, a, [shot(0.1)])).toBeNull();
    expect(a.intent).toBeNull();
  });
});

describe('C.75k 버전', () => {
  it('PATCH_LABEL · STAGE_LABEL', () => {
    expect(PATCH_LABEL).toMatch(/^C\.\d+[a-z]*$/); // 다음 패치가 덮어씀 (C.75t 병합)
    expect(STAGE_LABEL).toMatch(/^\d+단계$/);
  });
});
