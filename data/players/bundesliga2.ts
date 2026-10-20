import { FIELD_ATTRIBUTES, type FieldAttributes } from '../../src/attributes';
import type { FieldPlayerData, Foot, Position, Tier } from '../../src/types';

// 2. 분데스리가 2018-19 유명 선수 (C.75p, 45d3): 15명, 필드 선수만. 형식은 stars.ts 와 같다(club = 팀 영문 이름).
// 능력치는 2018-19 시즌 기준 보수적 추정(기억 기반), 척도는 stars.ts 에 맞췄다. 능력치 25개 순서:
// 드리블 볼컨트롤 | 슈팅 중거리 헤더 위치선정 | 숏패스 롱패스 크로스 프리킥 시야 |
// 태클 인터셉트 마킹 수비위치 | 속도 가속 민첩 | 체력 근력 점프 | 침착 결정력 리더십 노력

type Row = [
  id: string, name: string, nameKo: string, birthYear: number, nationality: string,
  club: string, league: string, shirt: number, height: number, weight: number, foot: Foot,
  position: Exclude<Position, 'GK'>, sub: Exclude<Position, 'GK'>[],
  potentialTier: Tier, reputation: number, legendBadge: boolean, attrs: string, spread?: number,
];

function parseAttrs(id: string, s: string): FieldAttributes {
  const nums = s.split(/[\s|]+/).filter(Boolean).map(Number);
  if (nums.length !== FIELD_ATTRIBUTES.length) throw new Error(`${id}: 능력치 ${nums.length}개`);
  return Object.fromEntries(FIELD_ATTRIBUTES.map((a, i) => [a, nums[i]])) as FieldAttributes;
}

const L = '2. Bundesliga';

const ROWS: Row[] = [
  ['terodde', 'Simon Terodde', '지몬 테로데', 1988, 'Germany', '1. FC Köln', L, 9, 192, 85, 'right', 'ST', [], 'special', 100, false,
    '60 66 | 78 60 80 84 | 60 46 44 40 54 | 28 30 26 28 | 62 64 58 | 72 80 80 | 76 80 66 80'],
  ['hector', 'Jonas Hector', '요나스 헥터', 1990, 'Germany', '1. FC Köln', L, 14, 185, 75, 'left', 'LB', ['CM', 'CDM'], 'special', 200, false,
    '70 74 | 56 62 58 56 | 76 72 70 50 70 | 72 74 70 72 | 70 70 70 | 84 68 64 | 74 64 70 82'],
  ['cordoba', 'Jhon Córdoba', '존 코르도바', 1993, 'Colombia', '1. FC Köln', L, 15, 188, 85, 'right', 'ST', [], 'special', 90, false,
    '66 66 | 72 60 72 72 | 58 44 44 40 54 | 30 30 26 28 | 80 78 64 | 74 86 76 | 66 70 50 76'],
  ['czichos', 'Rafael Czichos', '라파엘 치호스', 1990, 'Germany', '1. FC Köln', L, 5, 188, 82, 'left', 'CB', [], 'normal', 50, false,
    '54 60 | 30 40 70 30 | 62 60 40 30 50 | 68 68 68 70 | 60 58 54 | 72 74 72 | 66 56 64 76'],
  ['lasogga', 'Pierre-Michel Lasogga', '피에르미셸 라소가', 1991, 'Germany', 'Hamburger SV', L, 10, 189, 88, 'right', 'ST', [], 'normal', 90, false,
    '58 64 | 74 64 78 76 | 58 46 40 45 52 | 28 30 26 28 | 56 58 52 | 64 84 78 | 68 72 56 70'],
  ['aaron-hunt', 'Aaron Hunt', '아론 훈트', 1986, 'Germany', 'Hamburger SV', L, 14, 183, 75, 'right', 'CAM', ['CM'], 'special', 110, false,
    '72 78 | 64 70 45 64 | 76 72 66 72 76 | 30 36 28 30 | 58 60 66 | 62 58 50 | 76 66 70 66'],
  ['douglas-santos', 'Douglas Santos', '두글라스 산투스', 1994, 'Brazil', 'Hamburger SV', L, 6, 174, 68, 'left', 'LB', ['LM'], 'special', 80, false,
    '72 70 | 46 52 50 46 | 68 62 68 50 58 | 64 64 60 62 | 76 76 74 | 76 62 58 | 62 56 48 72'],
  ['arp', 'Fiete Arp', '피테 아르프', 2000, 'Germany', 'Hamburger SV', L, 9, 183, 76, 'right', 'ST', [], 'special', 80, false,
    '62 64 | 66 56 58 66 | 56 42 40 40 52 | 22 24 20 22 | 68 70 66 | 62 62 60 | 56 60 40 66', 8],
  ['sebastian-andersson', 'Sebastian Andersson', '세바스티안 안데르손', 1991, 'Sweden', '1. FC Union Berlin', L, 10, 190, 85, 'right', 'ST', [], 'normal', 60, false,
    '58 64 | 72 58 80 74 | 60 46 42 40 54 | 30 32 28 30 | 62 60 54 | 76 82 80 | 66 70 56 78'],
  ['lee-jae-sung', 'Lee Jae-sung', '이재성', 1992, 'Korea Republic', 'Holstein Kiel', L, 7, 180, 70, 'right', 'LM', ['CAM', 'CM'], 'special', 100, false,
    '74 76 | 62 64 52 66 | 74 64 66 55 74 | 50 56 44 48 | 70 72 76 | 88 60 56 | 72 64 60 88'],
  ['klos', 'Fabian Klos', '파비안 클로스', 1987, 'Germany', 'Arminia Bielefeld', L, 9, 195, 89, 'right', 'ST', [], 'normal', 50, false,
    '56 62 | 72 58 80 76 | 58 44 38 40 52 | 30 30 28 30 | 56 56 48 | 72 84 82 | 70 72 72 80'],
  ['glatzel', 'Robert Glatzel', '로베르트 글라첼', 1994, 'Germany', '1. FC Heidenheim', L, 11, 193, 87, 'right', 'ST', [], 'normal', 50, false,
    '58 62 | 72 58 76 72 | 56 44 40 40 50 | 28 30 26 28 | 64 64 56 | 74 80 78 | 64 70 50 78', 5],
  ['schnatterer', 'Marc Schnatterer', '마르크 슈나터러', 1985, 'Germany', '1. FC Heidenheim', L, 7, 174, 69, 'right', 'RM', ['CAM', 'RW'], 'normal', 60, false,
    '70 72 | 64 66 40 64 | 70 66 72 76 70 | 36 40 32 34 | 66 66 72 | 74 56 48 | 72 64 76 80'],
  ['lee-chung-yong', 'Lee Chung-yong', '이청용', 1988, 'Korea Republic', 'VfL Bochum', L, 17, 180, 70, 'right', 'RM', ['RW', 'CAM'], 'special', 130, false,
    '76 76 | 56 60 40 60 | 74 66 70 55 74 | 36 42 32 36 | 70 70 78 | 70 54 48 | 72 60 60 72'],
  ['hinterseer', 'Lukas Hinterseer', '루카스 힌터제어', 1991, 'Austria', 'VfL Bochum', L, 9, 192, 82, 'right', 'ST', [], 'normal', 50, false,
    '60 64 | 70 60 74 72 | 58 46 42 40 54 | 30 32 28 30 | 66 64 58 | 72 74 76 | 66 68 52 76'],
];

const SHORT_KO: Record<string, string> = { 'lee-jae-sung': '이재성', 'lee-chung-yong': '이청용' };

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
