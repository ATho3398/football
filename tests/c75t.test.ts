// C.75t (46a단계): 포토카드 도감 — 고정 도감 번호 · 경기 끝 자동 획득 · 볼 때 값 · 은퇴 고정 · 정렬 · 세이브 46
import { describe, expect, it } from 'vitest';
import { DEX_IDS, DEX_LOCKS } from '../data/players/photoDex';
import { MY_ID } from '../src/engine/adapter';
import { newGame, playRound, SAVE_FORMAT_VERSION, selectableRealPlayers, type GameState } from '../src/game';
import {
  collectPhotos, DEX_NO, dexAppend, dexCandidates, dexHash, photoGrade, photoRetirements, photoSnapshot, photoViews, sortPhotos,
} from '../src/photocards';
import { findRosterPlayer } from '../src/roster';
import { deserialize, migrate, serialize } from '../src/save';
import { photoDexVM } from '../src/ui/photoVM';
import { photoDexView } from '../src/ui/views/photos';
import { matchResultVM } from '../src/ui/viewModels';
import { PATCH_LABEL, STAGE_LABEL } from '../src/version';
import type { PlayerStats } from '../src/engine/types';

const game = (seed = 'c75t', legends = false) => newGame({ mode: 'real', playerId: selectableRealPlayers()[0]!.id, seed, difficulty: 'normal', legends });
const stat = (id: string, team: 0 | 1, minutes: number) => ({ id, team, minutes } as PlayerStats);

describe('도감 번호 (고정, 뒤에 이어 붙이기만)', () => {
  it('실제 선수 전원(현역·레전드·미래 스타)에 번호, 겹침 없음', () => {
    const ids = dexCandidates().map((c) => c.id);
    expect(new Set(DEX_IDS).size).toBe(DEX_IDS.length);
    for (const id of ids) expect(DEX_NO.has(id), id).toBe(true);
    expect(DEX_IDS.length).toBe(new Set(ids).size);
  });

  it('기존 번호 불변: 고정 확인(DEX_LOCKS)마다 앞부분 해시가 그대로', () => {
    expect(DEX_LOCKS.length).toBeGreaterThan(0);
    expect(DEX_LOCKS[0]).toEqual([238, '5cf01d5b']);
    for (const [n, h] of DEX_LOCKS) expect(dexHash(DEX_IDS.slice(0, n)), `앞 ${n}명`).toBe(h);
    expect(DEX_LOCKS[DEX_LOCKS.length - 1]![0]).toBe(DEX_IDS.length);
    // 처음 몇 번은 손으로 확인한 값 (2018-19 우승 맨시티 → 리버풀 …, 맨 뒤는 미래 스타)
    expect(DEX_IDS.slice(0, 2)).toEqual(['de-bruyne', 'foden']);
    expect(DEX_NO.get('salah')).toBe(10);
    expect(DEX_NO.get('messi')).toBe(21);
  });

  it('이어 붙이기: 지금 데이터로 다시 돌리면 그대로, 새 선수는 뒤에만 붙고 앞은 안 바뀜', () => {
    expect(dexAppend(DEX_IDS, dexCandidates())).toEqual(DEX_IDS);
    const extra = [
      { id: 'x-fw', nameKo: '가', kind: 'active' as const, position: 'ST' as const, shirt: 9, league: 'Premier League', club: 'Manchester City' },
      { id: 'x-gk', nameKo: '나', kind: 'active' as const, position: 'GK' as const, shirt: 1, league: 'Premier League', club: 'Manchester City' },
      { id: 'x-lg', nameKo: '다', kind: 'legend' as const, position: 'CB' as const, shirt: 5 },
    ];
    const next = dexAppend(DEX_IDS, [...dexCandidates(), ...extra]);
    expect(next.slice(0, DEX_IDS.length)).toEqual(DEX_IDS);
    // 새 판 안에서도 규칙대로: 현역(GK 먼저) → 레전드
    expect(next.slice(DEX_IDS.length)).toEqual(['x-gk', 'x-fw', 'x-lg']);
  });

  it('정렬 규칙: 현역 다음 레전드, 현역은 리그 → 구단 순위 → 포지션 → 등번호', () => {
    const cands = new Map(dexCandidates().map((c) => [c.id, c]));
    const kinds = DEX_IDS.map((id) => cands.get(id)!.kind);
    const firstLegend = kinds.indexOf('legend');
    expect(kinds.slice(0, firstLegend).every((k) => k === 'active')).toBe(true);
    expect(DEX_NO.get('kane')!).toBeLessThan(DEX_NO.get('aubameyang')!); // 토트넘 4위 < 아스널 5위
    expect(DEX_NO.get('aguero')!).toBeLessThan(DEX_NO.get('van-dijk')!); // 맨시티 < 리버풀
  });
});

describe('획득 (같은 경기에 뛴 실제 선수만)', () => {
  it('내가 뛰어야, 상대·우리 팀 실제 선수만, 가상 선수·안 뛴 선수 제외, 두 번째는 새로 안 셈', () => {
    const g = game();
    const mate = g.rosters[g.player.teamId]!.players.find((p) => p.real)!;
    const virt = g.rosters[g.player.teamId]!.players.find((p) => !p.real && !p.legend)!;
    const oppTeam = Object.keys(g.rosters).find((t) => t !== g.player.teamId && g.rosters[t]!.players.some((p) => p.real))!;
    const foe = g.rosters[oppTeam]!.players.find((p) => p.real)!;
    const bench = g.rosters[oppTeam]!.players.filter((p) => p.real && p.id !== foe.id)[0];
    const at = { date: g.calendar.date, season: g.league.season, vs: oppTeam };
    expect(collectPhotos(g, [stat(MY_ID, 0, 0), stat(mate.id, 0, 90)], MY_ID, at)).toBe(0);
    const players = [stat(MY_ID, 0, 70), stat(mate.id, 0, 90), stat(virt.id, 0, 90), stat(foe.id, 1, 30), ...(bench ? [stat(bench.id, 1, 0)] : [])];
    const self = g.player.realPlayerId!;
    expect(collectPhotos(g, players, MY_ID, at)).toBe(3); // 나(실제 선수) + 동료 + 상대
    expect(g.photos!.cards.map((c) => c.id)).toEqual([self, mate.id, foe.id]);
    const c = g.photos!.cards[1]!;
    expect(c).toMatchObject({ d: g.calendar.date, s: g.league.season, vs: oppTeam, jersey: false, first: { t: g.player.teamId } });
    expect(c.first.o).toBeGreaterThan(50);
    expect(collectPhotos(g, players, MY_ID, at)).toBe(0);
  });

  it('playRound: 결과 화면에 "새 포토카드 n장" 배너, 세이브 왕복', () => {
    const g = game('c75t-r');
    playRound(g);
    const n = g.lastMatch!.newPhotos ?? 0;
    if (g.lastMatch!.result.minutes > 0) expect(n).toBeGreaterThan(0);
    expect(g.photos?.cards.length ?? 0).toBe(n);
    const vm = matchResultVM(g, null)!;
    if (n) expect(vm.banners.some((b) => b.title === `새 포토카드 ${n}장` && b.to === 'dex')).toBe(true);
    expect(deserialize(serialize(g)).photos).toEqual(g.photos);
  });
});

describe('볼 때 값 · 은퇴 고정', () => {
  it('나이·OVR·소속은 지금 데이터에서 (처음 만났을 때 값과 따로)', () => {
    const g = game();
    const mate = g.rosters[g.player.teamId]!.players.find((p) => p.real)!;
    collectPhotos(g, [stat(MY_ID, 0, 90), stat(mate.id, 0, 90)], MY_ID, { date: g.calendar.date, season: g.league.season, vs: 'liv' });
    const first = g.photos!.cards.find((c) => c.id === mate.id)!.first.o;
    mate.age += 3;
    const v = photoViews(g).find((x) => x.id === mate.id)!;
    expect(v.age).toBe(mate.age);
    expect(v.team).toBe(g.player.teamId);
    expect(v.card.first.o).toBe(first);
    expect(v.retired).toBe(false);
  });

  it('은퇴한 레전드 = 시즌 갱신 전 값 고정 + "은퇴"', () => {
    const g = game('c75t-l', true);
    const team = Object.keys(g.rosters).find((t) => g.rosters[t]!.players.some((p) => p.legend))!;
    const lg = g.rosters[team]!.players.find((p) => p.legend)!;
    collectPhotos(g, [stat(MY_ID, 0, 90), stat(lg.id, 1, 90)], MY_ID, { date: g.calendar.date, season: g.league.season, vs: team });
    const snap = photoSnapshot(g);
    expect(snap.get(lg.id)?.a).toBe(lg.age);
    g.rosters[team]!.players = g.rosters[team]!.players.filter((p) => p.id !== lg.id);
    expect(findRosterPlayer(g.rosters, lg.id)).toBeNull();
    photoRetirements(g, snap);
    const v = photoViews(g).find((x) => x.id === lg.id)!;
    expect(v.retired).toBe(true);
    expect(v.age).toBe(lg.age);
    expect(photoDexVM(g, 'got').sections[0]!.cells.find((c) => c.card?.id === lg.id)!.card!.league).toBe('은퇴');
  });
});

describe('도감 화면', () => {
  it('번호순 = 전체 칸(실루엣 "No.042 ???"), 완성률, 다른 정렬은 모은 카드만, 포지션 정렬은 구분선', () => {
    const g = game();
    const ids = g.rosters[g.player.teamId]!.players.filter((p) => p.real).map((p) => p.id);
    collectPhotos(g, [stat(MY_ID, 0, 90), ...ids.map((id) => stat(id, 0, 90))], MY_ID, { date: g.calendar.date, season: g.league.season, vs: 'liv' });
    const have = g.photos!.cards.length;
    const vm = photoDexVM(g);
    expect(vm.have).toBe(have);
    expect(vm.total).toBe(DEX_IDS.length);
    expect(vm.sections[0]!.cells.length).toBe(DEX_IDS.length);
    const html = photoDexView(vm);
    expect(html).toContain(`${have} / ${DEX_IDS.length} ·`);
    expect(html).toContain('No.042');
    expect(html).toContain('???');
    for (const s of ['도감 번호', '포지션', '이름', '등번호', '나이', '능력치', '리그', '획득순']) expect(html).toContain(s);
    expect(photoDexVM(g, 'name').sections[0]!.cells.length).toBe(have);
    const pos = photoDexVM(g, 'pos');
    expect(pos.sections.every((s) => s.title)).toBe(true);
    expect(photoDexView(pos)).toContain('pc-divider');
    // 내림차순 = 오름차순 뒤집기 (같은 값은 번호순)
    const views = photoViews(g);
    const up = sortPhotos(views, 'ovr').map((v) => v.ovr);
    expect(sortPhotos(views, 'ovr', true).map((v) => v.ovr)).toEqual([...up].reverse());
    // 뒷면 = 처음 만났을 때
    const id = g.photos!.cards[0]!.id;
    expect(photoDexView(photoDexVM(g, 'no', false, id))).toContain('처음 만났을 때');
  });

  it('테두리 = OVR 등급 (카드 희귀도 색)', () => {
    expect(photoGrade(90)).toBe('legend');
    expect(photoGrade(84)).toBe('epic');
    expect(photoGrade(77)).toBe('rare');
    expect(photoGrade(60)).toBe('common');
  });
});

describe('세이브 46', () => {
  it('옛 세이브(45) = 빈 도감', () => {
    expect(SAVE_FORMAT_VERSION).toBe(47);
    const g: GameState = game();
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 45;
    delete raw.photos;
    const back = migrate(raw);
    expect(back.saveFormat).toBe(SAVE_FORMAT_VERSION);
    expect(back.photos).toEqual({ cards: [] });
  });

  it('버전 표시', () => {
    expect(PATCH_LABEL).toMatch(/^C\.\d+[a-z]*$/);
    expect(STAGE_LABEL).toBe('46단계');
  });
});
