// 인박스 화면 데이터 (20.4, 부록 C.63): 흩어진 알림(태그·포변 조언·면담 결과·이적 소식·제안·재계약)을 인박스로 모으고, 홈 카드·인박스 목록을 만든다

import type { IconName } from './components';
import { dateLabel, daysBetween } from '../calendar';
import type { GameState } from '../game';
import { ensureGoals, goalProgress, SOURCE_KO, TIER_KO, type GoalStatus, type GoalTier } from '../seasonGoals';
import { INBOX_CAT_KO, inboxList, isPending, pushInbox, unreadCount, type InboxCat, type InboxItem } from '../inbox';
import { rivalOf } from '../rival';
import { teamById } from '../league';
import { adviceCardVM } from './viewModels';

export const CAT_ICON: Record<InboxCat, IconName> = {
  event: 'info', media: 'chat', club: 'home', manager: 'player', rival: 'target', transfer: 'swap', contract: 'edit', tag: 'star', advice: 'tactic', life: 'face', team: 'combo', goal: 'target', money: 'coin',
};

/** 옛 알림 칸(C.37·C.42·C.47·C.48·C.62)을 인박스로 옮긴다 (화면을 그리기 전에 부른다, 같은 알림은 key 로 한 번만) */
export function collectNotices(g: GameState): void {
  const season = g.league.season;
  if (g.tagNotice) {
    pushInbox(g, { cat: 'tag', key: `tag:${g.tagNotice.season}:${g.tagNotice.text}`, title: g.tagNotice.text, body: '선수 → 몸·태그에서 전체를 봐요.', link: { to: 'player', label: '태그 보기' } });
    g.tagNotice = null;
  }
  const adv = adviceCardVM(g);
  if (adv && g.player.advice) {
    pushInbox(g, { cat: 'advice', key: `advice:${season}:${adv.pos}:${g.player.advice.kind}`, title: adv.title, body: `${adv.body} ${adv.window}`, link: { act: 'pos-open', v: adv.pos, label: `${adv.pos} 포지션 보기` } });
    g.player.advice.dismissed = true;
  }
  const mres = g.manager?.result;
  if (mres) {
    pushInbox(g, { cat: 'manager', key: `meet:${mres.date}:${mres.title}`, title: `감독 면담 · ${mres.title}`, body: mres.text, date: mres.date, read: true });
    g.manager!.result = null;
  }
  const m = g.market;
  if (m?.notice) {
    pushInbox(g, { cat: 'transfer', key: `notice:${season}:${m.notice}`, title: m.notice, body: '전술은 새 팀 기본값으로 바뀌었어요. 숙련도·적성·덱은 그대로예요.' });
    m.notice = null;
  }
  if (m?.refused?.length) {
    const names = m.refused.map((r) => teamById(g.league, r.teamId)?.nameKo ?? r.teamId).join(' · ');
    pushInbox(g, { cat: 'transfer', key: `refused:${season}:${m.offerWindow ?? ''}:${names}`, title: '구단이 이적 제안을 거절했어요', body: `${names}의 제안을 소속 구단이 받아들이지 않았어요.` });
    if (!m.offers?.length) m.refused = null;
  }
  // 응답이 필요한 제안·재계약은 홈 위 카드(디자인 97·100)가 그대로 맡고, 인박스에는 기록으로 (읽음)
  if (m?.offers?.length) {
    pushInbox(g, { cat: 'transfer', key: `offers:${season}:${m.offerWindow ?? ''}:${m.offers.map((o) => o.teamId).join(',')}`, title: `이적 제안 ${m.offers.length}개`, body: '수락하거나 거절해야 [계속]으로 넘어가요.', read: true, link: { to: 'offers', label: '제안 보기' } });
  }
  if (m?.renewal) {
    pushInbox(g, { cat: 'contract', key: `renewal:${season}`, title: '계약 만료 · 재계약', body: '재계약(연장)하거나 FA로 다른 팀 제안 중 하나를 골라요.', read: true, link: { to: 'contract', label: '재계약' } });
  }
}

export interface InboxRowVM {
  id: number; cat: string; icon: IconName; when: string; title: string; body: string; unread: boolean; pending: boolean;
  /** 답할 것: 남은 기한 / 답함: 고른 것 */
  status: string;
  link?: InboxItem['link'];
}

function rowOf(g: GameState, x: InboxItem): InboxRowVM {
  const pending = isPending(x);
  const left = x.due ? daysBetween(g.calendar.date, x.due) : 0;
  const status = pending ? (left > 0 ? `답할 것 · ${left}일 남음` : '답할 것 · 오늘까지') : x.answer ? `${x.answer.auto ? (x.answer.text.startsWith('자동 진행') ? '자동 진행 답' : '기본 선택') : '답함'} · ${x.answer.label}` : '';
  return {
    id: x.id, cat: INBOX_CAT_KO[x.cat], icon: CAT_ICON[x.cat], when: dateLabel(x.date), title: x.title, body: x.answer ? x.answer.text : x.body,
    unread: !x.read || pending, pending, status, ...(x.link ? { link: x.link } : {}),
  };
}

export interface InboxVM { rows: InboxRowVM[]; unread: number; todo: number; filter: 'all' | 'todo' | 'info' }

export function inboxVM(g: GameState, filter: 'all' | 'todo' | 'info'): InboxVM {
  return { rows: inboxList(g, filter).map((x) => rowOf(g, x)), unread: unreadCount(g), todo: inboxList(g, 'todo').length, filter };
}

/** 홈 알림 카드 (안 읽은 것, 답할 것 먼저, 최대 n개) */
export function homeInboxVM(g: GameState, n = 3): { rows: InboxRowVM[]; unread: number } {
  const all = inboxList(g).filter((x) => !x.read || isPending(x));
  const sorted = [...all.filter(isPending), ...all.filter((x) => !isPending(x))];
  return { rows: sorted.slice(0, n).map((x) => rowOf(g, x)), unread: all.length };
}

export interface InboxDetailVM {
  id: number; cat: string; icon: IconName; when: string; title: string; body: string; pending: boolean; status: string;
  choices: { id: string; label: string; desc: string; disabled?: string }[];
  answer?: InboxItem['answer'];
  link?: InboxItem['link'];
}

export function inboxDetailVM(g: GameState, id: number): InboxDetailVM | null {
  const x = g.inbox?.items.find((i) => i.id === id);
  if (!x) return null;
  const r = rowOf(g, x);
  return { ...r, body: x.body, choices: x.choices ?? [], ...(x.answer ? { answer: x.answer } : {}) };
}

/** 홈 라이벌 카드 (20.5) */
export interface RivalCardVM { name: string; team: string; teamId: string; pos: string; age: number; ovr: number; rep: number; myRep: number; me: { ga: number; avg: string; apps: number; goals: number; assists: number }; them: { ga: number; avg: string; apps: number; goals: number | null; assists: number | null }; est: boolean; lead: number; record: string }

export function rivalCardVM(g: GameState): RivalCardVM | null {
  if (g.phase !== 'season') return null;
  const r = rivalOf(g);
  if (!r) return null;
  const st = g.playerStats?.[r.id];
  const h = g.rival?.history ?? [];
  const w = h.filter((x) => x[5] > 0).length;
  const l = h.filter((x) => x[5] < 0).length;
  return {
    name: r.name, team: r.team, teamId: r.teamId, pos: r.pos, age: r.age, ovr: r.ovr, rep: r.rep, myRep: r.myRep,
    // C.76g (디자인 195 비교 표): 경기·골·도움 따로. 추정 라이벌은 골+도움만 있어 골·도움은 null(—)
    me: { ga: r.me.ga, avg: r.me.avg ? r.me.avg.toFixed(2) : '-', apps: g.player.season.apps, goals: g.player.season.goals, assists: g.player.season.assists },
    them: { ga: r.ga, avg: r.avg ? r.avg.toFixed(2) : '-', apps: r.apps, goals: st && !r.est ? st[1] : null, assists: st && !r.est ? st[2] : null }, est: r.est,
    lead: r.me.ga - r.ga, record: h.length ? `지난 비교 ${w}승 ${h.length - w - l}무 ${l}패` : '첫 시즌',
  };
}

/** 홈 시즌 목표 카드 (18.9, C.65): 목표 3개 진행 (감독 · 구단 · 개인) */
export interface GoalRowVM { source: string; tier: GoalTier; tierKo: string; label: string; value: string; ratio: number; status: GoalStatus; statusKo: string; reward: string }
export interface GoalsCardVM { rows: GoalRowVM[]; ok: number; round: number; rounds: number }

const STATUS_KO: Record<GoalStatus, string> = { done: '달성', track: '순항', behind: '모자람', start: '시작 전' };

export function goalsCardVM(g: GameState): GoalsCardVM | null {
  if (g.phase !== 'season') return null;
  const gs = ensureGoals(g);
  if (!gs) return null;
  const rows = gs.list.map((x) => goalProgress(g, x)).map((p) => ({
    source: SOURCE_KO[p.source], tier: p.tier, tierKo: TIER_KO[p.tier], label: p.label, value: p.valueText, ratio: p.ratio, status: p.status, statusKo: STATUS_KO[p.status], reward: p.reward,
  }));
  return { rows, ok: rows.filter((r) => r.status === 'done' || r.status === 'track').length, round: g.league.round, rounds: g.league.schedule.length };
}
