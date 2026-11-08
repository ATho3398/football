import { FIELD_ATTRIBUTES, type FieldAttributes } from '../../src/attributes';
import type { FieldPlayerData, Foot, Position, Tier } from '../../src/types';

// 사우디 프로리그 2018-19 실제 선수 (45d6, 부록 C.75s). 게임에 아직 연결하지 않는다 (45b).
// stars.ts 와 같은 Row 형식·능력치 척도(2018-19 시즌 나이·실력 기준, 보수적으로). 필드 선수만 (Row 형식에 GK 가 없음).
// 조빈코는 2019년 1월 알힐랄 이적이라 개막 소속(토론토, data/players/mls.ts)에만 둔다. 기존 data/players 와 겹치는 선수 없음.
// 능력치 25개: 드리블 볼컨트롤 | 슈팅 중거리 헤더 위치선정 | 숏패스 롱패스 크로스 프리킥 시야 |
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

const SPL = 'Saudi Professional League';

export const ROWS: Row[] = [
  // ── 알힐랄 ──
  ['gomis', 'Bafétimbi Gomis', '바페팀비 고미스', 1985, 'France', 'Al-Hilal', SPL, 18, 184, 82, 'right', 'ST', [], 'topClass', 350, false,
    '68 72 | 80 68 76 82 | 64 50 48 50 60 | 30 30 25 28 | 68 70 64 | 72 84 76 | 78 78 70 72'],
  ['omar-kharbin', 'Omar Kharbin', '오마르 크리빈', 1994, 'Syria', 'Al-Hilal', SPL, 10, 175, 68, 'right', 'ST', ['CF'], 'special', 220, false,
    '76 76 | 76 68 60 76 | 68 56 56 60 66 | 30 32 25 28 | 80 82 80 | 74 62 62 | 70 70 55 74'],
  ['andre-carrillo', 'André Carrillo', '안드레 카리요', 1991, 'Peru', 'Al-Hilal', SPL, 11, 180, 74, 'right', 'RW', ['RM'], 'special', 220, false,
    '80 76 | 66 66 50 66 | 70 62 72 55 70 | 38 40 32 35 | 86 84 80 | 76 66 60 | 66 64 52 72'],
  ['salem-al-dawsari', 'Salem Al-Dawsari', '살렘 알다우사리', 1991, 'Saudi Arabia', 'Al-Hilal', SPL, 29, 171, 65, 'right', 'LW', ['RW', 'CAM'], 'special', 220, false,
    '80 78 | 70 70 45 68 | 72 62 68 62 72 | 30 34 25 28 | 80 82 84 | 74 55 52 | 70 68 58 72'],
  ['salman-al-faraj', 'Salman Al-Faraj', '살만 알파라즈', 1989, 'Saudi Arabia', 'Al-Hilal', SPL, 7, 180, 70, 'right', 'CM', ['CDM'], 'special', 200, false,
    '70 76 | 60 68 50 60 | 78 76 62 62 76 | 58 62 55 58 | 60 62 70 | 74 62 58 | 74 74 74 72'],
  ['yasser-al-shahrani', 'Yasser Al-Shahrani', '야세르 알샤흐라니', 1992, 'Saudi Arabia', 'Al-Hilal', SPL, 12, 171, 65, 'left', 'LB', ['LWB'], 'special', 160, false,
    '70 70 | 45 50 50 50 | 68 62 70 40 60 | 66 66 64 64 | 80 80 78 | 80 58 55 | 64 64 55 80'],
  ['carlos-eduardo', 'Carlos Eduardo', '카를로스 에두아르두', 1987, 'Brazil', 'Al-Hilal', SPL, 8, 183, 75, 'right', 'CAM', ['CM'], 'special', 200, false,
    '80 80 | 72 76 50 70 | 76 70 66 72 78 | 30 34 28 30 | 66 68 74 | 64 64 60 | 74 72 60 62'],
  ['abdullah-otayf', 'Abdullah Otayf', '압둘라 오타이프', 1992, 'Saudi Arabia', 'Al-Hilal', SPL, 28, 175, 70, 'right', 'CDM', ['CM'], 'special', 150, false,
    '68 72 | 50 58 50 52 | 74 70 55 45 68 | 66 70 62 66 | 64 66 70 | 82 62 58 | 68 68 62 80'],
  // ── 알나스르 ──
  ['hamdallah', 'Abderrazak Hamdallah', '압데라자크 함달라', 1990, 'Morocco', 'Al-Nassr', SPL, 9, 186, 80, 'right', 'ST', [], 'topClass', 280, false,
    '70 74 | 82 70 76 86 | 62 50 48 52 60 | 28 30 25 28 | 74 76 70 | 72 78 78 | 78 80 55 68'],
  ['giuliano', 'Giuliano', '줄리아누', 1990, 'Brazil', 'Al-Nassr', SPL, 10, 173, 67, 'left', 'CAM', ['LW', 'CM'], 'special', 220, false,
    '78 78 | 70 74 48 70 | 76 70 68 66 76 | 40 44 35 38 | 72 74 78 | 76 58 55 | 70 70 58 74'],
  ['nordin-amrabat', 'Nordin Amrabat', '노르딘 암라바트', 1987, 'Morocco', 'Al-Nassr', SPL, 11, 179, 74, 'right', 'RW', ['RM'], 'special', 220, false,
    '80 76 | 66 66 50 66 | 68 60 70 50 66 | 40 42 35 38 | 80 82 80 | 76 72 62 | 66 64 60 80'],
  ['ahmed-musa', 'Ahmed Musa', '아메드 무사', 1992, 'Nigeria', 'Al-Nassr', SPL, 7, 170, 62, 'right', 'LW', ['ST', 'RW'], 'special', 220, false,
    '76 72 | 70 62 50 70 | 62 52 60 45 60 | 28 30 22 25 | 92 92 84 | 74 60 58 | 64 64 50 72'],
  ['petros', 'Petros', '페트로스', 1989, 'Brazil', 'Al-Nassr', SPL, 5, 180, 77, 'right', 'CDM', ['CM'], 'special', 150, false,
    '66 72 | 55 62 60 55 | 74 70 55 45 66 | 72 74 68 70 | 60 62 64 | 82 74 66 | 70 70 62 82'],
  ['yahya-al-shehri', 'Yahya Al-Shehri', '야히아 알셰흐리', 1990, 'Saudi Arabia', 'Al-Nassr', SPL, 14, 165, 62, 'right', 'CAM', ['LW'], 'special', 170, false,
    '78 76 | 64 68 35 64 | 74 64 68 66 72 | 30 34 25 28 | 78 80 84 | 70 48 45 | 66 66 50 68'],
  ['al-sahlawi', 'Mohammad Al-Sahlawi', '무함마드 알사흘라위', 1987, 'Saudi Arabia', 'Al-Nassr', SPL, 20, 175, 72, 'right', 'ST', [], 'special', 170, false,
    '70 72 | 76 64 62 78 | 60 48 45 45 58 | 25 28 22 25 | 72 74 72 | 66 66 64 | 70 72 55 60'],
  // ── 알아흘리 ──
  ['omar-al-somah', 'Omar Al Somah', '오마르 알소마', 1989, 'Syria', 'Al-Ahli', SPL, 9, 192, 87, 'right', 'ST', [], 'topClass', 280, false,
    '66 72 | 82 72 82 84 | 62 50 45 66 58 | 28 30 25 28 | 64 64 58 | 70 84 82 | 76 78 66 66'],
  ['djaniny', 'Djaniny', '자니니', 1991, 'Cape Verde', 'Al-Ahli', SPL, 11, 177, 72, 'right', 'ST', ['LW'], 'special', 160, false,
    '74 72 | 74 64 62 74 | 62 50 55 45 60 | 30 30 25 28 | 80 82 78 | 76 68 66 | 68 68 50 74'],
  ['al-moqahwi', 'Hussain Al-Moqahwi', '후세인 알모카위', 1988, 'Saudi Arabia', 'Al-Ahli', SPL, 8, 172, 66, 'right', 'CM', ['CDM'], 'special', 120, false,
    '68 72 | 55 64 45 56 | 74 70 58 55 70 | 62 64 58 60 | 64 66 70 | 78 58 52 | 66 66 60 76'],
  ['motaz-hawsawi', 'Motaz Hawsawi', '모타즈 하우사위', 1992, 'Saudi Arabia', 'Al-Ahli', SPL, 3, 182, 77, 'right', 'CB', [], 'special', 120, false,
    '52 58 | 35 38 70 40 | 62 58 40 35 50 | 68 68 68 68 | 64 62 58 | 70 74 72 | 64 64 62 68'],
  // ── 알이티하드 ──
  ['romarinho', 'Romarinho', '호마리뉴', 1990, 'Brazil', 'Al-Ittihad', SPL, 10, 170, 66, 'right', 'RW', ['CAM', 'LW'], 'special', 180, false,
    '80 78 | 72 74 40 70 | 72 64 66 66 72 | 30 32 25 28 | 78 82 84 | 70 52 50 | 70 70 55 70'],
  ['fahad-al-muwallad', 'Fahad Al-Muwallad', '파하드 알무왈라드', 1994, 'Saudi Arabia', 'Al-Ittihad', SPL, 19, 167, 64, 'right', 'RW', ['ST', 'LW'], 'special', 170, false,
    '76 72 | 70 64 45 68 | 62 52 58 50 60 | 28 30 22 25 | 90 90 84 | 72 54 52 | 62 62 50 70', 6],
  // ── 알샤바브 ──
  ['hattan-bahebri', 'Hattan Bahebri', '하탄 바헤브리', 1992, 'Saudi Arabia', 'Al-Shabab', SPL, 10, 172, 66, 'right', 'CAM', ['RW'], 'special', 120, false,
    '76 76 | 66 70 40 64 | 72 64 66 62 70 | 30 34 25 28 | 74 76 80 | 70 54 50 | 66 66 52 70'],
];

export const PLAYERS: FieldPlayerData[] = ROWS.map(
  ([id, name, nameKo, birthYear, nationality, club, league, shirtNumber, height, weight, foot,
    position, subPositions, potentialTier, reputation, legendBadge, attrs, spread]) => ({
    id, name, nameKo, birthYear, nationality, club, league, shirtNumber, height, weight, foot,
    position, subPositions, traits: [], potentialTier, reputation, legendBadge,
    attributes: parseAttrs(id, attrs),
    ...(spread !== undefined ? { variance: { spread } } : {}),
  }),
);
