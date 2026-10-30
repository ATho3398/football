// C.78o (미해결 7): 직접 모드에서 모든 결정을 "맡기기"로 넘기면(화면 경로 = 정책 없이 멈춤·재개) 같은 시드 자동 경기와 한 비트도 갈리지 않는다.
// 옛 갈림(C.44~C.75g)은 자동 경기만 결정 순간 카드(1대1 태클 카드 등)를 자동으로 써서였다 — C.75h 자동 경기 카드 금지 뒤 사라졌다.
// 그래서 비교는 카드 덱을 든 경기(roundMatch 기본)로, 1대1 수비 장면이 멈추는 CB·CM 을 넣는다.
import { describe, expect, it } from 'vitest';
import { MyMatchRun } from '../src/engine/adapter';
import { newGame, playRound, roundMatch, selectableRealPlayers } from '../src/game';
import { posGroup } from '../src/roster';

function rm(group: string, seed: string, rounds: number) {
  const p = selectableRealPlayers().find((x) => posGroup(x.position) === group)!;
  const g = newGame({ mode: 'real', playerId: p.id, seed: `${seed}-${p.id}`, difficulty: 'normal' });
  for (let r = 0; r < rounds; r++) playRound(g);
  for (let k = 0; k < 6; k++) {
    const m = roundMatch(g);
    if (m.plan.started) return m;
    playRound(g);
  }
  throw new Error('선발 경기 없음');
}

describe('직접 모드 전부 맡기기 = 자동 경기 (C.78o, 미해결 7)', () => {
  // 수정 전(C.75h 직전 커밋)에는 CB·CM 카드 경기 넷 중 넷이 갈렸다 (scripts/diag/c78o-sweep.ts)
  it.each([
    // C.78q(엔진 54): 라운드+0 경기는 1대1 수비 멈춤이 안 나와(장면 시드 의존) +2 로 — 비교 단언은 그대로
    // C.78t: 게겐 팀이면 경기 피로에 시즌 누적 피로가 더해져 +2 경기에도 멈춤이 안 나와 +4 로 (비교 단언은 그대로)
    // C.78s(엔진 55): 블록@라인 매우 낮음 = 옛 버스로 리그 궤적이 바뀌어도 +4 경기에 1대1 멈춤이 나온다(확인)
    // C.79e(엔진 59, 줄 인원 맞춤 내려앉기): +4 경기에 1대1 멈춤이 없어져 +3 으로 (+0~5 중 1대1 멈춤 +1·2·3 — +3 은 3회, 비교 단언은 그대로)
    // C.80c(엔진 63, 게겐 수신 후보 선제 마크): +3 경기에 1대1 멈춤이 없어져 +4 로 (+0·2·4·5 는 통과, +3 만 0회 — 비교 단언은 그대로)
    // C.80d(엔진 64, 카드율 2배 — 카드 지연으로 궤적이 갈림): 'all' +1 경기에 1대1 멈춤이 없어져 +0 으로 (+0·4·5 통과, +1·2·3 0회 — 비교 단언은 그대로)
    // C.80g(엔진 68, 박스 밖 땅볼 롱패스 수신 경합): +4 경기에 1대1 멈춤이 없어져 +3 으로 (+0~6 중 1대1 멈춤 +0 1회 · +3 3회, 비교 단언은 +0~6 모두 통과)
    ['CB', 'same', 3, 'important'],
    ['CB', 'same', 0, 'all'],
    ['CM', 'same', 0, 'important'],
    ['CM', 'same', 1, 'all'],
  ] as const)('%s %s 라운드+%i 정지 %s: 점수·이벤트열·선수 기록 같음', (group, seed, rounds, stop) => {
    const m = rm(group, seed, rounds);
    const auto = new MyMatchRun(m.input);
    auto.sim.runToEnd();
    const a = auto.finish().engine;
    const run = new MyMatchRun({ ...m.input, control: { mode: 'direct', stop } });
    let stops = 0;
    let duels = 0;
    while (run.advance()) {
      stops++;
      if (run.pending!.type === 'duel') duels++;
      if (run.pending!.type === 'halftime') run.halftime(null);
      else run.resolve('delegate');
    }
    const d = run.finish().engine;
    expect(stops).toBeGreaterThan(1);
    if (group === 'CB') expect(duels).toBeGreaterThan(0);
    expect([d.homeGoals, d.awayGoals]).toEqual([a.homeGoals, a.awayGoals]);
    expect(d.events).toEqual(a.events);
    expect(d.players).toEqual(a.players);
  });
});
