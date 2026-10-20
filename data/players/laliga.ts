import { FIELD_ATTRIBUTES, type FieldAttributes } from '../../src/attributes';
import type { FieldPlayerData, Foot, Position, Tier } from '../../src/types';

// 라리가 2018-19 유명 실제 선수 (45d1, 부록 C.75n). 게임에는 아직 연결하지 않는다 (45b 배선).
// 필드 선수만 (GK 실제 선수 형식은 아직 없음). 중심값은 기억 기반 초안이며 그 시즌 기준 나이·실력으로 보수적으로 잡았다.
// 이미 다른 표에 있는 선수(메시·stars: 수아레스·부스케츠·라모스·모드리치·크로스·비니시우스·그리즈만, 레전드: 피케·마르셀루·베일)는 넣지 않는다.
// 소속은 2018-19 개막 기준.
// 능력치 25개는 FIELD_ATTRIBUTES 순서 (stars.ts 와 같은 척도):
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

const L = 'La Liga';
const BAR = 'FC Barcelona', RMA = 'Real Madrid', ATM = 'Atlético Madrid', VAL = 'Valencia', SEV = 'Sevilla';
const ROWS: Row[] = [
  // FC Barcelona
  ['coutinho', 'Philippe Coutinho', '필리피 코치뉴', 1992, 'Brazil', BAR, L, 7, 172, 68, 'right', 'LW', ['CAM', 'CM'], 'worldClass', 700, false,
    '90 89 | 82 90 58 84 | 89 84 80 84 90 | 56 61 54 56 | 80 83 87 | 84 64 64 | 86 82 74 82', 3],
  ['rakitic', 'Ivan Rakitić', '이반 라키티치', 1988, 'Croatia', BAR, L, 4, 184, 78, 'right', 'CM', ['CDM'], 'worldClass', 750, false,
    '84 87 | 74 88 66 74 | 89 89 76 71 86 | 76 80 74 78 | 76 78 81 | 93 76 72 | 85 82 78 89', 3],
  ['dembele', 'Ousmane Dembélé', '우스만 뎀벨레', 1997, 'France', BAR, L, 11, 178, 67, 'both', 'RW', ['LW'], 'worldClass', 550, false,
    '88 85 | 81 82 59 84 | 78 70 78 69 78 | 39 42 36 39 | 90 91 92 | 82 66 66 | 79 78 69 80', 6],
  ['jordi-alba', 'Jordi Alba', '조르디 알바', 1989, 'Spain', BAR, L, 18, 170, 68, 'left', 'LB', ['LWB'], 'worldClass', 650, false,
    '77 79 | 53 59 55 83 | 83 75 89 55 70 | 82 82 80 80 | 93 93 85 | 88 69 67 | 77 77 70 87', 3],
  ['umtiti', 'Samuel Umtiti', '사뮈엘 움티티', 1993, 'France', BAR, L, 23, 182, 75, 'left', 'CB', [], 'worldClass', 550, false,
    '64 72 | 44 54 86 49 | 78 80 54 49 64 | 86 85 86 87 | 74 72 66 | 78 88 87 | 82 82 79 79', 4],
  ['arthur', 'Arthur', '아르투르', 1996, 'Brazil', BAR, L, 8, 172, 73, 'right', 'CM', [], 'topClass', 350, false,
    '83 88 | 65 75 61 69 | 91 82 71 66 81 | 71 75 69 73 | 71 73 76 | 84 71 67 | 84 77 73 84', 5],
  // Real Madrid
  ['benzema', 'Karim Benzema', '카림 벤제마', 1987, 'France', RMA, L, 9, 185, 81, 'right', 'ST', ['CF'], 'worldClass', 800, false,
    '86 89 | 88 82 86 89 | 88 74 70 68 90 | 41 44 38 41 | 86 86 84 | 82 86 86 | 88 86 76 80', 3],
  ['isco', 'Isco', '이스코', 1992, 'Spain', RMA, L, 22, 176, 79, 'right', 'CAM', ['CM', 'LW'], 'worldClass', 650, false,
    '91 92 | 82 86 58 84 | 89 84 80 80 90 | 56 61 54 56 | 76 83 87 | 84 66 64 | 86 82 74 82', 3],
  ['asensio', 'Marco Asensio', '마르코 아센시오', 1996, 'Spain', RMA, L, 20, 182, 76, 'left', 'RW', ['CAM', 'LW'], 'worldClass', 500, false,
    '86 83 | 83 88 62 82 | 76 68 76 73 76 | 37 40 34 37 | 88 89 87 | 80 64 64 | 77 76 67 78', 6],
  ['varane', 'Raphaël Varane', '라파엘 바란', 1993, 'France', RMA, L, 5, 191, 81, 'right', 'CB', [], 'worldClass', 750, false,
    '67 75 | 47 57 89 52 | 77 77 57 52 67 | 89 88 89 90 | 91 87 75 | 81 91 90 | 87 85 82 82', 3],
  ['carvajal', 'Dani Carvajal', '다니 카르바할', 1992, 'Spain', RMA, L, 2, 173, 73, 'right', 'RB', [], 'worldClass', 550, false,
    '76 78 | 52 58 66 68 | 78 74 84 54 69 | 83 81 79 79 | 87 87 84 | 87 74 72 | 76 80 69 88', 3],
  ['casemiro', 'Casemiro', '카세미루', 1992, 'Brazil', RMA, L, 14, 185, 84, 'right', 'CDM', [], 'worldClass', 650, false,
    '76 82 | 62 78 80 64 | 86 84 64 61 80 | 90 89 86 88 | 72 74 76 | 88 92 78 | 84 82 81 90', 3],
  // Atlético Madrid
  ['godin', 'Diego Godín', '디에고 고딘', 1986, 'Uruguay', ATM, L, 2, 187, 78, 'right', 'CB', [], 'worldClass', 700, false,
    '67 75 | 47 57 93 52 | 77 77 57 52 67 | 89 88 89 90 | 71 71 69 | 81 91 90 | 85 91 93 82', 3],
  ['jose-gimenez', 'José Giménez', '호세 마리아 히메네스', 1995, 'Uruguay', ATM, L, 24, 185, 80, 'right', 'CB', ['RB'], 'topClass', 400, false,
    '62 70 | 42 52 84 47 | 72 72 52 47 62 | 84 83 84 85 | 76 70 64 | 76 86 85 | 80 80 77 77', 5],
  ['koke', 'Koke', '코케', 1992, 'Spain', ATM, L, 6, 176, 74, 'right', 'CM', ['CAM', 'RM'], 'worldClass', 600, false,
    '83 86 | 73 79 65 73 | 88 86 87 78 88 | 75 79 73 77 | 75 77 80 | 93 75 71 | 84 81 77 88', 3],
  ['saul', 'Saúl Ñíguez', '사울 니게스', 1994, 'Spain', ATM, L, 8, 184, 76, 'left', 'CM', ['CDM', 'LM'], 'worldClass', 600, false,
    '83 86 | 79 85 79 81 | 88 86 75 70 85 | 75 79 73 77 | 75 77 80 | 91 75 71 | 84 81 77 88', 4],
  ['rodri', 'Rodri', '로드리', 1996, 'Spain', ATM, L, 14, 191, 82, 'right', 'CDM', ['CM'], 'worldClass', 250, false,
    '69 75 | 55 63 71 57 | 83 77 57 54 73 | 81 82 79 81 | 65 67 69 | 81 81 71 | 77 75 74 83', 7],
  ['diego-costa', 'Diego Costa', '디에고 코스타', 1988, 'Spain', ATM, L, 19, 186, 83, 'right', 'ST', [], 'topClass', 650, false,
    '79 81 | 85 79 83 86 | 75 67 67 65 75 | 38 41 35 38 | 83 83 75 | 79 93 83 | 85 85 73 87', 3],
  // Valencia
  ['parejo', 'Dani Parejo', '다니 파레호', 1989, 'Spain', VAL, L, 10, 182, 74, 'right', 'CM', ['CAM'], 'topClass', 450, false,
    '81 84 | 71 77 63 71 | 86 88 73 84 89 | 73 77 71 75 | 69 75 78 | 86 73 69 | 82 79 83 86', 3],
  ['rodrigo', 'Rodrigo', '로드리고 모레노', 1991, 'Spain', VAL, L, 19, 182, 77, 'right', 'ST', ['CF', 'LW'], 'topClass', 450, false,
    '82 80 | 84 78 82 85 | 74 66 66 64 74 | 37 40 34 37 | 86 82 80 | 78 82 82 | 84 82 72 82', 4],
  ['carlos-soler', 'Carlos Soler', '카를로스 솔레르', 1997, 'Spain', VAL, L, 8, 180, 76, 'right', 'CM', ['RM'], 'topClass', 250, false,
    '76 79 | 66 76 58 66 | 81 79 74 63 78 | 68 72 66 70 | 68 70 73 | 81 68 64 | 77 74 70 81', 6],
  ['gaya', 'José Gayà', '호세 가야', 1995, 'Spain', VAL, L, 14, 172, 64, 'left', 'LB', [], 'topClass', 350, false,
    '73 75 | 49 55 63 65 | 75 71 85 51 66 | 78 78 76 76 | 86 84 81 | 84 71 69 | 73 73 66 83', 4],
  ['guedes', 'Gonçalo Guedes', '곤살루 게드스', 1996, 'Portugal', VAL, L, 7, 179, 68, 'right', 'LW', ['RW', 'ST'], 'topClass', 400, false,
    '84 81 | 80 74 55 80 | 74 66 74 65 74 | 35 38 32 35 | 90 87 85 | 78 62 62 | 75 74 65 76', 6],
  // Sevilla
  ['ben-yedder', 'Wissam Ben Yedder', '위삼 벤 예데르', 1990, 'France', SEV, L, 9, 170, 68, 'right', 'ST', ['CF'], 'topClass', 450, false,
    '79 85 | 85 79 68 86 | 75 67 67 65 75 | 38 41 35 38 | 83 83 87 | 79 73 83 | 85 83 73 77', 3],
  ['sarabia', 'Pablo Sarabia', '파블로 사라비아', 1992, 'Spain', SEV, L, 17, 174, 70, 'left', 'RW', ['CAM'], 'topClass', 400, false,
    '86 83 | 79 76 57 82 | 84 68 80 73 84 | 37 40 34 37 | 82 84 87 | 80 64 64 | 77 76 67 78', 3],
  ['banega', 'Éver Banega', '에베르 바네가', 1988, 'Argentina', SEV, L, 10, 175, 73, 'right', 'CM', ['CAM'], 'topClass', 500, false,
    '85 84 | 71 77 63 71 | 86 90 73 76 90 | 73 77 71 75 | 67 75 78 | 86 73 69 | 82 79 75 86', 3],
  ['jesus-navas', 'Jesús Navas', '헤수스 나바스', 1985, 'Spain', SEV, L, 16, 172, 60, 'right', 'RB', ['RM'], 'topClass', 550, false,
    '79 75 | 49 55 63 65 | 75 71 89 51 66 | 78 78 76 76 | 90 90 81 | 84 63 69 | 73 73 66 83', 3],
  ['andre-silva', 'André Silva', '안드레 실바', 1995, 'Portugal', SEV, L, 33, 185, 79, 'right', 'ST', [], 'topClass', 350, false,
    '76 78 | 82 76 84 83 | 72 64 64 62 72 | 35 38 32 35 | 80 80 78 | 76 80 80 | 82 80 70 74', 5],
  // Getafe
  ['jaime-mata', 'Jaime Mata', '하이메 마타', 1988, 'Spain', 'Getafe', L, 7, 186, 80, 'right', 'ST', [], 'special', 250, false,
    '73 75 | 79 73 81 80 | 69 61 61 59 69 | 32 35 29 32 | 77 77 75 | 73 77 77 | 79 77 67 81', 4],
  ['jorge-molina', 'Jorge Molina', '호르헤 몰리나', 1982, 'Spain', 'Getafe', L, 19, 188, 80, 'right', 'ST', [], 'special', 250, false,
    '72 74 | 78 72 84 79 | 68 60 60 58 68 | 31 34 28 31 | 64 66 74 | 72 76 76 | 84 76 66 70', 3],
  ['djene', 'Djené', '제네 다코남', 1991, 'Togo', 'Getafe', L, 2, 178, 72, 'right', 'CB', [], 'special', 200, false,
    '58 66 | 38 48 80 43 | 68 68 48 43 58 | 84 79 80 81 | 76 66 68 | 72 82 81 | 76 76 73 73', 3],
  // Espanyol
  ['borja-iglesias', 'Borja Iglesias', '보르하 이글레시아스', 1993, 'Spain', 'Espanyol', L, 7, 187, 86, 'right', 'ST', [], 'special', 250, false,
    '74 76 | 80 74 82 81 | 70 62 62 60 70 | 33 36 30 33 | 70 78 76 | 74 86 78 | 80 78 68 72', 4],
  ['darder', 'Sergi Darder', '세르히 다르데르', 1993, 'Spain', 'Espanyol', L, 8, 180, 72, 'right', 'CM', [], 'special', 250, false,
    '75 78 | 65 75 57 65 | 80 78 67 62 77 | 67 71 65 69 | 67 69 72 | 80 67 63 | 76 73 69 80', 4],
  ['hermoso', 'Mario Hermoso', '마리오 에르모소', 1995, 'Spain', 'Espanyol', L, 22, 184, 77, 'left', 'CB', ['LB'], 'topClass', 200, false,
    '58 66 | 38 48 80 43 | 68 74 48 43 58 | 80 79 80 81 | 68 66 60 | 72 82 81 | 76 76 73 73', 5],
  // Athletic Bilbao
  ['inaki-williams', 'Iñaki Williams', '이냐키 윌리엄스', 1994, 'Spain', 'Athletic Bilbao', L, 9, 186, 78, 'right', 'RW', ['ST'], 'topClass', 350, false,
    '79 80 | 72 73 54 79 | 73 65 73 64 73 | 34 37 31 34 | 93 92 84 | 83 71 61 | 74 73 64 75', 5],
  ['aduriz', 'Aritz Aduriz', '아리츠 아두리스', 1981, 'Spain', 'Athletic Bilbao', L, 20, 182, 78, 'right', 'ST', [], 'topClass', 450, false,
    '76 78 | 82 76 92 83 | 72 64 64 62 72 | 35 38 32 35 | 66 68 78 | 76 80 88 | 86 80 80 74', 3],
  ['muniain', 'Iker Muniain', '이케르 무니아인', 1992, 'Spain', 'Athletic Bilbao', L, 10, 169, 64, 'left', 'LW', ['CAM'], 'topClass', 400, false,
    '84 81 | 77 74 55 80 | 80 66 74 65 80 | 35 38 32 35 | 82 87 85 | 78 62 62 | 75 74 65 76', 3],
  ['raul-garcia', 'Raúl García', '라울 가르시아', 1986, 'Spain', 'Athletic Bilbao', L, 22, 184, 80, 'right', 'CF', ['CAM'], 'special', 350, false,
    '78 80 | 78 76 84 81 | 76 68 66 68 78 | 38 42 34 38 | 69 77 79 | 75 82 70 | 79 77 68 83', 3],
  // Real Sociedad
  ['oyarzabal', 'Mikel Oyarzabal', '미켈 오야르사발', 1997, 'Spain', 'Real Sociedad', L, 10, 181, 78, 'left', 'LW', ['RW', 'CF'], 'topClass', 300, false,
    '83 80 | 79 73 54 79 | 73 65 73 64 73 | 34 37 31 34 | 85 86 84 | 77 61 61 | 78 73 64 75', 6],
  ['willian-jose', 'Willian José', '윌리안 조제', 1991, 'Brazil', 'Real Sociedad', L, 12, 186, 82, 'right', 'ST', [], 'special', 250, false,
    '74 76 | 80 74 84 81 | 70 62 62 60 70 | 33 36 30 33 | 78 78 76 | 74 84 78 | 80 78 68 72', 4],
  ['illarramendi', 'Asier Illarramendi', '아시에르 이야라멘디', 1990, 'Spain', 'Real Sociedad', L, 4, 179, 75, 'right', 'CDM', ['CM'], 'topClass', 400, false,
    '70 76 | 56 64 68 58 | 84 82 58 55 74 | 82 83 80 82 | 66 68 70 | 82 80 72 | 78 76 75 84', 3],
  ['mikel-merino', 'Mikel Merino', '미켈 메리노', 1996, 'Spain', 'Real Sociedad', L, 8, 189, 83, 'left', 'CM', ['CDM'], 'topClass', 200, false,
    '75 78 | 65 71 63 65 | 80 78 67 62 77 | 67 71 65 69 | 67 69 72 | 80 73 63 | 76 73 69 84', 6],
  // Real Betis
  ['canales', 'Sergio Canales', '세르히오 카날레스', 1991, 'Spain', 'Real Betis', L, 10, 176, 65, 'left', 'CAM', ['CM'], 'topClass', 350, false,
    '83 84 | 77 81 53 79 | 84 79 75 79 89 | 51 56 49 51 | 75 78 82 | 79 61 59 | 81 77 69 77', 3],
  ['lo-celso', 'Giovani Lo Celso', '지오바니 로 셀소', 1996, 'Argentina', 'Real Betis', L, 21, 177, 74, 'left', 'CAM', ['CM'], 'topClass', 300, false,
    '82 83 | 76 86 52 78 | 83 78 74 74 84 | 50 55 48 50 | 74 77 81 | 78 60 58 | 80 76 68 80', 5],
  ['joaquin', 'Joaquín', '호아킨', 1981, 'Spain', 'Real Betis', L, 17, 179, 75, 'right', 'RM', ['RW'], 'special', 500, false,
    '83 78 | 74 71 52 77 | 71 63 79 62 77 | 32 35 29 32 | 69 72 82 | 75 59 59 | 72 71 76 73', 3],
  ['william-carvalho', 'William Carvalho', '윌리앙 카르발류', 1992, 'Portugal', 'Real Betis', L, 14, 187, 83, 'right', 'CDM', ['CM'], 'topClass', 400, false,
    '71 77 | 57 65 69 59 | 85 79 59 56 75 | 83 84 81 83 | 63 69 71 | 83 87 73 | 79 77 76 85', 3],
  // Alavés
  ['jony', 'Jony', '호니', 1991, 'Spain', 'Alavés', L, 17, 179, 71, 'left', 'LM', ['LW'], 'special', 200, false,
    '80 77 | 73 70 51 76 | 70 62 78 61 70 | 31 34 28 31 | 80 83 81 | 74 58 58 | 71 70 61 72', 3],
  ['ibai-gomez', 'Ibai Gómez', '이바이 고메스', 1989, 'Spain', 'Alavés', L, 11, 181, 72, 'left', 'RM', ['RW'], 'special', 200, false,
    '80 77 | 73 76 51 76 | 70 62 78 71 70 | 31 34 28 31 | 82 83 81 | 74 58 58 | 71 70 61 72', 3],
  // Eibar
  ['cucurella', 'Marc Cucurella', '마르크 쿠쿠레야', 1998, 'Spain', 'Eibar', L, 17, 172, 66, 'left', 'LM', ['LB'], 'topClass', 150, false,
    '72 68 | 42 48 56 68 | 68 64 78 44 59 | 71 71 69 69 | 77 77 74 | 77 64 62 | 66 66 59 82', 7],
  ['kike-garcia', 'Kike García', '키케 가르시아', 1989, 'Spain', 'Eibar', L, 9, 186, 80, 'right', 'ST', [], 'special', 150, false,
    '71 73 | 77 71 83 78 | 67 59 59 57 67 | 30 33 27 30 | 69 75 73 | 71 81 75 | 77 75 65 69', 3],
  ['pedro-leon', 'Pedro León', '페드로 레온', 1986, 'Spain', 'Eibar', L, 21, 177, 70, 'right', 'RM', ['RW'], 'special', 250, false,
    '80 77 | 73 70 51 76 | 70 62 80 71 70 | 31 34 28 31 | 74 77 81 | 74 58 58 | 71 70 61 72', 3],
  // Leganés
  ['en-nesyri', 'Youssef En-Nesyri', '유세프 엔네시리', 1997, 'Morocco', 'Leganés', L, 19, 189, 78, 'left', 'ST', [], 'topClass', 200, false,
    '71 73 | 77 71 83 78 | 67 59 59 57 67 | 30 33 27 30 | 79 75 73 | 71 75 85 | 77 75 65 69', 7],
  ['braithwaite', 'Martin Braithwaite', '마르틴 브레이스웨이트', 1991, 'Denmark', 'Leganés', L, 9, 180, 73, 'right', 'ST', ['LW'], 'special', 200, false,
    '72 74 | 78 72 76 79 | 68 60 60 58 68 | 31 34 28 31 | 80 76 74 | 72 76 76 | 78 76 66 80', 3],
  ['oscar-rodriguez', 'Óscar Rodríguez', '오스카르 로드리게스', 1998, 'Spain', 'Leganés', L, 22, 174, 71, 'right', 'CAM', ['CM'], 'topClass', 150, false,
    '76 77 | 70 80 46 72 | 77 72 68 78 78 | 44 49 42 44 | 68 71 75 | 72 54 52 | 74 70 62 70', 7],
  // Villarreal
  ['gerard-moreno', 'Gerard Moreno', '헤라르드 모레노', 1992, 'Spain', 'Villarreal', L, 7, 180, 77, 'left', 'ST', ['CF', 'RW'], 'topClass', 300, false,
    '77 79 | 83 77 81 84 | 79 65 65 69 79 | 36 39 33 36 | 81 81 79 | 77 81 81 | 83 81 71 75', 3],
  ['cazorla', 'Santi Cazorla', '산티 카솔라', 1984, 'Spain', 'Villarreal', L, 8, 168, 66, 'both', 'CM', ['CAM'], 'topClass', 550, false,
    '82 83 | 76 86 52 78 | 83 78 74 78 90 | 50 55 48 50 | 60 67 81 | 72 60 58 | 80 76 68 76', 3],
  ['fornals', 'Pablo Fornals', '파블로 포르날스', 1996, 'Spain', 'Villarreal', L, 18, 178, 67, 'right', 'CAM', ['LW', 'CM'], 'topClass', 250, false,
    '80 81 | 74 78 50 76 | 81 76 72 72 82 | 48 53 46 48 | 72 75 79 | 76 58 56 | 78 74 66 80', 5],
  ['chukwueze', 'Samuel Chukwueze', '새뮤얼 추쿠에제', 1999, 'Nigeria', 'Villarreal', L, 11, 172, 70, 'left', 'RW', [], 'topClass', 100, false,
    '83 74 | 70 67 48 73 | 67 59 67 58 67 | 28 31 25 28 | 85 86 78 | 71 55 55 | 62 67 58 69', 8],
  // Levante
  ['jose-luis-morales', 'José Luis Morales', '호세 루이스 모랄레스', 1987, 'Spain', 'Levante', L, 11, 178, 74, 'right', 'LW', ['ST'], 'special', 200, false,
    '81 78 | 78 71 52 77 | 71 63 71 62 71 | 32 35 29 32 | 87 84 82 | 75 59 59 | 72 71 68 73', 3],
  ['roger-marti', 'Roger Martí', '로헤르 마르티', 1991, 'Spain', 'Levante', L, 9, 177, 72, 'right', 'ST', [], 'special', 200, false,
    '72 74 | 78 72 76 79 | 68 60 60 58 68 | 31 34 28 31 | 76 76 74 | 72 76 76 | 78 76 66 70', 3],
  ['campana', 'José Campaña', '호세 캄파냐', 1993, 'Spain', 'Levante', L, 24, 177, 65, 'right', 'CM', ['CAM'], 'special', 200, false,
    '75 78 | 65 71 57 65 | 84 78 67 62 81 | 67 71 65 69 | 67 69 72 | 80 67 63 | 76 73 69 80', 3],
  // Real Valladolid
  ['oscar-plano', 'Óscar Plano', '오스카르 플라노', 1991, 'Spain', 'Real Valladolid', L, 10, 178, 72, 'right', 'RM', ['CAM'], 'special', 150, false,
    '78 75 | 71 68 49 74 | 72 60 68 59 68 | 29 32 26 29 | 80 81 79 | 72 56 56 | 69 68 59 76', 3],
  ['calero', 'Fernando Calero', '페르난도 칼레로', 1995, 'Spain', 'Real Valladolid', L, 4, 186, 76, 'right', 'CB', [], 'special', 150, false,
    '54 62 | 34 44 76 39 | 64 64 44 39 54 | 76 75 76 77 | 64 62 56 | 68 78 77 | 72 72 69 69', 5],
  // Celta Vigo
  ['aspas', 'Iago Aspas', '이아고 아스파스', 1987, 'Spain', 'Celta Vigo', L, 10, 176, 67, 'left', 'ST', ['CF'], 'topClass', 550, false,
    '84 86 | 90 88 76 87 | 82 74 72 84 84 | 44 48 40 44 | 81 83 85 | 81 78 76 | 85 87 84 81', 3],
  ['maxi-gomez', 'Maxi Gómez', '막시 고메스', 1996, 'Uruguay', 'Celta Vigo', L, 9, 186, 84, 'right', 'ST', [], 'topClass', 300, false,
    '75 77 | 81 75 85 82 | 71 63 63 61 71 | 34 37 31 34 | 73 79 77 | 75 87 79 | 81 79 69 73', 5],
  ['brais-mendez', 'Brais Méndez', '브라이스 멘데스', 1997, 'Spain', 'Celta Vigo', L, 23, 187, 76, 'left', 'RM', ['CAM'], 'topClass', 200, false,
    '77 78 | 71 75 47 73 | 78 73 69 69 79 | 45 50 43 45 | 71 72 76 | 73 55 53 | 75 71 63 71', 6],
  ['lobotka', 'Stanislav Lobotka', '스타니슬라우 로보트카', 1994, 'Slovakia', 'Celta Vigo', L, 8, 170, 66, 'right', 'CM', ['CDM'], 'topClass', 200, false,
    '76 85 | 66 72 58 66 | 87 79 68 63 78 | 68 72 66 70 | 68 70 79 | 81 64 64 | 77 74 70 81', 4],
  // Girona
  ['stuani', 'Cristhian Stuani', '크리스티안 스투아니', 1986, 'Uruguay', 'Girona', L, 7, 186, 78, 'right', 'ST', [], 'special', 300, false,
    '74 76 | 80 74 88 81 | 70 62 62 60 70 | 33 36 30 33 | 70 78 76 | 74 78 84 | 80 78 68 80', 3],
  ['portu', 'Portu', '포르투', 1992, 'Spain', 'Girona', L, 24, 166, 65, 'right', 'RW', ['LW'], 'special', 150, false,
    '79 76 | 72 69 58 75 | 69 61 69 60 69 | 30 33 27 30 | 81 82 80 | 73 57 69 | 70 69 60 81', 3],
  ['pedro-porro', 'Pedro Porro', '페드로 포로', 1999, 'Spain', 'Girona', L, 29, 173, 71, 'right', 'RB', ['RM'], 'topClass', 50, false,
    '59 61 | 35 41 49 51 | 61 57 73 37 52 | 64 64 62 62 | 70 70 67 | 70 57 55 | 55 59 52 69', 8],
  // Huesca
  ['chimy-avila', 'Chimy Ávila', '치미 아빌라', 1994, 'Argentina', 'Huesca', L, 9, 172, 72, 'right', 'ST', ['CF'], 'special', 150, false,
    '71 73 | 77 71 79 78 | 67 59 59 57 67 | 30 33 27 30 | 75 75 73 | 71 83 75 | 77 75 65 79', 4],
  ['cucho-hernandez', 'Cucho Hernández', '쿠초 에르난데스', 1999, 'Colombia', 'Huesca', L, 7, 175, 69, 'right', 'ST', ['RW'], 'topClass', 100, false,
    '67 69 | 73 67 71 74 | 63 55 55 53 63 | 26 29 23 26 | 75 71 73 | 67 71 71 | 73 71 61 65', 8],
  // Rayo Vallecano
  ['raul-de-tomas', 'Raúl de Tomás', '라울 데 토마스', 1994, 'Spain', 'Rayo Vallecano', L, 9, 180, 70, 'right', 'ST', [], 'topClass', 200, false,
    '73 75 | 81 73 77 80 | 69 61 61 59 69 | 32 35 29 32 | 77 77 75 | 73 77 77 | 79 77 67 71', 5],
  ['embarba', 'Adrián Embarba', '아드리안 엠바르바', 1992, 'Spain', 'Rayo Vallecano', L, 11, 173, 70, 'right', 'RW', ['LW'], 'special', 150, false,
    '79 76 | 72 69 50 75 | 69 61 75 68 69 | 30 33 27 30 | 81 82 80 | 73 57 57 | 70 69 60 71', 3],
  ['trejo', 'Óscar Trejo', '오스카르 트레호', 1988, 'Argentina', 'Rayo Vallecano', L, 8, 180, 74, 'right', 'CAM', ['CF'], 'special', 150, false,
    '77 78 | 71 75 47 73 | 78 73 69 69 79 | 45 50 43 45 | 69 72 76 | 73 55 53 | 75 71 71 71', 3],
];

/** 짧은 이름 예외 (stars.ts SHORT_KO 와 같은 규칙): 통칭·두 단어 성. 나머지는 마지막 단어 */
const SHORT_KO: Record<string, string> = {
  coutinho: '코치뉴', 'jose-gimenez': '히메네스', saul: '사울', rodrigo: '로드리고', 'ben-yedder': '벤예데르',
  djene: '제네', 'lo-celso': '로셀소', 'jose-luis-morales': '모랄레스', 'chimy-avila': '아빌라', 'cucho-hernandez': '쿠초',
  'raul-de-tomas': '데토마스',
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
