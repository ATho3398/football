// 포토카드 도감 화면 데이터 (C.75t, pending 130)

import { dateLabel } from '../calendar';
import { COMP_NAMES_KO } from '../cups';
import type { GameState } from '../game';
import { teamById } from '../league';
import {
  DEX_TOTAL, dexLabel, KEY_STAT_KO, photoViews, POS_LINE_KO, POS_LINES, sortPhotos,
  type PhotoGrade, type PhotoSort, type PhotoView, type PosLine,
} from '../photocards';
import type { FaceRef } from './faces';

export interface PhotoCellVM {
  no: string;
  /** 모은 카드 (없으면 실루엣 칸) */
  card?: {
    id: string;
    name: string;
    pos: string;
    team: string;
    teamId?: string;
    league: string;
    ovr: number;
    age: number | null;
    shirt: number | null;
    /** 능력치 보조 = 포지션 줄 핵심 스탯 (이름 · 값) */
    key: string | null;
    grade: PhotoGrade;
    retired: boolean;
    away: boolean;
    jersey: boolean;
    face: FaceRef;
    /** 뒷면 "처음 만났을 때" */
    back: { date: string; match: string; first: string };
  };
}

export interface PhotoSectionVM { title?: string; cells: PhotoCellVM[] }

export interface PhotoDexVM {
  have: number;
  total: number;
  /** 완성률 % (소수 1자리) */
  pct: string;
  sort: PhotoSort;
  desc: boolean;
  sections: PhotoSectionVM[];
  /** 뒤집어 본 카드 id */
  flipped: string | null;
}

const LEAGUE_KO: Record<string, string> = {
  'premier league': '프리미어리그', 'efl championship': '챔피언십', championship: '챔피언십', 'la liga': '라리가', 'serie a': '세리에 A', bundesliga: '분데스리가', 'ligue 1': '리그 1',
};
export const leagueKo = (s: string): string => (s ? LEAGUE_KO[s.toLowerCase()] ?? s : '리그 밖');

function teamName(g: GameState, t: string): { name: string; id?: string } {
  if (!t) return { name: '리그 밖' };
  try {
    const team = teamById(g.league, t);
    return { name: team.nameKo, id: team.id };
  } catch {
    return { name: t };
  }
}

const seasonKo = (y: number) => `${y}-${String((y + 1) % 100).padStart(2, '0')}`;

function cell(g: GameState, v: PhotoView): PhotoCellVM {
  const team = teamName(g, v.team);
  const c = v.card;
  const vs = teamName(g, c.vs).name;
  const first = teamName(g, c.first.t).name;
  return {
    no: dexLabel(v.no),
    card: {
      id: v.id, name: v.name, pos: v.position, team: v.retired ? `${team.name} (은퇴)` : team.name, ...(team.id ? { teamId: team.id } : {}),
      league: v.retired ? '은퇴' : leagueKo(v.away ? '' : v.league),
      ovr: v.ovr, age: v.age || null, shirt: v.shirt || null,
      key: v.key ? `${KEY_STAT_KO[v.line]} ${v.key}` : null,
      grade: v.grade, retired: v.retired, away: v.away, jersey: v.jersey,
      face: { id: v.id, ...(v.age ? { age: v.age } : {}) },
      back: {
        date: `${seasonKo(c.s)} · ${dateLabel(c.d)}`,
        match: `${vs}전${c.c ? ` (${COMP_NAMES_KO[c.c]})` : ''}`,
        first: `${first} · OVR ${c.first.o || '-'}`,
      },
    },
  };
}

/** 도감 번호순이면 전체 칸(안 모은 번호 = 실루엣), 다른 정렬은 모은 카드만. 포지션 정렬은 줄마다 구분선 */
export function photoDexVM(g: GameState, sort: PhotoSort = 'no', desc = false, flipped: string | null = null): PhotoDexVM {
  const views = photoViews(g);
  const have = views.length;
  const total = DEX_TOTAL;
  const pct = total ? ((have / total) * 100).toFixed(1) : '0.0';
  let sections: PhotoSectionVM[];
  if (sort === 'no') {
    const byNo = new Map(views.map((v) => [v.no, v]));
    const nos = Array.from({ length: total }, (_, i) => i + 1);
    if (desc) nos.reverse();
    sections = [{ cells: nos.map((no) => (byNo.has(no) ? cell(g, byNo.get(no)!) : { no: dexLabel(no) })) }];
  } else if (sort === 'pos') {
    const sorted = sortPhotos(views, 'pos', desc);
    const lines = desc ? [...POS_LINES].reverse() : POS_LINES;
    sections = lines.map((line: PosLine) => ({ title: POS_LINE_KO[line], cells: sorted.filter((v) => v.line === line).map((v) => cell(g, v)) })).filter((s) => s.cells.length);
  } else {
    sections = [{ cells: sortPhotos(views, sort, desc).map((v) => cell(g, v)) }];
  }
  return { have, total, pct, sort, desc, sections, flipped };
}
