import { FIELD_ATTRIBUTES, type FieldAttributes } from '../../src/attributes';
import type { FieldPlayerData, Foot, Position, Tier } from '../../src/types';

// 세리에 A 2018-19 유명 실제 선수 (45d1, 부록 C.75n). 게임에는 아직 연결하지 않는다 (45b 배선).
// 필드 선수만 (GK 실제 선수 형식은 아직 없음). 중심값은 기억 기반 초안이며 그 시즌 기준 나이·실력으로 보수적으로 잡았다.
// 이미 다른 표에 있는 선수(stars: 호날두·디발라, 레전드: 키엘리니·보누치·데 로시)는 넣지 않는다.
// 소속은 2018-19 개막 기준 (이과인 = 밀란, 피옹테크 = 제노아).
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

const L = 'Serie A';
const JUV = 'Juventus', NAP = 'Napoli', ATA = 'Atalanta', INT = 'Inter', MIL = 'AC Milan', ROM = 'Roma', LAZ = 'Lazio';
const ROWS: Row[] = [
  // Juventus
  ['pjanic', 'Miralem Pjanić', '미랄렘 퍄니치', 1990, 'Bosnia and Herzegovina', JUV, L, 5, 178, 72, 'right', 'CM', ['CDM', 'CAM'], 'worldClass', 700, false,
    '84 87 | 74 80 66 74 | 93 93 76 87 91 | 76 80 74 78 | 76 78 81 | 89 76 72 | 85 82 78 89', 3],
  ['mandzukic', 'Mario Mandžukić', '마리오 만주키치', 1986, 'Croatia', JUV, L, 17, 190, 85, 'right', 'ST', ['LW'], 'topClass', 700, false,
    '79 81 | 85 79 93 86 | 75 67 67 65 75 | 38 41 35 38 | 75 77 81 | 79 91 91 | 85 89 73 91', 3],
  ['douglas-costa', 'Douglas Costa', '두글라스 코스타', 1990, 'Brazil', JUV, L, 11, 172, 70, 'left', 'RW', ['LW'], 'topClass', 600, false,
    '91 84 | 80 81 58 83 | 77 69 77 68 77 | 38 41 35 38 | 93 93 88 | 81 65 65 | 78 77 68 79', 4],
  ['matuidi', 'Blaise Matuidi', '블레즈 마튀디', 1987, 'France', JUV, L, 14, 180, 75, 'left', 'CM', ['LM', 'CDM'], 'topClass', 600, false,
    '80 83 | 66 76 62 70 | 85 83 72 67 78 | 78 82 70 74 | 72 74 77 | 93 72 68 | 81 78 74 93', 3],
  ['cancelo', 'João Cancelo', '주앙 칸셀루', 1994, 'Portugal', JUV, L, 20, 182, 74, 'right', 'RB', ['LB', 'RM'], 'worldClass', 400, false,
    '84 82 | 50 56 64 66 | 80 72 86 52 67 | 79 79 73 73 | 85 85 82 | 85 72 70 | 74 74 67 84', 5],
  ['alex-sandro', 'Alex Sandro', '알렉스 산드루', 1991, 'Brazil', JUV, L, 12, 180, 80, 'left', 'LB', ['LM'], 'topClass', 550, false,
    '75 77 | 51 57 71 67 | 77 73 87 53 68 | 80 80 78 78 | 86 86 83 | 86 79 71 | 75 75 68 85', 3],
  // Napoli
  ['insigne', 'Lorenzo Insigne', '로렌초 인시녜', 1991, 'Italy', NAP, L, 24, 163, 59, 'right', 'LW', ['CF'], 'worldClass', 650, false,
    '90 87 | 83 88 61 86 | 84 72 80 77 86 | 41 44 38 41 | 88 93 91 | 84 60 62 | 81 80 71 82', 3],
  ['koulibaly', 'Kalidou Koulibaly', '칼리두 쿨리발리', 1991, 'Senegal', NAP, L, 26, 187, 89, 'right', 'CB', [], 'worldClass', 650, false,
    '67 75 | 47 57 89 52 | 77 77 57 52 67 | 89 88 89 90 | 87 83 69 | 81 93 90 | 85 85 82 82', 3],
  ['mertens', 'Dries Mertens', '드리스 메르턴스', 1987, 'Belgium', NAP, L, 14, 169, 61, 'right', 'CF', ['LW', 'ST'], 'topClass', 600, false,
    '85 83 | 87 87 65 88 | 77 69 69 75 77 | 40 43 37 40 | 85 85 91 | 81 71 77 | 87 85 75 79', 3],
  ['callejon', 'José Callejón', '호세 카예혼', 1987, 'Spain', NAP, L, 7, 178, 73, 'right', 'RW', [], 'topClass', 550, false,
    '82 83 | 79 76 57 92 | 76 68 76 67 76 | 37 40 34 37 | 88 89 87 | 86 64 64 | 77 76 67 88', 3],
  ['allan', 'Allan', '아랑', 1991, 'Brazil', NAP, L, 5, 175, 72, 'right', 'CM', ['CDM'], 'topClass', 450, false,
    '81 84 | 67 77 63 71 | 86 84 73 68 83 | 83 85 71 75 | 73 75 78 | 92 73 69 | 82 79 75 93', 3],
  ['fabian-ruiz', 'Fabián Ruiz', '파비안 루이스', 1996, 'Spain', NAP, L, 8, 189, 70, 'left', 'CM', ['CAM'], 'topClass', 250, false,
    '77 84 | 67 81 59 67 | 82 80 69 64 79 | 69 73 67 71 | 69 71 74 | 82 69 65 | 78 75 71 82', 6],
  // Atalanta
  ['papu-gomez', 'Alejandro Gómez', '알레한드로 고메스', 1988, 'Argentina', ATA, L, 10, 167, 68, 'right', 'LW', ['CAM'], 'topClass', 400, false,
    '87 84 | 80 77 58 83 | 83 69 83 68 83 | 38 41 35 38 | 89 90 88 | 81 61 65 | 78 77 78 79', 3],
  ['ilicic', 'Josip Iličić', '요시프 일리치치', 1988, 'Slovenia', ATA, L, 72, 190, 83, 'left', 'RW', ['CAM', 'CF'], 'topClass', 400, false,
    '85 86 | 85 89 65 81 | 86 81 77 77 87 | 53 58 51 53 | 77 80 84 | 81 73 61 | 83 79 71 79', 3],
  ['duvan-zapata', 'Duván Zapata', '두반 사파타', 1991, 'Colombia', ATA, L, 91, 189, 88, 'right', 'ST', [], 'topClass', 350, false,
    '76 80 | 84 78 82 85 | 74 66 66 64 74 | 37 40 34 37 | 86 82 80 | 78 92 82 | 84 82 72 76', 4],
  ['freuler', 'Remo Freuler', '레모 프로일러', 1992, 'Switzerland', ATA, L, 11, 180, 74, 'right', 'CM', ['CDM'], 'topClass', 250, false,
    '77 80 | 67 73 59 67 | 82 80 69 64 79 | 69 73 67 71 | 69 71 74 | 88 69 65 | 78 75 71 88', 3],
  ['hateboer', 'Hans Hateboer', '한스 하테보어', 1994, 'Netherlands', ATA, L, 33, 185, 80, 'right', 'RWB', ['RB', 'RM'], 'special', 200, false,
    '69 71 | 45 51 69 69 | 71 67 77 47 62 | 74 74 72 72 | 80 80 77 | 86 73 65 | 69 69 62 79', 4],
  // Inter
  ['icardi', 'Mauro Icardi', '마우로 이카르디', 1993, 'Argentina', INT, L, 9, 181, 75, 'right', 'ST', [], 'worldClass', 650, false,
    '73 79 | 93 81 85 93 | 73 69 69 67 77 | 40 43 37 40 | 85 85 83 | 81 85 85 | 87 85 81 71', 3],
  ['skriniar', 'Milan Škriniar', '밀란 슈크리니아르', 1995, 'Slovakia', INT, L, 37, 188, 80, 'right', 'CB', [], 'worldClass', 450, false,
    '64 72 | 44 54 86 49 | 74 74 54 49 64 | 88 85 86 87 | 74 72 66 | 78 92 87 | 82 82 79 79', 4],
  ['perisic', 'Ivan Perišić', '이반 페리시치', 1989, 'Croatia', INT, L, 44, 186, 80, 'both', 'LW', ['RW', 'LM'], 'topClass', 600, false,
    '87 84 | 80 77 74 83 | 77 69 81 68 77 | 38 41 35 38 | 89 90 88 | 87 77 79 | 78 77 68 79', 3],
  ['brozovic', 'Marcelo Brozović', '마르셀로 브로조비치', 1992, 'Croatia', INT, L, 77, 181, 68, 'right', 'CDM', ['CM'], 'topClass', 450, false,
    '81 79 | 59 75 71 61 | 89 87 61 58 77 | 85 86 83 85 | 69 71 73 | 93 83 75 | 81 79 78 87', 3],
  ['de-vrij', 'Stefan de Vrij', '스테판 더프레이', 1992, 'Netherlands', INT, L, 6, 189, 78, 'right', 'CB', [], 'topClass', 500, false,
    '64 72 | 44 54 86 49 | 80 74 54 49 64 | 86 85 86 87 | 74 72 66 | 78 88 87 | 86 82 79 79', 3],
  ['lautaro', 'Lautaro Martínez', '라우타로 마르티네스', 1997, 'Argentina', INT, L, 10, 174, 72, 'right', 'ST', ['CF'], 'worldClass', 200, false,
    '73 75 | 79 73 77 80 | 69 61 61 59 69 | 32 35 29 32 | 77 77 75 | 73 83 77 | 79 77 67 77', 7],
  // AC Milan
  ['higuain', 'Gonzalo Higuaín', '곤살로 이과인', 1987, 'Argentina', MIL, L, 9, 184, 88, 'right', 'ST', [], 'worldClass', 750, false,
    '81 83 | 93 81 85 93 | 77 69 69 67 77 | 40 43 37 40 | 81 85 83 | 81 85 85 | 87 85 75 79', 3],
  ['suso', 'Suso', '수소', 1993, 'Spain', MIL, L, 8, 180, 70, 'left', 'RW', ['CAM'], 'topClass', 400, false,
    '85 82 | 78 81 56 81 | 75 67 85 66 81 | 36 39 33 36 | 81 84 86 | 79 63 63 | 76 75 66 77', 3],
  ['calhanoglu', 'Hakan Çalhanoğlu', '하칸 찰하놀루', 1994, 'Turkey', MIL, L, 10, 178, 76, 'right', 'CAM', ['CM', 'LW'], 'topClass', 400, false,
    '83 84 | 77 91 53 79 | 84 79 81 89 85 | 51 56 49 51 | 75 78 82 | 79 61 59 | 81 77 69 77', 3],
  ['romagnoli', 'Alessio Romagnoli', '알레시오 로마뇰리', 1995, 'Italy', MIL, L, 13, 188, 77, 'left', 'CB', [], 'topClass', 450, false,
    '63 71 | 43 53 85 48 | 73 73 53 48 63 | 85 84 85 86 | 73 71 65 | 77 87 86 | 81 81 84 78', 4],
  ['kessie', 'Franck Kessié', '프랑크 케시에', 1996, 'Côte d\'Ivoire', MIL, L, 79, 183, 82, 'right', 'CM', ['CDM'], 'topClass', 350, false,
    '78 81 | 72 74 60 68 | 83 81 70 65 80 | 70 74 68 72 | 70 72 75 | 91 82 66 | 79 76 72 83', 5],
  // Roma
  ['dzeko', 'Edin Džeko', '에딘 제코', 1986, 'Bosnia and Herzegovina', ROM, L, 9, 193, 84, 'right', 'ST', [], 'topClass', 650, false,
    '80 82 | 86 80 92 87 | 82 68 68 66 82 | 39 42 36 39 | 78 84 82 | 80 90 88 | 86 84 74 78', 3],
  ['lorenzo-pellegrini', 'Lorenzo Pellegrini', '로렌초 펠레그리니', 1996, 'Italy', ROM, L, 7, 186, 77, 'right', 'CM', ['CAM'], 'topClass', 300, false,
    '78 81 | 72 74 60 76 | 83 81 70 65 84 | 70 74 68 72 | 70 72 75 | 83 70 66 | 79 76 72 83', 5],
  ['zaniolo', 'Nicolò Zaniolo', '니콜로 차니올로', 1999, 'Italy', ROM, L, 22, 190, 79, 'left', 'CAM', ['RW', 'CM'], 'topClass', 100, false,
    '80 77 | 70 74 46 72 | 77 72 68 68 78 | 44 49 42 44 | 76 71 75 | 72 68 52 | 68 70 62 70', 8],
  ['manolas', 'Kostas Manolas', '코스타스 마놀라스', 1991, 'Greece', ROM, L, 44, 189, 80, 'right', 'CB', [], 'topClass', 450, false,
    '64 72 | 44 54 86 49 | 74 74 54 49 64 | 86 85 86 87 | 84 80 66 | 78 88 91 | 82 82 79 79', 3],
  ['kolarov', 'Aleksandar Kolarov', '알렉산다르 콜라로프', 1985, 'Serbia', ROM, L, 11, 187, 83, 'left', 'LB', [], 'topClass', 550, false,
    '72 74 | 62 74 62 64 | 74 70 88 72 65 | 77 77 75 75 | 77 83 80 | 83 80 68 | 72 72 65 82', 3],
  // Lazio
  ['immobile', 'Ciro Immobile', '치로 임모빌레', 1990, 'Italy', LAZ, L, 17, 185, 78, 'right', 'ST', [], 'topClass', 600, false,
    '81 83 | 87 81 85 92 | 77 69 69 67 77 | 40 43 37 40 | 87 85 83 | 81 85 85 | 87 85 75 79', 3],
  ['milinkovic-savic', 'Sergej Milinković-Savić', '세르게이 밀린코비치사비치', 1995, 'Serbia', LAZ, L, 21, 191, 76, 'right', 'CM', ['CAM'], 'worldClass', 500, false,
    '82 85 | 80 86 84 82 | 87 85 74 69 84 | 74 78 72 76 | 72 76 79 | 87 86 86 | 83 80 76 87', 4],
  ['luis-alberto', 'Luis Alberto', '루이스 알베르토', 1992, 'Spain', LAZ, L, 10, 182, 73, 'right', 'CAM', ['CM'], 'topClass', 400, false,
    '85 86 | 79 83 55 81 | 90 87 77 77 93 | 53 58 51 53 | 77 80 84 | 81 63 61 | 83 79 71 79', 3],
  ['joaquin-correa', 'Joaquín Correa', '호아킨 코레아', 1994, 'Argentina', LAZ, L, 11, 188, 75, 'right', 'CF', ['LW'], 'topClass', 300, false,
    '85 81 | 79 77 71 82 | 77 69 67 69 79 | 39 43 35 39 | 76 78 84 | 76 73 71 | 80 78 69 76', 5],
  ['acerbi', 'Francesco Acerbi', '프란체스코 아체르비', 1988, 'Italy', LAZ, L, 33, 192, 88, 'left', 'CB', [], 'topClass', 350, false,
    '63 71 | 43 53 85 48 | 73 73 53 48 63 | 85 84 85 86 | 73 71 65 | 77 91 86 | 81 81 84 78', 3],
  // Torino
  ['belotti', 'Andrea Belotti', '안드레아 벨로티', 1993, 'Italy', 'Torino', L, 9, 181, 72, 'right', 'ST', [], 'topClass', 450, false,
    '77 79 | 83 77 89 84 | 73 65 65 63 73 | 36 39 33 36 | 81 81 79 | 77 81 81 | 83 81 79 87', 3],
  ['iago-falque', 'Iago Falque', '이아고 팔케', 1990, 'Spain', 'Torino', L, 14, 175, 72, 'left', 'RW', ['CAM'], 'special', 300, false,
    '82 79 | 75 78 53 78 | 72 64 72 71 72 | 33 36 30 33 | 84 85 83 | 76 60 60 | 73 72 63 74', 3],
  ['izzo', 'Armando Izzo', '아르만도 이초', 1992, 'Italy', 'Torino', L, 4, 183, 74, 'right', 'CB', ['RB'], 'special', 200, false,
    '59 67 | 39 49 81 44 | 69 69 49 44 59 | 81 80 81 82 | 73 67 61 | 73 83 82 | 77 77 74 74', 3],
  // Sampdoria
  ['quagliarella', 'Fabio Quagliarella', '파비오 콸리아렐라', 1983, 'Italy', 'Sampdoria', L, 27, 180, 79, 'right', 'ST', ['CF'], 'special', 450, false,
    '77 79 | 89 89 81 84 | 73 65 65 63 73 | 36 39 33 36 | 69 73 79 | 77 81 81 | 89 81 81 75', 3],
  ['praet', 'Dennis Praet', '데니스 프라트', 1994, 'Belgium', 'Sampdoria', L, 10, 181, 72, 'right', 'CM', ['CAM'], 'topClass', 250, false,
    '80 83 | 66 72 58 66 | 81 79 68 63 78 | 68 72 66 70 | 68 70 73 | 81 68 64 | 77 74 70 81', 4],
  ['joachim-andersen', 'Joachim Andersen', '요아킴 안데르센', 1996, 'Denmark', 'Sampdoria', L, 3, 192, 88, 'right', 'CB', [], 'topClass', 150, false,
    '56 64 | 36 46 78 41 | 66 74 46 41 56 | 78 77 78 79 | 66 64 58 | 70 80 79 | 74 74 71 71', 6],
  // Bologna
  ['orsolini', 'Riccardo Orsolini', '리카르도 오르솔리니', 1997, 'Italy', 'Bologna', L, 7, 183, 71, 'left', 'RW', [], 'topClass', 150, false,
    '78 75 | 71 72 49 74 | 68 60 68 59 68 | 29 32 26 29 | 80 81 79 | 72 56 56 | 69 68 59 70', 7],
  ['santander', 'Federico Santander', '페데리코 산탄데르', 1991, 'Paraguay', 'Bologna', L, 9, 185, 80, 'right', 'ST', [], 'special', 150, false,
    '71 73 | 77 71 83 78 | 67 59 59 57 67 | 30 33 27 30 | 75 75 73 | 71 83 75 | 77 75 65 69', 3],
  // Sassuolo
  ['berardi', 'Domenico Berardi', '도메니코 베라르디', 1994, 'Italy', 'Sassuolo', L, 25, 183, 70, 'left', 'RW', ['CF'], 'topClass', 350, false,
    '84 81 | 81 82 55 80 | 74 66 74 73 74 | 35 38 32 35 | 86 87 85 | 78 62 62 | 75 74 65 76', 4],
  ['sensi', 'Stefano Sensi', '스테파노 센시', 1995, 'Italy', 'Sassuolo', L, 12, 168, 60, 'right', 'CM', ['CDM', 'CAM'], 'topClass', 150, false,
    '75 78 | 65 71 57 65 | 84 78 67 62 81 | 67 71 65 69 | 67 69 72 | 80 59 63 | 76 73 69 80', 5],
  ['locatelli', 'Manuel Locatelli', '마누엘 로카텔리', 1998, 'Italy', 'Sassuolo', L, 73, 185, 71, 'right', 'CDM', ['CM'], 'topClass', 200, false,
    '65 71 | 51 59 63 53 | 79 79 53 50 69 | 77 78 75 77 | 61 63 65 | 77 75 67 | 73 71 70 79', 6],
  // Udinese
  ['de-paul', 'Rodrigo De Paul', '로드리고 데 파울', 1994, 'Argentina', 'Udinese', L, 10, 180, 70, 'right', 'CAM', ['CM', 'RW'], 'topClass', 250, false,
    '85 82 | 75 79 51 77 | 82 77 73 73 83 | 49 54 47 49 | 73 76 80 | 83 59 57 | 79 75 67 83', 4],
  ['lasagna', 'Kevin Lasagna', '케빈 라사냐', 1992, 'Italy', 'Udinese', L, 15, 181, 75, 'right', 'ST', [], 'special', 200, false,
    '72 74 | 78 72 76 79 | 68 60 60 58 68 | 31 34 28 31 | 84 82 74 | 72 76 76 | 78 76 66 70', 3],
  ['seko-fofana', 'Seko Fofana', '세코 포파나', 1995, 'Côte d\'Ivoire', 'Udinese', L, 6, 185, 76, 'right', 'CM', [], 'special', 150, false,
    '81 78 | 65 71 57 65 | 80 78 67 62 77 | 67 71 65 69 | 67 69 72 | 80 75 63 | 76 73 69 80', 5],
  // SPAL
  ['petagna', 'Andrea Petagna', '안드레아 페타냐', 1995, 'Italy', 'SPAL', L, 37, 190, 86, 'right', 'ST', [], 'special', 150, false,
    '72 74 | 78 72 80 79 | 68 60 60 58 68 | 31 34 28 31 | 70 76 74 | 72 86 76 | 78 76 66 70', 4],
  ['lazzari', 'Manuel Lazzari', '마누엘 라차리', 1993, 'Italy', 'SPAL', L, 29, 174, 68, 'right', 'RM', ['RWB', 'RB'], 'special', 150, false,
    '75 71 | 45 51 59 71 | 71 67 83 47 62 | 74 74 72 72 | 88 88 77 | 80 67 65 | 69 69 62 79', 3],
  // Parma
  ['gervinho', 'Gervinho', '제르비뉴', 1987, 'Côte d\'Ivoire', 'Parma', L, 27, 179, 67, 'right', 'LW', ['RW'], 'special', 400, false,
    '82 79 | 71 72 53 78 | 72 64 72 63 72 | 33 36 30 33 | 92 91 83 | 76 60 60 | 73 72 63 74', 3],
  ['inglese', 'Roberto Inglese', '로베르토 잉글레세', 1991, 'Italy', 'Parma', L, 45, 186, 78, 'right', 'ST', [], 'special', 150, false,
    '72 74 | 78 72 82 79 | 68 60 60 58 68 | 31 34 28 31 | 76 76 74 | 72 76 76 | 78 76 66 70', 3],
  // Cagliari
  ['barella', 'Nicolò Barella', '니콜로 바렐라', 1997, 'Italy', 'Cagliari', L, 18, 172, 68, 'right', 'CM', ['CAM'], 'worldClass', 250, false,
    '81 80 | 67 73 59 67 | 82 80 69 64 79 | 73 73 67 71 | 69 71 74 | 88 69 65 | 78 75 71 92', 6],
  ['pavoletti', 'Leonardo Pavoletti', '레오나르도 파볼레티', 1988, 'Italy', 'Cagliari', L, 30, 188, 80, 'right', 'ST', [], 'special', 200, false,
    '66 74 | 78 72 92 79 | 68 60 60 58 68 | 31 34 28 31 | 70 76 74 | 72 76 88 | 78 76 66 70', 3],
  ['joao-pedro', 'João Pedro', '조앙 페드루', 1992, 'Brazil', 'Cagliari', L, 10, 182, 77, 'right', 'CAM', ['CF'], 'special', 200, false,
    '77 79 | 77 75 69 80 | 75 67 65 67 77 | 37 41 33 37 | 74 76 78 | 74 71 69 | 78 76 67 74', 3],
  // Fiorentina
  ['chiesa', 'Federico Chiesa', '페데리코 키에사', 1997, 'Italy', 'Fiorentina', L, 25, 175, 70, 'right', 'RW', ['LW'], 'topClass', 300, false,
    '84 81 | 77 74 55 80 | 74 66 74 65 74 | 35 38 32 35 | 90 91 85 | 84 62 62 | 75 74 65 84', 6],
  ['giovanni-simeone', 'Giovanni Simeone', '조반니 시메오네', 1995, 'Argentina', 'Fiorentina', L, 9, 181, 75, 'right', 'ST', [], 'special', 200, false,
    '72 74 | 78 72 76 79 | 68 60 60 58 68 | 31 34 28 31 | 76 76 74 | 72 76 76 | 78 76 66 80', 4],
  ['veretout', 'Jordan Veretout', '조르당 베레투', 1993, 'France', 'Fiorentina', L, 17, 177, 70, 'right', 'CM', ['CDM'], 'topClass', 250, false,
    '78 81 | 68 74 60 68 | 83 81 70 73 80 | 70 74 68 72 | 70 72 75 | 91 70 66 | 79 76 72 89', 3],
  ['pezzella', 'Germán Pezzella', '헤르만 페첼라', 1991, 'Argentina', 'Fiorentina', L, 20, 187, 84, 'right', 'CB', [], 'topClass', 250, false,
    '60 68 | 40 50 86 45 | 70 70 50 45 60 | 82 81 82 83 | 70 68 62 | 74 84 83 | 78 78 83 75', 3],
  // Genoa
  ['piatek', 'Krzysztof Piątek', '크시슈토프 피옹테크', 1995, 'Poland', 'Genoa', L, 9, 183, 77, 'right', 'ST', [], 'topClass', 100, false,
    '72 74 | 84 72 76 83 | 68 60 60 58 68 | 31 34 28 31 | 76 76 74 | 72 76 76 | 78 76 66 70', 6],
  ['kouame', 'Christian Kouamé', '크리스티안 쿠아메', 1997, 'Côte d\'Ivoire', 'Genoa', L, 21, 185, 74, 'right', 'ST', ['LW'], 'special', 100, false,
    '69 71 | 75 69 73 76 | 65 57 57 55 65 | 28 31 25 28 | 81 81 71 | 69 79 73 | 75 73 63 67', 6],
  ['criscito', 'Domenico Criscito', '도메니코 크리시토', 1986, 'Italy', 'Genoa', L, 4, 183, 76, 'left', 'LB', ['CB'], 'special', 300, false,
    '69 71 | 45 51 59 61 | 71 67 77 57 62 | 74 74 72 72 | 74 80 77 | 80 67 65 | 69 69 72 79', 3],
  // Empoli
  ['caputo', 'Francesco Caputo', '프란체스코 카푸토', 1987, 'Italy', 'Empoli', L, 19, 181, 77, 'right', 'ST', [], 'special', 150, false,
    '73 75 | 79 73 77 86 | 69 61 61 59 69 | 32 35 29 32 | 77 77 75 | 73 77 77 | 79 77 67 71', 3],
  ['bennacer', 'Ismaël Bennacer', '이스마엘 베나세르', 1997, 'Algeria', 'Empoli', L, 10, 175, 70, 'left', 'CM', ['CDM'], 'topClass', 100, false,
    '79 80 | 63 69 55 63 | 78 76 65 60 75 | 69 69 63 67 | 65 67 70 | 78 65 61 | 74 71 67 78', 6],
  // Frosinone
  ['ciofani', 'Daniel Ciofani', '다니엘 초파니', 1985, 'Italy', 'Frosinone', L, 9, 186, 80, 'right', 'ST', [], 'special', 100, false,
    '68 70 | 74 68 80 75 | 64 56 56 54 64 | 27 30 24 27 | 66 72 70 | 68 72 72 | 74 72 62 66', 3],
  ['pinamonti', 'Andrea Pinamonti', '안드레아 피나몬티', 1999, 'Italy', 'Frosinone', L, 99, 186, 79, 'right', 'ST', [], 'special', 80, false,
    '65 67 | 71 65 69 72 | 61 53 53 51 61 | 24 27 21 24 | 69 69 67 | 65 69 69 | 71 69 59 63', 7],
  // Chievo
  ['pellissier', 'Sergio Pellissier', '세르조 펠리시에르', 1979, 'Italy', 'Chievo', L, 31, 177, 75, 'right', 'ST', [], 'special', 200, false,
    '69 71 | 75 69 73 76 | 65 57 57 55 65 | 28 31 25 28 | 59 61 71 | 63 73 73 | 81 73 77 67', 3],
  ['giaccherini', 'Emanuele Giaccherini', '에마누엘레 자케리니', 1985, 'Italy', 'Chievo', L, 23, 167, 64, 'right', 'LM', ['CAM', 'LW'], 'special', 250, false,
    '79 76 | 72 69 50 75 | 69 61 69 60 69 | 30 33 27 30 | 81 82 80 | 77 57 57 | 70 69 60 79', 3],
];

/** 짧은 이름 예외 (stars.ts SHORT_KO 와 같은 규칙): 통칭·두 단어 성. 나머지는 마지막 단어 */
const SHORT_KO: Record<string, string> = {
  'papu-gomez': '파푸', 'duvan-zapata': '사파타', 'de-vrij': '더프레이', lautaro: '라우타로', 'lorenzo-pellegrini': '펠레그리니',
  'joaquin-correa': '코레아', 'joachim-andersen': '안데르센', 'de-paul': '데파울', 'seko-fofana': '포파나', 'giovanni-simeone': '시메오네',
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
