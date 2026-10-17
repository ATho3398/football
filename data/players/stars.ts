import { FIELD_ATTRIBUTES, type FieldAttributes } from '../../src/attributes';
import type { FieldPlayerData, Foot, Position, Tier } from '../../src/types';

// A등급 선수 (1단계 30~50명). 중심값은 기억 기반 초안이며 이후 조정 예정.
// 능력치 25개는 FIELD_ATTRIBUTES 순서:
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

const EPL = 'Premier League';

const ROWS: Row[] = [
  ['salah', 'Mohamed Salah', '모하메드 살라', 1992, 'Egypt', 'Liverpool', EPL, 11, 175, 71, 'left', 'RW', ['ST'], 'worldClass', 700, false,
    '88 87 | 88 79 60 90 | 80 70 77 65 82 | 40 42 35 38 | 93 92 90 | 85 72 70 | 85 85 70 80'],
  ['van-dijk', 'Virgil van Dijk', '버질 반 다이크', 1991, 'Netherlands', 'Liverpool', EPL, 4, 193, 92, 'right', 'CB', [], 'worldClass', 650, false,
    '70 75 | 60 62 85 55 | 78 80 55 60 70 | 89 88 89 91 | 77 73 60 | 80 92 91 | 89 85 88 75'],
  ['mane', 'Sadio Mané', '사디오 마네', 1992, 'Senegal', 'Liverpool', EPL, 10, 175, 69, 'right', 'LW', ['ST'], 'worldClass', 600, false,
    '87 84 | 83 72 76 87 | 76 68 72 60 78 | 40 42 35 38 | 93 94 89 | 88 75 85 | 80 82 70 85'],
  ['firmino', 'Roberto Firmino', '호베르투 피르미누', 1991, 'Brazil', 'Liverpool', EPL, 9, 181, 76, 'right', 'CF', ['ST', 'CAM'], 'topClass', 550, false,
    '85 87 | 82 76 75 87 | 82 74 72 60 85 | 60 65 50 55 | 77 79 82 | 90 75 70 | 82 80 70 92'],
  ['alexander-arnold', 'Trent Alexander-Arnold', '트렌트 알렉산더아놀드', 1998, 'England', 'Liverpool', EPL, 66, 175, 69, 'right', 'RB', ['CM'], 'worldClass', 250, false,
    '74 76 | 58 70 55 60 | 80 82 84 75 78 | 72 70 68 68 | 77 78 75 | 82 64 62 | 72 70 62 80', 7],
  ['de-bruyne', 'Kevin De Bruyne', '케빈 더 브라위너', 1991, 'Belgium', 'Manchester City', EPL, 17, 181, 70, 'right', 'CAM', ['CM'], 'worldClass', 750, false,
    '86 89 | 85 90 55 82 | 92 91 91 84 94 | 55 63 50 58 | 77 79 80 | 88 75 63 | 88 85 80 87', 3],
  ['aguero', 'Sergio Agüero', '세르히오 아구에로', 1988, 'Argentina', 'Manchester City', EPL, 10, 173, 70, 'right', 'ST', [], 'worldClass', 750, false,
    '89 90 | 92 82 75 93 | 80 65 65 70 83 | 25 30 20 25 | 82 88 89 | 75 72 75 | 93 88 75 70', 3],
  ['sterling', 'Raheem Sterling', '라힘 스털링', 1994, 'England', 'Manchester City', EPL, 7, 170, 69, 'right', 'LW', ['RW'], 'worldClass', 550, false,
    '89 86 | 82 72 50 86 | 80 68 76 55 80 | 40 45 30 38 | 92 94 92 | 85 63 70 | 78 76 70 85'],
  ['sane', 'Leroy Sané', '르로이 자네', 1996, 'Germany', 'Manchester City', EPL, 19, 183, 75, 'left', 'LW', ['RW'], 'worldClass', 500, false,
    '87 83 | 80 78 55 83 | 77 68 76 70 77 | 30 35 28 30 | 93 92 85 | 78 68 70 | 75 72 60 70'],
  ['foden', 'Phil Foden', '필 포든', 2000, 'England', 'Manchester City', EPL, 47, 171, 69, 'left', 'CAM', ['CM', 'LW'], 'worldClass', 120, false,
    '76 76 | 62 60 45 64 | 72 64 60 55 72 | 40 45 35 38 | 74 79 82 | 62 50 50 | 62 58 50 72', 8],
  ['hazard', 'Eden Hazard', '에당 아자르', 1991, 'Belgium', 'Chelsea', EPL, 10, 175, 74, 'right', 'LW', ['CAM'], 'worldClass', 800, false,
    '93 92 | 82 78 60 86 | 86 78 80 80 88 | 30 35 30 30 | 86 92 93 | 80 70 60 | 88 86 75 70', 3],
  ['kante', "N'Golo Kanté", '은골로 캉테', 1991, 'France', 'Chelsea', EPL, 7, 168, 70, 'right', 'CDM', ['CM'], 'worldClass', 700, false,
    '79 82 | 65 66 54 70 | 83 75 70 50 78 | 88 92 89 88 | 78 82 85 | 97 72 72 | 84 80 72 96'],
  ['kane', 'Harry Kane', '해리 케인', 1993, 'England', 'Tottenham Hotspur', EPL, 10, 188, 86, 'right', 'ST', ['CF'], 'worldClass', 750, false,
    '80 86 | 92 86 87 92 | 82 75 70 70 82 | 40 38 35 38 | 70 73 72 | 82 84 78 | 90 88 85 85', 3],
  ['son', 'Son Heung-min', '손흥민', 1992, 'Korea Republic', 'Tottenham Hotspur', EPL, 7, 183, 78, 'both', 'LW', ['ST', 'RW'], 'worldClass', 500, false,
    '86 84 | 86 85 60 85 | 78 70 74 68 78 | 40 38 35 38 | 89 90 86 | 85 68 65 | 84 80 72 82'],
  ['eriksen', 'Christian Eriksen', '크리스티안 에릭센', 1992, 'Denmark', 'Tottenham Hotspur', EPL, 23, 182, 76, 'right', 'CAM', ['CM'], 'topClass', 600, false,
    '82 86 | 80 85 55 78 | 88 87 82 87 90 | 55 60 50 55 | 72 75 78 | 85 62 55 | 85 80 72 80'],
  ['pogba', 'Paul Pogba', '폴 포그바', 1993, 'France', 'Manchester United', EPL, 6, 191, 84, 'right', 'CM', ['CAM'], 'worldClass', 750, false,
    '87 88 | 80 85 76 76 | 87 87 77 78 88 | 70 68 65 68 | 74 78 74 | 86 86 82 | 85 85 78 75'],
  ['rashford', 'Marcus Rashford', '마커스 래시포드', 1997, 'England', 'Manchester United', EPL, 10, 180, 70, 'right', 'LW', ['ST'], 'worldClass', 400, false,
    '82 80 | 80 76 65 80 | 72 64 70 72 72 | 35 38 30 33 | 92 91 86 | 78 74 75 | 72 72 60 76', 6],
  ['aubameyang', 'Pierre-Emerick Aubameyang', '피에르에메릭 오바메양', 1989, 'Gabon', 'Arsenal', EPL, 14, 187, 80, 'right', 'ST', ['LW'], 'topClass', 600, false,
    '80 82 | 86 78 72 91 | 72 62 65 60 75 | 30 32 25 30 | 95 94 86 | 80 72 75 | 85 82 70 75'],
  ['ronaldo', 'Cristiano Ronaldo', '크리스티아누 호날두', 1985, 'Portugal', 'Juventus', 'Serie A', 7, 187, 83, 'right', 'ST', ['LW'], 'legendary', 1000, true,
    '88 89 | 94 92 90 95 | 82 75 82 85 83 | 30 30 28 30 | 89 89 87 | 85 80 95 | 95 95 85 80', 3],
  ['neymar', 'Neymar Jr', '네이마르', 1992, 'Brazil', 'Paris Saint-Germain', 'Ligue 1', 10, 175, 68, 'right', 'LW', ['CAM'], 'legendary', 850, false,
    '95 95 | 86 80 60 87 | 85 76 78 85 88 | 30 35 28 30 | 90 93 96 | 80 55 60 | 88 82 70 75', 3],
  ['mbappe', 'Kylian Mbappé', '킬리안 음바페', 1998, 'France', 'Paris Saint-Germain', 'Ligue 1', 7, 178, 73, 'right', 'ST', ['RW', 'LW'], 'legendary', 650, false,
    '89 87 | 85 76 70 87 | 76 66 76 60 80 | 30 35 28 32 | 96 96 91 | 82 70 72 | 82 82 65 78'],
  ['griezmann', 'Antoine Griezmann', '앙투안 그리즈만', 1991, 'France', 'Atlético Madrid', 'La Liga', 7, 176, 73, 'left', 'CF', ['ST'], 'worldClass', 800, false,
    '87 89 | 88 82 82 90 | 84 76 80 85 86 | 55 60 50 55 | 80 84 87 | 85 64 78 | 88 85 78 90', 3],
  ['modric', 'Luka Modrić', '루카 모드리치', 1985, 'Croatia', 'Real Madrid', 'La Liga', 10, 172, 66, 'right', 'CM', ['CAM'], 'worldClass', 900, true,
    '88 92 | 74 80 50 75 | 91 89 84 80 92 | 72 75 68 70 | 74 78 92 | 88 58 55 | 91 90 85 88', 3],
  ['ramos', 'Sergio Ramos', '세르히오 라모스', 1986, 'Spain', 'Real Madrid', 'La Liga', 4, 184, 82, 'right', 'CB', ['RB'], 'worldClass', 900, true,
    '72 78 | 62 60 90 60 | 78 74 70 70 70 | 88 85 86 87 | 74 74 78 | 82 82 90 | 85 90 92 80', 3],
  ['kroos', 'Toni Kroos', '토니 크로스', 1990, 'Germany', 'Real Madrid', 'La Liga', 8, 183, 76, 'right', 'CM', ['CDM'], 'worldClass', 800, true,
    '80 90 | 76 88 60 70 | 93 93 86 84 92 | 60 66 58 62 | 52 58 64 | 80 70 52 | 90 85 75 75', 3],
  ['lewandowski', 'Robert Lewandowski', '로베르트 레반도프스키', 1988, 'Poland', 'Bayern Munich', 'Bundesliga', 9, 185, 81, 'right', 'ST', [], 'worldClass', 800, false,
    '85 89 | 92 84 85 94 | 78 70 70 82 80 | 35 40 30 35 | 78 79 80 | 76 82 84 | 88 85 80 78', 3],
  ['suarez', 'Luis Suárez', '루이스 수아레스', 1987, 'Uruguay', 'FC Barcelona', 'La Liga', 9, 182, 86, 'right', 'ST', [], 'worldClass', 850, false,
    '86 88 | 92 82 77 92 | 82 68 77 82 85 | 45 40 38 40 | 75 80 84 | 80 80 70 | 88 88 80 86', 3],
  ['busquets', 'Sergio Busquets', '세르히오 부스케츠', 1988, 'Spain', 'FC Barcelona', 'La Liga', 5, 189, 76, 'right', 'CDM', ['CM'], 'worldClass', 750, true,
    '75 87 | 60 64 68 60 | 89 84 62 50 87 | 82 88 85 87 | 45 50 64 | 72 75 68 | 92 85 82 80', 3],
  ['sancho', 'Jadon Sancho', '제이든 산초', 2000, 'England', 'Borussia Dortmund', 'Bundesliga', 7, 180, 76, 'right', 'RW', ['LW', 'CAM'], 'worldClass', 200, false,
    '85 82 | 66 60 45 74 | 74 66 72 60 77 | 30 35 25 30 | 82 86 88 | 70 52 50 | 70 65 50 72', 8],
  ['vinicius', 'Vinícius Júnior', '비니시우스 주니오르', 2000, 'Brazil', 'Real Madrid', 'La Liga', 28, 176, 73, 'right', 'LW', [], 'worldClass', 200, false,
    '84 78 | 64 58 50 70 | 68 58 64 50 66 | 25 25 20 22 | 92 93 88 | 72 60 55 | 60 62 50 72', 8],
  ['dybala', 'Paulo Dybala', '파울로 디발라', 1993, 'Argentina', 'Juventus', 'Serie A', 10, 177, 75, 'left', 'CF', ['CAM'], 'worldClass', 650, false,
    '88 89 | 84 85 60 84 | 82 74 72 86 84 | 30 35 28 30 | 82 85 90 | 75 60 65 | 82 80 65 75'],
  ['kimmich', 'Joshua Kimmich', '조슈아 키미히', 1995, 'Germany', 'Bayern Munich', 'Bundesliga', 32, 176, 75, 'right', 'RB', ['CDM', 'CM'], 'worldClass', 550, false,
    '78 83 | 72 76 62 70 | 86 82 85 70 82 | 82 84 79 80 | 72 76 78 | 92 70 65 | 82 82 82 90'],
  ['havertz', 'Kai Havertz', '카이 하베르츠', 1999, 'Germany', 'Bayer Leverkusen', 'Bundesliga', 29, 189, 82, 'left', 'CAM', ['CF', 'CM'], 'worldClass', 200, false,
    '78 80 | 72 70 70 74 | 76 72 62 60 76 | 45 50 42 45 | 70 72 74 | 74 70 72 | 75 72 60 70', 8],
];

/** 짧은 이름 예외 표 (부록 C.44a): 성이 아닌 통칭으로 불리거나 성이 여러 단어인 선수. 나머지는 마지막 단어(names.ts autoShortKo) */
const SHORT_KO: Record<string, string> = {
  'van-dijk': '반다이크', 'alexander-arnold': '알렉산더아놀드', 'de-bruyne': '더브라위너', neymar: '네이마르', vinicius: '비니시우스', son: '손흥민',
  firmino: '피르미누', aubameyang: '오바메양',
};

export const stars: FieldPlayerData[] = ROWS.map(
  ([id, name, nameKo, birthYear, nationality, club, league, shirtNumber, height, weight, foot,
    position, subPositions, potentialTier, reputation, legendBadge, attrs, spread]) => ({
    id, name, nameKo, birthYear, nationality, club, league, shirtNumber, height, weight, foot,
    position, subPositions, traits: [], potentialTier, reputation, legendBadge,
    attributes: parseAttrs(id, attrs),
    ...(SHORT_KO[id] ? { shortKo: SHORT_KO[id] } : {}),
    ...(spread !== undefined ? { variance: { spread } } : {}),
  }),
);
