// 이적·계약 화면 뷰모델 (18.10, 부록 C.42)

import { leagueData } from '../../data/leagues';
import { myFace } from './viewModels';
import type { GameState } from '../game';
import { proficientOvr } from '../proficiency';
import {
  annualLabel, clubNameKo, isOutside, latestWindow, midWindowKo, windowKo, marketPending, myBuyout, myValue, offerTier, ratingOf, releaseChance, requestEligibility, startLabel, teamRank, wageLabel, weakMovePenalty, WHY_KO,
} from '../transfer';
import { tierLabel, valueLabel } from '../finance';
import { seasonLabel } from './viewModels';

export interface OfferVM {
  i: number; team: string; teamId: string; /** 리그 팀이면 팀 상세로 (C.53) */ league: boolean; rating: number; rank: number; diff: number; loan: boolean;
  years: number; wage: string; annual: string; start: string; startPct: number;
  /** 유스 구단 계약 제안 (C.45), 자유계약의 마지막 남은 제안 (거절 불가) */
  youth?: boolean;
  lastFree?: boolean;
  /** 유망주 계약 (C.78u): 저연봉·장기 */
  prospect?: boolean;
  /** 구단 재정 등급 (C.46) */
  tier: string;
  /** 제안 이적료 (C.48, 계약 중일 때만) */
  fee?: string;
  /** 지금보다 주급 % (C.60 OfferCard 메모 줄) */
  wagePct: number;
  /** 수락하면 깎일 위상 (약팀 이적, 임대 제외) */
  repLoss: number;
  /** 계약 끝 시즌 ("2023-24") */
  until: string;
}

export interface MarketVM {
  team: string; rating: number; ovr: number;
  /** 내 팀 재정 등급, 내 몸값 (C.46) */
  tier: string; value: string;
  contract: { team: string; until: string; yearsLeft: number; wage: string; annual: string; loan: string | null; buyout: string };
  /** 소속 구단이 거절한 제안 뉴스 (C.48) */
  refused: string[];
  /** 거절된 제안 줄 (디자인 145: 취소선 · 재정 등급) */
  refusedOffers: { team: string; fee: string; tier: string }[];
  /** 남은 계약에 따른 이번 창 제안 단계 안내 (C.48) */
  tierNote: string;
  offers: OfferVM[] | null; window: string; pending: boolean;
  renewal: { years: number[]; wage: string; annual: string; prospect?: boolean } | null;
  request: { ok: boolean; reason: string; chance: number | null; status: string | null };
  notice: string | null;
  moves: { season: string; text: string }[];
  /** 자유계약 신분 (C.45): 하나는 골라야 한다 */
  free: boolean;
  /** 맨 위 상태 줄 (디자인 145): 계약 남음 · 만료 · 소속팀 없음 */
  state: 'remain' | 'expired' | 'free';
  /** 지금 주급 (수락 확인 "a → b") */
  curWage: string;
  /** 겨울 이적시장 (디자인 99: 진행 멈춤 안내) */
  winter: boolean;
}

const TIER_NOTE = {
  last: '계약 마지막 해·만료·이적 명단이라 제안이 많이 와요 (3~5개)',
  one: '계약이 1년 더 남아 제안이 조금 와요 (1~3개)',
  more: '계약이 2년 이상 남아 더 강한 구단만 가끔 제안해요 (0~2개)',
} as const;

/** 받침 있으면 "이", 없으면 "가" (한글 끝 글자 기준, 그 외 "이") */
const iga = (w: string): string => {
  const c = w.charCodeAt(w.length - 1);
  return c >= 0xac00 && c <= 0xd7a3 ? ((c - 0xac00) % 28 ? '이' : '가') : '이';
};

export function marketVM(g: GameState): MarketVM {
  const m = g.market;
  const p = g.player;
  const cur = ratingOf(g, p.teamId);
  const c = m.contract;
  const nextSeason = g.league.season + (g.phase === 'season' ? 0 : 1);
  const el = requestEligibility(g);
  const req = m.request?.season === g.league.season ? m.request : null;
  return {
    team: clubNameKo(g.league, p.teamId), rating: cur, ovr: proficientOvr(p, p.position),
    tier: tierLabel(p.teamId), value: valueLabel(myValue(g)),
    contract: {
      team: clubNameKo(g.league, c.teamId), until: `${seasonLabel(c.until)} 시즌까지`, yearsLeft: Math.max(0, c.until - nextSeason + 1),
      wage: wageLabel(c.wage), annual: annualLabel(c.wage),
      loan: c.loan ? `${clubNameKo(g.league, p.teamId)} 임대 중 · ${seasonLabel(c.loan.until)} 시즌 끝나면 복귀` : null,
      buyout: valueLabel(myBuyout(g)),
    },
    refused: (m.refused ?? []).map((r) => {
      const mine = clubNameKo(g.league, p.teamId);
      return `${mine}${iga(mine)} ${clubNameKo(g.league, r.teamId)}의 제안(이적료 ${valueLabel(r.fee)})을 거절했어요`;
    }),
    refusedOffers: (m.refused ?? []).map((r) => ({ team: clubNameKo(g.league, r.teamId), fee: valueLabel(r.fee), tier: tierLabel(r.teamId) })),
    tierNote: TIER_NOTE[offerTier(g)],
    offers: m.offers?.map((o, i) => {
      const r = ratingOf(g, o.teamId);
      return {
        i, team: clubNameKo(g.league, o.teamId), teamId: o.teamId, league: !isOutside(o.teamId), rating: r, rank: teamRank(g, o.teamId), diff: Math.round((r - cur) * 10) / 10, loan: o.kind === 'loan',
        years: o.years, wage: wageLabel(o.wage), annual: annualLabel(o.wage), start: startLabel(o.start), startPct: Math.round(o.start * 100), tier: tierLabel(o.teamId),
        ...(o.youth ? { youth: true } : {}), ...(o.prospect ? { prospect: true } : {}), ...(o.fee ? { fee: valueLabel(o.fee) } : {}),
        ...(m.free && (m.offers?.length ?? 0) <= 1 ? { lastFree: true } : {}),
        wagePct: c.wage > 0 ? Math.round((o.wage / c.wage - 1) * 100) : 0,
        repLoss: o.kind === 'loan' ? 0 : weakMovePenalty(p.reputation, cur, r),
        until: seasonLabel(nextSeason + o.years - 1),
      };
    }) ?? null,
    window: `${windowKo(g.league, m.offerWindow ?? 'summer')} 이적시장`,
    pending: marketPending(g),
    renewal: m.renewal ? { years: m.renewal.years, wage: wageLabel(m.renewal.wage), annual: annualLabel(m.renewal.wage), ...(m.renewal.prospect ? { prospect: true } : {}) } : null,
    request: {
      ok: el.ok, reason: el.reason, chance: el.ok ? Math.round(releaseChance(g) * 100) : null,
      status: req ? (req.accepted ? (m.offers ? '이적 명단 · 제안이 왔어요' : `이적 명단 · ${midWindowKo(g.league)} 이적시장에 제안이 와요`) : '구단이 요청을 거절했어요') : null,
    },
    notice: m.notice ?? null,
    free: !!m.free,
    state: m.free ? 'free' : m.renewal ? 'expired' : 'remain',
    curWage: wageLabel(c.wage),
    winter: m.offerWindow === 'winter',
    moves: m.moves.map((x) => ({
      season: seasonLabel(x.season),
      text: x.back ? `${clubNameKo(g.league, x.from)} → ${clubNameKo(g.league, x.to)} (임대 복귀)` : `${clubNameKo(g.league, x.from)} → ${clubNameKo(g.league, x.to)}${x.loan ? ' (임대)' : ''}`,
    })),
  };
}

export interface NewsRowVM { id: string; name: string; pos: string; age: number; ovr: number; from: string; to: string; why: string; real: boolean; into: boolean; out: boolean; fill: { name: string; pos: string; age: number; ovr: number; club: string } | null; mine: boolean; fee: string; toTier: string; /** 누르면 열 선수 상세 (C.53): 선수 id, 내 선수 'me'. 리그 밖으로 간 선수는 C.71a 리그 밖 빈 화면 */ open: string | null }
export interface NewsVM { title: string; count: number; inLeague: number; rows: NewsRowVM[]; /** 내 리그 이름 (C.76c, 없으면 프리미어리그) */ league?: string; /** 다른 고른 리그 팀으로 간 선수 수 (C.76c) */ toOther?: number }

/** 월드 "이적 소식": 가장 최근 이적시장의 NPC 이동 (+ 같은 이적시장 내 선수 이동) */
export function newsVM(g: GameState): NewsVM | null {
  const w = latestWindow(g);
  const me = g.market.moves.filter((x) => !x.back).at(-1);
  if (!w && !me) return null;
  const rows: NewsRowVM[] = (w?.recs ?? []).map((r) => ({
    id: r.id, name: r.name, pos: r.pos, age: r.age, ovr: r.ovr, from: clubNameKo(g.league, r.from), to: clubNameKo(g.league, r.to), why: WHY_KO[r.why], real: !!r.real,
    // 리그 안 = 내 리그 팀으로 (C.76c: 다른 고른 리그 팀은 리그 밖 묶음, 실제 선수 보충은 "다른 리그 실제 선수")
    into: g.league.teams.some((t) => t.id === r.to), out: !g.league.teams.some((t) => t.id === r.to),
    fill: r.fill ? { name: r.fill.real ? `${r.fill.name} (실제 선수)` : r.fill.name, pos: r.pos, age: r.fill.age, ovr: r.fill.ovr, club: clubNameKo(g.league, r.fill.club) } : null,
    mine: r.from === g.player.teamId || r.to === g.player.teamId,
    fee: r.fee ? valueLabel(r.fee) : '자유계약', toTier: tierLabel(r.to), open: r.id,
  }));
  // 실제 선수 → 리그 안 이동 → OVR 순
  rows.sort((a, b) => Number(b.real) - Number(a.real) || Number(b.into) - Number(a.into) || b.ovr - a.ovr);
  if (me && w && me.season === w.season && me.w === w.w) {
    rows.unshift({ id: myFace(g).id, name: g.player.name, pos: g.player.position, age: g.player.age, ovr: proficientOvr(g.player, g.player.position), from: clubNameKo(g.league, me.from), to: clubNameKo(g.league, me.to), why: me.loan ? '임대' : '내 선수', real: true, into: true, out: false, fill: null, mine: true, fee: valueLabel(myValue(g)), toTier: tierLabel(me.to), open: 'me' });
  }
  const season = w?.season ?? me!.season;
  const kind = windowKo(g.league, w?.w ?? me!.w);
  const others = new Set((g.otherLeagues ?? []).flatMap((o) => o.teams.map((t) => t.id)));
  return {
    title: `${seasonLabel(season)} ${kind} 이적시장`, count: rows.length, inLeague: rows.filter((r) => r.into).length, rows,
    league: leagueData(g.league.id)?.nameKo ?? g.league.name, toOther: (w?.recs ?? []).filter((r) => others.has(r.to)).length,
  };
}
