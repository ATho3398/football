// 개인 시상 화면 (C.76n, 디자인 없음 — 부록 C 목록): 올해 시상(상마다 결과 · 득표 · 발표 예정) · 역대 수상자(상별 연도 · 이름 · 팀 · 득표).
// C.76t (47b): 부문(세계 · 리그별) · 올해의 팀(4-3-3 자리) · 이달의 선수 탭 · 시상식(후보 → 최종 3인 → 발표)
import { BALANCE } from '../config/balance';
import type { GameState } from '../game';
import { dateLabel } from '../calendar';
import {
  awardDefOf, awardDesc, awardIds, awardKo, awardLeague, awardTeam, awardYearOf, leagueKo, myAwardCounts, myAwardRank, seasonLeagues, XI_KO, type AwardRow, type AwardYear,
} from '../awards';

export interface AwardLineVM { rank: number; name: string; team: string; teamId: string; value: string; first: string; me: boolean; pos?: string }

export interface AwardCardVM {
  id: string;
  name: string;
  desc: string;
  /** 'shown' = 결과 · 'nominees' = 후보만 발표 · 'pending' = 발표 전 · 'none' = 시상 없음 */
  status: 'shown' | 'nominees' | 'pending' | 'none';
  when: string;
  lines: AwardLineVM[];
  /** 접어 둔 나머지 줄 (발롱도르 30인) */
  more: AwardLineVM[];
  mine: string | null;
  /** 올해의 팀 (자리별 줄) · 시상식을 볼 수 있는 상 · 기록 상(골 수) */
  xi?: boolean;
  cer?: boolean;
  record?: boolean;
}

/** 시상식 (후보 → 최종 3인 → 발표) */
export interface CeremonyVM {
  id: string;
  name: string;
  step: 0 | 1 | 2;
  /** 단계 제목 · 설명 */
  head: string;
  sub: string;
  lines: AwardLineVM[];
  winner: AwardLineVM | null;
}

export interface PotmLineVM { month: string; name: string; team: string; teamId: string; goals: string; votes: string; me: boolean }

export interface AwardsVM {
  years: { id: string; label: string }[];
  season: number | null;
  title: string;
  est: boolean;
  /** 부문: 'world' · 리그 id */
  groups: { id: string; label: string }[];
  group: string;
  cards: AwardCardVM[];
  myTags: string[];
  counts: { name: string; n: number }[];
  /** 배지 (올해의 팀 선정, 47b) */
  badges: { name: string; n: number }[];
  hist: { id: string; label: string }[];
  histId: string;
  histRows: { year: string; name: string; team: string; teamId: string; value: string; me: boolean }[];
  ceremony: CeremonyVM | null;
  /** 이달의 선수 (고른 부문 리그, 최근 시즌 먼저) */
  potmLeague: string;
  /** 내 리그 id (이달의 선수 탭에서 '내 리그'와 겹치는 탭을 뺀다) */
  myLeague: string;
  potm: { season: string; rows: PotmLineVM[] }[];
}

function valueOf(id: string, r: AwardRow): string {
  const d = awardDefOf(id);
  if (d?.formula === 'boot') return `${r.g}골 · ${r.v}점`;
  if (d?.formula === 'goals' || d?.formula === 'wcBoot') return `${r.g ?? r.v}골`;
  if (d?.xi) return `${r.v}표`;
  return `${r.v}점`;
}

const line = (g: GameState, id: string, r: AwardRow, i: number): AwardLineVM => ({
  rank: i + 1, name: r.me ? g.player.name : r.n, team: awardTeam(g, r.t), teamId: r.t, value: valueOf(id, r), first: r.f ? `1위표 ${r.f}` : '', me: !!r.me,
  ...(awardDefOf(id)?.xi ? { pos: XI_KO[r.p] ?? r.p } : {}),
});

/** 부문 (세계 · 내 리그 · 고른 다른 리그) */
function groupsOf(g: GameState, y: AwardYear | undefined): { id: string; label: string }[] {
  const lgs = y ? [...new Set(Object.keys(y.res).map(awardLeague).filter((x): x is string => !!x))] : [];
  const order = seasonLeagues(g);
  lgs.sort((a, b) => (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)));
  return [{ id: 'world', label: '세계' }, ...lgs.map((id) => ({ id, label: leagueKo(id) }))];
}

function cardOf(g: GameState, y: AwardYear | undefined, id: string): AwardCardVM {
  const def = awardDefOf(id);
  const name = awardKo(id, y?.cont);
  const base = { id, name, desc: awardDesc(id), lines: [] as AwardLineVM[], more: [] as AwardLineVM[], mine: null as string | null, ...(def?.xi ? { xi: true } : {}), ...(def?.formula ? { record: true } : {}) };
  if (!y || !y.res[id]) {
    return { ...base, status: 'none' as const, when: def?.wc ? '월드컵이 열린 해에만' : def?.cont ? '대륙 대회가 열린 해에만' : def?.ucl ? '챔스에 나간 팀이 있을 때만' : '시상 기록 없음' };
  }
  const rows = y.res[id]!;
  const due = y.due[id];
  if (!y.shown.includes(id)) {
    const nom = y.shown.includes(`${id}:nominees`);
    const sorted = nom ? [...rows].sort((a, b) => (a.n < b.n ? -1 : 1)) : [];
    return {
      ...base, status: nom ? 'nominees' as const : 'pending' as const, when: due ? `${dateLabel(due, true)} 발표` : '발표 예정',
      lines: sorted.map((r) => ({ rank: 0, name: r.me ? g.player.name : r.n, team: awardTeam(g, r.t), teamId: r.t, value: '', first: '', me: !!r.me })),
      mine: nom && rows.some((r) => r.me) ? '후보에 들었어요' : null,
    };
  }
  const all = rows.map((r, i) => line(g, id, r, i));
  if (def?.xi) {
    return { ...base, status: 'shown' as const, when: due ? `${dateLabel(due, true)} 발표` : '시즌 끝 발표', lines: all, mine: rows.some((r) => r.me) ? '선정' : null };
  }
  const rk = myAwardRank(rows);
  return {
    ...base, status: 'shown' as const, when: due ? `${dateLabel(due, true)} 발표` : '시즌 끝 발표',
    lines: all.slice(0, 5), more: all.slice(5), mine: rk ? (rk === 1 ? '수상' : `${rk}위`) : null,
    ...(!def?.formula && rows.length >= 3 ? { cer: true } : {}),
  };
}

/** 시상식 단계 (step 0 후보 · 1 최종 3인 · 2 발표) */
export function ceremonyVM(g: GameState, y: AwardYear | undefined, id: string, step: number): CeremonyVM | null {
  const rows = y?.shown.includes(id) ? y.res[id] : undefined;
  if (!y || !rows || rows.length < 3) return null;
  const name = `${awardYearOf(y)} ${awardKo(id, y.cont)}`;
  const all = rows.map((r, i) => line(g, id, r, i));
  const abc = (xs: AwardLineVM[]) => [...xs].sort((a, b) => (a.name < b.name ? -1 : 1)).map((l) => ({ ...l, rank: 0, value: '', first: '' }));
  const s = Math.max(0, Math.min(2, step)) as 0 | 1 | 2;
  if (s === 0) return { id, name, step: s, head: `후보 ${all.length}명`, sub: '이력서(기록 · 트로피 · 결정적 순간 · 서사 · 인기) 종합 상위 · 가나다순', lines: abc(all), winner: null };
  if (s === 1) return { id, name, step: s, head: '최종 3인', sub: '투표 상위 3명 · 가나다순', lines: abc(all.slice(0, 3)), winner: null };
  return { id, name, step: s, head: '수상자 발표', sub: '득표 · 1위표 공개', lines: all.slice(0, 3), winner: all[0]! };
}

export function awardsVM(g: GameState, season: number | null, histId: string | null, group: string | null = null, cer: { id: string; step: number } | null = null): AwardsVM {
  const years = (g.globalAwards?.years ?? []).filter((y) => y.shown.length);
  const y: AwardYear | undefined = years.find((x) => x.season === season) ?? years.at(-1);
  const groups = groupsOf(g, y);
  const grp = group && groups.some((x) => x.id === group) ? group : 'world';
  const ids = awardIds().filter((id) => !BALANCE.awards.defs[id]!.monthly);
  const keys = grp === 'world'
    ? ids.filter((id) => BALANCE.awards.defs[id]!.scope !== 'league')
    : Object.keys(y?.res ?? {}).filter((k) => awardLeague(k) === grp).sort((a, b) => ids.indexOf(a.split('@')[0]!) - ids.indexOf(b.split('@')[0]!));
  const cards = keys.map((id) => cardOf(g, y, id));
  // 역대 수상자: 세계 상 + 기록에 있는 리그 상 (내 리그 먼저)
  const lgKeys = [...new Set(years.flatMap((x) => Object.keys(x.res)).filter((k) => awardLeague(k)))];
  const order = seasonLeagues(g);
  lgKeys.sort((a, b) => ((order.indexOf(awardLeague(a)!) + 99) % 99) - ((order.indexOf(awardLeague(b)!) + 99) % 99) || ids.indexOf(a.split('@')[0]!) - ids.indexOf(b.split('@')[0]!));
  const histIds = [...ids.filter((id) => BALANCE.awards.defs[id]!.scope !== 'league'), ...lgKeys];
  const hid = histId && histIds.includes(histId) ? histId : histIds[0]!;
  const histRows = years.filter((x) => x.shown.includes(hid) && x.res[hid]?.[0]).reverse().map((x) => {
    const rows = x.res[hid]!;
    const xi = awardDefOf(hid)?.xi;
    const r = xi ? rows.find((z) => z.me) ?? rows[0]! : rows[0]!;
    return {
      year: `${awardYearOf(x)}`, name: xi ? (rows.some((z) => z.me) ? `${g.player.name} 외 ${rows.length - 1}명` : rows.map((z) => z.n).slice(0, 3).join(' · ') + ' …') : r.me ? g.player.name : r.n,
      team: awardTeam(g, r.t), teamId: r.t, value: xi ? `${rows.length}명` : valueOf(hid, r), me: !!r.me,
    };
  });
  const all = Object.entries(myAwardCounts(g));
  const counts = all.filter(([id]) => !awardDefOf(id)?.xi).map(([id, n]) => ({ name: awardKo(id), n }));
  if (g.globalAwards?.potm) counts.push({ name: '이달의 선수', n: g.globalAwards.potm });
  const badges = all.filter(([id]) => awardDefOf(id)?.xi).map(([id, n]) => ({ name: awardKo(id), n }));
  // 이달의 선수: 고른 부문이 리그면 그 리그, 세계면 내 리그
  const potmLeague = grp === 'world' ? g.league.id : grp;
  const seasons = [...new Set((g.globalAwards?.months ?? []).filter((m) => m.lg === potmLeague).map((m) => m.s))].sort((a, b) => b - a);
  const potm = seasons.map((s) => ({
    season: `${s}-${String((s + 1) % 100).padStart(2, '0')}`,
    rows: (g.globalAwards?.months ?? []).filter((m) => m.lg === potmLeague && m.s === s).sort((a, b) => (a.m < b.m ? 1 : -1)).map((m) => ({
      month: `${Number(m.m.slice(5))}월`, name: m.me ? g.player.name : m.n, team: awardTeam(g, m.t), teamId: m.t, goals: `${m.g}골`, votes: `${m.v}점`, me: !!m.me,
    })),
  }));
  return {
    years: years.map((x) => ({ id: String(x.season), label: `${awardYearOf(x)}` })), season: y?.season ?? null,
    title: y ? `${awardYearOf(y)} 시상` : '시상 기록 없음', est: !!y?.est, groups, group: grp, cards, myTags: y?.mine?.tags ?? [], counts, badges,
    hist: histIds.map((id) => ({ id, label: awardKo(id) })), histId: hid, histRows,
    ceremony: cer ? ceremonyVM(g, y, cer.id, cer.step) : null, potmLeague: leagueKo(potmLeague), myLeague: g.league.id, potm,
  };
}

/** 시즌 요약 "다음 할 일" 줄 (시상 일정): 그 시즌 시상이 있으면 (리그 상은 내 리그만) */
export function awardsTodo(g: GameState, season: number): string | null {
  const y = g.globalAwards?.years.find((x) => x.season === season);
  if (!y) return null;
  const shown = Object.keys(y.res).filter((id) => y.shown.includes(id) && (!awardLeague(id) || awardLeague(id) === g.league.id)).flatMap((id) => {
    const xi = awardDefOf(id)?.xi;
    const rk = xi ? (y.res[id]!.some((r) => r.me) ? 1 : null) : myAwardRank(y.res[id]!.slice(0, 3));
    if (xi && !rk) return [];
    return [`${awardKo(id, y.cont)}${rk ? (xi ? ' 선정' : rk === 1 ? ' 수상' : ` ${rk}위`) : ''}`];
  });
  const bd = y.due.ballonDor;
  return `${shown.length ? `${shown.join(' · ')} 발표됨` : '시상 준비 중'}${bd && !y.shown.includes('ballonDor') ? ` · 발롱도르 ${dateLabel(bd, true)}` : ''}`;
}
