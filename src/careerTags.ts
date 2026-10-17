// 플레이로 붙는 커리어 태그 판정 (부록 C.47): 노익장·늦게 핀 꽃(pending 66·67) + 자연 발생 태그(pending 65).
// 내 선수는 시즌 끝(endSeason, 노화 전)에 판정해 태그로 저장하고 홈 알림 한 줄. 수치는 BALANCE.tags

import { BALANCE } from './config/balance';
import { agingRate, isVeteranAttribute, PHYSICAL } from './growth';
import { FIELD_ATTRIBUTES } from './attributes';
import { posGroup } from './roster';
import { TAGS, tagHas, type PlayerTag, type TagId } from './tags';
export type { PlayerTag };
import type { PlayerState, SeasonRecord, SeasonStats } from './types';

const rating = (s: Pick<SeasonStats, 'apps' | 'ratingSum'>): number | null => (s.apps > 0 ? s.ratingSum / s.apps : null);

export interface TagChange { added: PlayerTag[]; removed: PlayerTag[] }

function add(p: PlayerState, id: TagId, season: number, perm: boolean, ch: TagChange, extra: Partial<PlayerTag> = {}): void {
  if (tagHas(p, id)) return;
  const t: PlayerTag = { id, perm, season, ...extra };
  p.tags.push(t);
  ch.added.push(t);
}

function remove(p: PlayerState, id: TagId, ch: TagChange): void {
  const gone = p.tags.filter((t) => t.id === id);
  if (!gone.length) return;
  p.tags = p.tags.filter((t) => t.id !== id);
  ch.removed.push(...gone);
}

/**
 * 노익장 (30세 이후, 해제형): 시즌 평점 7.0+ 또는 OVR 80+ 유지(지난 시즌 대비 −1 이내) → 붙음.
 * 붙은 뒤 2시즌 연속 평점 6.5 미만이면 떨어진다. age = 그 시즌 나이, ovr = 시즌 끝 OVR(노화 전).
 * 노화 완화(×0.7)는 태그가 있고 그 시즌 조건을 채웠을 때만 (pending 67 "조건 유지 때만") → 돌려주는 값
 */
export function judgeEvergreen(p: PlayerState, season: number, age: number, ovr: number, ch: TagChange): boolean {
  const E = BALANCE.tags.evergreen;
  const r = rating(p.season);
  const prev = p.history.at(-1);
  const keep = ovr >= E.ovr && (!prev || ovr >= prev.ovr - E.keep);
  const met = age >= E.fromAge && p.season.apps >= E.minApps && ((r !== null && r >= E.rating) || keep);
  if (tagHas(p, 'evergreen')) {
    const prevR = prev ? rating(prev) : null;
    const low = (x: number | null) => x === null || x < E.dropBelow;
    if (low(r) && low(prevR) && E.dropSeasons === 2) remove(p, 'evergreen', ch);
  } else if (met) add(p, 'evergreen', season, false, ch);
  return met && tagHas(p, 'evergreen');
}

/**
 * 늦게 핀 꽃 (기록형): 한 포지션군에서 3시즌+ 뛴 뒤 전환 → 새 포지션군 첫 2시즌 안에
 * 시즌 평점 ≥ 옛 포지션 평균 + 0.3 또는 지금 OVR ≥ 옛 포지션 마지막 OVR + 3
 */
export function judgeLateBloomer(p: PlayerState, season: number, ovr: number, ch: TagChange): void {
  if (tagHas(p, 'lateBloomer')) return;
  const L = BALANCE.tags.lateBloomer;
  if (p.season.apps < L.minApps) return;
  const g = posGroup(p.position);
  const hist = p.history.filter((h): h is SeasonRecord & { position: NonNullable<SeasonRecord['position']> } => !!h.position);
  let i = hist.length - 1;
  let newSeasons = 1;
  while (i >= 0 && posGroup(hist[i]!.position) === g) {
    newSeasons++;
    i--;
  }
  if (newSeasons > L.window || i < 0) return;
  const old = posGroup(hist[i]!.position);
  const olds: SeasonRecord[] = [];
  while (i >= 0 && posGroup(hist[i]!.position) === old) olds.push(hist[i--]!);
  if (olds.length < L.oldSeasons) return;
  const played = olds.filter((h) => h.apps > 0);
  const oldAvg = played.length ? played.reduce((t, h) => t + h.ratingSum / h.apps, 0) / played.length : null;
  const r = rating(p.season);
  const byRating = r !== null && oldAvg !== null && r >= oldAvg + L.rating;
  const byOvr = ovr >= olds[0]!.ovr + L.ovr;
  if (byRating || byOvr) add(p, 'lateBloomer', season, true, ch);
}

/**
 * 늦게 핀 꽃 노화 면제 (B안): 신체·기술멘탈 각각 그 묶음의 첫 노화 1회를 건너뛴다 (이미 노화 중이면 다음 노화 1회).
 * 이번 시즌 노화에서 건너뛸 묶음을 돌려주고 태그에 쓴 것으로 적는다. age = 그 시즌 나이
 */
export function lateBloomerSkip(p: PlayerState, age: number): { phys?: boolean; other?: boolean } {
  const t = p.tags.find((x) => x.id === 'lateBloomer');
  if (!t) return {};
  const A = BALANCE.aging;
  const V = BALANCE.veteran;
  const used = new Set(t.used ?? []);
  const physAging = agingRate(A.physical, age) > 0;
  const otherAging = agingRate(A.other, age) > 0 && FIELD_ATTRIBUTES.some((a) => !PHYSICAL.includes(a) && (!isVeteranAttribute(a) || age >= V.agingFromAge));
  const out: { phys?: boolean; other?: boolean } = {};
  if (physAging && !used.has('phys')) {
    out.phys = true;
    used.add('phys');
  }
  if (otherAging && !used.has('other')) {
    out.other = true;
    used.add('other');
  }
  if (out.phys || out.other) t.used = [...used];
  return out;
}

/** 홈 알림 한 줄: "태그 · +노익장 · −유리몸" */
export function tagChangeLine(ch: TagChange): string | null {
  const name = (t: PlayerTag) => t.name ?? TAGS[t.id].ko;
  const parts = [...ch.added.map((t) => `+${name(t)}`), ...ch.removed.map((t) => `−${name(t)}`)];
  return parts.length ? `태그 · ${parts.join(' · ')}` : null;
}

// ── 자연 발생 태그 (pending 65, C.47): 시즌 끝(노화 전) 이번 시즌 경기 기록(matchLog·일정 득점 기록)으로 판정 ──

/** 통산 누적 (세이브): 더비 골, 80분 이후 결승·동점골, 전 소속 구단 상대 골, 빅매치 출전·평점 합 */
export interface TagStats { derbyGoals: number; lateGoals: number; exGoals: number; bigApps: number; bigSum: number }

export const emptyTagStats = (): TagStats => ({ derbyGoals: 0, lateGoals: 0, exGoals: 0, bigApps: 0, bigSum: 0 });

/** 판정에 필요한 게임 상태 (game.ts 순환 참조를 피해 필요한 것만) */
export interface NaturalInput {
  season: number;
  age: number;
  /** 시즌 끝 OVR (노화 전) */
  ovr: number;
  log: readonly { opponentId: string; minutes: number; started: boolean; goals: number; goalsAgainst: number; rating: number | null; round: number }[];
  /** 라운드별 내 경기 득점 기록 [분, 쪽(0 홈·1 원정), 득점자, 도움] 과 내 쪽 */
  goals: (round: number) => { recs: readonly (readonly [number, 0 | 1, string, string | null])[]; side: 0 | 1 } | null;
  myId: string;
  isDerby: (opp: string) => boolean;
  /** 시즌 전 레이팅 순위 */
  rank: (team: string) => number;
  /** 전 소속 구단 (지금 구단 제외) */
  formerClubs: readonly string[];
  /** 지금까지 뛴 구단 수 (지금 구단 포함) */
  clubs: number;
  /** 리그 다른 선수 시즌 최다 골·도움 */
  maxGoals: number;
  maxAssists: number;
  rounds: number;
}

const avg = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sd = (xs: readonly number[]) => {
  const m = avg(xs);
  return Math.sqrt(avg(xs.map((x) => (x - m) ** 2)));
};

/** 80분 이후 내 결승골·동점골 수 (그 골 뒤 동점이거나, 앞서 나가 끝까지 이김) */
export function lateDecisive(recs: readonly (readonly [number, 0 | 1, string, string | null])[], side: 0 | 1, myId: string, minute: number): number {
  const sorted = [...recs].sort((a, b) => a[0] - b[0]);
  const fin = sorted.reduce((t, g) => t + (g[1] === side ? 1 : -1), 0);
  let diff = 0;
  let n = 0;
  for (const g of sorted) {
    diff += g[1] === side ? 1 : -1;
    if (g[2] !== myId || g[1] !== side || g[0] < minute) continue;
    if (diff === 0 || (diff === 1 && fin >= 1 && fin === diff)) n++;
  }
  return n;
}

function setRecord(p: PlayerState, id: TagId, season: number, ch: TagChange): void {
  const t = p.tags.find((x) => x.id === id);
  if (t) {
    const n = Number(/×(\d+)$/.exec(t.name ?? '')?.[1] ?? 1) + 1;
    t.name = `${TAGS[id].ko} ×${n}`;
    t.season = season;
    ch.added.push(t);
  } else add(p, id, season, true, ch);
  p.reputation += BALANCE.tags.natural.recordRep;
}

/** 시즌 끝 자연 발생 태그 판정. 유지형은 조건이 깨지면 떨어지고 기록형은 남는다 */
export function judgeNatural(p: PlayerState, x: NaturalInput, ch: TagChange): void {
  const N = BALANCE.tags.natural;
  const st = (p.tagStats ??= emptyTagStats());
  const s = p.season;
  const r = rating(s);
  const prev = p.history.at(-1);
  const prevR = prev ? rating(prev) : null;
  const played = x.log.filter((m) => m.minutes > 0 && m.rating !== null);

  // 누적 기록
  for (const m of played) {
    const big = x.isDerby(m.opponentId) || x.rank(m.opponentId) <= N.bigTop;
    if (big) {
      st.bigApps++;
      st.bigSum += m.rating!;
    }
    if (x.isDerby(m.opponentId)) st.derbyGoals += m.goals;
    if (x.formerClubs.includes(m.opponentId)) st.exGoals += m.goals;
    const g = m.goals > 0 ? x.goals(m.round) : null;
    if (g) st.lateGoals += lateDecisive(g.recs, g.side, x.myId, N.lateMinute);
  }

  // 스타 플레이어 (유지형)
  if (tagHas(p, 'starPlayer')) {
    if ((r === null || r < N.starDrop) && (prevR === null || prevR < N.starDrop)) remove(p, 'starPlayer', ch);
  } else if (p.reputation >= N.starRep && r !== null && r >= N.starRating && prevR !== null && prevR >= N.starRating && s.apps >= 10) add(p, 'starPlayer', x.season, false, ch);

  // 원더키드 → 21세에 원더키드 출신
  if (tagHas(p, 'wonderkid') && x.age > N.wonderAge) {
    remove(p, 'wonderkid', ch);
    add(p, 'wonderkidFormer', x.season, true, ch);
  } else if (!tagHas(p, 'wonderkid') && !tagHas(p, 'wonderkidFormer') && x.age <= N.wonderAge && s.apps >= 10
    && ((r !== null && r >= N.wonderRating) || s.goals >= N.wonderPoints || s.assists >= N.wonderPoints)) add(p, 'wonderkid', x.season, false, ch);

  // 빅매치 체질 (유지형): 큰 경기 평균 − 통산 평균
  const allR = [...p.history.filter((h) => h.apps > 0).map((h) => h.ratingSum / h.apps), ...(r !== null ? [r] : [])];
  const bigDiff = st.bigApps >= N.bigApps ? st.bigSum / st.bigApps - avg(allR) : null;
  if (tagHas(p, 'bigGame')) {
    if (bigDiff !== null && bigDiff < N.bigKeep) remove(p, 'bigGame', ch);
  } else if (bigDiff !== null && bigDiff >= N.bigDiff) add(p, 'bigGame', x.season, false, ch);

  // 기록형: 더비 영웅, 극장골 장인, 친정 킬러, 저니맨
  if (st.derbyGoals >= N.derbyGoals) add(p, 'derbyHero', x.season, true, ch);
  if (st.lateGoals >= N.lateGoals) add(p, 'lateShow', x.season, true, ch);
  if (st.exGoals >= N.exClubGoals) add(p, 'exClubKiller', x.season, true, ch);
  if (x.clubs >= N.journeyClubs) add(p, 'journeyman', x.season, true, ch);
  // 컬트 히어로: 한 구단 3시즌+ & 더비 영웅·극장골 장인 (그 구단에 붙는다)
  const here = p.clubRun && p.clubRun.club === p.teamId ? x.season - p.clubRun.since + 1 : 0;
  if (here >= N.cultSeasons && (tagHas(p, 'derbyHero') || tagHas(p, 'lateShow')) && !p.tags.some((t) => t.id === 'cultHero' && t.club === p.teamId)) {
    add(p, 'cultHero', x.season, true, ch, { club: p.teamId });
  }

  // 슈퍼 서브 (유지형)
  const subGoals = played.filter((m) => !m.started).reduce((t, m) => t + m.goals, 0);
  if (tagHas(p, 'superSub')) {
    if (subGoals < N.superSubKeep) remove(p, 'superSub', ch);
  } else if (subGoals >= N.superSubGoals) add(p, 'superSub', x.season, false, ch);

  // 득점 기계 / 도움 장인 / 클린시트 장인 (기록형, 시즌별 횟수)
  if (s.goals > 0 && s.goals >= x.maxGoals) setRecord(p, 'goalMachine', x.season, ch);
  if (s.assists > 0 && s.assists >= x.maxAssists) setRecord(p, 'assistKing', x.season, ch);
  const g = posGroup(p.position);
  const cs = x.log.filter((m) => m.minutes >= N.cleanSheetMinutes && m.goalsAgainst === 0).length;
  if ((g === 'CB' || g === 'GK') && cs >= N.cleanSheets) setRecord(p, 'cleanSheet', x.season, ch);

  // 철인 (유지형): 리그 전 경기 또는 3000분+ 2시즌 연속
  const iron = (h: Pick<SeasonStats, 'apps' | 'minutes'>) => h.apps >= x.rounds || h.minutes >= N.ironMinutes;
  if (tagHas(p, 'everPresent')) {
    if (s.minutes < N.ironDrop) remove(p, 'everPresent', ch);
  } else if (iron(s) && prev && iron(prev)) add(p, 'everPresent', x.season, false, ch);

  // 유리몸 (둘 다 태그의 플레이 획득, 해제는 C.45 조건): 2시즌 안 부상 3회+ 또는 결장 60일+
  const inj = s.injuries + (prev?.injuries ?? 0);
  const days = (s.injuredWeeks + (prev?.injuredWeeks ?? 0)) * 7;
  if (!tagHas(p, 'glass') && !tagHas(p, 'ironMan') && (inj >= N.glassInjuries || days >= N.glassDays)) add(p, 'glass', x.season, false, ch, { play: true });

  // 꾸준함 / 롤러코스터 (둘 다 태그): 20경기 이상 시즌 평점 표준편차
  if (played.length >= N.sdApps && !tagHas(p, 'consistent') && !tagHas(p, 'rollercoaster')) {
    const v = sd(played.map((m) => m.rating!));
    if (v <= N.consistentSd) add(p, 'consistent', x.season, false, ch, { play: true });
    else if (v >= N.rollerSd) add(p, 'rollercoaster', x.season, false, ch, { play: true });
  }

  // 문제아 (둘 다 태그) / 신사 (유지형)
  if (!tagHas(p, 'troublemaker') && !tagHas(p, 'gentleman') && (s.yellows >= N.troubleYellows || s.reds >= N.troubleReds)) add(p, 'troublemaker', x.season, false, ch, { play: true });
  const clean = (h: Pick<SeasonStats, 'apps' | 'yellows' | 'reds'>) => h.apps >= N.sdApps && h.yellows <= N.gentleYellows && h.reds === 0;
  if (tagHas(p, 'gentleman')) {
    if (s.reds > 0 || s.yellows >= N.gentleDrop) remove(p, 'gentleman', ch);
  } else if (!tagHas(p, 'troublemaker') && clean(s) && p.history.slice(-(N.gentleSeasons - 1)).filter(clean).length >= N.gentleSeasons - 1) {
    add(p, 'gentleman', x.season, false, ch);
  }
}
