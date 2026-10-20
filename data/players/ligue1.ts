import { FIELD_ATTRIBUTES, type FieldAttributes } from '../../src/attributes';
import type { FieldPlayerData, Foot, Position, Tier } from '../../src/types';

// 리그 1 2018-19 유명 실제 선수 (45d2단계, 부록 C.75o). 게임에는 아직 연결하지 않는다 (45b).
// 형식·척도는 stars.ts 와 같다 (필드 선수만 — 실제 선수 표에 GK 형식이 없어 GK 는 넣지 않음). 능력치는 2018-19 시즌 기준 기억 기반 초안.
// 이미 다른 표에 있는 선수(네이마르·음바페 = stars, 부폰·수보티치 = 레전드)는 넣지 않는다. 낭트 에밀리아노 살라는 시즌 중 사고(2019-01)로 넣지 않는다.
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

const L1 = 'Ligue 1';
const PSG = 'Paris Saint-Germain';
const LIL = 'Lille';
const LYO = 'Olympique Lyonnais';
const MAR = 'Olympique de Marseille';
const ASM = 'AS Monaco';
const ASE = 'Saint-Étienne';

const ROWS: Row[] = [
  // 파리 생제르맹
  ['edinson-cavani', 'Edinson Cavani', '에딘손 카바니', 1987, 'Uruguay', PSG, L1, 9, 184, 71, 'right', 'ST', [], 'worldClass', 700, false,
    '76 80 | 88 76 84 92 | 72 62 60 66 72 | 50 45 40 45 | 80 80 78 | 92 78 82 | 84 84 76 92', 3],
  ['angel-di-maria', 'Ángel Di María', '앙헬 디 마리아', 1988, 'Argentina', PSG, L1, 11, 180, 75, 'left', 'RW', ['LW', 'CAM'], 'worldClass', 650, false,
    '87 86 | 78 84 50 78 | 84 82 86 80 86 | 40 45 35 40 | 84 86 86 | 80 60 55 | 80 78 66 82', 3],
  ['marco-verratti', 'Marco Verratti', '마르코 베라티', 1992, 'Italy', PSG, L1, 6, 165, 60, 'right', 'CM', ['CDM'], 'worldClass', 550, false,
    '86 92 | 55 62 40 60 | 92 86 66 60 88 | 76 80 66 74 | 66 74 88 | 82 58 45 | 88 84 70 80', 3],
  ['thiago-silva', 'Thiago Silva', '티아구 실바', 1984, 'Brazil', PSG, L1, 2, 183, 79, 'right', 'CB', [], 'worldClass', 700, true,
    '66 78 | 45 55 80 45 | 80 76 50 45 70 | 86 88 86 90 | 66 66 70 | 74 78 84 | 90 88 90 78', 3],
  ['marquinhos', 'Marquinhos', '마르키뉴스', 1994, 'Brazil', PSG, L1, 5, 183, 75, 'right', 'CB', ['CDM'], 'worldClass', 450, false,
    '68 76 | 45 50 76 45 | 78 74 50 40 68 | 84 86 82 84 | 78 76 74 | 82 74 80 | 82 80 76 84'],
  ['dani-alves', 'Dani Alves', '다니 아우베스', 1983, 'Brazil', PSG, L1, 32, 172, 70, 'right', 'RB', ['RWB', 'CM'], 'worldClass', 650, true,
    '80 84 | 64 72 55 66 | 84 80 84 72 80 | 70 72 66 68 | 72 74 80 | 74 64 66 | 84 80 80 82', 3],
  ['presnel-kimpembe', 'Presnel Kimpembe', '프레스넬 킴펨베', 1995, 'France', PSG, L1, 3, 183, 77, 'left', 'CB', [], 'topClass', 250, false,
    '58 66 | 35 40 72 35 | 70 68 40 30 56 | 80 78 78 78 | 74 72 64 | 76 82 76 | 72 72 66 78'],
  // 릴
  ['nicolas-pepe', 'Nicolas Pépé', '니콜라 페페', 1995, "Côte d'Ivoire", LIL, L1, 19, 183, 73, 'left', 'RW', ['ST'], 'topClass', 250, false,
    '85 80 | 80 78 55 78 | 74 66 74 70 76 | 30 35 25 30 | 86 86 82 | 80 66 62 | 76 76 55 76', 5],
  ['rafael-leao', 'Rafael Leão', '하파엘 레앙', 1999, 'Portugal', LIL, L1, 17, 188, 81, 'right', 'ST', ['LW'], 'worldClass', 100, false,
    '78 74 | 70 64 62 68 | 64 52 55 40 60 | 25 30 20 25 | 88 86 78 | 66 72 66 | 60 60 45 60', 8],
  ['jonathan-ikone', 'Jonathan Ikoné', '조나탄 이코네', 1998, 'France', LIL, L1, 10, 175, 67, 'right', 'RW', ['CAM', 'LW'], 'topClass', 100, false,
    '82 78 | 66 66 40 64 | 74 64 68 55 74 | 30 35 25 30 | 84 86 86 | 74 55 50 | 66 64 50 72', 6],
  ['jonathan-bamba', 'Jonathan Bamba', '조나탄 밤바', 1996, 'France', LIL, L1, 7, 175, 70, 'right', 'LW', ['RW'], 'special', 100, false,
    '80 76 | 72 70 45 72 | 70 60 66 55 68 | 35 35 30 35 | 86 86 82 | 76 58 55 | 66 66 50 74'],
  ['jose-fonte', 'José Fonte', '조제 폰트', 1983, 'Portugal', LIL, L1, 6, 187, 82, 'right', 'CB', [], 'special', 150, false,
    '50 64 | 40 45 78 40 | 66 62 40 35 56 | 76 76 78 80 | 52 52 52 | 68 80 78 | 78 76 82 76'],
  // 올랭피크 리옹
  ['nabil-fekir', 'Nabil Fekir', '나빌 페키르', 1993, 'France', LYO, L1, 18, 173, 72, 'left', 'CAM', ['CF'], 'worldClass', 400, false,
    '86 86 | 80 82 55 78 | 82 72 70 78 82 | 40 45 35 40 | 76 80 82 | 74 72 60 | 80 76 72 72', 5],
  ['memphis-depay', 'Memphis Depay', '멤피스 데파이', 1994, 'Netherlands', LYO, L1, 11, 176, 78, 'right', 'LW', ['ST', 'CF'], 'worldClass', 400, false,
    '86 82 | 80 82 55 78 | 78 70 74 82 76 | 35 35 30 35 | 82 84 82 | 76 74 66 | 76 74 66 72', 5],
  ['houssem-aouar', 'Houssem Aouar', '우셈 아우아르', 1998, 'France', LYO, L1, 8, 175, 70, 'right', 'CM', ['CAM'], 'topClass', 120, false,
    '82 84 | 66 70 50 64 | 80 72 62 55 78 | 55 60 50 55 | 72 76 82 | 76 60 55 | 72 70 55 72', 6],
  ['tanguy-ndombele', 'Tanguy Ndombele', '탕기 은돔벨레', 1996, 'France', LYO, L1, 28, 181, 73, 'right', 'CM', ['CDM'], 'topClass', 150, false,
    '84 86 | 60 62 50 58 | 82 72 55 45 78 | 70 74 64 68 | 72 76 80 | 80 78 64 | 76 72 55 76', 5],
  ['moussa-dembele', 'Moussa Dembélé', '무사 뎀벨레', 1996, 'France', LYO, L1, 9, 183, 70, 'right', 'ST', [], 'topClass', 200, false,
    '74 76 | 82 70 70 82 | 66 52 50 45 64 | 30 30 25 30 | 78 80 76 | 72 76 70 | 74 74 55 72'],
  ['ferland-mendy', 'Ferland Mendy', '페를랑 멘디', 1995, 'France', LYO, L1, 22, 180, 73, 'left', 'LB', [], 'topClass', 150, false,
    '74 74 | 50 52 60 50 | 68 62 66 40 62 | 76 74 74 74 | 86 86 78 | 82 76 72 | 70 70 55 78'],
  // 올랭피크 마르세유
  ['dimitri-payet', 'Dimitri Payet', '디미트리 파예', 1987, 'France', MAR, L1, 10, 175, 77, 'right', 'CAM', ['LW', 'CM'], 'topClass', 450, false,
    '82 86 | 74 82 50 72 | 86 84 86 90 88 | 40 45 35 40 | 66 70 76 | 70 62 52 | 82 78 74 66', 3],
  ['florian-thauvin', 'Florian Thauvin', '플로리앙 토뱅', 1993, 'France', MAR, L1, 26, 180, 71, 'left', 'RW', ['CAM'], 'topClass', 350, false,
    '84 84 | 80 80 50 80 | 78 70 76 74 78 | 35 40 30 35 | 76 78 82 | 76 60 55 | 78 76 60 70'],
  ['lucas-ocampos', 'Lucas Ocampos', '루카스 오캄포스', 1994, 'Argentina', MAR, L1, 11, 187, 84, 'right', 'LW', ['RW', 'LM'], 'topClass', 150, false,
    '78 74 | 70 68 62 70 | 68 60 68 50 64 | 55 55 50 52 | 80 80 74 | 86 76 66 | 66 66 62 84'],
  ['luiz-gustavo', 'Luiz Gustavo', '루이스 구스타부', 1987, 'Brazil', MAR, L1, 19, 187, 80, 'left', 'CDM', ['CB'], 'topClass', 300, false,
    '64 74 | 55 64 72 50 | 78 74 55 55 70 | 80 80 76 80 | 60 60 62 | 80 82 76 | 80 78 78 78'],
  ['morgan-sanson', 'Morgan Sanson', '모르강 상송', 1994, 'France', MAR, L1, 8, 180, 69, 'right', 'CM', ['CAM'], 'special', 120, false,
    '76 78 | 66 70 55 66 | 76 70 60 55 72 | 60 64 56 60 | 72 74 76 | 84 64 60 | 70 70 60 82'],
  // AS 모나코
  ['radamel-falcao', 'Radamel Falcao', '라다멜 팔카오', 1986, 'Colombia', ASM, L1, 9, 177, 72, 'right', 'ST', [], 'topClass', 600, false,
    '72 80 | 86 70 84 90 | 68 55 50 55 66 | 30 30 25 30 | 64 68 70 | 64 76 80 | 84 82 82 76', 3],
  ['aleksandr-golovin', 'Aleksandr Golovin', '알렉산드르 골로빈', 1996, 'Russia', ASM, L1, 17, 180, 69, 'right', 'CAM', ['CM', 'RW'], 'topClass', 200, false,
    '80 80 | 70 76 45 66 | 80 76 74 76 80 | 50 55 45 50 | 72 76 82 | 80 58 50 | 70 70 55 74', 6],
  ['youri-tielemans', 'Youri Tielemans', '유리 틸레만스', 1997, 'Belgium', ASM, L1, 8, 176, 72, 'right', 'CM', ['CAM'], 'worldClass', 200, false,
    '76 80 | 70 80 50 66 | 82 82 70 72 80 | 60 64 56 60 | 64 66 72 | 78 64 55 | 74 72 60 74', 6],
  ['kamil-glik', 'Kamil Glik', '카밀 글리크', 1988, 'Poland', ASM, L1, 25, 190, 80, 'right', 'CB', [], 'topClass', 200, false,
    '50 62 | 40 45 82 45 | 64 60 40 35 52 | 80 76 80 78 | 56 56 52 | 74 84 84 | 76 74 78 80'],
  // 생테티엔
  ['wahbi-khazri', 'Wahbi Khazri', '와흐비 하즈리', 1991, 'Tunisia', ASE, L1, 10, 182, 79, 'right', 'CF', ['CAM', 'ST'], 'special', 150, false,
    '76 78 | 76 78 60 74 | 76 70 70 80 76 | 40 40 35 40 | 70 72 74 | 74 70 62 | 72 72 66 76'],
  ['remy-cabella', 'Rémy Cabella', '레미 카벨라', 1990, 'France', ASE, L1, 7, 172, 66, 'right', 'CAM', ['RW'], 'special', 150, false,
    '82 80 | 66 72 40 64 | 78 70 70 72 78 | 35 40 30 35 | 76 80 84 | 72 52 45 | 70 68 55 70'],
  ['yann-mvila', "Yann M'Vila", '얀 음빌라', 1990, 'France', ASE, L1, 8, 180, 78, 'right', 'CDM', ['CM'], 'special', 150, false,
    '66 76 | 55 64 60 55 | 80 78 55 55 74 | 74 76 70 74 | 56 58 62 | 78 74 66 | 76 74 70 74'],
  ['loic-perrin', 'Loïc Perrin', '로이크 페랭', 1985, 'France', ASE, L1, 24, 181, 78, 'right', 'CB', [], 'special', 120, false,
    '52 66 | 40 45 74 40 | 68 64 40 35 58 | 76 78 78 80 | 56 56 58 | 70 76 74 | 80 78 84 78'],
  // 스타드 렌
  ['hatem-ben-arfa', 'Hatem Ben Arfa', '하템 벤 아르파', 1987, 'France', 'Stade Rennais', L1, 18, 178, 70, 'left', 'RW', ['CAM'], 'topClass', 300, false,
    '88 86 | 76 78 45 72 | 78 70 70 70 78 | 30 35 25 30 | 72 76 84 | 62 64 50 | 74 70 55 55'],
  ['ismaila-sarr', 'Ismaïla Sarr', '이스마일라 사르', 1998, 'Senegal', 'Stade Rennais', L1, 7, 185, 76, 'right', 'RW', ['LW'], 'topClass', 120, false,
    '78 72 | 68 64 50 66 | 64 55 66 45 62 | 35 35 30 35 | 94 92 80 | 76 64 62 | 60 60 45 72', 7],
  ['mbaye-niang', "M'Baye Niang", '음바예 니앙', 1994, 'Senegal', 'Stade Rennais', L1, 9, 184, 79, 'right', 'ST', ['LW'], 'special', 150, false,
    '74 72 | 74 70 66 72 | 64 55 55 55 62 | 35 35 30 35 | 82 82 74 | 72 80 70 | 64 66 50 70'],
  ['benjamin-bourigeaud', 'Benjamin Bourigeaud', '뱅자맹 부리조', 1994, 'France', 'Stade Rennais', L1, 14, 178, 70, 'right', 'CM', ['RM', 'CAM'], 'special', 100, false,
    '72 76 | 66 74 50 66 | 76 74 76 74 74 | 56 60 52 56 | 70 70 72 | 84 60 55 | 70 70 62 82'],
  // OGC 니스
  ['allan-saint-maximin', 'Allan Saint-Maximin', '알랭 생막시맹', 1997, 'France', 'OGC Nice', L1, 7, 173, 67, 'right', 'LW', ['RW'], 'topClass', 120, false,
    '88 80 | 62 60 40 62 | 68 58 64 45 66 | 40 40 35 40 | 88 90 90 | 76 68 55 | 60 58 45 74', 7],
  ['mario-balotelli', 'Mario Balotelli', '마리오 발로텔리', 1990, 'Italy', 'OGC Nice', L1, 9, 189, 88, 'right', 'ST', [], 'topClass', 450, false,
    '72 78 | 84 80 72 80 | 68 58 50 78 64 | 30 30 25 30 | 72 72 66 | 60 84 72 | 80 72 50 52'],
  ['dante', 'Dante', '단테', 1983, 'Brazil', 'OGC Nice', L1, 4, 188, 86, 'left', 'CB', [], 'special', 200, false,
    '52 66 | 40 45 78 40 | 68 64 40 35 58 | 76 76 76 78 | 50 50 52 | 66 82 80 | 80 76 82 72'],
  // 몽펠리에
  ['andy-delort', 'Andy Delort', '앙디 들로르', 1991, 'Algeria', 'Montpellier', L1, 9, 181, 79, 'right', 'ST', [], 'special', 100, false,
    '70 70 | 76 70 74 76 | 66 55 55 60 62 | 40 35 35 35 | 72 72 70 | 78 78 72 | 66 68 62 80'],
  ['gaetan-laborde', 'Gaëtan Laborde', '가에탕 라보르드', 1994, 'France', 'Montpellier', L1, 10, 181, 77, 'left', 'ST', [], 'special', 80, false,
    '70 70 | 72 64 70 72 | 64 55 55 45 60 | 45 45 40 42 | 76 76 70 | 84 76 70 | 64 64 55 84'],
  ['vitorino-hilton', 'Vitorino Hilton', '비토리누 힐통', 1977, 'Brazil', 'Montpellier', L1, 4, 180, 76, 'right', 'CB', [], 'special', 120, false,
    '50 62 | 35 40 74 35 | 64 62 40 35 54 | 76 78 78 80 | 48 48 52 | 62 74 74 | 80 78 82 76'],
  // 보르도
  ['francois-kamano', 'François Kamano', '프랑수아 카마노', 1996, 'Guinea', 'Bordeaux', L1, 11, 178, 71, 'right', 'LW', ['ST'], 'special', 100, false,
    '78 74 | 70 68 50 68 | 64 55 62 50 62 | 35 35 30 35 | 86 86 80 | 74 62 58 | 62 62 50 72'],
  ['jimmy-briand', 'Jimmy Briand', '지미 브리앙', 1985, 'France', 'Bordeaux', L1, 25, 180, 80, 'right', 'ST', ['RW'], 'special', 100, false,
    '68 70 | 72 64 66 72 | 64 55 55 45 60 | 40 40 35 40 | 70 70 66 | 72 74 66 | 70 68 66 76'],
  // 낭트
  ['valentin-rongier', 'Valentin Rongier', '발랑탱 롱지에', 1994, 'France', 'Nantes', L1, 28, 172, 66, 'right', 'CM', ['CDM'], 'special', 100, false,
    '72 76 | 60 64 50 60 | 76 72 60 55 72 | 66 70 62 66 | 70 72 76 | 86 58 52 | 70 70 66 84'],
  ['abdoulaye-toure', 'Abdoulaye Touré', '압둘라예 투레', 1994, 'France', 'Nantes', L1, 5, 188, 84, 'right', 'CDM', ['CM'], 'special', 80, false,
    '64 70 | 55 60 66 52 | 70 66 50 40 62 | 72 74 68 70 | 66 66 64 | 82 78 72 | 66 66 62 80'],
  // 스트라스부르
  ['kenny-lala', 'Kenny Lala', '케니 랄라', 1991, 'France', 'Strasbourg', L1, 27, 178, 72, 'right', 'RB', ['RWB'], 'special', 80, false,
    '70 70 | 55 60 55 55 | 70 66 78 50 66 | 68 68 66 66 | 80 78 74 | 84 66 62 | 66 66 62 80'],
  ['ludovic-ajorque', 'Ludovic Ajorque', '뤼도비크 아조르크', 1994, 'France', 'Strasbourg', L1, 25, 197, 89, 'left', 'ST', [], 'special', 60, false,
    '62 66 | 70 60 82 70 | 60 50 45 40 55 | 40 40 35 40 | 62 60 52 | 76 84 84 | 64 64 60 80'],
  // 툴루즈
  ['max-gradel', 'Max Gradel', '막스 그라델', 1987, "Côte d'Ivoire", 'Toulouse', L1, 10, 178, 74, 'right', 'LW', ['RW'], 'special', 120, false,
    '78 74 | 70 72 50 70 | 66 58 66 60 64 | 40 40 35 40 | 80 80 78 | 72 68 58 | 66 66 60 74'],
  ['yaya-sanogo', 'Yaya Sanogo', '야야 사노고', 1993, 'France', 'Toulouse', L1, 9, 191, 83, 'right', 'ST', [], 'normal', 80, false,
    '62 64 | 66 56 72 66 | 58 48 45 40 52 | 35 35 30 35 | 70 68 60 | 64 78 74 | 58 60 50 66'],
  // 앙제
  ['angelo-fulgini', 'Angelo Fulgini', '안젤로 풀지니', 1996, 'France', 'Angers', L1, 11, 182, 72, 'right', 'CM', ['CAM'], 'special', 60, false,
    '74 74 | 66 72 50 64 | 72 66 62 60 70 | 55 58 50 55 | 72 74 76 | 80 62 56 | 66 66 55 76'],
  ['thomas-mangani', 'Thomas Mangani', '토마 망가니', 1987, 'France', 'Angers', L1, 25, 180, 76, 'right', 'CDM', ['CM'], 'normal', 60, false,
    '64 72 | 58 70 55 55 | 76 74 60 74 70 | 66 70 64 68 | 52 54 60 | 76 70 62 | 72 72 74 74'],
  // 랭스
  ['suk-hyun-jun', 'Suk Hyun-jun', '석현준', 1991, 'Korea Republic', 'Reims', L1, 18, 190, 83, 'right', 'ST', [], 'normal', 80, false,
    '64 66 | 68 60 76 68 | 58 48 45 40 54 | 35 35 30 35 | 70 70 62 | 72 80 78 | 62 62 55 74'],
  ['remi-oudin', 'Rémi Oudin', '레미 우댕', 1996, 'France', 'Reims', L1, 10, 175, 65, 'right', 'LW', ['CAM'], 'normal', 50, false,
    '74 72 | 66 70 45 64 | 68 62 64 60 66 | 40 40 35 40 | 76 78 78 | 72 55 50 | 62 62 50 72'],
  ['bjorn-engels', 'Björn Engels', '비외른 엥겔스', 1994, 'Belgium', 'Reims', L1, 4, 195, 84, 'right', 'CB', [], 'special', 60, false,
    '50 60 | 40 45 80 40 | 62 60 40 35 50 | 74 72 74 74 | 64 60 50 | 72 82 82 | 70 70 66 74'],
  // 님
  ['teji-savanier', 'Téji Savanier', '테지 사바니에', 1991, 'France', 'Nîmes', L1, 11, 170, 67, 'right', 'CM', ['CAM'], 'special', 60, false,
    '74 78 | 68 78 45 64 | 78 76 70 78 76 | 60 62 52 56 | 64 66 72 | 78 58 50 | 70 70 66 76'],
  ['renaud-ripart', 'Renaud Ripart', '르노 리파르', 1993, 'France', 'Nîmes', L1, 23, 180, 74, 'right', 'ST', ['RW', 'RM'], 'normal', 50, false,
    '66 66 | 66 62 66 66 | 62 55 60 45 58 | 50 50 45 48 | 72 72 68 | 86 70 66 | 62 62 55 84'],
  // 캉
  ['faycal-fajr', 'Fayçal Fajr', '파이살 파즈르', 1988, 'Morocco', 'Caen', L1, 29, 178, 70, 'right', 'CM', ['CAM'], 'normal', 60, false,
    '72 74 | 64 74 45 60 | 74 72 66 78 72 | 50 55 45 50 | 62 64 70 | 72 58 50 | 68 68 62 68'],
  ['enzo-crivelli', 'Enzo Crivelli', '앙조 크리벨리', 1995, 'France', 'Caen', L1, 9, 181, 77, 'right', 'ST', [], 'normal', 50, false,
    '64 64 | 68 60 70 66 | 58 48 45 40 54 | 40 40 35 40 | 72 72 66 | 74 76 72 | 60 60 50 76'],
  // 디종
  ['kwon-chang-hoon', 'Kwon Chang-hoon', '권창훈', 1994, 'Korea Republic', 'Dijon', L1, 22, 174, 66, 'left', 'CAM', ['LW', 'CM'], 'special', 120, false,
    '76 76 | 70 74 50 70 | 72 64 64 60 70 | 40 45 35 40 | 74 76 78 | 80 58 52 | 68 68 55 80'],
  ['julio-tavares', 'Júlio Tavares', '줄리우 타바르스', 1988, 'Cape Verde', 'Dijon', L1, 9, 188, 83, 'right', 'ST', [], 'normal', 50, false,
    '62 64 | 66 56 76 68 | 58 48 45 40 52 | 35 35 30 35 | 64 64 58 | 72 82 78 | 62 62 60 74'],
  // 아미앵
  ['gael-kakuta', 'Gaël Kakuta', '가엘 카쿠타', 1991, 'DR Congo', 'Amiens', L1, 10, 173, 64, 'left', 'CAM', ['LW', 'RW'], 'special', 120, false,
    '80 78 | 66 72 40 62 | 74 66 66 66 74 | 35 40 30 35 | 72 76 82 | 66 52 45 | 66 64 50 66'],
  ['moussa-konate', 'Moussa Konaté', '무사 코나테', 1993, 'Senegal', 'Amiens', L1, 9, 183, 76, 'right', 'ST', [], 'normal', 60, false,
    '66 66 | 70 62 72 70 | 58 48 45 40 54 | 35 35 30 35 | 76 76 70 | 72 76 72 | 62 64 50 72'],
  // 갱강
  ['marcus-thuram', 'Marcus Thuram', '마르퀴스 튀랑', 1997, 'France', 'Guingamp', L1, 9, 192, 88, 'right', 'ST', ['LW'], 'topClass', 80, false,
    '74 70 | 66 62 70 66 | 62 52 58 45 58 | 40 40 35 40 | 80 78 70 | 74 82 74 | 60 60 50 74', 7],
  ['ludovic-blas', 'Ludovic Blas', '뤼도비크 블라', 1997, 'France', 'Guingamp', L1, 10, 180, 70, 'right', 'CAM', ['RW', 'LW'], 'special', 60, false,
    '76 74 | 64 68 45 62 | 70 62 62 60 68 | 40 40 35 40 | 74 76 80 | 72 55 50 | 62 62 50 70', 6],
];

/** 짧은 이름 예외 (stars.ts SHORT_KO 와 같은 뜻): 통칭으로 불리거나 성이 여러 단어인 선수 */
const SHORT_KO: Record<string, string> = {
  'angel-di-maria': '디마리아', 'thiago-silva': '티아구 실바', 'dani-alves': '다니 아우베스', 'hatem-ben-arfa': '벤아르파',
  'luiz-gustavo': '루이스 구스타부', 'suk-hyun-jun': '석현준', 'kwon-chang-hoon': '권창훈',
};

export const ligue1Players: FieldPlayerData[] = ROWS.map(
  ([id, name, nameKo, birthYear, nationality, club, league, shirtNumber, height, weight, foot,
    position, subPositions, potentialTier, reputation, legendBadge, attrs, spread]) => ({
    id, name, nameKo, birthYear, nationality, club, league, shirtNumber, height, weight, foot,
    position, subPositions, traits: [], potentialTier, reputation, legendBadge,
    attributes: parseAttrs(id, attrs),
    ...(SHORT_KO[id] ? { shortKo: SHORT_KO[id] } : {}),
    ...(spread !== undefined ? { variance: { spread } } : {}),
  }),
);
