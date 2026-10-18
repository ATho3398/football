// 감독 신뢰도·면담 화면 데이터 (C.62, 18.2·18.3 · 디자인 22 주전 경쟁 · 45 감독 면담)

import { isCaptain } from '../club';
import { BALANCE } from '../config/balance';
import { daysBetween } from '../calendar';
import { dayPlan, myMatchPosition, type GameState } from '../game';
import {
  captainCandidate, competition, ensureManager, managerData, meetingBlocked, meetingLine, meetingOptions, nextMeetingHint, startChance,
  type MeetingKind, type MeetingOption,
} from '../manager';
import { MANAGER_STYLE_KO } from '../../data/managers';
import { proficientOvr } from '../proficiency';
import { teamById } from '../league';
import { requestEligibility } from '../transfer';

export interface RivalRowVM { name: string; detail: string; total: string; me: boolean; w: [number, number, number, number] }
export interface TrustLogVM { v: string; t: string; when: string; up: boolean }

export interface CompetitionVM {
  pos: string;
  chance: number;
  trust: number;
  manager: string;
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
    log: m.log.slice().reverse().map((e) => ({ v: sign(r1(e.delta)), t: e.why, when: when(daysBetween(e.date, g.calendar.date)), up: e.delta > 0 })),
    hint: nextMeetingHint(g), meeting: m.meeting, captain: isCaptain(g) ? '주장' : captainCandidate(g) ? '주장 후보' : '',
  };
}

export interface MeetingVM {
  kind: MeetingKind;
  trust: number;
  manager: string;
  line: string;
  section: string;
  chips: (string | { label: string; soft?: boolean })[];
  options: MeetingOption[];
  blocked: string | null;
}

const KIND_KO: Record<MeetingKind, string> = { low: '출전·신뢰 면담', reward: '보상 면담', position: '포지션 제안' };

/** 감독 면담 화면 (디자인 45). 열린 면담이 없으면 null */
export function meetingVM(g: GameState): MeetingVM | null {
  const m = ensureManager(g);
  const kind = m.meeting;
  if (!kind) return null;
  const md = managerData(g.player.teamId, g);
  const req = requestEligibility(g, true);
  const t = Math.round(m.trust);
  const level = t >= BALANCE.manager.meeting.rewardFrom ? '신뢰도 높음' : t < BALANCE.manager.meeting.lowBelow ? '신뢰도 낮음' : '신뢰도 보통';
  return {
    kind, trust: t, manager: md ? `${md.nameKo} 감독` : '감독', line: meetingLine(g, kind),
    section: kind === 'reward' ? '보상 고르기' : kind === 'position' ? '제안에 답하기' : '어떻게 할까요',
    chips: [level, { label: KIND_KO[kind], soft: true }],
    options: meetingOptions(g, kind, req),
    blocked: meetingBlocked(g, dayPlan(g)),
  };
}
