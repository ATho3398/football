import { FIELD_ATTRIBUTES, type FieldAttributes } from '../../src/attributes';
import type { FieldPlayerData, Foot, Position, Tier } from '../../src/types';

// MLS 2018 시즌 실제 선수 (45d6, 부록 C.75s). 게임에 아직 연결하지 않는다 (45b).
// stars.ts 와 같은 Row 형식·능력치 척도(2018 시즌 나이·실력 기준, 보수적으로). 필드 선수만 (Row 형식에 GK 가 없음).
// 레전드 팩에 이미 있는 루니(D.C.)·즐라탄(LA 갤럭시)·다비드 비야(뉴욕 시티)·슈바인슈타이거(시카고)는 넣지 않았다.
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

const MLS = 'Major League Soccer';

export const ROWS: Row[] = [
  ['josef-martinez', 'Josef Martínez', '호세프 마르티네스', 1993, 'Venezuela', 'Atlanta United', MLS, 7, 172, 74, 'right', 'ST', [], 'topClass', 350, false,
    '76 77 | 82 70 70 86 | 68 55 55 55 66 | 30 30 25 28 | 82 85 82 | 80 72 68 | 78 78 62 85'],
  ['almiron', 'Miguel Almirón', '미겔 알미론', 1994, 'Paraguay', 'Atlanta United', MLS, 10, 174, 63, 'left', 'CAM', ['RW', 'LW'], 'topClass', 300, false,
    '82 79 | 72 74 45 73 | 76 68 68 62 76 | 45 50 38 40 | 87 88 86 | 88 58 55 | 70 70 55 90'],
  ['vela', 'Carlos Vela', '카를로스 벨라', 1989, 'Mexico', 'Los Angeles FC', MLS, 10, 177, 75, 'left', 'RW', ['CF', 'ST'], 'topClass', 450, false,
    '84 84 | 80 80 55 80 | 80 72 74 74 82 | 30 32 25 28 | 78 80 84 | 72 62 60 | 80 76 70 68'],
  ['diego-rossi', 'Diego Rossi', '디에고 로시', 1998, 'Uruguay', 'Los Angeles FC', MLS, 9, 170, 70, 'right', 'LW', ['ST'], 'topClass', 120, false,
    '76 74 | 72 66 50 72 | 66 56 60 50 64 | 30 32 25 28 | 85 86 84 | 78 60 58 | 66 66 45 80', 7],
  ['giovinco', 'Sebastian Giovinco', '세바스티안 조빈코', 1987, 'Italy', 'Toronto FC', MLS, 10, 164, 57, 'right', 'CF', ['CAM', 'LW'], 'topClass', 450, false,
    '85 85 | 80 84 40 78 | 80 72 72 88 82 | 25 30 22 25 | 82 86 90 | 72 45 50 | 80 76 65 70'],
  ['michael-bradley', 'Michael Bradley', '마이클 브래들리', 1987, 'United States', 'Toronto FC', MLS, 4, 188, 80, 'right', 'CDM', ['CM'], 'topClass', 350, false,
    '68 76 | 62 72 64 62 | 80 80 64 60 76 | 72 74 68 72 | 62 62 64 | 82 74 70 | 78 76 82 80'],
  ['altidore', 'Jozy Altidore', '조지 알티도어', 1989, 'United States', 'Toronto FC', MLS, 17, 185, 89, 'right', 'ST', [], 'topClass', 300, false,
    '70 74 | 76 68 72 76 | 66 52 50 50 62 | 30 30 25 28 | 72 72 64 | 70 86 72 | 72 70 60 68'],
  ['valeri', 'Diego Valeri', '디에고 발레리', 1986, 'Argentina', 'Portland Timbers', MLS, 8, 178, 72, 'right', 'CAM', ['CM'], 'topClass', 300, false,
    '78 82 | 76 78 50 76 | 82 74 72 78 82 | 38 42 32 35 | 66 68 74 | 74 60 58 | 82 78 74 76'],
  ['lodeiro', 'Nicolás Lodeiro', '니콜라스 로데이로', 1989, 'Uruguay', 'Seattle Sounders FC', MLS, 10, 173, 66, 'left', 'CAM', ['CM'], 'topClass', 300, false,
    '80 82 | 70 74 45 70 | 82 76 76 76 80 | 45 52 40 42 | 70 72 80 | 88 58 55 | 76 74 66 88'],
  ['piatti', 'Ignacio Piatti', '이그나시오 피아티', 1985, 'Argentina', 'Montreal Impact', MLS, 10, 173, 68, 'right', 'LW', ['CAM'], 'topClass', 280, false,
    '82 80 | 78 76 48 76 | 74 64 66 66 74 | 30 32 25 28 | 72 76 80 | 70 58 55 | 78 76 62 70'],
  ['wright-phillips', 'Bradley Wright-Phillips', '브래들리 라이트필립스', 1985, 'England', 'New York Red Bulls', MLS, 99, 173, 76, 'right', 'ST', [], 'special', 250, false,
    '68 72 | 78 64 66 84 | 64 50 48 45 60 | 30 32 25 28 | 70 74 72 | 76 70 62 | 78 78 60 76'],
  ['tyler-adams', 'Tyler Adams', '타일러 애덤스', 1999, 'United States', 'New York Red Bulls', MLS, 4, 175, 70, 'right', 'CM', ['CDM', 'RB'], 'topClass', 150, false,
    '68 70 | 52 56 50 55 | 70 64 58 40 64 | 70 72 66 66 | 76 78 78 | 90 64 60 | 64 64 60 90', 7],
  ['alphonso-davies', 'Alphonso Davies', '알폰소 데이비스', 2000, 'Canada', 'Vancouver Whitecaps FC', MLS, 67, 181, 72, 'left', 'LW', ['LM', 'LB'], 'worldClass', 150, false,
    '76 70 | 58 52 48 60 | 62 54 62 40 58 | 40 42 38 38 | 92 92 84 | 78 62 60 | 58 58 45 80', 9],
  ['luciano-acosta', 'Luciano Acosta', '루시아노 아코스타', 1994, 'Argentina', 'D.C. United', MLS, 10, 160, 58, 'right', 'CAM', ['LW'], 'special', 180, false,
    '82 78 | 68 70 35 68 | 76 66 68 66 76 | 35 40 30 32 | 80 84 88 | 74 45 45 | 68 66 50 76'],
  ['federico-higuain', 'Federico Higuaín', '페데리코 이과인', 1984, 'Argentina', 'Columbus Crew', MLS, 10, 175, 71, 'right', 'CAM', ['CF'], 'special', 200, false,
    '76 80 | 72 74 50 72 | 80 72 66 76 80 | 32 36 28 30 | 58 62 70 | 64 58 55 | 80 76 70 64'],
  ['zardes', 'Gyasi Zardes', '자이어시 자디스', 1991, 'United States', 'Columbus Crew', MLS, 11, 188, 78, 'right', 'ST', ['RW'], 'special', 180, false,
    '68 68 | 70 58 70 74 | 60 48 52 40 56 | 32 32 28 30 | 82 80 72 | 76 74 72 | 66 66 55 78'],
  ['alessandrini', 'Romain Alessandrini', '로맹 알레산드리니', 1989, 'France', 'LA Galaxy', MLS, 7, 175, 68, 'left', 'RW', ['LW'], 'special', 180, false,
    '78 76 | 72 76 45 70 | 70 66 72 70 70 | 30 32 25 28 | 78 80 80 | 70 55 50 | 70 68 55 70'],
  ['jonathan-dos-santos', 'Jonathan dos Santos', '조나탄 도스 산토스', 1990, 'Mexico', 'LA Galaxy', MLS, 8, 172, 74, 'left', 'CM', ['CDM'], 'special', 220, false,
    '74 80 | 62 72 45 62 | 80 76 66 62 76 | 64 68 60 62 | 66 68 74 | 78 60 55 | 74 72 62 76'],
  ['giovani-dos-santos', 'Giovani dos Santos', '조바니 도스 산토스', 1989, 'Mexico', 'LA Galaxy', MLS, 10, 175, 74, 'left', 'CF', ['CAM', 'LW'], 'special', 280, false,
    '80 80 | 72 74 45 70 | 74 64 64 66 74 | 28 30 25 26 | 72 76 80 | 62 60 55 | 72 70 55 60'],
  ['maxi-moralez', 'Maximiliano Moralez', '막시밀리아노 모랄레스', 1987, 'Argentina', 'New York City FC', MLS, 10, 160, 55, 'right', 'CAM', ['CM'], 'special', 160, false,
    '80 80 | 64 66 32 66 | 80 72 72 70 80 | 35 42 30 32 | 72 76 86 | 72 42 40 | 74 72 55 76'],
  ['darwin-quintero', 'Darwin Quintero', '다르윈 킨테로', 1987, 'Colombia', 'Minnesota United FC', MLS, 23, 163, 62, 'right', 'RW', ['CAM'], 'special', 160, false,
    '82 78 | 72 70 35 70 | 70 60 64 66 70 | 28 30 22 25 | 80 84 88 | 68 52 50 | 70 68 50 66'],
  ['alberth-elis', 'Alberth Elis', '알베르트 엘리스', 1996, 'Honduras', 'Houston Dynamo', MLS, 17, 183, 76, 'right', 'RW', ['ST'], 'special', 140, false,
    '76 72 | 72 64 60 70 | 62 52 60 45 60 | 30 30 25 28 | 88 88 80 | 74 70 66 | 64 64 45 72', 7],
  ['johnny-russell', 'Johnny Russell', '조니 러셀', 1990, 'Scotland', 'Sporting Kansas City', MLS, 7, 175, 70, 'left', 'RW', ['LW'], 'special', 140, false,
    '74 74 | 72 72 50 72 | 70 62 66 60 68 | 35 38 30 32 | 76 78 78 | 78 60 55 | 68 68 55 78'],
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
