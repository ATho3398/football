import { FIELD_ATTRIBUTES, type FieldAttributes } from '../../src/attributes';
import type { FieldPlayerData, Foot, Position, Tier } from '../../src/types';

// 에레디비시 2018-19 유명 선수 (C.75p, 45d3): 36명(아약스 14·PSV 11·페예노르트 7·AZ 3·빌럼 II 1), 필드 선수만. 형식은 stars.ts 와 같다.
// 판페르시(페예노르트)는 레전드 팩에 있어 뺐다. 능력치는 2018-19 시즌 기준 보수적 추정(기억 기반), 척도는 stars.ts 에 맞췄다. 능력치 25개 순서:
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

const L = 'Eredivisie';

const ROWS: Row[] = [
  // ── 아약스 ──
  ['frenkie-de-jong', 'Frenkie de Jong', '프렝키 더용', 1997, 'Netherlands', 'Ajax', L, 21, 180, 74, 'right', 'CM', ['CDM'], 'worldClass', 350, false,
    '86 88 | 60 66 50 64 | 88 84 66 55 86 | 66 74 60 66 | 76 80 84 | 84 62 56 | 86 72 64 82', 6],
  ['de-ligt', 'Matthijs de Ligt', '마타이스 더리흐트', 1999, 'Netherlands', 'Ajax', L, 4, 189, 89, 'right', 'CB', [], 'worldClass', 350, false,
    '62 70 | 45 50 80 40 | 72 72 46 40 60 | 82 80 80 80 | 70 66 60 | 78 86 82 | 80 72 82 80', 6],
  ['ziyech', 'Hakim Ziyech', '하킴 지예흐', 1993, 'Morocco', 'Ajax', L, 22, 180, 65, 'left', 'RW', ['CAM'], 'topClass', 300, false,
    '82 82 | 74 82 40 72 | 82 82 84 80 86 | 40 44 30 36 | 72 74 80 | 78 58 46 | 76 70 60 76'],
  ['tadic', 'Dušan Tadić', '두샨 타디치', 1988, 'Serbia', 'Ajax', L, 10, 181, 76, 'left', 'LW', ['CF', 'CAM'], 'topClass', 300, false,
    '82 84 | 76 74 56 80 | 82 74 78 74 84 | 36 40 30 34 | 70 72 76 | 80 64 56 | 82 78 74 80'],
  ['neres', 'David Neres', '다비드 네레스', 1997, 'Brazil', 'Ajax', L, 7, 175, 66, 'left', 'RW', ['LW'], 'topClass', 200, false,
    '84 78 | 70 68 40 70 | 68 56 62 55 68 | 26 30 22 24 | 84 86 86 | 70 52 46 | 66 66 44 70', 6],
  ['van-de-beek', 'Donny van de Beek', '도니 판더베이크', 1997, 'Netherlands', 'Ajax', L, 6, 184, 76, 'right', 'CAM', ['CM'], 'topClass', 200, false,
    '74 80 | 70 66 58 80 | 78 66 60 50 76 | 56 60 50 56 | 66 70 72 | 84 64 58 | 78 74 60 84', 5],
  ['blind', 'Daley Blind', '달레이 블린트', 1990, 'Netherlands', 'Ajax', L, 17, 180, 72, 'left', 'CB', ['LB', 'CDM'], 'special', 250, false,
    '68 76 | 46 60 56 46 | 82 82 72 66 78 | 72 78 72 78 | 56 58 62 | 72 62 56 | 82 64 76 74'],
  ['tagliafico', 'Nicolás Tagliafico', '니콜라스 탈리아피코', 1992, 'Argentina', 'Ajax', L, 31, 172, 65, 'left', 'LB', [], 'special', 150, false,
    '68 70 | 46 50 60 50 | 70 64 70 40 62 | 76 74 72 72 | 76 76 74 | 84 66 66 | 72 60 64 86'],
  ['mazraoui', 'Noussair Mazraoui', '누사이르 마즈라위', 1997, 'Morocco', 'Ajax', L, 12, 183, 70, 'right', 'RB', ['RM'], 'topClass', 100, false,
    '72 72 | 46 50 50 46 | 70 62 64 40 62 | 66 68 64 64 | 76 76 76 | 78 62 56 | 66 60 48 76', 6],
  ['schone', 'Lasse Schöne', '라세 쇠네', 1986, 'Denmark', 'Ajax', L, 20, 175, 69, 'right', 'CM', ['CDM'], 'special', 120, false,
    '68 76 | 60 72 45 58 | 80 80 70 82 76 | 60 64 54 62 | 54 56 62 | 76 56 48 | 80 64 74 78'],
  ['huntelaar', 'Klaas-Jan Huntelaar', '클라스얀 훈텔라르', 1983, 'Netherlands', 'Ajax', L, 9, 186, 82, 'right', 'ST', [], 'topClass', 200, false,
    '62 72 | 80 64 76 84 | 64 46 42 45 58 | 22 24 20 22 | 52 54 56 | 56 74 70 | 80 80 72 72'],
  ['dolberg', 'Kasper Dolberg', '카스페르 돌베르그', 1997, 'Denmark', 'Ajax', L, 25, 187, 77, 'right', 'ST', [], 'topClass', 150, false,
    '70 72 | 74 66 62 72 | 64 48 46 45 60 | 22 24 20 22 | 72 72 68 | 64 70 64 | 70 70 46 66', 6],
  ['veltman', 'Joël Veltman', '조얼 펠트만', 1992, 'Netherlands', 'Ajax', L, 3, 183, 78, 'right', 'RB', ['CB'], 'special', 100, false,
    '60 66 | 40 44 64 36 | 70 66 56 40 58 | 74 74 72 74 | 66 66 64 | 76 70 66 | 70 56 66 76'],
  ['gravenberch', 'Ryan Gravenberch', '라이언 흐라벤베르흐', 2002, 'Netherlands', 'Ajax', L, 37, 190, 78, 'right', 'CM', ['CDM'], 'worldClass', 30, false,
    '64 64 | 46 50 40 46 | 60 54 44 40 56 | 46 50 42 44 | 62 64 60 | 60 58 50 | 50 46 36 64', 8],
  // ── PSV ──
  ['lozano', 'Hirving Lozano', '이르빙 로사노', 1995, 'Mexico', 'PSV', L, 11, 177, 70, 'right', 'LW', ['RW'], 'topClass', 250, false,
    '82 78 | 74 68 50 76 | 68 56 66 55 68 | 32 34 26 30 | 90 90 86 | 76 60 58 | 70 72 50 76'],
  ['bergwijn', 'Steven Bergwijn', '스테번 베르흐베인', 1997, 'Netherlands', 'PSV', L, 27, 178, 78, 'right', 'RW', ['LW'], 'topClass', 150, false,
    '82 76 | 68 66 50 70 | 70 58 66 50 70 | 36 40 30 34 | 84 86 82 | 76 66 58 | 66 64 50 76', 6],
  ['luuk-de-jong', 'Luuk de Jong', '뤼크 더용', 1990, 'Netherlands', 'PSV', L, 9, 188, 86, 'right', 'ST', [], 'special', 150, false,
    '58 66 | 74 58 86 80 | 64 50 46 45 58 | 32 34 30 32 | 56 56 52 | 74 82 86 | 72 74 80 82'],
  ['pereiro', 'Gastón Pereiro', '가스톤 페레이로', 1995, 'Uruguay', 'PSV', L, 7, 188, 78, 'left', 'CAM', ['LW'], 'special', 100, false,
    '76 78 | 72 72 56 72 | 72 64 60 66 74 | 28 30 24 26 | 60 62 70 | 60 60 56 | 70 70 44 58'],
  ['dumfries', 'Denzel Dumfries', '덴젤 둠프리스', 1996, 'Netherlands', 'PSV', L, 22, 188, 80, 'right', 'RB', ['RWB'], 'topClass', 80, false,
    '66 64 | 52 50 70 54 | 62 56 64 40 54 | 66 66 64 64 | 82 80 70 | 84 78 74 | 62 58 62 82', 6],
  ['rosario', 'Pablo Rosario', '파블로 로사리오', 1997, 'Netherlands', 'PSV', L, 15, 183, 78, 'right', 'CDM', ['CM'], 'special', 60, false,
    '64 70 | 50 58 60 50 | 72 66 50 40 64 | 72 72 68 70 | 66 66 64 | 80 74 66 | 66 56 60 78', 5],
  ['angelino', 'Angeliño', '앙헬리뇨', 1997, 'Spain', 'PSV', L, 3, 171, 68, 'left', 'LB', ['LWB'], 'topClass', 80, false,
    '74 72 | 46 52 40 46 | 70 66 76 50 66 | 62 64 58 60 | 78 78 78 | 80 54 50 | 64 58 48 76', 6],
  ['viergever', 'Nick Viergever', '닉 피르허버르', 1989, 'Netherlands', 'PSV', L, 4, 183, 80, 'left', 'CB', ['LB'], 'normal', 60, false,
    '56 64 | 30 40 70 30 | 66 64 46 30 56 | 70 70 70 72 | 60 58 56 | 72 72 70 | 70 54 66 74'],
  ['malen', 'Donyell Malen', '도니엘 말런', 1999, 'Netherlands', 'PSV', L, 17, 176, 69, 'right', 'ST', ['LW'], 'topClass', 60, false,
    '74 70 | 70 64 46 70 | 60 46 50 40 58 | 24 26 20 22 | 84 86 80 | 70 60 52 | 62 66 40 74', 7],
  ['ihattaren', 'Mohamed Ihattaren', '모하메드 이하타렌', 2002, 'Netherlands', 'PSV', L, 32, 180, 72, 'right', 'CAM', ['CM'], 'topClass', 40, false,
    '70 72 | 54 58 40 54 | 66 60 54 50 68 | 30 34 26 28 | 62 64 70 | 56 50 44 | 56 50 36 56', 8],
  ['gakpo', 'Cody Gakpo', '코디 학포', 1999, 'Netherlands', 'PSV', L, 30, 189, 76, 'right', 'LW', ['ST'], 'topClass', 30, false,
    '66 64 | 60 60 52 60 | 58 50 52 45 56 | 26 28 22 24 | 72 72 66 | 64 60 56 | 54 54 40 66', 8],
  // ── 페예노르트 ──
  ['berghuis', 'Steven Berghuis', '스테번 베르하위스', 1991, 'Netherlands', 'Feyenoord', L, 10, 182, 77, 'left', 'RW', ['CAM'], 'special', 120, false,
    '78 78 | 72 76 50 72 | 74 70 76 76 74 | 34 36 28 30 | 72 74 76 | 74 62 56 | 72 70 62 72'],
  ['toornstra', 'Jens Toornstra', '옌스 토른스트라', 1989, 'Netherlands', 'Feyenoord', L, 28, 177, 72, 'right', 'CM', ['CAM'], 'special', 100, false,
    '68 72 | 64 66 56 72 | 72 64 56 50 68 | 56 60 50 56 | 66 66 68 | 86 62 58 | 70 66 70 86'],
  ['vilhena', 'Tonny Vilhena', '토니 빌레나', 1995, 'Netherlands', 'Feyenoord', L, 8, 173, 69, 'left', 'CM', ['LM', 'LB'], 'special', 90, false,
    '72 74 | 60 66 46 60 | 74 68 64 55 70 | 58 62 52 56 | 68 70 74 | 80 60 50 | 68 60 56 78'],
  ['kokcu', 'Orkun Kökçü', '오르쿤 쾨크취', 2000, 'Turkey', 'Feyenoord', L, 33, 175, 68, 'right', 'CAM', ['CM'], 'topClass', 50, false,
    '74 74 | 60 70 40 58 | 72 66 60 66 72 | 40 46 34 38 | 66 68 74 | 70 52 46 | 64 58 46 70', 8],
  ['jorgensen', 'Nicolai Jørgensen', '니콜라이 요르겐센', 1991, 'Denmark', 'Feyenoord', L, 9, 190, 84, 'right', 'ST', ['CF'], 'special', 120, false,
    '70 74 | 70 62 72 72 | 70 56 50 45 68 | 32 34 28 30 | 64 64 64 | 72 76 74 | 70 66 56 74'],
  ['st-juste', 'Jeremiah St. Juste', '예레미아 스트 유스터', 1996, 'Netherlands', 'Feyenoord', L, 4, 180, 75, 'right', 'CB', ['RB'], 'special', 60, false,
    '62 64 | 30 32 64 30 | 62 56 44 30 50 | 68 68 64 66 | 86 84 72 | 70 70 70 | 60 52 50 72', 6],
  ['sam-larsson', 'Sam Larsson', '삼 라르손', 1993, 'Sweden', 'Feyenoord', L, 11, 179, 70, 'right', 'LW', ['RW'], 'normal', 70, false,
    '78 72 | 62 62 40 64 | 66 56 66 55 64 | 28 30 24 26 | 78 80 82 | 68 52 46 | 62 60 44 66'],
  // ── AZ ──
  ['stengs', 'Calvin Stengs', '칼빈 스텡스', 1998, 'Netherlands', 'AZ', L, 7, 182, 70, 'left', 'RW', ['CAM'], 'topClass', 50, false,
    '76 74 | 62 66 40 62 | 72 66 70 60 74 | 30 34 26 28 | 72 74 78 | 66 52 46 | 64 58 44 70', 7],
  ['koopmeiners', 'Teun Koopmeiners', '퇸 코프메이너르스', 1998, 'Netherlands', 'AZ', L, 6, 184, 77, 'left', 'CM', ['CDM', 'CB'], 'topClass', 50, false,
    '66 72 | 60 70 56 60 | 76 76 60 70 70 | 62 64 58 62 | 62 62 64 | 80 66 60 | 70 64 64 80', 7],
  ['boadu', 'Myron Boadu', '마이런 보아두', 2001, 'Netherlands', 'AZ', L, 9, 180, 70, 'right', 'ST', [], 'topClass', 30, false,
    '66 64 | 66 56 56 66 | 54 42 42 40 50 | 20 22 18 20 | 78 80 74 | 64 60 54 | 56 60 36 66', 8],
  // ── 빌럼 II (겨울 임대) ──
  ['isak', 'Alexander Isak', '알렉산데르 이사크', 1999, 'Sweden', 'Willem II', L, 9, 190, 75, 'right', 'ST', [], 'worldClass', 80, false,
    '76 74 | 72 62 62 72 | 62 48 46 45 62 | 22 24 20 22 | 78 78 76 | 64 62 64 | 70 72 44 68', 8],
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
