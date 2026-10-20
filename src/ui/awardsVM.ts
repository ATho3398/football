// 개인 시상 화면 (C.76n, 디자인 없음 — 부록 C 목록): 올해 시상(상마다 결과 · 득표 · 발표 예정) · 역대 수상자(상별 연도 · 이름 · 팀 · 득표)
import { BALANCE } from '../config/balance';
import type { GameState } from '../game';
import { dateLabel } from '../calendar';
import { awardDesc, awardTeam, awardIds, awardKo, awardYearOf, myAwardCounts, myAwardRank, type AwardRow, type AwardYear } from '../awards';

export interface AwardLineVM { rank: number; name: string; team: string; teamId: string; value: string; first: string; me: boolean }

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
}

export interface AwardsVM {
  years: { id: string; label: string }[];
  season: number | null;
  title: string;
  est: boolean;
  cards: AwardCardVM[];
  myTags: string[];
  counts: { name: string; n: number }[];
  hist: { id: string; label: string }[];
  histId: string;
  histRows: { year: string; name: string; team: string; teamId: string; value: string; me: boolean }[];
}

function valueOf(id: string, r: AwardRow): string {
  const d = BALANCE.awards.defs[id];
  if (d?.formula === 'boot') return `${r.g}골 · ${r.v}점`;
  if (d?.formula === 'goals') return `${r.v}골`;
  return `${r.v}점`;
}

const line = (g: GameState, id: string, r: AwardRow, i: number): AwardLineVM => ({
  rank: i + 1, name: r.me ? g.player.name : r.n, team: awardTeam(g, r.t), teamId: r.t, value: valueOf(id, r), first: r.f ? `1위표 ${r.f}` : '', me: !!r.me,
});

export function awardsVM(g: GameState, season: number | null, histId: string | null): AwardsVM {
  const years = (g.globalAwards?.years ?? []).filter((y) => y.shown.length);
  const y: AwardYear | undefined = years.find((x) => x.season === season) ?? years.at(-1);
  const cards: AwardCardVM[] = awardIds().map((id) => {
    const name = awardKo(id);
    const base = { id, name, desc: awardDesc(id), lines: [] as AwardLineVM[], more: [] as AwardLineVM[], mine: null as string | null };
    if (!y || !y.res[id]) return { ...base, status: 'none' as const, when: BALANCE.awards.defs[id]?.wc ? '월드컵이 열린 해에만' : '시상 기록 없음' };
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
    const rk = myAwardRank(rows);
    return {
      ...base, status: 'shown' as const, when: due ? `${dateLabel(due, true)} 발표` : '시즌 끝 발표',
      lines: all.slice(0, 5), more: all.slice(5), mine: rk ? (rk === 1 ? '수상' : `${rk}위`) : null,
    };
  });
  const ids = awardIds();
  const hid = histId && ids.includes(histId) ? histId : ids[0]!;
  const histRows = years.filter((x) => x.shown.includes(hid) && x.res[hid]?.[0]).reverse().map((x) => {
    const r = x.res[hid]![0]!;
    return { year: `${awardYearOf(x)}`, name: r.me ? g.player.name : r.n, team: awardTeam(g, r.t), teamId: r.t, value: valueOf(hid, r), me: !!r.me };
  });
  const counts = Object.entries(myAwardCounts(g)).map(([id, n]) => ({ name: awardKo(id), n }));
  return {
    years: years.map((x) => ({ id: String(x.season), label: `${awardYearOf(x)}` })), season: y?.season ?? null,
    title: y ? `${awardYearOf(y)} 시상` : '시상 기록 없음', est: !!y?.est, cards, myTags: y?.mine?.tags ?? [], counts,
    hist: ids.map((id) => ({ id, label: awardKo(id) })), histId: hid, histRows,
  };
}

/** 시즌 요약 "다음 할 일" 줄 (시상 일정): 그 시즌 시상이 있으면 */
export function awardsTodo(g: GameState, season: number): string | null {
  const y = g.globalAwards?.years.find((x) => x.season === season);
  if (!y) return null;
  const shown = Object.keys(y.res).filter((id) => y.shown.includes(id)).map((id) => {
    const rk = myAwardRank(y.res[id]!.slice(0, 3));
    return `${awardKo(id)}${rk ? (rk === 1 ? ' 수상' : ` ${rk}위`) : ''}`;
  });
  const bd = y.due.ballonDor;
  return `${shown.length ? `${shown.join(' · ')} 발표됨` : '시상 준비 중'}${bd && !y.shown.includes('ballonDor') ? ` · 발롱도르 ${dateLabel(bd, true)}` : ''}`;
}
