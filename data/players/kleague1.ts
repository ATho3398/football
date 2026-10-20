import { FIELD_ATTRIBUTES, type FieldAttributes } from '../../src/attributes';
import type { FieldPlayerData, Foot, Position, Tier } from '../../src/types';

// K리그1 2018 유명 선수 (C.75q, 45d4). stars.ts 와 같은 Row 형식, 필드 선수만. 데이터만 — 게임 연결은 45b.
// 능력치는 2018 시즌 기준 나이·실력으로 stars.ts 척도에 맞춰 보수적으로 잡았다(리그 정상급 ≈ 70대 중후반).
// 짧은 이름은 한국 이름 전체(names.ts autoShortKo: 마지막 단어)라 예외 표가 없다.
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

const KL = 'K League 1';
const KOR = 'Korea Republic';

const ROWS: Row[] = [
  // 전북 현대 모터스
  ['lee-dong-gook', 'Lee Dong-gook', '이동국', 1979, KOR, 'Jeonbuk Hyundai Motors', KL, 20, 185, 80, 'right', 'ST', [], 'topClass', 160, false,
    '66 75 | 80 76 78 84 | 72 60 55 68 70 | 25 28 22 25 | 56 58 60 | 62 74 72 | 84 80 82 76'],
  ['kim-shin-wook', 'Kim Shin-wook', '김신욱', 1988, KOR, 'Jeonbuk Hyundai Motors', KL, 9, 196, 93, 'right', 'ST', [], 'special', 130, false,
    '58 68 | 72 62 86 76 | 64 55 45 50 60 | 30 32 30 30 | 58 56 50 | 72 86 84 | 70 72 66 76'],
  ['lee-yong', 'Lee Yong', '이용', 1986, KOR, 'Jeonbuk Hyundai Motors', KL, 2, 180, 74, 'right', 'RB', [], 'special', 110, false,
    '64 68 | 50 52 60 56 | 70 66 74 50 62 | 70 70 68 70 | 72 72 70 | 82 66 64 | 68 62 66 82'],
  ['kim-min-jae', 'Kim Min-jae', '김민재', 1996, KOR, 'Jeonbuk Hyundai Motors', KL, 3, 190, 88, 'right', 'CB', [], 'worldClass', 110, false,
    '58 66 | 40 44 72 40 | 66 62 40 35 56 | 76 74 74 72 | 76 72 62 | 78 84 76 | 66 68 60 82', 8],
  ['ricardo-lopes', 'Ricardo Lopes', '로페즈', 1990, 'Brazil', 'Jeonbuk Hyundai Motors', KL, 10, 183, 78, 'right', 'LW', ['RW'], 'special', 110, false,
    '78 74 | 72 70 55 72 | 64 58 64 55 64 | 30 32 28 30 | 84 82 78 | 76 74 62 | 68 70 52 72'],
  ['han-kyo-won', 'Han Kyo-won', '한교원', 1990, KOR, 'Jeonbuk Hyundai Motors', KL, 7, 182, 73, 'right', 'RW', ['LW'], 'normal', 70, false,
    '72 70 | 66 62 50 68 | 64 56 66 45 60 | 32 34 30 32 | 84 82 76 | 78 66 60 | 64 64 50 74'],
  ['son-jun-ho', 'Son Jun-ho', '손준호', 1992, KOR, 'Jeonbuk Hyundai Motors', KL, 28, 177, 70, 'right', 'CM', ['CDM'], 'special', 90, false,
    '70 74 | 58 66 52 58 | 74 72 66 62 72 | 68 70 62 66 | 68 70 74 | 84 64 60 | 70 64 58 84'],
  // 경남 FC
  ['malcom', 'Malcom', '말컹', 1994, 'Brazil', 'Gyeongnam FC', KL, 9, 196, 90, 'right', 'ST', [], 'special', 120, false,
    '68 70 | 78 68 80 78 | 58 50 44 50 56 | 25 28 22 25 | 72 68 58 | 70 84 82 | 70 76 50 68', 5],
  ['choi-young-jun', 'Choi Young-jun', '최영준', 1991, KOR, 'Gyeongnam FC', KL, 66, 181, 75, 'right', 'CDM', ['CM'], 'normal', 60, false,
    '62 68 | 50 56 58 50 | 70 68 56 45 64 | 72 74 68 70 | 62 64 64 | 84 70 64 | 66 60 64 84'],
  // 울산 현대
  ['park-joo-ho', 'Park Joo-ho', '박주호', 1987, KOR, 'Ulsan Hyundai', KL, 33, 175, 70, 'left', 'LB', ['CDM'], 'special', 120, false,
    '68 72 | 50 56 50 56 | 72 68 68 50 66 | 70 70 66 68 | 70 70 72 | 80 62 58 | 70 64 64 80'],
  ['lee-keun-ho', 'Lee Keun-ho', '이근호', 1985, KOR, 'Ulsan Hyundai', KL, 22, 176, 74, 'right', 'ST', ['LW', 'RW'], 'special', 100, false,
    '70 70 | 68 64 58 70 | 64 56 58 50 62 | 30 32 28 30 | 74 76 74 | 80 62 62 | 68 64 68 84'],
  ['junior-negrao', 'Junior Negrão', '주니오', 1986, 'Brazil', 'Ulsan Hyundai', KL, 9, 185, 80, 'right', 'ST', [], 'normal', 90, false,
    '66 70 | 78 68 74 80 | 60 50 44 50 56 | 25 28 22 25 | 64 64 60 | 68 76 72 | 76 78 56 70'],
  // 포항 스틸러스
  ['kim-seung-dae', 'Kim Seung-dae', '김승대', 1991, KOR, 'Pohang Steelers', KL, 12, 175, 64, 'right', 'CF', ['CAM', 'RW'], 'normal', 70, false,
    '72 72 | 66 62 48 74 | 68 58 58 50 66 | 32 34 28 32 | 78 82 80 | 80 54 56 | 66 64 54 78'],
  // 수원 삼성 블루윙즈
  ['yeom-ki-hun', 'Yeom Ki-hun', '염기훈', 1983, KOR, 'Suwon Samsung Bluewings', KL, 26, 182, 80, 'left', 'LW', ['LM'], 'special', 120, false,
    '70 76 | 66 74 50 64 | 76 76 82 82 76 | 30 34 28 30 | 60 60 64 | 68 66 58 | 76 70 78 76'],
  ['dejan-damjanovic', 'Dejan Damjanović', '데얀', 1981, 'Montenegro', 'Suwon Samsung Bluewings', KL, 10, 187, 81, 'right', 'ST', [], 'special', 130, false,
    '68 74 | 80 72 74 82 | 66 54 50 55 62 | 22 25 20 22 | 58 58 60 | 62 72 70 | 80 78 64 68'],
  ['hong-chul', 'Hong Chul', '홍철', 1990, KOR, 'Suwon Samsung Bluewings', KL, 33, 176, 70, 'left', 'LB', ['LM'], 'special', 90, false,
    '68 70 | 52 58 46 54 | 68 66 76 62 62 | 64 64 62 64 | 76 76 74 | 80 60 56 | 64 60 56 78'],
  // 대구 FC
  ['cesinha', 'Cesinha', '세징야', 1989, 'Brazil', 'Daegu FC', KL, 11, 177, 73, 'right', 'CAM', ['LW', 'RW'], 'special', 100, false,
    '78 76 | 70 76 46 70 | 74 66 70 76 74 | 34 38 30 32 | 74 78 80 | 78 62 56 | 70 68 66 78'],
  // FC 서울
  ['park-chu-young', 'Park Chu-young', '박주영', 1985, KOR, 'FC Seoul', KL, 10, 182, 75, 'right', 'ST', ['CF'], 'special', 140, false,
    '70 74 | 72 70 70 74 | 68 58 54 74 66 | 25 28 22 25 | 62 64 66 | 64 66 68 | 74 70 66 68'],
  ['go-yo-han', 'Go Yo-han', '고요한', 1988, KOR, 'FC Seoul', KL, 13, 170, 65, 'right', 'RB', ['CM', 'RM'], 'normal', 70, false,
    '68 70 | 52 56 44 54 | 70 64 64 50 62 | 66 68 64 66 | 74 76 78 | 82 56 56 | 64 60 68 84'],
  // 인천 유나이티드
  ['stefan-mugosa', 'Stefan Mugoša', '무고사', 1992, 'Montenegro', 'Incheon United', KL, 9, 189, 82, 'right', 'ST', [], 'normal', 70, false,
    '64 68 | 76 70 76 76 | 58 50 44 55 54 | 25 28 22 25 | 66 66 60 | 70 76 76 | 70 72 52 72'],
  ['moon-seon-min', 'Moon Seon-min', '문선민', 1992, KOR, 'Incheon United', KL, 27, 172, 68, 'right', 'RW', ['LW'], 'normal', 70, false,
    '74 68 | 64 60 42 66 | 60 50 60 45 56 | 28 30 26 28 | 86 86 82 | 76 54 56 | 60 62 46 76'],
  // 강원 FC
  ['jung-jo-gook', 'Jung Jo-gook', '정조국', 1984, KOR, 'Gangwon FC', KL, 9, 186, 80, 'right', 'ST', [], 'normal', 80, false,
    '64 70 | 74 68 70 76 | 62 52 46 55 58 | 22 25 20 22 | 60 60 60 | 64 70 68 | 72 72 62 70'],
  // 상주 상무
  ['yoon-bit-garam', 'Yoon Bit-garam', '윤빛가람', 1990, KOR, 'Sangju Sangmu', KL, 10, 178, 75, 'right', 'CAM', ['CM'], 'special', 80, false,
    '70 74 | 64 72 46 62 | 76 74 66 72 76 | 46 50 42 44 | 64 66 68 | 74 62 54 | 70 64 58 70'],
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
