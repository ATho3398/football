// C.77s (pending 145 A): 소극적 백패스 평점 감점 · 위험 감수 실패 완화 · 결정 카드 기대 평점
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { optionValue, type MomentOption } from '../src/engine/moments';
import { passivePreview, type Candidate } from '../src/engine/onball';
import { ratingDelta, ratingParts, type RatingParts } from '../src/engine/rating';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createMatch } from '../src/engine/sim';
import { attackDir } from '../src/engine/pitch';
import { createTeamRoster } from '../src/roster';
import { ChoiceButton } from '../src/ui/components/match';

const R = ENGINE.rating;
const base: RatingParts = {
  group: 'CB', passes: 0, forward: 0, keyPasses: 0, onTarget: 0, goals: 0, assists: 0, dribbles: 0, tackles: 0, interceptions: 0, aerials: 0,
  lost: 0, dangerLost: 0, attackLost: 0, fouls: 0, offsides: 0, yellows: 0, red: 0, conceded: 0, saves: 0, cleanSheet: 0, result: 0,
};

function match(seed = 1000) {
  const home = createTeamRoster({ id: 'h', rating: 75 }, 'c77s-h', 2018, []);
  const away = createTeamRoster({ id: 'a', rating: 75 }, 'c77s-a', 2018, []);
  return createMatch({ home: teamSetupFromRoster(home, 75, 75), away: teamSetupFromRoster(away, 75, 75), mode: 'auto', difficulty: 'normal', seed, bigMatch: false });
}

describe('C.77s 평점 규칙', () => {
  it('소극적 백패스: 가중 합 × passive, 경기 최대 passiveMax', () => {
    expect(ratingDelta({ ...base, passive: 1.5 }) - ratingDelta(base)).toBeCloseTo(1.5 * R.passive, 6);
    expect(ratingDelta({ ...base, passive: 40 }) - ratingDelta(base)).toBeCloseTo(R.passiveMax, 6);
    // 횟수(passiveN)는 측정용, 식에 안 들어간다
    expect(ratingDelta({ ...base, passiveN: 5 })).toBe(ratingDelta(base));
  });

  it('위험 감수 실패는 lost × riskLostFactor, 공격 1/3·위험 지역과 겹치지 않는다', () => {
    const plain = ratingDelta({ ...base, lost: 2 });
    const risk = ratingDelta({ ...base, lost: 2, riskLost: 1 });
    expect(risk - plain).toBeCloseTo(-R.lost * (1 - R.riskLostFactor), 6);
    expect(R.riskLostFactor).toBe(0.5);
  });

  it('엔진 경기: 소극적 백패스를 세고, 허용 횟수를 넘긴 선수만 감점된다 (선택은 그대로)', () => {
    // C.80g(엔진 68, 박스 밖 땅볼 롱패스 수신 경합): 시드 1000 경기에 소극적 백패스 0회(전제 조건만 깨짐) → 시드 1008(센 선수 3 · 감점 1, 감점 분기도 지남).
    // 시드 1000~1009 센 선수 0 · 4 · 4 · 1 · 6 · 2 · 2 · 0 · 3 · 4 (scripts/diag/c80g-passive.ts)
    const m = match(1008);
    m.runToEnd();
    const s = m.state;
    const counted = s.agents.filter((a) => (a.rt.passive ?? 0) > 0);
    expect(counted.length).toBeGreaterThan(0);
    for (const a of s.agents) {
      const free = ['gegenpress', 'direct'].includes(s.teams[a.team].tactics.tendency) ? R.passiveFreeAttack : R.passiveFree;
      if ((a.rt.passiveW ?? 0) > 0) expect(a.rt.passive!).toBeGreaterThan(free);
      else expect(a.rt.passive ?? 0).toBeLessThanOrEqual(free + 0);
      const p = ratingParts(s, a, s.elapsed);
      expect(p.passive ?? 0).toBe(a.rt.passiveW ?? 0);
    }
  });

  it('2골 차 리드면 소극적 감점 미리보기 0, 압박 없는 열린 전진 패스를 두고 뒤로 가면 허용을 넘겼을 때 음수', () => {
    const m = match(1003);
    const s = m.state;
    const a = s.agents.find((x) => x.team === 0 && x.line === 2)!;
    const dir = attackDir(a.team, s.half);
    for (const o of s.agents) if (o.team !== a.team) { o.x = a.x + dir * 40; o.y = 2; }
    const back: Candidate = { type: 'pass', p: 0.95, u: 0, x: a.x - dir * 10, y: a.y, receiver: 1, value: 0 };
    const fwd: Candidate = { type: 'pass', p: 0.8, u: 0, x: a.x + dir * 12, y: a.y, receiver: 2, value: 0 };
    s.possOrigin = 'open';
    s.t = 30 * 60;
    s.teams[0].tactics = { ...s.teams[0].tactics, tendency: 'balanced', pressing: 0.5 };
    expect(passivePreview(s, a, back, [back, fwd])).toBe(0); // 허용 안
    a.rt.passive = 5;
    const pen = passivePreview(s, a, back, [back, fwd]);
    expect(pen).toBeLessThan(0);
    expect(passivePreview(s, a, back, [back, { ...fwd, p: 0.5 }])).toBe(0); // 열린 전진 패스 없음
    s.teams[0].stats.goals = 2;
    expect(passivePreview(s, a, back, [back, fwd])).toBe(0); // 2골 리드 예외
  });
});

describe('C.77s 결정 카드 기대 평점', () => {
  const o: MomentOption = { kind: 'safe', action: 'pass', label: 'x에게 백패스', p: 0.8, success: '', fail: '', up: 0.02, down: -0.04, value: 0.1, to: { x: 0, y: 0 }, ref: 0 };
  it('optionValue 에 소극적 감점이 그대로 붙는다', () => {
    expect(optionValue({ ...o, passive: -0.05 })).toBeCloseTo(optionValue(o) - 0.05, 9);
  });
  it('ChoiceButton 에 기대 평점 한 줄', () => {
    const html = ChoiceButton({ kind: 'safe', name: 'n', chance: 80, success: { text: 'a', rating: '+0.02' }, fail: { text: 'b', rating: '−0.04 · 소극적 −0.05' }, ev: '+0.06' });
    expect(html).toContain('기대 평점');
    expect(html).toContain('+0.06');
    expect(html).toContain('소극적');
  });
});
