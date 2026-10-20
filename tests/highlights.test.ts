import { describe, expect, it } from 'vitest';
import { playMyMatch } from '../src/engine/adapter';
import { averagePositions, HL, possessionSummary, selectScenes } from '../src/highlights';
import { createTeamRoster } from '../src/roster';
import { ReplayPlayer } from '../src/ui/views/replay';

const my = createTeamRoster({ id: 'h', rating: 75 }, 'hl-h', 2018, []);
const opp = createTeamRoster({ id: 'a', rating: 75 }, 'hl-a', 2018, []);
const replayOf = (seed: number) => playMyMatch({
  myRoster: my, oppRoster: opp, myRating: 75, oppRating: 75, home: true,
  me: { position: 'ST', attributes: my.players.find((p) => p.position === 'ST')!.attributes!, fatigue: 0, form: 0 },
  plan: { started: true, minutes: { start: 0, end: 90 } }, difficulty: 'normal', seed, worldSeed: 'hl',
}, { teams: ['홈', '원정'] }).replay!;

describe('전개 하이라이트 (24.3 개정)', () => {
  // C.45: 시드 91 은 엔진 20 에서 첫 장면이 공이 죽은 시간(빨리 감기)에 시작해 실제 속도 확인에 맞지 않아 92 로. C.75c(엔진 24): 같은 이유로 93
  const r = replayOf(93);
  const scenes = selectScenes(r);
  it('같은 경기면 장면 선택과 장면 시각이 늘 같다 (결정적)', () => {
    expect(selectScenes(replayOf(93))).toEqual(scenes);
    expect(selectScenes(r)).toEqual(scenes);
  });
  it('장면 6~8개, 각 10~15초, 시간 순, 같은 시간대(20초 안) 중복 없음', () => {
    expect(scenes.length).toBeGreaterThanOrEqual(HL.minScenes);
    expect(scenes.length).toBeLessThanOrEqual(HL.maxScenes);
    for (const s of scenes) {
      expect(s.end - s.start).toBeGreaterThanOrEqual(HL.minLen - 0.11);
      expect(s.end - s.start).toBeLessThanOrEqual(HL.maxLen + 0.11);
      expect(s.key).toBeGreaterThan(s.start);
      expect(s.key).toBeLessThan(s.end);
    }
    for (let i = 1; i < scenes.length; i++) expect(scenes[i]!.key - scenes[i - 1]!.key).toBeGreaterThanOrEqual(HL.gap);
  });
  it('골은 모두 장면이 되고, 상대 공격도 1개 이상 들어간다', () => {
    const goals = r.events.filter((e) => e.type === 'goal').length;
    expect(scenes.filter((s) => s.kind === 'goal')).toHaveLength(goals);
    if (r.events.some((e) => e.type === 'shot' && e.team !== r.side)) expect(scenes.some((s) => s.team !== r.side)).toBe(true);
  });
  it('재생은 실제 속도: 1× 에서 실제 1초 = 경기 1초, 장면 끝에서 전환(약 1초) 후 다음 장면 시작', () => {
    const p = new ReplayPlayer(r, () => {});
    expect(p.e).toBe(scenes[0]!.start);
    p.advance(1);
    expect(p.e).toBeCloseTo(scenes[0]!.start + 1, 6);
    p.speed = 2;
    p.advance(1);
    expect(p.e).toBeCloseTo(scenes[0]!.start + 3, 6);
    p.speed = 1;
    p.advance(scenes[0]!.end - p.e);
    expect(p.mode).toBe('transition');
    p.advance(HL.transition);
    expect(p.mode).toBe('scene');
    expect(p.e).toBe(scenes[1]!.start);
  });
  it('[여기서부터 실시간]: 장면 중이면 그 시점부터 끊김 없이 이어진다', () => {
    const p = new ReplayPlayer(r, () => {});
    p.advance(2);
    const at = p.e;
    p.goLive();
    p.advance(scenes[0]!.end - scenes[0]!.start);
    expect(p.mode).toBe('live');
    expect(p.e).toBeCloseTo(at + (scenes[0]!.end - scenes[0]!.start), 6);
  });
  it('평균 위치는 양 팀 선발 대부분, 피치 안. 점유 요약 문구', () => {
    const avg = averagePositions(r);
    expect(avg.filter((a) => a.team === 0).length).toBeGreaterThanOrEqual(10);
    expect(avg.filter((a) => a.team === 1).length).toBeGreaterThanOrEqual(10);
    for (const a of avg) {
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x).toBeLessThanOrEqual(105);
    }
    // 홈 팀 GK 는 왼쪽(자기 골), 원정 GK 는 오른쪽
    const gk = (team: 0 | 1) => avg.find((a) => a.team === team && r.players.find((p) => p.id === a.id)?.gk)!;
    expect(gk(0).x).toBeLessThan(20);
    expect(gk(1).x).toBeGreaterThan(85);
    expect(possessionSummary(r, 0, 600)).toMatch(/^10분간 우리 점유 \d+%$/);
  });
});
