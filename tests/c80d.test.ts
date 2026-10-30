// C.80d: 카드율 현실화 — 엔진 카드 몫(옐로 팀당 경기 약 1.9) · 리그 옐로 누적 정지 = 실제 PL 규칙
import { describe, expect, it } from 'vitest';
import { nextYellowBan, seasonFrac, yellowBanMatches, yellowBanRule } from '../src/discipline';
import { npcBanAfterMatch, npcBanLeft, type NpcBanMap } from '../src/npcBan';
import { createTeamRoster } from '../src/roster';

describe('리그 옐로 누적 정지 (C.80d, PL 규칙)', () => {
  it('5장은 19경기 안에만 1경기 · 10장은 32경기 안 2경기 · 15장 3경기', () => {
    expect(yellowBanMatches(4, 5, seasonFrac(18, 38))).toBe(1);
    expect(yellowBanMatches(4, 5, seasonFrac(19, 38))).toBe(0);
    expect(yellowBanMatches(9, 10, seasonFrac(31, 38))).toBe(2);
    expect(yellowBanMatches(9, 10, seasonFrac(32, 38))).toBe(0);
    expect(yellowBanMatches(14, 15, seasonFrac(37, 38))).toBe(3);
    expect(yellowBanMatches(5, 6, seasonFrac(3, 38))).toBe(0);
    // 다른 리그 길이(34경기)도 비율로
    expect(yellowBanMatches(4, 5, seasonFrac(16, 34))).toBe(1);
    expect(yellowBanMatches(4, 5, seasonFrac(17, 34))).toBe(0);
  });

  it('다음 기준: 19경기 뒤 4장이면 10장, 15장 넘으면 0', () => {
    expect(nextYellowBan(3, seasonFrac(5, 38))).toBe(5);
    expect(nextYellowBan(4, seasonFrac(25, 38))).toBe(10);
    expect(nextYellowBan(9, seasonFrac(34, 38))).toBe(15);
    expect(nextYellowBan(15, seasonFrac(36, 38))).toBe(0);
    expect(yellowBanRule()).toBe('5장(19경기 안) 1경기 · 10장(32경기 안) 2경기 · 15장 3경기');
  });

  it('NPC 도 같은 규칙: 늦게 채운 5장은 정지 없음 · 10장째 2경기', () => {
    const r = createTeamRoster({ id: 't', rating: 70 }, 't', 2018, []);
    const id = r.players[3]!.id;
    const ban: NpcBanMap = { [id]: [4, 0] };
    npcBanAfterMatch(ban, [r], [{ id, yellows: 1, red: false }], seasonFrac(25, 38));
    expect(ban[id]).toEqual([5, 0]);
    ban[id] = [9, 0];
    npcBanAfterMatch(ban, [r], [{ id, yellows: 1, red: false }], seasonFrac(30, 38));
    expect(npcBanLeft(ban, id)).toBe(2);
  });
});
