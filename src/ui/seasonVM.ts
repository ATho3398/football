// C.76j U8-e 뷰모델: 경기 결과 대회 배너(214) · 우승 축하 한 장(207). 데이터는 지금 세이브 그대로(새 저장 필드 없음)
import { compNameKo, GROUP_LETTERS, groupTable, KO_NAMES, reachLabel, stageName, uclReachLabel } from '../cups';
import { leaguePosition, teamById } from '../league';
import { dateLabel } from '../calendar';
import { leagueData } from '../../data/leagues';
import type { GameState } from '../game';
import type { IconName } from './components';
import { seasonLabel } from './viewModels';

/** 214 대회 배너: 대회 경기가 끝나면 결과 화면 하이라이트 아래 · 득점 위에 하나 */
export interface CupBannerVM {
  tone: 'go' | 'pens' | 'out' | 'won';
  icon: IconName;
  kicker: string; title: string; body: string;
  /** 오른쪽 큰 숫자 (조 순위 · 합계 · 승부차기) */
  big?: string; bigLabel?: string;
}

export function cupBannerVM(g: GameState): CupBannerVM | null {
  const m = g.lastMatch;
  if (!m?.cup || m.nat) return null;
  const me = g.player.teamId;
  const name = compNameKo(m.cup.comp, g.league.id);
  const kicker = `${m.cup.comp === 'ucl' ? '챔피언스리그' : name} · ${m.cup.stage}`;
  const u = g.cups?.season === m.season ? g.cups.ucl : null;
  if (m.cup.decisive === false) {
    const k = u ? u.groups.findIndex((x) => x.includes(me)) : -1;
    if (u && k >= 0 && m.cup.stage.startsWith('조별')) {
      const rows = groupTable(g, u, k);
      const pos = rows.findIndex((r) => r.id === me) + 1;
      const played = rows.find((r) => r.id === me)?.p ?? 0;
      return { tone: 'go', icon: 'grid', kicker, title: `챔스 ${GROUP_LETTERS[k]}조 ${pos}위`, body: '조 2위까지 16강에 올라요.', big: `${pos}위`, bigLabel: `${GROUP_LETTERS[k]}조 · ${played}/6경기` };
    }
    return { tone: 'go', icon: 'swap', kicker, title: `${m.cup.stage} 끝`, body: '2차전 합계로 진출 팀이 정해져요 (동률이면 승부차기).' };
  }
  const pens = m.cup.pens ? (m.home ? m.cup.pens : [m.cup.pens[1], m.cup.pens[0]] as [number, number]) : null;
  if (m.cup.won) return { tone: 'won', icon: 'trophy', kicker, title: `${name} 우승`, body: '트로피를 받았어요 · 시즌 요약 트로피 칸에 올라가요.' };
  // 챔스 2차전: 합계 (1차전 · 2차전)
  const s = u && m.cup.comp === 'ucl' ? KO_NAMES.findIndex((x) => m.cup!.stage.startsWith(x)) : -1;
  const st = s >= 0 ? u!.ko[s] : undefined;
  const i = st ? st.l1.findIndex((t) => t.h === me || t.a === me) : -1;
  let agg: [number, number] | null = null;
  let legs = '';
  if (st && i >= 0 && st.l2[i]?.hg !== undefined) {
    const t1 = st.l1[i]!; const t2 = st.l2[i]!;
    const h1 = t1.h === me;
    const l1: [number, number] = h1 ? [t1.hg!, t1.ag!] : [t1.ag!, t1.hg!];
    const l2: [number, number] = t2.h === me ? [t2.hg!, t2.ag!] : [t2.ag!, t2.hg!];
    agg = [l1[0] + l2[0], l1[1] + l2[1]];
    legs = `1차전 ${l1[0]}-${l1[1]} · 2차전 ${l2[0]}-${l2[1]}`;
  }
  const next = nextStage(m.cup.comp, m.cup.stage);
  const score = `${m.result.goalsFor}-${m.result.goalsAgainst}`;
  if (pens) {
    return {
      tone: m.cup.through ? 'go' : 'pens', icon: 'target', kicker,
      title: `${agg ? `합계 ${agg[0]}-${agg[1]}` : score} · 승부차기 ${pens[0]}-${pens[1]}`,
      body: m.cup.through ? `${next ? `${next} 진출` : '다음 단계 진출'}이에요.` : `${teamById(g.league, m.opponentId).nameKo} 진출 · 이번 시즌 ${name}은 여기까지예요.`,
      big: `${pens[0]}-${pens[1]}`, bigLabel: '승부차기',
    };
  }
  if (m.cup.through) {
    return agg
      ? { tone: 'go', icon: 'swap', kicker, title: `합계 ${agg[0]}-${agg[1]} · ${next ?? '다음 단계'} 진출`, body: legs, big: `${agg[0]}-${agg[1]}`, bigLabel: '합계' }
      : { tone: 'go', icon: 'levelup', kicker, title: `${next ?? '다음 단계'} 진출`, body: '다음 상대는 추첨으로 정해져요.' };
  }
  return {
    tone: 'out', icon: 'close', kicker, title: m.cup.stage === '결승' ? `${name} 준우승` : `${m.cup.stage.replace(/ ?[12]차전$/, '')} 탈락`,
    body: `${agg ? `${legs} · ` : ''}이번 시즌 ${name}은 여기까지예요.`, ...(agg ? { big: `${agg[0]}-${agg[1]}`, bigLabel: '합계' } : {}),
  };
}

/** "3라운드" → "4라운드", "16강 2차전" → "8강" */
function nextStage(comp: string, stage: string): string | null {
  const base = stage.replace(/ ?[12]차전$/, '');
  const k = KO_NAMES.indexOf(base as (typeof KO_NAMES)[number]);
  if (k >= 0) return KO_NAMES[k + 1] ?? null;
  const r = /^(\d+)라운드/.exec(base);
  if (r) return `${Number(r[1]) + 1}라운드`;
  const n = /^(\d+)강/.exec(base);
  if (n) return Number(n[1]) / 2 === 2 ? '결승' : `${Number(n[1]) / 2}강`;
  return comp ? null : null;
}

/** 207 우승 축하: 경기 결과 뒤 한 장 (리그 = 시즌 마지막 경기 뒤 1위, 컵·챔스 = 결승 승리) */
export interface CelebrateVM {
  key: string;
  season: string;
  /** "리그 우승" · "챔스 우승" · "FA컵 우승" */
  title: string;
  /** "프리미어리그 · 리버풀" */
  sub: string;
  /** 한 줄: "38R 최종전 뒤 1위 확정 · 커리어 첫 리그 우승" / "결승 · 리버풀 2-1 바르셀로나 · 6월 1일 (토)" */
  line: string;
  /** 오른쪽 위 "리그 38경기" / "컵·챔스 9경기" */
  scope: string;
  tiles: { label: string; value: string; hi?: boolean }[];
  rows: { label: string; value: string }[];
}

const countOf = (list: string[], f: (x: string) => boolean) => list.filter(f).length;

export function celebrateVM(g: GameState): CelebrateVM | null {
  const m = g.lastMatch;
  if (!m || m.nat) return null;
  const me = g.player.teamId;
  const team = teamById(g.league, me).nameKo;
  const leagueName = leagueData(g.league.id)?.nameKo ?? g.league.name;
  const past = (g.chapters?.list ?? []).flatMap((c) => c.trophies);
  const all = past;
  const sum = g.lastSeasonSummary;
  const leagueWon = g.phase !== 'season' && !!sum && sum.season === m.season && sum.leaguePosition === 1 && m.round >= g.league.schedule.length;
  const cupWon = !!m.cup?.won;
  if (!leagueWon && !cupWon) return null;
  const ucl = m.cup?.comp === 'ucl';
  // 커리어 우승 수: 챕터 기록(시즌 끝에 쌓임) + 이번 컵 우승(시즌 중이면 아직 안 쌓임)
  const pending = cupWon && g.phase === 'season' ? [ucl ? '챔스 우승' : `${compNameKo(m.cup!.comp, g.league.id)} 우승`] : [];
  const trophies = [...all, ...pending];
  const nLeague = countOf(trophies, (x) => x === '리그 우승');
  const nCup = countOf(trophies, (x) => x.endsWith('우승') && x !== '리그 우승' && x !== '챔스 우승' && !x.includes('월드컵') && !x.includes('유로') && !x.includes('아시안컵') && !x.includes('코파'));
  const nUcl = countOf(trophies, (x) => x === '챔스 우승');
  const cupName = compNameKo('fa', g.league.id);
  const career = { label: '커리어 우승', value: `리그 ${nLeague} · ${cupName} ${nCup} · 챔스 ${nUcl}` };
  const st = g.phase === 'season' ? g.player.season : g.player.history.at(-1) ?? g.player.season;
  const avg = (sumR: number, n: number) => (n ? (sumR / n).toFixed(2) : '-');
  if (cupWon) {
    const c = st.cup ?? { apps: 0, goals: 0, assists: 0, ratingSum: 0 };
    const res = m.result;
    const opp = teamById(g.league, m.opponentId).nameKo;
    const score = m.home ? `${team} ${res.goalsFor}-${res.goalsAgainst} ${opp}` : `${opp} ${res.goalsAgainst}-${res.goalsFor} ${team}`;
    const name = compNameKo(m.cup!.comp, g.league.id);
    return {
      key: `${m.season}-${m.round}-${m.cup!.comp}`, season: seasonLabel(m.season), title: `${ucl ? '챔스' : name} 우승`,
      sub: `${ucl ? 'UEFA 챔피언스리그' : name} · ${team}`, line: `결승 · ${score}${g.calendar?.date ? ` · ${dateLabel(g.calendar.date)}` : ''}`,
      scope: `컵·챔스 ${c.apps}경기`,
      tiles: [{ label: '출전', value: String(c.apps) }, { label: '골', value: String(c.goals), hi: true }, { label: '도움', value: String(c.assists) }, { label: '평균 평점', value: avg(c.ratingSum, c.apps) }],
      rows: [
        { label: '결승', value: res.minutes > 0 ? `${res.goals ?? 0}골 · 평점 ${res.rating?.toFixed(1) ?? '-'}${res.mom ? ' · MOM' : ''}` : '결장' },
        career,
      ],
    };
  }
  return {
    key: `${m.season}-league`, season: seasonLabel(m.season), title: '리그 우승', sub: `${leagueName} · ${team}`,
    line: `${m.round}R 최종전 뒤 1위 확정 · ${nLeague <= 1 ? '커리어 첫 리그 우승' : `커리어 ${nLeague}번째 리그 우승`}`,
    scope: `리그 ${g.league.schedule.length}경기`,
    tiles: [{ label: '출전', value: String(st.apps) }, { label: '골', value: String(st.goals), hi: true }, { label: '도움', value: String(st.assists) }, { label: '평균 평점', value: avg(st.ratingSum, st.apps) }],
    rows: [{ label: 'MOM', value: `${st.moms}회` }, { label: '팀 순위', value: `1위 · ${seasonLabel(m.season)} 시즌` }, career],
  };
}

/** 208 선수 기록 "대회별": 리그 · 컵·챔스(기록이 한 칸에 합쳐 쌓여 FA컵·챔스를 나누지 못함) · 합계 + 커리어 우승 횟수 */
export interface CompRecordVM {
  season: string; team: string;
  rows: { icon: IconName; name: string; sub: string; apps: number; goals: number; assists: number; avg: string; total?: boolean }[];
  wins: { label: string; n: number }[];
  winsTotal: number;
}

export function compRecordVM(g: GameState): CompRecordVM {
  const st = g.phase === 'season' ? g.player.season : g.player.history.at(-1) ?? g.player.season;
  const season = g.phase === 'season' ? g.league.season : g.player.history.at(-1)?.season ?? g.league.season;
  const me = g.player.teamId;
  const avg = (r: number, n: number) => (n ? (r / n).toFixed(2) : '-');
  const lgName = leagueData(g.league.id)?.nameKo ?? g.league.name;
  const pos = leaguePositionOf(g);
  const c = st.cup ?? { apps: 0, goals: 0, assists: 0, ratingSum: 0 };
  const cups = g.cups?.season === season ? g.cups : null;
  const cupName = compNameKo('fa', g.league.id);
  const reach = [cups?.fa ? `${cupName} ${reachLabel(cups.fa, me)}` : '', cups?.ucl ? `챔스 ${uclReachLabel(g, cups.ucl, me)}` : ''].filter((x) => x && !x.endsWith('출전 안 함')).join(' · ');
  const rows: CompRecordVM['rows'] = [
    { icon: 'grid', name: '리그', sub: `${lgName}${pos ? ` · ${pos}위` : ''}`, apps: st.apps, goals: st.goals, assists: st.assists, avg: avg(st.ratingSum, st.apps) },
    { icon: 'trophy', name: `${cupName}·챔스`, sub: reach || '이번 시즌 컵 경기 없음', apps: c.apps, goals: c.goals, assists: c.assists, avg: avg(c.ratingSum, c.apps) },
  ];
  const tA = st.apps + c.apps;
  rows.push({ icon: 'star', name: '합계', sub: '', apps: tA, goals: st.goals + c.goals, assists: st.assists + c.assists, avg: avg(st.ratingSum + c.ratingSum, tA), total: true });
  const trophies = (g.chapters?.list ?? []).flatMap((x) => x.trophies);
  const nL = trophies.filter((x) => x === '리그 우승').length;
  const nU = trophies.filter((x) => x === '챔스 우승').length;
  const nC = trophies.filter((x) => x === `${cupName} 우승` || x === 'FA컵 우승').length;
  return { season: seasonLabel(season), team: teamById(g.league, me).nameKo, rows, wins: [{ label: '리그', n: nL }, { label: cupName, n: nC }, { label: '챔스', n: nU }], winsTotal: nL + nC + nU };
}

function leaguePositionOf(g: GameState): number | null {
  if (g.phase !== 'season') return g.lastSeasonSummary?.leaguePosition ?? null;
  return leaguePosition(g.league, g.player.teamId) ?? null;
}

/** 211 홈 "이번 시즌 대회" 칸: 리그 · 챔스 · 국내 컵 (나가지 않는 대회는 빠짐) */
export interface SeasonCompVM { kind: 'league' | 'ucl' | 'fa'; name: string; value: string; sub: string; out?: boolean }

export function seasonCompsVM(g: GameState): SeasonCompVM[] {
  if (g.phase !== 'season') return [];
  const me = g.player.teamId;
  const lgName = leagueData(g.league.id)?.nameKo ?? g.league.name;
  const out: SeasonCompVM[] = [{ kind: 'league', name: '리그', value: `${g.league.round}/${g.league.schedule.length}R`, sub: `${lgName}${g.league.round ? ` · ${leaguePosition(g.league, me)}위` : ''}` }];
  const cups = g.cups?.season === g.league.season ? g.cups : null;
  const u = cups?.ucl;
  if (u && u.groups.some((x) => x.includes(me))) {
    const k = u.groups.findIndex((x) => x.includes(me));
    const groupsDone = u.gs.every((r) => r.every((t) => t.hg !== undefined));
    if (!groupsDone) {
      const rows = groupTable(g, u, k);
      const r = rows.find((x) => x.id === me)!;
      out.push({ kind: 'ucl', name: '챔스', value: `${GROUP_LETTERS[k]}조 ${rows.indexOf(r) + 1}위`, sub: `조별 ${r.p}/6 · ${r.pts}점` });
    } else {
      const lbl = uclReachLabel(g, u, me);
      out.push({ kind: 'ucl', name: '챔스', value: lbl, sub: u.winner ? `우승 ${teamById(g.league, u.winner).nameKo}` : '녹아웃', out: lbl.endsWith('탈락') });
    }
  }
  const fa = cups?.fa;
  if (fa) {
    const name = compNameKo('fa', g.league.id);
    const inIt = fa.rounds.some((r) => r.some((t) => t.h === me || t.a === me));
    if (inIt) {
      const lbl = reachLabel(fa, me);
      out.push({ kind: 'fa', name, value: lbl, sub: fa.winner ? `우승 ${teamById(g.league, fa.winner).nameKo}` : '단판 승부', out: lbl.endsWith('탈락') });
    } else if (!fa.winner) {
      const s = fa.rounds.length;
      const date = fa.dates[s];
      out.push({ kind: 'fa', name, value: date ? `${dateLabel(date)} ${stageName(fa, s)}부터` : '대진 추첨 전', sub: '아직 경기 없음' });
    }
  }
  return out;
}
