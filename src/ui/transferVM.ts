// 이적·계약 화면 뷰모델 (18.10, 부록 C.42)

import { myFace } from './viewModels';
import type { GameState } from '../game';
import { proficientOvr } from '../proficiency';
import {
  annualLabel, clubNameKo, isOutside, latestWindow, marketPending, myValue, ratingOf, releaseChance, requestEligibility, startLabel, teamRank, wageLabel, WHY_KO,
} from '../transfer';
import { tierLabel, valueLabel } from '../finance';
import { seasonLabel } from './viewModels';

export interface OfferVM {
  i: number; team: string; teamId: string; rating: number; rank: number; diff: number; loan: boolean;
  years: number; wage: string; annual: string; start: string; startPct: number;
  /** 유스 구단 계약 제안 (C.45), 자유계약의 마지막 남은 제안 (거절 불가) */
  youth?: boolean;
  lastFree?: boolean;
  /** 구단 재정 등급 (C.46) */
  tier: string;
}

export interface MarketVM {
  team: string; rating: number; ovr: number;
  /** 내 팀 재정 등급, 내 몸값 (C.46) */
  tier: string; value: string;
  contract: { team: string; until: string; yearsLeft: number; wage: string; annual: string; loan: string | null };
  offers: OfferVM[] | null; window: string; pending: boolean;
  renewal: { years: number[]; wage: string; annual: string } | null;
  request: { ok: boolean; reason: string; chance: number | null; status: string | null };
  notice: string | null;
  moves: { season: string; text: string }[];
  /** 자유계약 신분 (C.45): 하나는 골라야 한다 */
  free: boolean;
}

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
    },
    offers: m.offers?.map((o, i) => {
      const r = ratingOf(g, o.teamId);
      return {
        i, team: clubNameKo(g.league, o.teamId), teamId: o.teamId, rating: r, rank: teamRank(g, o.teamId), diff: Math.round((r - cur) * 10) / 10, loan: o.kind === 'loan',
        years: o.years, wage: wageLabel(o.wage), annual: annualLabel(o.wage), start: startLabel(o.start), startPct: Math.round(o.start * 100), tier: tierLabel(o.teamId),
        ...(o.youth ? { youth: true } : {}),
        ...(m.free && (m.offers?.length ?? 0) <= 1 ? { lastFree: true } : {}),
      };
    }) ?? null,
    window: m.offerWindow === 'winter' ? '겨울 이적시장' : '여름 이적시장',
    pending: marketPending(g),
    renewal: m.renewal ? { years: m.renewal.years, wage: wageLabel(m.renewal.wage), annual: annualLabel(m.renewal.wage) } : null,
    request: {
      ok: el.ok, reason: el.reason, chance: el.ok ? Math.round(releaseChance(g) * 100) : null,
      status: req ? (req.accepted ? (m.offers ? '이적 명단 · 제안이 왔어요' : '이적 명단 · 1월 1일 겨울 이적시장에 제안이 와요') : '구단이 요청을 거절했어요') : null,
    },
    notice: m.notice ?? null,
    free: !!m.free,
    moves: m.moves.map((x) => ({
      season: seasonLabel(x.season),
      text: x.back ? `${clubNameKo(g.league, x.from)} → ${clubNameKo(g.league, x.to)} (임대 복귀)` : `${clubNameKo(g.league, x.from)} → ${clubNameKo(g.league, x.to)}${x.loan ? ' (임대)' : ''}`,
    })),
  };
}

export interface NewsRowVM { id: string; name: string; pos: string; age: number; ovr: number; from: string; to: string; why: string; real: boolean; into: boolean; out: boolean; fill: string | null; mine: boolean; fee: string; toTier: string }
export interface NewsVM { title: string; count: number; inLeague: number; rows: NewsRowVM[] }

/** 월드 "이적 소식": 가장 최근 이적시장의 NPC 이동 (+ 같은 이적시장 내 선수 이동) */
export function newsVM(g: GameState): NewsVM | null {
  const w = latestWindow(g);
  const me = g.market.moves.filter((x) => !x.back).at(-1);
  if (!w && !me) return null;
  const rows: NewsRowVM[] = (w?.recs ?? []).map((r) => ({
    id: r.id, name: r.name, pos: r.pos, age: r.age, ovr: r.ovr, from: clubNameKo(g.league, r.from), to: clubNameKo(g.league, r.to), why: WHY_KO[r.why], real: !!r.real,
    into: !isOutside(r.to), out: isOutside(r.to), fill: r.fill ? `${r.fill.name} (OVR ${r.fill.ovr}) ← ${clubNameKo(g.league, r.fill.club)}` : null,
    mine: r.from === g.player.teamId || r.to === g.player.teamId,
    fee: valueLabel(r.fee ?? 0), toTier: tierLabel(r.to),
  }));
  // 실제 선수 → 리그 안 이동 → OVR 순
  rows.sort((a, b) => Number(b.real) - Number(a.real) || Number(b.into) - Number(a.into) || b.ovr - a.ovr);
  if (me && w && me.season === w.season && me.w === w.w) {
    rows.unshift({ id: myFace(g).id, name: g.player.name, pos: g.player.position, age: g.player.age, ovr: proficientOvr(g.player, g.player.position), from: clubNameKo(g.league, me.from), to: clubNameKo(g.league, me.to), why: me.loan ? '임대' : '내 선수', real: true, into: true, out: false, fill: null, mine: true, fee: valueLabel(myValue(g)), toTier: tierLabel(me.to) });
  }
  const season = w?.season ?? me!.season;
  const kind = (w?.w ?? me!.w) === 'winter' ? '겨울' : '여름';
  return { title: `${seasonLabel(season)} ${kind} 이적시장`, count: rows.length, inLeague: rows.filter((r) => r.into).length, rows };
}
