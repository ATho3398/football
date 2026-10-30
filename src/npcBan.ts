// NPC 출장 정지 (C.80a, 외부 피드백 R7): 내 선수와 같은 징계 규칙(BALANCE.discipline — 퇴장 1경기, 리그 옐로 yellowBanEvery 장마다 1경기).
// 리그 경기만 센다(컵·챔스 카드는 내 선수와 같이 세지 않는다). 엔진 경기는 엔진 출력(PlayerLine 카드 칸), 빠른 경기는 출전 명단에
// 엔진 평균 카드율(포지션군 × 팀 성향, BALANCE.discipline.npc)로 결정적 굴림. 정지 선수는 그날 컨디션(NpcCond)의 결장 칸으로 선발에서 빠진다.
// 시즌이 바뀌면 비운다(npcFit 과 같이)

import { BALANCE } from './config/balance';
import { createRng, hashSeed } from './rng';
import { posGroup, type TeamRoster } from './roster';
import { rosterTendency, type NpcLine } from './npcFit';
import type { PlayerLine } from './engine/npcMatch';

/** 선수 id → [이번 시즌 리그 옐로 누적, 남은 정지 경기, 이번 시즌 리그 퇴장 수(있을 때만)] */
export type NpcBanMap = Record<string, [number, number, number?]>;

/** 경기 카드 한 줄 */
export interface CardLine { id: string; yellows: number; red: boolean }

/** 남은 정지 경기 (없으면 0) */
export const npcBanLeft = (ban: NpcBanMap | undefined, id: string): number => ban?.[id]?.[1] ?? 0;

/** 엔진 요약 선수 기록 → 카드 줄 (카드 받은 선수만) */
export function engineCards(res: { players: readonly PlayerLine[] }): CardLine[] {
  const out: CardLine[] = [];
  for (const [id, , , , , , y, red] of res.players) if (y || red) out.push({ id, yellows: y ?? 0, red: red === 1 });
  return out;
}

/**
 * 빠른 경기 카드 굴림: 출전 선수마다 레드 확률 = red90 × 포지션군 배율 × 성향 배율 × 분/90, 옐로 확률 = yellow90 × 같은 배율 × 분/90.
 * 난수는 (worldSeed, 경기 시드, 선수 id) 로 결정적
 */
export function quickCards(roster: TeamRoster, lines: readonly NpcLine[], worldSeed: string, matchSeed: number): CardLine[] {
  const N = BALANCE.discipline.npc;
  const byId = new Map(roster.players.map((p) => [p.id, p]));
  const tend = N.tendency[rosterTendency(roster, worldSeed)] ?? 1;
  const out: CardLine[] = [];
  for (const l of lines) {
    const p = byId.get(l.id);
    if (!p || l.minutes <= 0) continue;
    const k = (N.group[posGroup(p.position)] ?? 1) * tend * (l.minutes / 90);
    const x = createRng(hashSeed(`${worldSeed}:npc-card:${matchSeed}:${l.id}`))();
    const pr = N.red90 * k;
    if (x < pr) out.push({ id: l.id, yellows: 0, red: true });
    else if (x < pr + N.yellow90 * k) out.push({ id: l.id, yellows: 1, red: false });
  }
  return out;
}

/**
 * 리그 경기 뒤: 두 팀에서 정지 중이던 선수는 1경기를 채우고(먼저), 이번 경기 카드를 더한다 — 내 선수와 같은 규칙
 * (두 번째 옐로 퇴장은 옐로 누적에 넣지 않는다, 누적이 yellowBanEvery 배수를 넘거나 퇴장이면 banMatches 경기)
 */
export function npcBanAfterMatch(ban: NpcBanMap, rosters: readonly TeamRoster[], cards: readonly CardLine[]): void {
  if (!BALANCE.discipline.npc.on) return;
  const D = BALANCE.discipline;
  const ids = new Set<string>();
  for (const r of rosters) {
    for (const p of r.players) {
      ids.add(p.id);
      const b = ban[p.id];
      if (b && b[1] > 0) b[1]--;
    }
  }
  for (const c of cards) {
    if (!ids.has(c.id) || (!c.yellows && !c.red)) continue;
    const b = (ban[c.id] ??= [0, 0]);
    const before = Math.floor(b[0] / D.yellowBanEvery);
    b[0] += c.red && c.yellows >= 2 ? 0 : c.yellows;
    if (c.red) b[2] = (b[2] ?? 0) + 1;
    if (c.red || Math.floor(b[0] / D.yellowBanEvery) > before) b[1] += D.banMatches;
  }
}

/** 이번 시즌 받은 출장 정지 [퇴장, 옐로 누적] (측정): 옐로 누적 정지 = 누적 ÷ yellowBanEvery */
export function npcBanTotals(ban: NpcBanMap | undefined, ids: Iterable<string>): [number, number] {
  let red = 0;
  let yel = 0;
  for (const id of ids) {
    const b = ban?.[id];
    if (!b) continue;
    red += b[2] ?? 0;
    yel += Math.floor(b[0] / BALANCE.discipline.yellowBanEvery);
  }
  return [red, yel];
}
