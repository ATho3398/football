import { FIELD_ATTRIBUTES, GK_ATTRIBUTES, type FieldAttributes, type GkAttributes } from '../../src/attributes';
import type { FieldPlayerData, Foot, GoalkeeperData, Position, Tier } from '../../src/types';

// 브라질 세리에 A 2018 유명 실제 선수·유망주 (45d5, 부록 C.75r). 게임에는 아직 연결하지 않는다 (45b).
// 형식은 stars.ts Row 그대로. 능력치 25개 순서도 같다:
// 드리블 볼컨트롤 | 슈팅 중거리 헤더 위치선정 | 숏패스 롱패스 크로스 프리킥 시야 |
// 태클 인터셉트 마킹 수비위치 | 속도 가속 민첩 | 체력 근력 점프 | 침착 결정력 리더십 노력
// 값은 2018 시즌(4월 개막) 기준 기억 기반 근사(보수적). 소속은 개막 때 구단.
// 이미 다른 표에 있는 선수(비니시우스 주니오르 — stars.ts 레알, 엔드릭 — 미래 스타)는 넣지 않는다.
// 아르투르(그레미우 → 2018-07 바르셀로나)는 라리가 2018-19 데이터와 겹칠 수 있어 뺐다.
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

const L = 'Campeonato Brasileiro Série A';
const PAL = 'Palmeiras';
const FLA = 'Flamengo';
const GRE = 'Grêmio';
const SAN = 'Santos';
const COR = 'Corinthians';
const SAO = 'São Paulo';
const CRU = 'Cruzeiro';
const CAP = 'Athletico Paranaense';

const ROWS: Row[] = [
  // ── 파우메이라스 ──
  ['dudu', 'Dudu', '두두', 1992, 'Brazil', PAL, L, 7, 166, 62, 'right', 'LW', ['RW'], 'topClass', 300, false,
    '84 80 | 72 70 40 74 | 76 66 76 64 76 | 35 40 30 35 | 84 87 88 | 82 52 50 | 72 70 66 82'],
  ['bruno-henrique-2', 'Bruno Henrique', '브루누 엔히키', 1989, 'Brazil', PAL, L, 19, 184, 78, 'right', 'CM', ['CDM'], 'special', 180, false,
    '68 74 | 66 70 66 66 | 74 70 55 50 68 | 70 72 66 68 | 64 64 64 | 82 74 68 | 72 72 74 80'],
  ['felipe-melo', 'Felipe Melo', '펠리피 멜루', 1983, 'Brazil', PAL, L, 30, 183, 83, 'right', 'CDM', ['CB'], 'special', 300, false,
    '62 72 | 58 66 66 50 | 74 72 45 50 66 | 78 78 74 76 | 52 52 54 | 70 82 70 | 74 70 80 78'],
  ['gustavo-gomez', 'Gustavo Gómez', '구스타보 고메스', 1993, 'Paraguay', PAL, L, 15, 185, 79, 'right', 'CB', [], 'special', 180, false,
    '48 60 | 50 45 82 45 | 62 58 35 35 50 | 78 74 78 76 | 64 62 52 | 74 82 82 | 72 76 74 78'],
  ['miguel-borja', 'Miguel Borja', '미겔 보르하', 1993, 'Colombia', PAL, L, 9, 183, 81, 'right', 'ST', [], 'special', 200, false,
    '70 72 | 76 68 70 78 | 60 50 45 45 58 | 25 28 22 25 | 76 76 68 | 72 82 74 | 70 74 50 70'],
  // ── 플라멩구 ──
  ['lucas-paqueta', 'Lucas Paquetá', '루카스 파케타', 1997, 'Brazil', FLA, L, 11, 180, 72, 'left', 'CAM', ['CM', 'CF'], 'worldClass', 150, false,
    '80 82 | 70 70 70 70 | 78 72 62 60 78 | 55 60 50 55 | 72 74 80 | 78 66 72 | 70 70 55 78', 7],
  ['diego-ribas', 'Diego', '디에구', 1985, 'Brazil', FLA, L, 10, 172, 73, 'right', 'CAM', [], 'special', 300, false,
    '78 82 | 68 76 45 66 | 82 78 70 76 82 | 40 45 35 40 | 56 60 72 | 60 62 50 | 78 70 72 60'],
  ['everton-ribeiro', 'Everton Ribeiro', '에베르통 히베이루', 1989, 'Brazil', FLA, L, 7, 174, 66, 'left', 'RW', ['CAM'], 'topClass', 250, false,
    '82 84 | 68 72 40 68 | 82 76 74 70 82 | 45 50 40 45 | 66 70 82 | 76 52 48 | 78 70 66 76'],
  ['vitinho', 'Vitinho', '비치뉴', 1993, 'Brazil', FLA, L, 18, 173, 69, 'right', 'LW', ['RW'], 'special', 180, false,
    '80 76 | 72 72 40 68 | 70 60 66 62 68 | 30 35 25 30 | 82 84 84 | 72 60 55 | 64 66 50 66'],
  // ── 그레미우 ──
  ['everton', 'Everton', '에베르통', 1996, 'Brazil', GRE, L, 11, 174, 68, 'right', 'LW', [], 'topClass', 200, false,
    '84 78 | 74 74 45 74 | 72 62 66 58 70 | 32 38 28 32 | 86 90 88 | 78 58 55 | 72 72 55 78', 6],
  ['luan', 'Luan', '루앙', 1993, 'Brazil', GRE, L, 7, 180, 76, 'right', 'CF', ['CAM', 'LW'], 'topClass', 280, false,
    '84 84 | 76 76 55 76 | 78 66 62 66 82 | 35 40 30 35 | 72 74 80 | 72 62 60 | 78 74 60 70'],
  ['jean-pyerre', 'Jean Pyerre', '장 피에르', 1998, 'Brazil', GRE, L, 21, 181, 70, 'right', 'CAM', ['CM'], 'topClass', 60, false,
    '76 78 | 64 72 45 60 | 76 72 58 70 76 | 35 40 30 35 | 64 66 72 | 62 55 50 | 64 60 45 60', 8],
  ['pedro-geromel', 'Pedro Geromel', '페드루 제로멜', 1985, 'Brazil', GRE, L, 3, 190, 84, 'right', 'CB', [], 'special', 250, false,
    '52 66 | 40 40 80 40 | 70 64 40 35 56 | 82 80 80 84 | 58 56 52 | 72 80 80 | 82 80 82 78'],
  ['kannemann', 'Walter Kannemann', '왈테르 카네만', 1991, 'Argentina', GRE, L, 4, 185, 84, 'left', 'CB', [], 'special', 150, false,
    '48 58 | 38 40 78 38 | 62 58 35 30 48 | 80 76 80 78 | 60 58 52 | 76 84 80 | 70 76 70 82'],
  // ── 산투스 ──
  ['rodrygo', 'Rodrygo', '호드리구', 2001, 'Brazil', SAN, L, 43, 174, 64, 'right', 'RW', ['LW', 'ST'], 'worldClass', 60, false,
    '78 74 | 62 58 45 64 | 64 54 58 50 62 | 25 28 22 25 | 82 84 86 | 60 45 45 | 60 62 40 66', 9],
  ['gabriel-barbosa', 'Gabriel Barbosa', '가브리엘 바르보자', 1996, 'Brazil', SAN, L, 10, 178, 70, 'left', 'ST', ['RW'], 'topClass', 250, false,
    '78 78 | 80 72 60 80 | 68 58 60 62 68 | 30 32 28 30 | 80 82 80 | 76 66 62 | 72 78 55 70'],
  ['bruno-henrique', 'Bruno Henrique', '브루누 엔히키', 1990, 'Brazil', SAN, L, 27, 184, 77, 'right', 'LW', ['ST'], 'special', 180, false,
    '76 72 | 74 66 70 74 | 64 54 60 45 62 | 35 38 30 35 | 88 86 78 | 78 72 76 | 68 70 50 76'],
  // ── 코린치앙스 ──
  ['fagner', 'Fagner', '파그네르', 1989, 'Brazil', COR, L, 23, 168, 67, 'right', 'RB', [], 'special', 200, false,
    '72 74 | 52 58 45 50 | 74 68 74 55 64 | 72 72 70 70 | 74 76 76 | 80 62 55 | 70 68 66 78'],
  ['jadson', 'Jadson', '자드송', 1983, 'Brazil', COR, L, 77, 168, 67, 'right', 'CAM', ['CM'], 'special', 220, false,
    '72 80 | 66 76 40 62 | 80 78 74 76 78 | 40 45 35 40 | 54 58 70 | 64 56 46 | 74 68 66 64'],
  ['pedrinho', 'Pedrinho', '페드리뉴', 1998, 'Brazil', COR, L, 38, 175, 64, 'right', 'RW', ['LW'], 'topClass', 70, false,
    '80 76 | 62 62 40 62 | 68 60 64 55 66 | 30 32 25 30 | 80 82 84 | 66 50 48 | 60 60 40 66', 7],
  // ── 상파울루 ──
  ['diego-souza', 'Diego Souza', '디에구 소자', 1985, 'Brazil', SAO, L, 9, 187, 87, 'right', 'ST', ['CAM'], 'special', 250, false,
    '70 76 | 74 76 74 76 | 72 66 55 62 72 | 35 38 30 35 | 54 56 58 | 62 82 72 | 76 72 70 62'],
  ['nene', 'Nenê', '네네', 1981, 'Brazil', SAO, L, 10, 180, 74, 'left', 'CAM', ['LW'], 'special', 280, false,
    '76 80 | 72 80 50 70 | 78 76 74 82 76 | 30 35 28 30 | 54 58 66 | 58 62 55 | 80 74 70 62'],
  ['rodrigo-caio', 'Rodrigo Caio', '호드리구 카이우', 1993, 'Brazil', SAO, L, 3, 182, 74, 'right', 'CB', ['CDM'], 'special', 180, false,
    '58 68 | 45 50 72 45 | 70 66 45 40 60 | 76 78 74 78 | 66 64 60 | 74 72 72 | 74 72 68 76'],
  ['antony', 'Antony', '안토니', 2000, 'Brazil', SAO, L, 38, 174, 63, 'left', 'RW', ['LW'], 'topClass', 30, false,
    '76 72 | 58 60 35 56 | 62 56 60 52 60 | 28 30 25 28 | 80 82 84 | 64 45 45 | 55 55 38 66', 9],
  // ── 크루제이루 ──
  ['thiago-neves', 'Thiago Neves', '치아구 네베스', 1985, 'Brazil', CRU, L, 30, 177, 72, 'right', 'CAM', [], 'special', 250, false,
    '76 80 | 72 78 55 72 | 78 72 66 74 78 | 35 40 30 35 | 64 66 72 | 66 64 60 | 76 72 66 62'],
  ['arrascaeta', 'Giorgian de Arrascaeta', '조르지안 데 아라스카에타', 1994, 'Uruguay', CRU, L, 10, 172, 67, 'right', 'CAM', ['LW'], 'topClass', 220, false,
    '82 84 | 72 74 45 72 | 80 72 72 74 82 | 40 45 35 40 | 72 76 84 | 74 54 52 | 74 72 60 74'],
  ['dede-2', 'Dedé', '데데', 1988, 'Brazil', CRU, L, 26, 192, 87, 'right', 'CB', [], 'special', 180, false,
    '45 58 | 40 38 84 40 | 62 56 35 30 48 | 80 74 80 78 | 62 60 50 | 70 86 86 | 70 76 72 74'],
  // ── 아틀레치쿠 파라나엔시 ──
  ['bruno-guimaraes', 'Bruno Guimarães', '브루누 기마랑이스', 1997, 'Brazil', CAP, L, 39, 182, 74, 'right', 'CDM', ['CM'], 'topClass', 80, false,
    '74 78 | 58 64 55 58 | 78 72 55 50 74 | 70 74 66 68 | 66 68 72 | 80 68 60 | 70 64 58 82', 7],
  ['renan-lodi', 'Renan Lodi', '헤낭 로지', 1998, 'Brazil', CAP, L, 6, 177, 70, 'left', 'LB', [], 'topClass', 70, false,
    '72 72 | 50 58 45 52 | 70 68 74 55 64 | 66 66 64 64 | 80 82 78 | 80 62 58 | 62 62 45 78', 7],
  // ── 그 밖 ──
  ['pedro', 'Pedro', '페드루', 1997, 'Brazil', 'Fluminense', L, 9, 185, 80, 'right', 'ST', [], 'topClass', 120, false,
    '72 76 | 78 66 72 80 | 64 54 45 50 64 | 25 28 22 25 | 70 72 68 | 64 76 70 | 76 78 50 66', 6],
  ['dalessandro', "Andrés D'Alessandro", '안드레스 달레산드로', 1981, 'Argentina', 'Internacional', L, 10, 174, 70, 'left', 'CAM', [], 'special', 300, false,
    '82 84 | 64 70 40 64 | 82 78 72 72 82 | 35 40 30 35 | 54 58 74 | 56 58 45 | 80 66 80 68'],
  ['ricardo-oliveira', 'Ricardo Oliveira', '히카르두 올리베이라', 1980, 'Brazil', 'Atlético Mineiro', L, 9, 183, 83, 'right', 'ST', [], 'special', 250, false,
    '66 72 | 76 66 76 80 | 64 52 45 45 62 | 25 28 22 25 | 56 58 56 | 60 76 72 | 80 78 72 70'],
  ['paulinho-2', 'Paulinho', '파울리뉴', 2000, 'Brazil', 'Vasco da Gama', L, 18, 177, 70, 'left', 'LW', ['RW'], 'topClass', 60, false,
    '76 74 | 64 64 50 62 | 64 58 60 52 62 | 30 32 25 30 | 80 82 80 | 66 55 55 | 60 60 40 70', 8],
];

const GK_ROWS: GkRow[] = [
  ['weverton', 'Weverton', '웨베르통', 1987, 'Brazil', PAL, L, 21, 189, 86, 'right', 'special', 180, 'C 78 74 72 66'],
  ['cassio', 'Cássio', '카시우', 1987, 'Brazil', COR, L, 12, 195, 92, 'right', 'special', 200, 'C 78 72 76 60'],
];

/** 짧은 이름 예외 (stars.ts SHORT_KO 와 같은 규칙: 없으면 nameKo 마지막 단어) */
const SHORT_KO: Record<string, string> = {
  'gabriel-barbosa': '가브리엘', 'jean-pyerre': '장 피에르',
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
