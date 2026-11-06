// 시즌 하이라이트 3 (22.2 끝 · I.13, 부록 C.73b): 시즌 경기 기록(matchLog)에서 최고 평점 경기 · 골 · 위기를 하나씩 고른다.
// 시즌 종료 요약에 보여 주고, 같은 후보(점수 포함)를 챕터 리뷰 하이라이트 후보로도 쓴다. 기록만 읽는 순수 함수다

import { BALANCE } from './config/balance';
import type { MatchLogEntry } from './matchRecord';

export type SeasonHighlightKind = 'best' | 'goal' | 'crisis';
export const SEASON_HL_KO: Record<SeasonHighlightKind, string> = { best: '최고 평점 경기', goal: '골', crisis: '위기' };

export interface SeasonHighlight {
  kind: SeasonHighlightKind; text: string; score: number;
  /** 카드 표시 (C.76j 디자인 224): 왼쪽 큰 숫자 · 단위, 라운드, 제목 줄 · 설명 줄 */
  card?: { big: string; unit: string; round: string; title: string; line: string };
}

const H = () => BALANCE.seasonHighlights;

function result(e: MatchLogEntry): string {
  return `${e.goalsFor}-${e.goalsAgainst} ${e.goalsFor > e.goalsAgainst ? '승' : e.goalsFor < e.goalsAgainst ? '패' : '무'}`;
}

const venue = (e: MatchLogEntry) => (e.home ? '홈' : '원정');

const bestScore = (e: MatchLogEntry): number => e.rating! + e.goals * H().best.goalW + e.assists * H().best.assistW;

/** 이긴 경기 골 차 ≤ 내 골, 또는 비긴 경기에서 넣은 골 = 승부를 가른 골 */
const decisive = (e: MatchLogEntry): boolean =>
  e.goals > 0 && ((e.goalsFor > e.goalsAgainst && e.goalsFor - e.goalsAgainst <= e.goals) || e.goalsFor === e.goalsAgainst);

/**
 * 시즌 하이라이트 3: 최고 평점 경기 · 골(없으면 도움) · 위기(부상 결장 연속 · 연패 · 최악 평점 경기 중 큰 것). 해당이 없으면 그 칸은 빠진다.
 * 골 경기는 최고 평점 경기와 다른 경기를 먼저 고른다
 */
export function seasonHighlights3(log: readonly MatchLogEntry[], oppName: (id: string) => string): SeasonHighlight[] {
  const out: SeasonHighlight[] = [];
  const played = log.filter((e) => e.minutes > 0 && e.rating !== null);
  const best = [...played].sort((a, b) => bestScore(b) - bestScore(a))[0];
  if (best) {
    const ga = [best.goals ? `${best.goals}골` : '', best.assists ? `${best.assists}도움` : ''].filter(Boolean).join(' ');
    out.push({
      kind: 'best', text: `${oppName(best.opponentId)}전 평점 ${best.rating!.toFixed(1)}${ga ? ` · ${ga}` : ''}${best.mom ? ' · MOM' : ''} · ${result(best)}`, score: bestScore(best),
      card: { big: best.rating!.toFixed(1), unit: '평점', round: `${best.round}R`, title: `${oppName(best.opponentId)}전 · ${venue(best)}`, line: [best.started ? '선발' : '교체', ga, best.mom ? 'MOM' : '', result(best)].filter(Boolean).join(' · ') },
    });
  }
  // 골: 골 수 + 승부를 가른 골. 같은 점수면 앞 경기. 최고 평점 경기와 다른 경기를 먼저
  const G = H().goal;
  const goalScore = (e: MatchLogEntry) => G.base + e.goals * G.perGoal + (decisive(e) ? G.decisive : 0);
  const scorers = played.filter((e) => e.goals > 0).sort((a, b) => goalScore(b) - goalScore(a));
  const gm = scorers.find((e) => e !== best) ?? scorers[0];
  if (gm) {
    const what = gm.goals >= 3 ? `해트트릭(${gm.goals}골)` : `${gm.goals}골`;
    const tag = decisive(gm) ? (gm.goalsFor === gm.goalsAgainst ? ' · 지지 않게 한 골' : ' · 승부를 가른 골') : '';
    out.push({
      kind: 'goal', text: `${oppName(gm.opponentId)}전 ${what} · ${result(gm)}${tag}`, score: goalScore(gm),
      card: { big: String(gm.goals), unit: '골', round: `${gm.round}R`, title: `${oppName(gm.opponentId)}전 · ${venue(gm)}`, line: `${result(gm)}${tag}` },
    });
  } else {
    const am = played.filter((e) => e.assists > 0).sort((a, b) => b.assists - a.assists)[0];
    if (am) {
      out.push({
        kind: 'goal', text: `골은 없었지만 ${oppName(am.opponentId)}전 ${am.assists}도움 · ${result(am)}`, score: G.base - 1 + am.assists * G.perAssist,
        card: { big: String(am.assists), unit: '도움', round: `${am.round}R`, title: `${oppName(am.opponentId)}전 · ${venue(am)}`, line: `골은 없었지만 ${am.assists}도움 · ${result(am)}` },
      });
    }
  }
  const crisis = crisisOf(log, played, oppName);
  if (crisis) out.push(crisis);
  return out;
}

function crisisOf(log: readonly MatchLogEntry[], played: readonly MatchLogEntry[], oppName: (id: string) => string): SeasonHighlight | null {
  const C = H().crisis;
  const cands: SeasonHighlight[] = [];
  // 부상 결장 연속 (가장 긴 것)
  let run: MatchLogEntry[] = [];
  let longest: MatchLogEntry[] = [];
  for (const e of log) {
    if (e.absent === 'injured') run.push(e);
    else run = [];
    if (run.length > longest.length) longest = [...run];
  }
  if (longest.length) {
    const a = longest[0]!.round;
    const b = longest.at(-1)!.round;
    const first = longest[0]!; const last = longest.at(-1)!;
    cands.push({
      kind: 'crisis', text: `부상으로 ${longest.length}경기 결장 (${a === b ? `${a}R` : `${a}~${b}R`})`, score: Math.min(C.injuryMax, C.injuryBase + longest.length * C.injuryPer),
      card: { big: String(longest.length), unit: '경기', round: a === b ? `${a}R` : `${a}~${b}R`, title: `부상 · ${longest.length}경기 결장`, line: a === b ? `${a}R ${oppName(first.opponentId)} ${venue(first)}` : `${a}R ${oppName(first.opponentId)} ${venue(first)}부터 ${b}R ${oppName(last.opponentId)} ${venue(last)}까지` },
    });
  }
  // 팀 연패 (결장 경기 포함)
  let lose = 0;
  let worstRun = 0;
  let runEnd = 0;
  for (const e of log) {
    lose = e.goalsFor < e.goalsAgainst ? lose + 1 : 0;
    if (lose > worstRun) { worstRun = lose; runEnd = e.round; }
  }
  if (worstRun >= C.minLosing) {
    cands.push({
      kind: 'crisis', text: `팀 ${worstRun}연패 (${runEnd - worstRun + 1}~${runEnd}R)`, score: C.losingBase + worstRun * C.losingPer,
      card: { big: String(worstRun), unit: '연패', round: `${runEnd - worstRun + 1}~${runEnd}R`, title: `팀 ${worstRun}연패`, line: '결장 경기를 포함한 팀 결과예요' },
    });
  }
  // 최악 평점 경기
  const worst = [...played].sort((a, b) => a.rating! - b.rating!)[0];
  if (worst && worst.rating! < C.worstBelow) {
    cands.push({
      kind: 'crisis', text: `${oppName(worst.opponentId)}전 평점 ${worst.rating!.toFixed(1)} · ${result(worst)}`, score: C.worstBase + (C.worstBelow - worst.rating!),
      card: { big: worst.rating!.toFixed(1), unit: '평점', round: `${worst.round}R`, title: `${oppName(worst.opponentId)}전 · ${venue(worst)}`, line: `최악 평점 경기 · ${result(worst)}` },
    });
  }
  return cands.sort((a, b) => b.score - a.score)[0] ?? null;
}
