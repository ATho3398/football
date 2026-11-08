// 유니폼 교환 패널 · 진열실 화면 데이터 (C.76b, pending 130 ②③)

import { dateLabel } from '../calendar';
import type { GameState } from '../game';
import { teamById } from '../league';
import {
  hasJersey, jerseyBlocked, jerseyChance, jerseyName, RELATION_KO, showroomSlots, shownItems, storedItems, type ShowItem,
} from '../jerseys';
import { photoView, posLine } from '../photocards';
import { BALANCE } from '../config/balance';
import { TIER_NAMES_KO } from '../growth';
import type { FaceRef } from './faces';

export interface JerseyPickVM {
  id: string;
  name: string;
  pos: string;
  ovr: number;
  face: FaceRef;
  /** 성공 확률 % */
  pct: number;
  /** 관계 한 줄 ("더비 상대 · 같은 국적"), 없으면 '' */
  rel: string;
  /** 이미 받은 유니폼 */
  have: boolean;
}

export interface JerseyPanelVM {
  /** 요청 결과 (요청했으면) */
  done: { name: string; ok: boolean; line: string } | null;
  picks: JerseyPickVM[];
  /** 내 위상 티어 이름 */
  tier: string;
}

function teamName(g: GameState, id: string): string {
  try {
    return teamById(g.league, id).nameKo;
  } catch {
    return id;
  }
}

/** 결과 화면 패널. 내가 뛴 엔진 경기에서 상대 실제 선수가 있을 때만 (빠른 경기·결장·실제 선수 없음이면 null) */
export function jerseyPanelVM(g: GameState): JerseyPanelVM | null {
  const m = g.lastMatch;
  if (!m?.jerseyPool?.length) return null;
  const tier = TIER_NAMES_KO[jerseyChance(g, m.jerseyPool[0]!, m).tier];
  if (m.jersey) return { done: { name: jerseyName(m.jersey.id), ok: m.jersey.ok, line: m.jersey.line }, picks: [], tier };
  const card = (id: string) => g.photos?.cards.find((c) => c.id === id);
  const picks = m.jerseyPool.map((id): JerseyPickVM => {
    const ch = jerseyChance(g, id, m);
    const c = card(id);
    const v = c ? photoView(g, c, 0) : null;
    return {
      id, name: jerseyName(id), pos: v?.position ?? '', ovr: v?.ovr ?? 0,
      face: { id, ...(v?.age ? { age: v.age } : {}) },
      pct: Math.round(ch.p * 100),
      rel: ch.relations.map((r) => RELATION_KO[r.kind]).join(' · '),
      have: hasJersey(g, id) || jerseyBlocked(g, id, m) !== null,
    };
  });
  // 포지션 줄(GK → FW) · OVR 내림
  const LINE = { GK: 0, DF: 1, MF: 2, FW: 3 } as const;
  picks.sort((a, b) => (a.pos && b.pos ? LINE[posLine(a.pos as never)] - LINE[posLine(b.pos as never)] : 0) || b.ovr - a.ovr);
  return { done: null, picks, tier };
}

export interface ShowItemVM {
  key: string;
  kind: 'trophy' | 'jersey';
  title: string;
  sub: string;
  face?: FaceRef;
}

export interface ShowroomVM {
  house: string;
  slots: number;
  /** 다음 집 단계의 칸 수 (마지막 단계면 null) */
  nextSlots: number | null;
  shown: ShowItemVM[];
  stored: ShowItemVM[];
  /** 교환 기록 (최근 순) */
  log: { date: string; name: string; vs: string; ok: boolean }[];
  swaps: number;
  got: number;
}

const seasonKo = (y: number) => `${y}-${String((y + 1) % 100).padStart(2, '0')}`;

function itemVM(g: GameState, x: ShowItem): ShowItemVM {
  if (x.kind === 'trophy') return { key: x.key, kind: 'trophy', title: x.label, sub: '트로피' };
  return {
    key: x.key, kind: 'jersey', title: jerseyName(x.label),
    sub: `유니폼 · ${x.season !== undefined ? seasonKo(x.season) : ''}${x.vs ? ` ${teamName(g, x.vs)}전` : ''}`, face: { id: x.label },
  };
}

export function showroomVM(g: GameState): ShowroomVM {
  const houses = BALANCE.wealth.houses;
  const lvl = Math.min(g.money?.house ?? 0, houses.length - 1);
  const table = BALANCE.jerseys.showroomSlots;
  const swaps = g.showcase?.swaps ?? [];
  return {
    house: houses[lvl]!.ko,
    slots: showroomSlots(g),
    nextSlots: lvl + 1 < table.length ? table[lvl + 1]! : null,
    shown: shownItems(g).map((x) => itemVM(g, x)),
    stored: storedItems(g).map((x) => itemVM(g, x)),
    log: [...swaps].reverse().slice(0, 12).map((s) => ({ date: `${seasonKo(s.s)} · ${dateLabel(s.d)}`, name: jerseyName(s.id), vs: teamName(g, s.vs), ok: s.ok })),
    swaps: swaps.length,
    got: swaps.filter((s) => s.ok).length,
  };
}
