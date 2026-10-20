import { FIELD_ATTRIBUTES, GK_ATTRIBUTES, type FieldAttributes, type GkAttributes } from '../../src/attributes';
import type { FieldPlayerData, Foot, GoalkeeperData, Position, Tier } from '../../src/types';

// 리가 포르투갈 2018-19 유명 실제 선수 (45d5, 부록 C.75r). 게임에는 아직 연결하지 않는다 (45b).
// 형식은 stars.ts Row 그대로. 능력치 25개 순서도 같다:
// 드리블 볼컨트롤 | 슈팅 중거리 헤더 위치선정 | 숏패스 롱패스 크로스 프리킥 시야 |
// 태클 인터셉트 마킹 수비위치 | 속도 가속 민첩 | 체력 근력 점프 | 침착 결정력 리더십 노력
// 값은 2018-19 시즌 기준 기억 기반 근사(보수적). 유망주는 spread 로 흔들림을 키운다.
// 이미 다른 표에 있는 선수(페페 — 2019-01 포르투 복귀, 레전드 팩 · 카시야스 — 레전드 팩)는 넣지 않는다.

type Row = [
  id: string, name: string, nameKo: string, birthYear: number, nationality: string,
  club: string, league: string, shirt: number, height: number, weight: number, foot: Foot,
  position: Exclude<Position, 'GK'>, sub: Exclude<Position, 'GK'>[],
  potentialTier: Tier, reputation: number, legendBadge: boolean, attrs: string, spread?: number,
];

/** GK 줄: 능력치는 legends.ts 와 같은 'S|C 선방 핸들링 공중볼 배급' */
type GkRow = [
  id: string, name: string, nameKo: string, birthYear: number, nationality: string,
  club: string, league: string, shirt: number, height: number, weight: number, foot: Foot,
  potentialTier: Tier, reputation: number, attrs: string,
];

function parseAttrs(id: string, s: string): FieldAttributes {
  const nums = s.split(/[\s|]+/).filter(Boolean).map(Number);
  if (nums.length !== FIELD_ATTRIBUTES.length) throw new Error(`${id}: 능력치 ${nums.length}개`);
  return Object.fromEntries(FIELD_ATTRIBUTES.map((a, i) => [a, nums[i]])) as FieldAttributes;
}

function parseGk(id: string, s: string): { gkType: 'sweeper' | 'classic'; gkAttributes: GkAttributes } {
  const [t, ...rest] = s.split(/\s+/);
  const nums = rest.map(Number);
  if ((t !== 'S' && t !== 'C') || nums.length !== GK_ATTRIBUTES.length) throw new Error(`${id}: GK 능력치 형식`);
  return { gkType: t === 'S' ? 'sweeper' : 'classic', gkAttributes: Object.fromEntries(GK_ATTRIBUTES.map((a, i) => [a, nums[i]])) as GkAttributes };
}

const L = 'Primeira Liga';
const SLB = 'Benfica';
const FCP = 'FC Porto';
const SCP = 'Sporting CP';
const BRA = 'SC Braga';

const ROWS: Row[] = [
  // ── 벤피카 ──
  ['joao-felix', 'João Félix', '주앙 펠릭스', 1999, 'Portugal', SLB, L, 79, 181, 70, 'right', 'CF', ['ST', 'CAM', 'LW'], 'worldClass', 150, false,
    '82 83 | 76 72 70 78 | 78 70 66 62 80 | 35 40 30 35 | 80 82 85 | 70 60 65 | 76 74 55 75', 8],
  ['ruben-dias', 'Rúben Dias', '후벵 디아스', 1997, 'Portugal', SLB, L, 6, 186, 82, 'right', 'CB', [], 'worldClass', 180, false,
    '58 70 | 40 45 82 40 | 72 70 45 35 60 | 80 78 80 78 | 66 64 58 | 78 84 82 | 76 78 78 82', 6],
  ['pizzi', 'Pizzi', '피치', 1989, 'Portugal', SLB, L, 21, 176, 72, 'right', 'RW', ['CM', 'CAM'], 'topClass', 250, false,
    '80 82 | 77 79 50 76 | 82 79 79 74 82 | 50 55 45 50 | 72 74 78 | 82 60 55 | 78 76 68 78'],
  ['rafa-silva', 'Rafa Silva', '하파 실바', 1993, 'Portugal', SLB, L, 27, 170, 63, 'right', 'LW', ['RW', 'CAM'], 'topClass', 200, false,
    '84 79 | 74 70 45 77 | 74 64 67 58 74 | 35 40 30 35 | 90 92 88 | 78 55 55 | 70 70 55 75'],
  ['seferovic', 'Haris Seferović', '하리스 세페로비치', 1992, 'Switzerland', SLB, L, 14, 185, 85, 'left', 'ST', [], 'special', 200, false,
    '70 74 | 79 72 74 82 | 68 58 58 55 66 | 30 32 25 30 | 78 77 70 | 76 80 75 | 76 77 60 78'],
  ['jonas', 'Jonas', '조나스', 1984, 'Brazil', SLB, L, 10, 181, 71, 'right', 'ST', ['CF'], 'topClass', 280, false,
    '78 83 | 83 78 72 84 | 78 68 62 70 78 | 30 35 25 30 | 60 64 72 | 62 66 68 | 84 82 72 65'],
  ['grimaldo', 'Álex Grimaldo', '알레한드로 그리말도', 1995, 'Spain', SLB, L, 3, 171, 69, 'left', 'LB', ['LM'], 'topClass', 200, false,
    '78 79 | 62 70 45 60 | 78 76 81 82 74 | 68 70 66 68 | 82 84 82 | 82 55 52 | 72 70 55 76'],
  ['andre-almeida', 'André Almeida', '안드레 알메이다', 1990, 'Portugal', SLB, L, 34, 185, 79, 'right', 'RB', ['RM', 'CDM'], 'special', 150, false,
    '66 72 | 55 60 62 55 | 74 70 72 55 66 | 74 72 72 74 | 70 70 66 | 82 72 70 | 72 72 70 80'],
  ['gedson-fernandes', 'Gedson Fernandes', '젭송 페르난드스', 1999, 'Portugal', SLB, L, 83, 182, 75, 'right', 'CM', ['CAM'], 'topClass', 100, false,
    '74 74 | 60 62 58 62 | 72 66 58 50 68 | 62 64 58 60 | 78 78 76 | 82 70 62 | 64 62 50 82', 8],
  ['fejsa', 'Ljubomir Fejsa', '류보미르 페이사', 1988, 'Serbia', SLB, L, 5, 186, 80, 'right', 'CDM', [], 'special', 180, false,
    '62 74 | 50 55 66 50 | 78 70 50 40 66 | 80 82 78 82 | 58 58 60 | 74 78 70 | 78 74 70 78'],
  ['florentino-luis', 'Florentino Luís', '플로렌티누 루이스', 1999, 'Portugal', SLB, L, 61, 183, 70, 'right', 'CDM', ['CM'], 'topClass', 60, false,
    '62 70 | 42 45 60 42 | 72 64 40 35 62 | 74 78 72 74 | 66 66 66 | 80 68 64 | 66 64 50 82', 8],
  // ── 포르투 ──
  ['alex-telles', 'Alex Telles', '알렉스 텔레스', 1992, 'Brazil', FCP, L, 13, 181, 71, 'left', 'LB', [], 'topClass', 250, false,
    '74 78 | 62 70 55 60 | 78 78 84 83 74 | 72 72 70 72 | 76 76 72 | 86 66 62 | 76 74 66 82'],
  ['hector-herrera', 'Héctor Herrera', '엑토르 에레라', 1990, 'Mexico', FCP, L, 16, 185, 72, 'right', 'CM', ['CDM'], 'topClass', 300, false,
    '74 80 | 68 78 62 66 | 80 80 66 65 78 | 72 74 68 72 | 70 70 70 | 86 74 64 | 76 74 82 85'],
  ['brahimi', 'Yacine Brahimi', '야신 브라히미', 1990, 'Algeria', FCP, L, 8, 175, 65, 'right', 'LW', ['CAM'], 'topClass', 280, false,
    '88 85 | 72 70 45 74 | 76 64 66 60 76 | 35 40 30 35 | 78 84 88 | 72 58 55 | 76 70 60 70'],
  ['marega', 'Moussa Marega', '무사 마레가', 1991, 'Mali', FCP, L, 11, 186, 85, 'right', 'ST', ['RW'], 'special', 220, false,
    '70 70 | 74 64 72 78 | 62 52 58 40 60 | 40 42 35 38 | 86 82 70 | 86 88 75 | 68 70 60 85'],
  ['danilo-pereira', 'Danilo Pereira', '다닐루 페레이라', 1991, 'Portugal', FCP, L, 22, 188, 83, 'right', 'CDM', ['CB'], 'topClass', 250, false,
    '64 74 | 60 68 76 56 | 76 72 50 45 66 | 80 82 78 80 | 62 62 58 | 80 86 80 | 76 74 76 80'],
  ['eder-militao', 'Éder Militão', '에데르 밀리탕', 1998, 'Brazil', FCP, L, 3, 186, 78, 'right', 'CB', ['RB'], 'worldClass', 150, false,
    '64 70 | 45 50 76 45 | 70 66 55 40 58 | 78 76 76 76 | 80 78 70 | 78 78 80 | 70 72 62 78', 7],
  ['felipe', 'Felipe', '펠리피', 1989, 'Brazil', FCP, L, 28, 190, 81, 'right', 'CB', [], 'special', 180, false,
    '52 62 | 45 40 82 40 | 66 62 40 35 52 | 80 76 80 80 | 66 64 56 | 74 84 84 | 72 76 74 78'],
  ['corona', 'Jesús Corona', '헤수스 코로나', 1993, 'Mexico', FCP, L, 17, 173, 62, 'right', 'RW', ['RB', 'LW'], 'topClass', 250, false,
    '85 81 | 70 68 45 70 | 74 64 72 60 72 | 45 48 40 42 | 82 85 87 | 76 55 52 | 68 68 55 75'],
  ['oliver-torres', 'Óliver Torres', '올리베르 토레스', 1994, 'Spain', FCP, L, 10, 175, 65, 'right', 'CM', ['CAM'], 'topClass', 200, false,
    '80 84 | 62 66 45 62 | 84 76 64 64 80 | 55 62 50 55 | 66 70 82 | 76 52 50 | 76 64 55 72'],
  ['otavio', 'Otávio', '오타비우', 1995, 'Brazil', FCP, L, 25, 172, 65, 'right', 'CAM', ['RW', 'CM'], 'topClass', 150, false,
    '82 80 | 64 66 45 64 | 78 70 70 62 76 | 58 60 52 55 | 74 78 82 | 82 56 52 | 70 64 55 85'],
  ['tiquinho-soares', 'Tiquinho Soares', '티키뉴 소아레스', 1991, 'Brazil', FCP, L, 29, 187, 82, 'right', 'ST', [], 'special', 170, false,
    '68 72 | 78 66 76 79 | 62 52 50 45 62 | 30 30 25 28 | 72 72 64 | 72 80 76 | 72 76 55 74'],
  // ── 스포르팅 CP ──
  ['bruno-fernandes', 'Bruno Fernandes', '브루누 페르난드스', 1994, 'Portugal', SCP, L, 8, 179, 69, 'right', 'CAM', ['CM'], 'worldClass', 350, false,
    '80 84 | 80 86 60 80 | 84 84 78 82 86 | 55 62 50 55 | 74 76 78 | 88 66 60 | 80 78 78 86'],
  ['bas-dost', 'Bas Dost', '바스 도스트', 1989, 'Netherlands', SCP, L, 28, 196, 87, 'right', 'ST', [], 'topClass', 280, false,
    '60 70 | 82 66 84 86 | 64 52 45 50 62 | 25 25 20 25 | 60 62 52 | 66 82 80 | 80 84 60 66'],
  ['nani', 'Nani', '나니', 1986, 'Portugal', SCP, L, 77, 175, 66, 'right', 'LW', ['RW'], 'topClass', 400, false,
    '82 80 | 74 78 48 70 | 74 70 76 72 74 | 30 35 28 30 | 74 76 82 | 64 60 60 | 72 68 66 64'],
  ['raphinha', 'Raphinha', '하피냐', 1996, 'Brazil', SCP, L, 11, 176, 68, 'left', 'RW', ['LW'], 'topClass', 150, false,
    '82 78 | 70 74 45 70 | 72 66 74 66 72 | 40 45 35 38 | 84 86 84 | 76 55 55 | 66 66 50 78', 6],
  ['acuna', 'Marcos Acuña', '마르코스 아쿠냐', 1991, 'Argentina', SCP, L, 21, 172, 69, 'left', 'LB', ['LM', 'LW'], 'topClass', 220, false,
    '78 77 | 62 68 50 60 | 74 72 80 66 72 | 70 70 66 66 | 76 76 76 | 86 70 60 | 68 70 66 86'],
  ['coates', 'Sebastián Coates', '세바스티안 코아테스', 1990, 'Uruguay', SCP, L, 4, 196, 92, 'right', 'CB', [], 'special', 220, false,
    '50 64 | 52 50 84 50 | 66 62 40 35 56 | 78 76 80 78 | 56 54 48 | 74 86 84 | 74 76 78 76'],
  ['mathieu', 'Jérémy Mathieu', '제레미 마티외', 1983, 'France', SCP, L, 22, 189, 84, 'left', 'CB', ['LB'], 'special', 250, false,
    '56 70 | 48 55 78 45 | 72 72 55 50 62 | 78 78 78 80 | 52 52 52 | 64 78 76 | 78 76 74 70'],
  ['wendel', 'Wendel', '웬델', 1997, 'Brazil', SCP, L, 23, 183, 70, 'left', 'CM', ['CAM'], 'topClass', 80, false,
    '74 76 | 62 66 50 60 | 76 72 58 55 72 | 60 62 55 58 | 72 74 74 | 78 62 58 | 64 62 50 78', 7],
  ['battaglia', 'Rodrigo Battaglia', '로드리고 바타글리아', 1991, 'Argentina', SCP, L, 16, 187, 83, 'right', 'CDM', [], 'special', 150, false,
    '60 68 | 48 55 70 48 | 70 64 45 40 60 | 78 76 74 74 | 62 60 58 | 82 80 74 | 68 68 70 80'],
  // ── 브라가 ──
  ['paulinho', 'Paulinho', '파울리뉴', 1992, 'Portugal', BRA, L, 9, 183, 76, 'right', 'ST', [], 'special', 120, false,
    '70 72 | 72 66 70 74 | 66 58 52 45 64 | 38 40 32 38 | 72 74 72 | 80 72 66 | 68 70 55 82'],
  ['dyego-sousa', 'Dyego Sousa', '디에구 소자', 1989, 'Brazil', BRA, L, 19, 188, 82, 'right', 'ST', [], 'special', 150, false,
    '66 70 | 76 70 78 76 | 62 52 48 50 60 | 30 30 25 28 | 66 66 60 | 74 80 80 | 72 74 60 74'],
  ['ricardo-horta', 'Ricardo Horta', '히카르두 오르타', 1994, 'Portugal', BRA, L, 21, 173, 67, 'right', 'LW', ['CAM'], 'special', 120, false,
    '78 76 | 72 74 45 68 | 72 64 66 64 70 | 35 40 30 35 | 76 80 82 | 74 55 52 | 68 66 55 74'],
  ['trincao', 'Francisco Trincão', '프란시스쿠 트린캉', 1999, 'Portugal', BRA, L, 77, 184, 70, 'left', 'RW', ['LW'], 'topClass', 50, false,
    '76 72 | 62 62 45 60 | 64 58 60 50 62 | 30 35 25 30 | 78 78 80 | 66 58 55 | 58 58 40 66', 8],
];

const GK_ROWS: GkRow[] = [
  ['vlachodimos', 'Odysseas Vlachodimos', '오디세아스 블라코디모스', 1994, 'Greece', SLB, L, 99, 191, 85, 'right', 'special', 150, 'S 78 74 72 72'],
];

/** 짧은 이름 예외 (stars.ts SHORT_KO 와 같은 규칙: 없으면 nameKo 마지막 단어) */
const SHORT_KO: Record<string, string> = {
  'rafa-silva': '하파', 'florentino-luis': '플로렌티누', 'gedson-fernandes': '젭송',
};

export const PLAYERS: FieldPlayerData[] = ROWS.map(
  ([id, name, nameKo, birthYear, nationality, club, league, shirtNumber, height, weight, foot,
    position, subPositions, potentialTier, reputation, legendBadge, attrs, spread]) => ({
    id, name, nameKo, birthYear, nationality, club, league, shirtNumber, height, weight, foot,
    position, subPositions, traits: [], potentialTier, reputation, legendBadge,
    attributes: parseAttrs(id, attrs),
    ...(SHORT_KO[id] ? { shortKo: SHORT_KO[id] } : {}),
    ...(spread !== undefined ? { variance: { spread } } : {}),
  }),
);

export const GOALKEEPERS: GoalkeeperData[] = GK_ROWS.map(
  ([id, name, nameKo, birthYear, nationality, club, league, shirtNumber, height, weight, foot, potentialTier, reputation, attrs]) => ({
    id, name, nameKo, birthYear, nationality, club, league, shirtNumber, height, weight, foot,
    position: 'GK', subPositions: [], traits: [], potentialTier, reputation, legendBadge: false,
    ...parseGk(id, attrs),
  }),
);
