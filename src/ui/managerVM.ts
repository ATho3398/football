// 감독 신뢰도·면담 화면 데이터 (C.62, 18.2·18.3 · 디자인 22 주전 경쟁 · 45 감독 면담)

import { isCaptain } from '../club';
import { BALANCE } from '../config/balance';
import { daysBetween } from '../calendar';
import { dayPlan, myMatchPosition, type GameState } from '../game';
import {
  bestPosition, captainCandidate, competition, ensureManager, managerData, meetingBlocked, meetingLine, meetingOptions, nextMeetingHint, startChance,
  type MeetingKind, type MeetingOption,
} from '../manager';
import { MANAGER_STYLE_KO } from '../../data/managers';
import { proficiencyOf, proficientOvr } from '../proficiency';
import { teamById } from '../league';
import { requestEligibility } from '../transfer';
import type { FieldPosition } from '../positions';

export interface RivalRowVM { name: string; detail: string; total: string; me: boolean; w: [number, number, number, number] }
export interface TrustLogVM { v: string; t: string; when: string; up: boolean }

export interface CompetitionVM {
  pos: string;
  chance: number;
  trust: number;
  manager: string;
  /** C.76g (디자인 198 감독 줄): 이름 · 성향 따로 */
  mgrName: string;
  mgrStyle: string;
  rows: RivalRowVM[];
  log: TrustLogVM[];
  hint: string;
  meeting: MeetingKind | null;
  perks: string[];
  /** 주장 칩 (C.63): 주장 / 주장 후보(C.62 영원한) / 없음 */
  captain: '' | '주장' | '주장 후보';
}

const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const r1 = (n: number) => Math.round(n * 10) / 10;

function when(days: number): string {
  if (days <= 0) return '오늘';
  if (days < 7) return `${days}일 전`;
  return `${Math.floor(days / 7)}주 전`;
}

/** 홈 "주전 경쟁" 카드 (디자인 22): 시즌 중에만 */
export function competitionVM(g: GameState): CompetitionVM | null {
  if (g.phase !== 'season' || g.trial) return null;
  const m = ensureManager(g);
  const p = g.player;
  const pos = myMatchPosition(g);
  const rows = competition(g, pos, 2);
  // 막대 50점부터 (디자인 22): 회색 = 슬롯 OVR(+ 음수 항), 파랑 = 신뢰도 +, 라임 = 폼 +, 빨강 = 빠진 몫(피로·음수 신뢰·폼)
  const top = Math.max(...rows.map((r) => r.ovr + Math.max(0, r.trust) + Math.max(0, r.form))) + 2;
  const span = Math.max(1, top - 50);
  const pct = (v: number) => Math.max(0, Math.round((v / span) * 1000) / 10);
  const vm = rows.map((r) => {
    const neg = Math.min(0, r.trust) + Math.min(0, r.form) + r.fatigue;
    const parts = [`${r.age}세`, `OVR ${r.ovr}`, `신뢰 ${sign(r.trust)}`, ...(r.form ? [`폼 ${sign(r.form)}`] : []), ...(r.fatigue ? [`피로 ${r.fatigue}`] : [])];
    return {
      name: r.me ? `${r.name} 나` : r.name, detail: parts.join(' · '), total: r.total.toFixed(1), me: r.me,
      w: [pct(r.ovr + neg - 50), pct(Math.max(0, r.trust)), pct(Math.max(0, r.form)), pct(-neg)] as [number, number, number, number],
    };
  });
  const team = teamById(g.league, p.teamId);
  const chance = Math.round(startChance(g, proficientOvr(p, pos), team.rating, p.fatigue) * 100);
  const md = managerData(p.teamId, g);
  const X = BALANCE.manager.meeting;
  const perks = [
    ...((m.perks.slot ?? 0) > 0 ? [`선호 슬롯 보장 ${m.perks.slot}경기`] : []),
    ...((m.perks.start ?? 0) > 0 ? [`주전 보장 ${m.perks.start}경기 (선발 ${Math.round(X.startFloor * 100)}%+)`] : []),
    ...((m.perks.chance ?? 0) > 0 ? [`감독이 준 기회 ${m.perks.chance}경기`] : []),
    ...(m.perks.effortUntil && daysBetween(g.calendar.date, m.perks.effortUntil) >= 0 ? [`훈련 XP ×${X.effortXp} (${daysBetween(g.calendar.date, m.perks.effortUntil) + 1}일)`] : []),
  ];
  return {
    pos, chance, trust: Math.round(m.trust), rows: vm, perks,
    manager: md ? `${md.nameKo} 감독 · ${MANAGER_STYLE_KO[md.style]}` : '감독 정보 없음',
    mgrName: md?.nameKo ?? '감독 정보 없음', mgrStyle: md ? MANAGER_STYLE_KO[md.style] : '',
    log: m.log.slice().reverse().map((e) => ({ v: sign(r1(e.delta)), t: e.why, when: when(daysBetween(e.date, g.calendar.date)), up: e.delta > 0 })),
    hint: nextMeetingHint(g), meeting: m.meeting, captain: isCaptain(g) ? '주장' : captainCandidate(g) ? '주장 후보' : '',
  };
}

/** 면담 선택지 + 결과 예고 (C.76i 디자인 191·192: 요구 강도 칩 · "이걸 고르면" 신뢰도 막대 ± · 보상 칩) */
export interface MeetingOptionVM extends MeetingOption {
  pv: { delta: number; chips: { label: string; tone: 'up' | 'down' | 'brand' | '' }[] };
}

export interface MeetingVM {
  kind: MeetingKind;
  trust: number;
  manager: string;
  line: string;
  section: string;
  chips: (string | { label: string; soft?: boolean })[];
  options: MeetingOptionVM[];
  blocked: string | null;
  /** 감독 · 내 역할 줄 (C.76i) */
  mgrName: string; mgrStyle: string;
  role: { title: string; line: string };
  /** 포지션 제안: 지금 → 제안 두 칸 */
  compare: { cur: PosCellVM; sug: PosCellVM } | null;
}

export interface PosCellVM { pos: string; formation: string; ovr: number; prof: number; chance: number }

const KIND_KO: Record<MeetingKind, string> = { low: '출전·신뢰 면담', reward: '보상 면담', position: '포지션 제안' };
const LOW_ORDER = ['effort', 'complain', 'request'];
const LOW_TAG: Record<string, string> = { effort: '요구 약하게', complain: '요구 세게', request: '요구 가장 세게' };
const POS_TAG: Record<string, string> = { follow: '받기', decline: '거절' };

/** 감독 면담 화면 (디자인 45 → C.76i 191·192). 열린 면담이 없으면 null */
export function meetingVM(g: GameState): MeetingVM | null {
  const m = ensureManager(g);
  const kind = m.meeting;
  if (!kind) return null;
  const md = managerData(g.player.teamId, g);
  const req = requestEligibility(g, true);
  const t = Math.round(m.trust);
  const X = BALANCE.manager.meeting;
  const level = t >= X.rewardFrom ? '신뢰도 높음' : t < X.lowBelow ? '신뢰도 낮음' : '신뢰도 보통';
  const p = g.player;
  const team = teamById(g.league, p.teamId);
  const pos = myMatchPosition(g);
  const chanceAt = (ps: FieldPosition) => Math.round(startChance(g, proficientOvr(p, ps), team.rating, p.fatigue) * 100);
  const chance = chanceAt(pos);
  const rank = competition(g, pos, 2).findIndex((r) => r.me) + 1;
  const best = bestPosition(g);
  const formation = g.tactics.formation;
  const cell = (ps: FieldPosition): PosCellVM => ({ pos: ps, formation, ovr: proficientOvr(p, ps), prof: Math.round(proficiencyOf(p, ps)), chance: chanceAt(ps) });
  const rest = { label: '오늘 훈련 → 휴식', tone: '' as const };
  const pv = (o: MeetingOption): MeetingOptionVM['pv'] => {
    switch (o.id) {
      case 'effort': return { delta: X.effortTrust, chips: [{ label: `신뢰도 +${X.effortTrust}`, tone: 'up' }, { label: `훈련 XP ×${X.effortXp} · ${X.effortDays}일`, tone: 'brand' }, rest] };
      case 'complain': return { delta: -X.complainTrust, chips: [{ label: `신뢰도 −${X.complainTrust}`, tone: 'down' }, { label: `기회 ${Math.round(X.complainChance * 100)}%`, tone: 'brand' }, rest] };
      case 'request': return { delta: 0, chips: [{ label: '이적 명단 요청', tone: 'brand' }, rest] };
      case 'slot': return { delta: 0, chips: [{ label: `보상 · ${o.title}`, tone: 'up' }, { label: `${pos} 선발 · ${X.slotGames}경기`, tone: 'brand' }, rest] };
      case 'card': return { delta: 0, chips: [{ label: `보상 · ${o.title}`, tone: 'up' }, { label: '희귀 3택 1', tone: 'brand' }, rest] };
      case 'start': return { delta: 0, chips: [{ label: `보상 · ${o.title}`, tone: 'up' }, { label: `선발 ${Math.round(X.startFloor * 100)}%+ · ${X.startGames}경기`, tone: 'brand' }, rest] };
      case 'follow': return { delta: X.posTrust, chips: [{ label: `신뢰도 +${X.posTrust}`, tone: 'up' }, { label: `선발 확률 ${chance}% → ${chanceAt(best.pos)}%`, tone: 'up' }, { label: `내 위치 ${pos} → ${best.pos}`, tone: 'brand' }, rest] };
      default: return { delta: 0, chips: [{ label: '변화 없음', tone: '' }, rest] };
    }
  };
  let opts = meetingOptions(g, kind, req);
  if (kind === 'low') opts = LOW_ORDER.map((id) => opts.find((o) => o.id === id)).filter((o): o is MeetingOption => !!o);
  return {
    kind, trust: t, manager: md ? `${md.nameKo} 감독` : '감독', line: meetingLine(g, kind),
    section: kind === 'reward' ? '보상 고르기' : kind === 'position' ? '제안에 답하기' : '어떻게 할까요',
    chips: [level, { label: KIND_KO[kind], soft: true }],
    options: opts.map((o) => ({ ...o, ...(kind === 'low' ? { tag: LOW_TAG[o.id] } : kind === 'position' ? { tag: POS_TAG[o.id] } : {}), pv: pv(o) })),
    blocked: meetingBlocked(g, dayPlan(g)),
    mgrName: md?.nameKo ?? '감독 정보 없음', mgrStyle: md ? MANAGER_STYLE_KO[md.style] : '',
    role: { title: chance >= 50 ? '주전' : '교체 자원', line: `${pos} ${rank || '—'}순위 · 선발 ${chance}%` },
    compare: kind === 'position' ? { cur: cell(pos), sug: cell(best.pos) } : null,
  };
}
