import { FIELD_ATTRIBUTES, type FieldAttributes } from '../../src/attributes';
import type { FieldPlayerData, Foot, Position, Tier } from '../../src/types';

// EFL 챔피언십 2018-19 유명 선수 (C.75p, 45d3): 20명, 필드 선수만. 형식은 stars.ts 와 같다(club = 팀 영문 이름, 임대생은 그 시즌 뛴 팀).
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

const L = 'EFL Championship';

const ROWS: Row[] = [
  ['grealish', 'Jack Grealish', '잭 그릴리시', 1995, 'England', 'Aston Villa', L, 10, 175, 68, 'right', 'CAM', ['LW', 'CM'], 'topClass', 200, false,
    '84 83 | 66 68 45 70 | 78 70 72 66 78 | 40 45 35 40 | 74 78 84 | 76 66 50 | 74 68 70 80', 5],
  ['tammy-abraham', 'Tammy Abraham', '태미 에이브러햄', 1997, 'England', 'Aston Villa', L, 18, 190, 80, 'right', 'ST', [], 'topClass', 150, false,
    '70 72 | 76 64 72 76 | 64 50 50 45 60 | 25 28 22 25 | 76 74 70 | 74 72 72 | 70 74 50 74', 6],
  ['mcginn', 'John McGinn', '존 맥긴', 1994, 'Scotland', 'Aston Villa', L, 7, 178, 68, 'left', 'CM', ['CAM'], 'special', 120, false,
    '74 75 | 64 70 55 66 | 74 68 62 55 70 | 64 64 56 60 | 70 74 72 | 86 74 60 | 70 66 64 88'],
  ['pukki', 'Teemu Pukki', '테무 푸키', 1990, 'Finland', 'Norwich City', L, 22, 180, 74, 'right', 'ST', ['CF'], 'special', 130, false,
    '72 74 | 78 66 60 80 | 70 55 52 50 66 | 28 30 22 26 | 76 80 76 | 78 62 58 | 78 78 58 82'],
  ['buendia', 'Emiliano Buendía', '에밀리아노 부엔디아', 1996, 'Argentina', 'Norwich City', L, 17, 172, 72, 'right', 'CAM', ['RW', 'RM'], 'topClass', 90, false,
    '78 78 | 64 66 40 68 | 76 70 72 62 78 | 42 46 34 38 | 72 76 82 | 80 54 46 | 70 66 52 84', 5],
  ['aarons', 'Max Aarons', '맥스 아론스', 2000, 'England', 'Norwich City', L, 2, 178, 64, 'right', 'RB', ['RWB'], 'topClass', 50, false,
    '70 68 | 40 45 50 45 | 68 60 64 40 58 | 64 64 62 62 | 80 80 76 | 76 56 56 | 60 58 44 74', 7],
  ['mount', 'Mason Mount', '메이슨 마운트', 1999, 'England', 'Derby County', L, 8, 178, 70, 'right', 'CAM', ['CM'], 'topClass', 100, false,
    '74 75 | 66 72 45 66 | 76 70 68 72 76 | 48 54 40 46 | 72 74 76 | 80 56 50 | 68 64 52 84', 7],
  ['harry-wilson', 'Harry Wilson', '해리 윌슨', 1997, 'Wales', 'Derby County', L, 22, 173, 68, 'left', 'RW', ['RM', 'CAM'], 'special', 90, false,
    '74 74 | 70 78 40 66 | 68 66 70 80 66 | 30 34 26 28 | 72 74 76 | 66 54 46 | 66 66 46 66', 6],
  ['tomori', 'Fikayo Tomori', '피카요 토모리', 1997, 'England', 'Derby County', L, 6, 185, 75, 'right', 'CB', ['RB'], 'topClass', 70, false,
    '58 64 | 30 30 66 30 | 66 60 44 30 52 | 68 70 66 66 | 80 76 70 | 74 70 70 | 64 58 54 74', 6],
  ['pablo-hernandez', 'Pablo Hernández', '파블로 에르난데스', 1985, 'Spain', 'Leeds United', L, 19, 173, 67, 'right', 'CAM', ['RW', 'LW'], 'special', 100, false,
    '76 80 | 70 72 40 70 | 80 76 74 70 82 | 30 36 28 30 | 64 66 76 | 66 52 44 | 80 70 66 74'],
  ['kalvin-phillips', 'Kalvin Phillips', '캘빈 필립스', 1995, 'England', 'Leeds United', L, 23, 178, 72, 'right', 'CDM', ['CM', 'CB'], 'topClass', 70, false,
    '64 70 | 52 64 56 54 | 74 74 60 56 68 | 70 74 66 70 | 64 64 66 | 84 70 64 | 70 64 62 84', 5],
  ['billy-sharp', 'Billy Sharp', '빌리 샤프', 1986, 'England', 'Sheffield United', L, 10, 175, 72, 'right', 'ST', [], 'special', 80, false,
    '62 66 | 76 62 64 82 | 62 46 46 45 56 | 30 30 26 28 | 62 66 66 | 70 66 62 | 78 78 76 82'],
  ['gayle', 'Dwight Gayle', '드와이트 게일', 1990, 'England', 'West Bromwich Albion', L, 9, 178, 72, 'right', 'ST', [], 'special', 90, false,
    '68 68 | 76 62 60 78 | 60 46 46 45 56 | 26 28 22 25 | 82 84 76 | 70 66 62 | 72 74 48 72'],
  ['jay-rodriguez', 'Jay Rodriguez', '제이 로드리게스', 1989, 'England', 'West Bromwich Albion', L, 19, 185, 80, 'right', 'ST', ['LW'], 'special', 90, false,
    '68 70 | 74 68 74 74 | 64 52 58 50 60 | 30 32 28 30 | 72 74 70 | 72 72 74 | 70 70 52 72'],
  ['watkins', 'Ollie Watkins', '올리 왓킨스', 1995, 'England', 'Brentford', L, 11, 180, 70, 'right', 'LW', ['ST'], 'topClass', 70, false,
    '72 72 | 70 64 64 70 | 66 56 60 50 64 | 38 40 32 36 | 80 80 76 | 82 66 66 | 66 66 52 82', 5],
  ['benrahma', 'Saïd Benrahma', '사이드 벤라마', 1995, 'Algeria', 'Brentford', L, 10, 172, 66, 'right', 'LW', ['CAM', 'RW'], 'special', 60, false,
    '82 78 | 68 72 36 66 | 70 62 66 64 72 | 28 30 24 26 | 74 80 84 | 64 50 40 | 70 64 46 66', 5],
  ['maupay', 'Neal Maupay', '닐 모페', 1996, 'France', 'Brentford', L, 9, 171, 69, 'right', 'ST', [], 'special', 70, false,
    '70 72 | 74 62 60 76 | 66 50 48 45 60 | 32 34 28 30 | 74 78 78 | 74 64 58 | 70 72 48 80'],
  ['jarrod-bowen', 'Jarrod Bowen', '재러드 보언', 1996, 'England', 'Hull City', L, 20, 175, 70, 'left', 'RW', ['ST'], 'topClass', 70, false,
    '74 72 | 72 68 52 72 | 66 58 64 55 66 | 36 38 30 34 | 78 80 78 | 82 62 60 | 68 70 50 82', 5],
  ['daniel-james', 'Daniel James', '대니얼 제임스', 1997, 'Wales', 'Swansea City', L, 20, 170, 66, 'right', 'LW', ['RW'], 'special', 60, false,
    '74 68 | 60 56 40 62 | 62 52 64 45 60 | 30 34 26 28 | 92 92 82 | 76 52 46 | 60 58 44 78', 6],
  ['joe-allen', 'Joe Allen', '조 앨런', 1990, 'Wales', 'Stoke City', L, 4, 168, 62, 'right', 'CM', ['CDM'], 'special', 130, false,
    '74 80 | 56 64 45 60 | 82 74 60 50 76 | 64 70 58 64 | 64 66 78 | 82 56 48 | 80 66 70 80'],
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
