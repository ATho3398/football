// 시작 소속·1군 테스트·재계약 판정·스토리 태그 (pending 61·62, 부록 C.45 10·12·13번).
// 유스 시스템은 만들지 않는다: 유스는 서사(기록·문구)이고 게임 시작 = 성인팀 계약 시점이다.
// 15~18세 + 유스 구단 선택 = 시즌 첫 리그 경기 테스트(출전 보장) → 합격(유스 구단 + 경쟁 제안) / 연장 / 방출(자유계약 영입 제안).
// 수치는 BALANCE.startClub. 구단 재정 조건은 34b C.46 에서 붙인다 (지금은 C.42 제안 규칙)

import { BALANCE } from './config/balance';
import type { GameState } from './game';
import { proficientOvr } from './proficiency';
import { createRng, hashSeed, type Rng } from './rng';
import { randInt } from './growth';
import { contractYears, expectedStart, makeOffers, wageFor, type Offer } from './transfer';
import { wageMul } from './traits';

// ── 스토리 태그 (효과 없이 기능만, 62.4) ──

export type StoryTagId = 'academy' | 'homeChoice' | 'loyalReturn' | 'oneClubMan' | 'releasedPain';

export interface StoryTag {
  id: StoryTagId;
  /** 화면 이름 (아카데미는 "라 마시아 출신" 등) */
  name: string;
  desc: string;
  /** 얻은 시즌·날짜 */
  season: number;
  date: string;
  /** 관련 구단 */
  club?: string;
}

/** 유명 아카데미 고유 이름 (나머지는 "○○ 유스"). 리그 밖 구단은 6단계에서 리그가 생기면 같은 규칙으로 */
export const ACADEMY_NAMES: Readonly<Record<string, string>> = {
  ars: '헤일 엔드', che: '코범 아카데미', liv: '커크비 아카데미', mun: '캐링턴 아카데미', mci: '시티 풋볼 아카데미',
  tot: '핫스퍼 웨이 아카데미', sou: '스테이플우드', whu: '아카데미 오브 풋볼', eve: '핀치 팜', lei: '시그레이브 아카데미',
  'x:bar': '라 마시아', 'x:rma': '라 파브리카', 'x:ajx': '데 토코마스트', 'x:slb': '세이샬', 'x:bay': 'FC 바이에른 캠퍼스',
  'x:atm': '아틀레티코 아카데미', 'x:juv': '비노보', 'x:psg': '캉 데 로주',
};

export function academyName(teamId: string, teamName: string): string {
  return ACADEMY_NAMES[teamId] ?? `${teamName} 유스`;
}

export const STORY_TAG_DESC: Readonly<Record<StoryTagId, string>> = {
  academy: '유스 구단에서 1군 테스트에 합격해 첫 계약',
  homeChoice: '더 많은 연봉 제안을 두고 유스 구단과 계약',
  loyalReturn: '유스 구단을 떠났다가 다시 돌아옴',
  oneClubMan: `한 구단에서만 ${BALANCE.startClub.oneClubSeasons}시즌 이상`,
  releasedPain: '1군 테스트·재계약에서 방출된 뒤 다른 팀에서 시작',
};

/** 효과 훅 (지금은 모두 0): 아카데미 출신 → 그 구단 대표 성향 숙련도, 충성심 → 감독 신뢰도 (5-1·5-2 에서 값) */
export function academyTacticBonus(_p: { tags?: StoryTag[] }, _teamId: string): number {
  return 0;
}
export function loyaltyTrustBonus(_p: { tags?: StoryTag[] }, _teamId: string): number {
  return 0;
}

export function addTag(state: GameState, id: StoryTagId, name: string, club?: string): StoryTag | null {
  const p = state.player;
  const tags = (p.tags ??= []);
  if (tags.some((t) => t.id === id && t.club === club)) return null;
  const tag: StoryTag = { id, name, desc: STORY_TAG_DESC[id], season: state.league.season, date: state.calendar.date, ...(club ? { club } : {}) };
  tags.push(tag);
  state.market.notice = `새 이야기 · ${name}`;
  return tag;
}

// ── 시작 소속 ──

export type StartKind = 'youth' | 'club' | 'none';

export interface StartChoice {
  kind: StartKind;
  /** youth: 유스 구단(테스트), club: 계약할 팀 */
  club?: string;
  /** none: 서사용 유스 구단 (없거나 'random' 이면 시드로) */
  youthClub?: string;
}

/** 1군 테스트 진행 (세이브) */
export interface TrialState {
  teamId: string;
  games: number;
  ratings: number[];
  goals: number;
  assists: number;
  /** 4~5경기 연장 중 */
  extended: boolean;
}

const teamName = (state: GameState, id: string) => state.league.teams.find((t) => t.id === id)?.nameKo ?? id;
const ratingOf = (state: GameState, id: string) => state.league.teams.find((t) => t.id === id)?.rating ?? 70;

/** 유효 OVR (어린 선수는 잠재력만큼 높여 본다, 제안 모델과 같은 식) + 유스 완화 */
export function judgeOvr(state: GameState, teamId: string): number {
  const O = BALANCE.transfer.offers;
  const p = state.player;
  const ovr = proficientOvr(p, p.position) + Math.max(0, O.youthAge - p.age) * O.youthPerYear;
  return ovr + (p.youth?.club === teamId ? BALANCE.startClub.youthRelief : 0);
}

/** 19세 이상 "소속팀 선택" 목록: 스탯에 맞는 팀 (유효 OVR 과 레이팅 차가 작은 순) */
export function fitTeams(state: GameState): string[] {
  const O = BALANCE.transfer.offers;
  const eff = judgeOvr(state, '');
  return [...state.league.teams]
    .sort((a, b) => Math.abs(eff - a.rating - O.fitOffset) - Math.abs(eff - b.rating - O.fitOffset) || a.id.localeCompare(b.id))
    .slice(0, BALANCE.startClub.fitTeams)
    .map((t) => t.id);
}

/** 자유계약 영입 제안 (최소 freeOffers[0]개). exclude 팀은 빼고, C.42 제안 규칙 */
export function freeAgentOffers(state: GameState, tag: string, exclude: readonly string[] = []): Offer[] {
  const S = BALANCE.startClub;
  const rng = createRng(hashSeed(`${state.worldSeed}:free-offers:${tag}`));
  const n = randInt(rng, S.freeOffers[0], S.freeOffers[1]);
  const all = makeOffers(state, 'summer', `free-${tag}`).filter((o) => o.kind === 'transfer' && !exclude.includes(o.teamId));
  const out = all.slice(0, n);
  // 모자라면 레이팅이 낮은 팀부터 채운다 (자유계약이라 누군가는 데려간다)
  const p = state.player;
  const have = new Set([...out.map((o) => o.teamId), ...exclude, p.teamId]);
  for (const t of [...state.league.teams].sort((a, b) => a.rating - b.rating)) {
    if (out.length >= n) break;
    if (have.has(t.id)) continue;
    out.push(offerFor(state, t.id, rng));
    have.add(t.id);
  }
  return out;
}

function offerFor(state: GameState, teamId: string, rng: Rng): Offer {
  const p = state.player;
  const [lo, hi] = contractYears(p.age);
  return {
    teamId, kind: 'transfer', years: randInt(rng, lo, hi), wage: wageFor(p.reputation, proficientOvr(p, p.position), ratingOf(state, teamId), wageMul(p)),
    start: expectedStart(state, teamId), interest: 0,
  };
}

/** 커스텀 생성 시작 소속 적용 (newGame 마지막). 랜덤 생성·실제 선수는 부르지 않는다 */
export function applyStart(state: GameState, c: StartChoice): void {
  const p = state.player;
  const S = BALANCE.startClub;
  const ids = state.league.teams.map((t) => t.id);
  const pick = (id: string | undefined, salt: string) =>
    id && ids.includes(id) ? id : ids[Math.floor(createRng(hashSeed(`${state.worldSeed}:youth:${salt}`))() * ids.length)]!;
  const m = state.market;
  if (c.kind === 'youth' && p.age <= S.trialMaxAge) {
    // 1군 콜업 (임시, 정식 계약 전): 그 시즌 첫 리그 경기들이 테스트
    const club = pick(c.club, 'trial');
    p.youth = { club };
    moveTo(state, club);
    m.contract = { ...m.contract, teamId: club, until: state.league.season };
    state.trial = { teamId: club, games: 0, ratings: [], goals: 0, assists: 0, extended: false };
    m.notice = `${teamName(state, club)} 1군 콜업 · 첫 리그 ${S.trialGames}경기가 테스트예요`;
    return;
  }
  if (c.kind === 'club' && c.club && ids.includes(c.club)) {
    p.youth = { club: c.club };
    moveTo(state, c.club);
    m.contract = { ...m.contract, teamId: c.club };
    m.notice = `${teamName(state, c.club)}와 계약했어요`;
    return;
  }
  // 소속팀 없음: 유스는 서사만, 시작 때 영입 제안
  const youth = pick(c.youthClub === 'random' ? undefined : c.youthClub, 'none');
  p.youth = { club: youth, ...(c.youthClub && c.youthClub !== 'random' ? {} : { random: true }) };
  moveTo(state, youth);
  m.free = true;
  m.offers = freeAgentOffers(state, `start`, [youth]);
  delete m.offerWindow;
  m.notice = '소속팀 없이 시작 · 영입 제안이 왔어요';
}

function moveTo(state: GameState, teamId: string): void {
  state.player.teamId = teamId;
}

// ── 1군 테스트 (시즌 첫 리그 경기) ──

export type TrialVerdict = 'pass' | 'fail' | 'extend' | null;

/** 테스트 판정 (games 경기 뒤). 아주 좋음/아주 나쁨은 바로, 그 사이는 점수, 최대 경기면 통과/방출 중 하나 */
export function trialVerdict(state: GameState, t: TrialState): TrialVerdict {
  const S = BALANCE.startClub;
  if (t.games < S.trialGames) return null;
  const avg = t.ratings.reduce((a, b) => a + b, 0) / Math.max(1, t.ratings.length);
  const pts = t.goals + t.assists;
  if (avg >= S.greatRating || (pts >= S.greatPoints && t.goals >= S.greatGoals)) return 'pass';
  if (avg < S.badRating && pts === 0) return 'fail';
  const score = avg - S.pivot + S.statWeight * (judgeOvr(state, t.teamId) - ratingOf(state, t.teamId));
  if (score >= S.passScore) return 'pass';
  if (score <= S.failScore) return 'fail';
  if (t.games >= S.trialMaxGames) return score >= 0 ? 'pass' : 'fail';
  return 'extend';
}

/** 내 팀 리그 경기 뒤 (출전했든 아니든 경기 수는 센다 — 테스트 중에는 출전 보장) */
export function afterTrialMatch(state: GameState, r: { minutes: number; rating: number | null; goals: number; assists: number }): TrialVerdict {
  const t = state.trial;
  if (!t) return null;
  t.games++;
  if (r.minutes > 0 && r.rating !== null) t.ratings.push(r.rating);
  t.goals += r.goals;
  t.assists += r.assists;
  const v = trialVerdict(state, t);
  const S = BALANCE.startClub;
  const m = state.market;
  const name = teamName(state, t.teamId);
  if (v === 'extend') {
    if (!t.extended) m.notice = `${name} 1군 테스트 연장 · ${S.trialMaxGames}경기까지 지켜봐요`;
    t.extended = true;
  } else if (v === 'pass') {
    state.trial = null;
    passOffers(state, t.teamId);
    m.notice = `${name} 1군 테스트 합격 · 계약 제안이 왔어요`;
  } else if (v === 'fail') {
    state.trial = null;
    release(state, `trial`, `${name} 1군 테스트 불합격 · 방출됐어요. 영입 제안을 골라요`);
  }
  return v;
}

/** 합격: 유스 구단 계약 제안(연봉 낮게) + 다른 팀 경쟁 제안 2~3개 (하위권일수록 연봉 더) */
function passOffers(state: GameState, club: string): void {
  const S = BALANCE.startClub;
  const rng = createRng(hashSeed(`${state.worldSeed}:pass:${club}`));
  const n = randInt(rng, S.rivalOffers[0], S.rivalOffers[1]);
  const rivals = freeAgentOffers(state, `pass-${club}`, [club]).slice(0, n);
  const teams = state.league.teams.length;
  for (const o of rivals) {
    const rank = 1 + state.league.teams.filter((t) => t.rating > ratingOf(state, o.teamId)).length;
    o.wage = Math.round((o.wage * (1 + S.rivalWageBoost * (rank / teams))) / 50) * 50;
  }
  const avg = rivals.reduce((t, o) => t + o.wage, 0) / Math.max(1, rivals.length);
  const k = S.youthWage[0] + (S.youthWage[1] - S.youthWage[0]) * rng();
  const own = offerFor(state, club, rng);
  own.wage = Math.max(50, Math.round((avg * k) / 50) * 50);
  own.youth = true;
  state.market.offers = [own, ...rivals];
  delete state.market.offerWindow;
  state.market.free = true;
}

/** 방출: 자유계약 신분 → 영입 제안 (소속팀 제외) */
export function release(state: GameState, tag: string, notice: string): void {
  const m = state.market;
  m.free = true;
  m.released = true;
  m.renewal = null;
  m.offers = freeAgentOffers(state, `${tag}-${state.league.season}`, [state.player.teamId]);
  delete m.offerWindow;
  m.notice = notice;
}

/** 재계약 판정 (커스텀 생성 선수만, 유스 완화 유지). 크게 모자라면 재계약 실패·방출 */
export function renewalFails(state: GameState): boolean {
  const p = state.player;
  if (!p.custom) return false;
  return judgeOvr(state, p.teamId) < ratingOf(state, p.teamId) - BALANCE.startClub.renewGap;
}

/** 제안 수락 뒤 태그: 유스 구단 첫 계약(아카데미 출신), 친정 선택, 귀환, 방출의 설움 */
export function afterAccept(state: GameState, o: Offer, others: readonly Offer[], fromTeam: string): void {
  const p = state.player;
  const m = state.market;
  const youth = p.youth?.club;
  const released = !!m.released;
  m.free = false;
  m.released = false;
  if (youth && o.teamId === youth && !p.tags?.some((t) => t.id === 'academy')) {
    addTag(state, 'academy', `${academyName(youth, teamName(state, youth))} 출신`, youth);
    if (others.some((x) => x !== o && x.wage > o.wage)) addTag(state, 'homeChoice', '친정 선택', youth);
  } else if (youth && o.teamId === youth && fromTeam !== youth && m.moves.some((mv) => mv.from === youth)) {
    addTag(state, 'loyalReturn', '무한한 충성심', youth);
  }
  if (released && o.teamId !== fromTeam) addTag(state, 'releasedPain', '방출의 설움', o.teamId);
}

/** 시즌 끝: 원클럽맨 (한 구단 oneClubSeasons 시즌 이상, 이적 기록 없음) */
export function seasonEndTags(state: GameState): void {
  const p = state.player;
  const h = p.history;
  if (h.length >= BALANCE.startClub.oneClubSeasons && h.every((r) => r.teamId === p.teamId) && !state.market.moves.some((mv) => !mv.back)) {
    addTag(state, 'oneClubMan', '원클럽맨', p.teamId);
  }
}
