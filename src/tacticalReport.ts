// 경기 후 전술 리포트 (21.5.2): 엔진이 이미 기록하는 팀 통계(TeamStats)만 읽어 숫자 줄과 판정 카드(최대 2장)를 만든다.
// 엔진, 밸런스, 세이브는 바꾸지 않는다. 경계값은 BALANCE.tacticalReport (실제 시즌 빈도로 조정, 부록 C.22)

import { BALANCE } from './config/balance';
import type { Tactics, TeamStats } from './engine/types';

export type Tendency = Tactics['tendency'];

/** 한 팀 시점의 리포트 입력 (우리 / 상대) */
export interface ReportSide {
  poss: number;
  shots: number;
  onTarget: number;
  counterShots: number;
  oppHalfWins: number;
  passes: number;
  passesCompleted: number;
  longPasses: number;
  longCompleted: number;
  offsides: number;
  crosses: number;
  crossesCompleted: number;
  centralShots: number;
}

export interface ReportInput {
  tendency: Tendency;
  own: ReportSide;
  opp: ReportSide;
}

function side(s: TeamStats, poss: number): ReportSide {
  return {
    poss, shots: s.shots, onTarget: s.shotsOnTarget, counterShots: s.counterShots, oppHalfWins: s.oppHalfWins,
    passes: s.passes, passesCompleted: s.passesCompleted, longPasses: s.longPasses, longCompleted: s.longCompleted,
    offsides: s.offsides, crosses: s.crosses, crossesCompleted: s.crossesCompleted, centralShots: s.centralShots,
  };
}

/** 엔진 팀 통계 [홈, 원정] → 내 팀(side) 시점 입력 */
export function reportInput(stats: readonly [TeamStats, TeamStats], mySide: 0 | 1, tendency: Tendency): ReportInput {
  const own = stats[mySide];
  const opp = stats[mySide === 0 ? 1 : 0];
  const p = Math.round((own.possessionTicks / Math.max(1, own.possessionTicks + opp.possessionTicks)) * 100);
  return { tendency, own: side(own, p), opp: side(opp, 100 - p) };
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
export const longShare = (s: ReportSide) => pct(s.longPasses, s.passes);
export const passPct = (s: ReportSide) => pct(s.passesCompleted, s.passes);
export const longPct = (s: ReportSide) => pct(s.longCompleted, s.longPasses);

export interface Verdict {
  /** 판정 id (빈도 측정용): 성향은 'tendency:ok' 형식, 공통은 'common:<n>' */
  id: string;
  ok: boolean;
  title: string;
  detail: string;
}

/** ① 내 팀 성향 판정. 보통이면 null (표시하지 않음) */
export function tendencyVerdict(r: ReportInput): Verdict | null {
  const T = BALANCE.tacticalReport;
  const { own: o, opp: x } = r;
  const v = (ok: boolean, title: string, detail: string): Verdict => ({ id: `${r.tendency}:${ok ? 'ok' : 'bad'}`, ok, title, detail });
  switch (r.tendency) {
    case 'counter':
      if (o.counterShots >= T.counter.okMin && o.counterShots >= o.shots * T.counter.okShare) {
        return v(true, '역습이 통했어요', `슈팅 ${o.shots}개 중 ${o.counterShots}개가 역습에서 나왔어요`);
      }
      if (o.counterShots <= T.counter.badMax) return v(false, '역습 기회가 거의 없었어요', `역습 슈팅 ${o.counterShots}개`);
      return null;
    case 'gegenpress':
      if (o.oppHalfWins >= T.gegenpress.okMin && o.oppHalfWins >= x.oppHalfWins * T.gegenpress.okRatio) {
        return v(true, '높은 곳에서 공을 뺏었어요', `상대 진영 탈취 ${o.oppHalfWins}회(상대 ${x.oppHalfWins}회)`);
      }
      if (o.oppHalfWins <= x.oppHalfWins) return v(false, '압박이 벗겨졌어요', `상대 진영 탈취 ${o.oppHalfWins}회(상대 ${x.oppHalfWins}회)`);
      return null;
    case 'tikitaka':
      if (o.poss >= T.tikitaka.okPoss && passPct(o) >= T.tikitaka.okPassPct && o.shots > x.shots) {
        return v(true, '공을 지배했어요', `점유 ${o.poss}%, 패스 성공 ${passPct(o)}%`);
      }
      if (o.poss >= T.tikitaka.badPoss && o.shots <= x.shots) {
        return v(false, '돌리기만 했어요', `점유 ${o.poss}%인데 슈팅 ${o.shots}개(상대 ${x.shots}개)`);
      }
      return null;
    case 'direct':
      if (longShare(o) >= T.direct.okLongShare && longPct(o) >= T.direct.okLongPct) {
        return v(true, '롱볼이 먹혔어요', `긴 패스 ${o.longPasses}개 중 ${o.longCompleted}개 연결`);
      }
      if (o.longPasses > 0 && longPct(o) < T.direct.badLongPct) {
        return v(false, '롱볼이 자주 끊겼어요', `긴 패스 ${o.longPasses}개 중 ${o.longCompleted}개 연결`);
      }
      return null;
    case 'block':
    case 'bus':
      if (x.onTarget <= T.block.okOppOnMax && x.centralShots <= T.block.okOppCentralMax) {
        return v(true, '블록이 버텼어요', `상대 유효 슈팅 ${x.onTarget}개`);
      }
      if (x.onTarget >= T.block.badOppOn) return v(false, '블록이 뚫렸어요', `상대 유효 슈팅 ${x.onTarget}개`);
      return null;
    case 'balanced':
      if (o.shots > x.shots && o.onTarget > x.onTarget) return v(true, '경기를 주도했어요', `슈팅 ${o.shots} 대 ${x.shots}`);
      if (o.shots < x.shots && o.onTarget < x.onTarget) return v(false, '주도권을 내줬어요', `슈팅 ${o.shots} 대 ${x.shots}`);
      return null;
  }
}

/** ② 공통 판정 (우선순위 순, 해당하는 첫 번째 1장) */
export function commonVerdict(r: ReportInput): Verdict | null {
  const C = BALANCE.tacticalReport.common;
  const { own: o, opp: x, tendency: t } = r;
  const v = (n: number, ok: boolean, title: string, detail: string): Verdict => ({ id: `common:${n}`, ok, title, detail });
  if (x.counterShots >= C.oppCounter) return v(1, false, '역습을 자주 맞았어요', `상대 역습 슈팅 ${x.counterShots}개`);
  if (t !== 'tikitaka' && o.poss >= C.possNoShots && o.shots <= x.shots) {
    return v(2, false, '점유를 슈팅으로 못 바꿨어요', `점유 ${o.poss}%, 슈팅 ${o.shots} 대 ${x.shots}`);
  }
  if (t !== 'direct' && longShare(o) >= C.longShare) return v(3, false, '롱볼에 기댔어요', `긴 패스 비율 ${longShare(o)}%`);
  if (o.offsides >= C.offsides) return v(4, false, `오프사이드에 ${o.offsides}번 걸렸어요`, `오프사이드 ${o.offsides}회(상대 ${x.offsides}회)`);
  if (o.crosses >= C.crosses && pct(o.crossesCompleted, o.crosses) < C.crossPct) {
    return v(5, false, '크로스가 안 통했어요', `${o.crosses}개 중 ${o.crossesCompleted}개`);
  }
  if (t !== 'gegenpress' && o.oppHalfWins >= C.pressWins) return v(6, true, '전방 압박이 잘 됐어요', `상대 진영 탈취 ${o.oppHalfWins}회`);
  return null;
}

export interface ReportRow {
  label: string;
  own: string;
  opp: string;
}

export interface TacticalReport {
  tendency: Tendency;
  verdicts: Verdict[];
  rows: ReportRow[];
}

/** 숫자 줄 (우리 / 상대, 항상 표시) + 판정 카드 최대 2장 */
export function tacticalReport(r: ReportInput): TacticalReport {
  const { own: o, opp: x } = r;
  const rows: ReportRow[] = [
    { label: '점유율', own: `${o.poss}%`, opp: `${x.poss}%` },
    { label: '슈팅(유효)', own: `${o.shots}(${o.onTarget})`, opp: `${x.shots}(${x.onTarget})` },
    { label: '역습 슈팅', own: `${o.counterShots}`, opp: `${x.counterShots}` },
    { label: '상대 진영 탈취', own: `${o.oppHalfWins}`, opp: `${x.oppHalfWins}` },
    { label: '롱패스 비율', own: `${longShare(o)}%`, opp: `${longShare(x)}%` },
    { label: '패스 성공률', own: `${passPct(o)}%`, opp: `${passPct(x)}%` },
  ];
  const verdicts = [tendencyVerdict(r), commonVerdict(r)].filter((v): v is Verdict => v !== null);
  return { tendency: r.tendency, verdicts, rows };
}
