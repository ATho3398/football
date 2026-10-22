// 부록 C.44a: 이름 3종(풀네임·짧은 이름·별명), 세로 피치 좌표 변환, 화면 설정이 경기 결과에 영향 없음
import { describe, expect, it } from 'vitest';
import { A_GRADE_PLAYERS } from '../data/players';
import { newGame, playRound, SAVE_FORMAT_VERSION } from '../src/game';
import { autoShortKo, labelName, setNameOverride, shortNames, type NameOverrides } from '../src/names';
import { deserialize, SaveFormatError, serialize } from '../src/save';
import {
  attackDirOf, pitchProjection, setPitchNames, setPitchOrient, setPitchSize, markerRadius,
} from '../src/ui/pitch/renderer';
import type { ReplayFrame, ReplayPlayer } from '../src/replay';

describe('짧은 이름 (C.44a)', () => {
  it('마지막 단어, 한 단어·붙여 쓴 이름은 그대로, 반·더 접두어는 붙인다', () => {
    expect(autoShortKo('로베르트 레반도프스키')).toBe('레반도프스키');
    expect(autoShortKo('네이마르')).toBe('네이마르');
    expect(autoShortKo('손흥민')).toBe('손흥민');
    expect(autoShortKo('버질 반 다이크')).toBe('반다이크');
    expect(autoShortKo('에드윈 반 데르 사르')).toBe('반데르사르');
    expect(autoShortKo('단 더 용')).toBe('더용');
  });

  it('실제 선수 표: 통칭·한국 통용 표기', () => {
    const byId = new Map(A_GRADE_PLAYERS.map((p) => [p.id, p]));
    const m = shortNames(A_GRADE_PLAYERS);
    expect(byId.get('van-dijk')!.nameKo).toBe('버질 반 다이크');
    expect(m.get('van-dijk')).toBe('반다이크');
    expect(m.get('lewandowski')).toBe('레반도프스키');
    expect(m.get('vinicius')).toBe('비니시우스');
    expect(m.get('neymar')).toBe('네이마르');
    expect(m.get('son')).toBe('손흥민');
    expect(m.get('de-bruyne')).toBe('더브라위너');
    expect(m.get('alexander-arnold')).toBe('알렉산더아놀드');
  });

  it('흔한 이름만 첫 글자, 첫 글자도 같으면 두 글자', () => {
    const m = shortNames([
      { id: 'a', name: 'Alexis Sánchez', nameKo: '알렉시스 산체스' },
      { id: 'b', name: 'Davinson Sánchez', nameKo: '다빈손 산체스' },
      { id: 'c', name: 'Daniel Sánchez', nameKo: '다니엘 산체스' },
      { id: 'd', name: 'Robert Lewandowski', nameKo: '로베르트 레반도프스키' },
    ]);
    expect(m.get('a')).toBe('A.산체스');
    expect(m.get('b')).toBe('Da.산체스');
    expect(m.get('c')).toBe('Da.산체스'); // 두 글자도 같으면 그대로 둔다
    expect(m.get('d')).toBe('레반도프스키');
  });

  it('라벨: 별명 > 직접 고친 짧은 이름 > 자동', () => {
    const ov: NameOverrides = {};
    expect(labelName('x', '레반도프스키', '로베르트 레반도프스키', ov)).toBe('레반도프스키');
    setNameOverride(ov, 'x', 'shortName', 'L.레반도프스키');
    expect(labelName('x', '레반도프스키', '', ov)).toBe('L.레반도프스키');
    setNameOverride(ov, 'x', 'nickname', '레비');
    expect(labelName('x', '레반도프스키', '', ov)).toBe('레비');
    setNameOverride(ov, 'x', 'nickname', ' ');
    setNameOverride(ov, 'x', 'shortName', '');
    expect(ov).toEqual({});
  });

  it('생성 선수도 짧은 이름이 있다 (세계 전체)', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'names1', difficulty: 'normal' });
    const all = Object.values(g.rosters).flatMap((r) => r.players);
    const m = shortNames(all);
    for (const p of all) expect(m.get(p.id)!.length).toBeGreaterThan(0);
  });
});

describe('세이브 22 → 23 (C.44a)', () => {
  it('nameOverrides 빈 값, NPC 한글 이름은 지금 표기 · 옛 세이브(22)는 이어 할 수 없음', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'mig21', difficulty: 'normal' });
    const back = deserialize(serialize(g));
    expect(back.saveFormat).toBe(SAVE_FORMAT_VERSION);
    expect(back.nameOverrides).toEqual({});
    const vd = back.npcs.find((n) => n.id === 'van-dijk');
    if (vd) expect(vd.nameKo).toBe('버질 반 다이크');
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 22;
    expect(() => deserialize(JSON.stringify(raw))).toThrow(SaveFormatError);
  });

  it('별명은 세이브에 남는다', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'nick', difficulty: 'normal' });
    setNameOverride(g.nameOverrides, 'lewandowski', 'nickname', '레비');
    expect(deserialize(serialize(g)).nameOverrides).toEqual({ lewandowski: { nickname: '레비' } });
  });
});

describe('세로 피치 (C.44a)', () => {
  it('가로는 그대로, 세로는 90도 회전(뒤집지 않음): 공격 방향 골이 위', () => {
    const land = pitchProjection(1050, 680);
    expect(land.portrait).toBe(false);
    expect(land.toScreen(105, 68)).toEqual([1050, 680]);
    const up = pitchProjection(680, 1050, 1);
    expect(up.portrait).toBe(true);
    expect(up.toScreen(105, 34)).toEqual([340, 0]); // x 증가 쪽 골 = 위
    expect(up.toScreen(0, 34)).toEqual([340, 1050]);
    expect(up.toScreen(52.5, 0)[0]).toBe(0); // 공격 방향 왼쪽 측면 = 화면 왼쪽
    const down = pitchProjection(680, 1050, -1);
    expect(down.toScreen(0, 34)).toEqual([340, 0]);
    expect(down.toScreen(52.5, 68)[0]).toBe(0); // x 감소 방향으로 공격할 때 왼쪽 측면(y 큰 쪽) = 화면 왼쪽
  });

  it('공격 방향: 내 골키퍼 반대쪽 (후반에 진영이 바뀌어도 내 팀이 위)', () => {
    const players = new Map<string, ReplayPlayer>([
      ['g0', { id: 'g0', name: 'a', team: 0, number: 1, position: 'GK', isMe: false, gk: true }],
      ['p0', { id: 'p0', name: 'b', team: 0, number: 9, position: 'ST', isMe: true, gk: false }],
      ['g1', { id: 'g1', name: 'c', team: 1, number: 1, position: 'GK', isMe: false, gk: true }],
    ]);
    const frame = (gx0: number, gx1: number): ReplayFrame => ({ e: 0, t: 0, ball: { x: 50, y: 34, z: 0 }, carrier: null, players: [{ id: 'g0', x: gx0, y: 34 }, { id: 'p0', x: 60, y: 30 }, { id: 'g1', x: gx1, y: 34 }] });
    expect(attackDirOf(frame(3, 102), players, 0)).toBe(1);
    expect(attackDirOf(frame(102, 3), players, 0)).toBe(-1);
    expect(attackDirOf(frame(3, 102), players, 1)).toBe(-1);
  });

  it('선수 크기: 크게(기본) = 보통의 1.5배', () => {
    setPitchSize('normal');
    const n = markerRadius(358);
    setPitchSize('large');
    expect(markerRadius(358)).toBeCloseTo(n * 1.5);
    setPitchSize('xlarge');
    expect(markerRadius(358)).toBeGreaterThan(n * 1.5);
    setPitchSize('large');
  });

  it('방향·크기·이름 설정과 별명은 경기 결과에 영향 없음 (같은 시드 같은 결과)', () => {
    const play = (setup: () => void, nick: boolean) => {
      setup();
      const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c44a-det', difficulty: 'normal' });
      if (nick) for (const r of Object.values(g.rosters)) for (const p of r.players) setNameOverride(g.nameOverrides, p.id, 'nickname', 'X');
      const rep = playRound(g);
      return JSON.stringify({ rep, table: g.league.table, player: g.player });
    };
    const a = play(() => { setPitchOrient('auto'); setPitchSize('large'); setPitchNames('all'); }, false);
    const b = play(() => { setPitchOrient('portrait'); setPitchSize('xlarge'); setPitchNames('off'); }, true);
    expect(b).toBe(a);
    setPitchOrient('auto');
    setPitchNames('all');
    setPitchSize('large');
  });
});
