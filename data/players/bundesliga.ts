import { FIELD_ATTRIBUTES, type FieldAttributes } from '../../src/attributes';
import type { FieldPlayerData, Foot, Position, Tier } from '../../src/types';

// 분데스리가 2018-19 유명 실제 선수 (45d2단계, 부록 C.75o). 게임에는 아직 연결하지 않는다 (45b).
// 형식·척도는 stars.ts 와 같다 (필드 선수만 — 실제 선수 표에 GK 형식이 없어 GK 는 넣지 않음). 능력치는 2018-19 시즌 기준 기억 기반 초안.
// 이미 다른 표에 있는 선수(레반도프스키·산초·키미히·하베르츠 = stars, 리베리·로번·훔멜스·피슈첵·슈멜처·S.벤더·샤힌 = 레전드)는 넣지 않는다.
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

const BL = 'Bundesliga';
const BAY = 'Bayern Munich';
const BVB = 'Borussia Dortmund';
const RBL = 'RB Leipzig';
const B04 = 'Bayer Leverkusen';
const BMG = 'Borussia Mönchengladbach';
const SGE = 'Eintracht Frankfurt';

const ROWS: Row[] = [
  // 바이에른 뮌헨
  ['thomas-muller', 'Thomas Müller', '토마스 뮐러', 1989, 'Germany', BAY, BL, 25, 185, 76, 'right', 'CAM', ['CF', 'RW'], 'worldClass', 650, false,
    '76 82 | 82 75 72 92 | 82 72 78 60 87 | 45 55 40 45 | 72 74 76 | 88 70 70 | 85 85 82 90', 3],
  ['david-alaba', 'David Alaba', '다비드 알라바', 1992, 'Austria', BAY, BL, 27, 180, 78, 'left', 'LB', ['CB', 'CM'], 'worldClass', 550, false,
    '80 83 | 68 76 62 65 | 84 82 80 82 80 | 80 80 77 79 | 82 82 80 | 85 70 68 | 82 80 76 82', 3],
  ['thiago-alcantara', 'Thiago Alcântara', '티아고 알칸타라', 1991, 'Spain', BAY, BL, 6, 174, 70, 'right', 'CM', ['CDM', 'CAM'], 'worldClass', 550, false,
    '88 92 | 66 74 50 66 | 91 86 72 70 89 | 74 78 66 72 | 68 74 86 | 80 64 55 | 87 84 70 80', 3],
  ['jerome-boateng', 'Jérôme Boateng', '제롬 보아텡', 1988, 'Germany', BAY, BL, 17, 192, 90, 'right', 'CB', [], 'worldClass', 500, false,
    '62 72 | 45 50 76 40 | 76 82 50 40 66 | 82 80 80 80 | 72 70 62 | 72 86 80 | 78 76 72 70', 3],
  ['niklas-sule', 'Niklas Süle', '니클라스 쥘레', 1995, 'Germany', BAY, BL, 4, 195, 99, 'right', 'CB', [], 'topClass', 300, false,
    '55 68 | 40 48 78 40 | 72 70 40 35 60 | 82 78 80 79 | 70 64 52 | 74 90 78 | 76 75 66 72'],
  ['leon-goretzka', 'Leon Goretzka', '레온 고레츠카', 1995, 'Germany', BAY, BL, 18, 189, 82, 'right', 'CM', ['CAM', 'CDM'], 'worldClass', 350, false,
    '76 80 | 74 76 76 76 | 80 74 64 55 76 | 72 74 68 70 | 74 76 72 | 86 82 76 | 78 78 70 84'],
  ['serge-gnabry', 'Serge Gnabry', '세르주 그나브리', 1995, 'Germany', BAY, BL, 22, 175, 75, 'right', 'RW', ['LW'], 'worldClass', 350, false,
    '84 82 | 82 80 50 80 | 74 64 72 62 74 | 35 40 30 35 | 88 88 85 | 80 66 62 | 78 76 60 78', 5],
  ['kingsley-coman', 'Kingsley Coman', '킹슬리 코망', 1996, 'France', BAY, BL, 29, 179, 75, 'right', 'LW', ['RW'], 'worldClass', 400, false,
    '87 82 | 70 66 45 74 | 74 64 76 50 74 | 30 35 25 30 | 92 93 86 | 72 60 55 | 72 72 55 75', 5],
  // 보루시아 도르트문트
  ['marco-reus', 'Marco Reus', '마르코 로이스', 1989, 'Germany', BVB, BL, 11, 180, 71, 'right', 'CAM', ['LW', 'CF'], 'worldClass', 650, false,
    '85 87 | 86 84 60 87 | 84 74 76 82 85 | 40 45 35 40 | 82 84 84 | 76 62 60 | 86 84 82 80', 3],
  ['axel-witsel', 'Axel Witsel', '악셀 비첼', 1989, 'Belgium', BVB, BL, 28, 186, 81, 'right', 'CDM', ['CM'], 'topClass', 450, false,
    '76 84 | 62 70 70 60 | 86 80 60 55 80 | 76 80 72 78 | 62 62 66 | 84 82 72 | 86 80 76 80'],
  ['paco-alcacer', 'Paco Alcácer', '파코 알카세르', 1993, 'Spain', BVB, BL, 9, 175, 70, 'right', 'ST', [], 'topClass', 300, false,
    '74 78 | 84 72 70 86 | 70 55 55 60 68 | 25 30 20 25 | 77 80 78 | 66 66 64 | 84 80 60 72'],
  ['achraf-hakimi', 'Achraf Hakimi', '아슈라프 하키미', 1998, 'Morocco', BVB, BL, 5, 181, 73, 'right', 'RB', ['LB', 'RWB'], 'worldClass', 200, false,
    '78 76 | 62 62 50 62 | 74 66 74 55 68 | 68 70 66 66 | 93 92 84 | 82 66 62 | 66 66 55 78', 7],
  ['christian-pulisic', 'Christian Pulisic', '크리스천 풀리식', 1998, 'United States', BVB, BL, 22, 177, 70, 'right', 'RW', ['LW', 'CAM'], 'worldClass', 300, false,
    '84 80 | 72 70 45 72 | 74 62 68 55 72 | 30 35 25 30 | 86 88 88 | 72 60 55 | 70 70 55 74', 6],
  ['raphael-guerreiro', 'Raphaël Guerreiro', '하파엘 게헤이루', 1993, 'Portugal', BVB, BL, 13, 170, 68, 'left', 'LB', ['CM', 'LM'], 'topClass', 300, false,
    '80 82 | 68 76 45 64 | 82 78 80 78 78 | 70 72 66 68 | 78 80 84 | 76 58 52 | 76 74 62 74'],
  // RB 라이프치히
  ['timo-werner', 'Timo Werner', '티모 베르너', 1996, 'Germany', RBL, BL, 11, 180, 75, 'right', 'ST', ['LW'], 'worldClass', 400, false,
    '78 76 | 82 70 62 82 | 70 58 66 50 70 | 30 35 25 30 | 94 92 82 | 80 70 65 | 74 72 60 82', 5],
  ['yussuf-poulsen', 'Yussuf Poulsen', '유수프 폴센', 1994, 'Denmark', RBL, BL, 9, 193, 84, 'right', 'ST', ['CF'], 'topClass', 200, false,
    '68 70 | 72 62 80 74 | 68 55 55 40 62 | 45 45 40 42 | 82 78 66 | 84 82 84 | 68 68 60 86'],
  ['emil-forsberg', 'Emil Forsberg', '에밀 포르스베리', 1991, 'Sweden', RBL, BL, 10, 179, 78, 'right', 'LM', ['CAM'], 'topClass', 300, false,
    '82 82 | 72 76 45 72 | 80 74 80 74 82 | 40 45 35 40 | 74 76 82 | 76 60 50 | 76 74 62 74'],
  ['marcel-sabitzer', 'Marcel Sabitzer', '마르셀 자비처', 1994, 'Austria', RBL, BL, 7, 177, 75, 'right', 'CM', ['RM', 'CAM'], 'topClass', 250, false,
    '78 78 | 76 82 60 74 | 78 76 72 70 76 | 62 64 58 60 | 76 76 76 | 84 72 66 | 74 74 66 82'],
  ['dayot-upamecano', 'Dayot Upamecano', '다요 우파메카노', 1998, 'France', RBL, BL, 5, 186, 90, 'right', 'CB', [], 'worldClass', 150, false,
    '62 68 | 35 40 70 35 | 70 66 40 30 58 | 78 76 74 74 | 80 76 62 | 76 84 76 | 68 68 58 72', 7],
  // 바이어 레버쿠젠
  ['julian-brandt', 'Julian Brandt', '율리안 브란트', 1996, 'Germany', B04, BL, 10, 185, 83, 'right', 'CAM', ['LW', 'CM'], 'worldClass', 300, false,
    '82 82 | 72 76 50 72 | 82 76 76 70 82 | 40 45 35 40 | 80 80 80 | 76 64 58 | 74 74 60 74', 5],
  ['kevin-volland', 'Kevin Volland', '케빈 폴란트', 1992, 'Germany', B04, BL, 31, 178, 85, 'left', 'ST', ['CF', 'LW'], 'topClass', 250, false,
    '76 76 | 80 76 66 80 | 72 62 66 60 70 | 40 40 35 40 | 78 80 74 | 80 80 70 | 74 72 66 82'],
  ['leon-bailey', 'Leon Bailey', '레온 베일리', 1997, 'Jamaica', B04, BL, 9, 178, 71, 'left', 'RW', ['LW'], 'topClass', 200, false,
    '84 78 | 72 76 45 70 | 68 62 70 72 68 | 30 30 25 30 | 92 92 86 | 70 60 55 | 66 64 50 66', 7],
  ['jonathan-tah', 'Jonathan Tah', '요나탄 타', 1996, 'Germany', B04, BL, 4, 195, 97, 'right', 'CB', [], 'topClass', 200, false,
    '55 64 | 35 40 76 35 | 68 62 40 30 52 | 78 74 78 76 | 74 70 52 | 72 88 78 | 70 70 62 72'],
  ['charles-aranguiz', 'Charles Aránguiz', '찰레스 아랑기스', 1989, 'Chile', B04, BL, 20, 171, 70, 'right', 'CM', ['CDM'], 'topClass', 300, false,
    '74 80 | 64 70 55 64 | 82 78 66 62 78 | 76 78 70 72 | 68 72 76 | 88 70 62 | 78 76 70 88'],
  // 보루시아 묀헨글라트바흐
  ['thorgan-hazard', 'Thorgan Hazard', '토르강 아자르', 1993, 'Belgium', BMG, BL, 10, 175, 70, 'right', 'LW', ['CAM', 'RW'], 'topClass', 300, false,
    '82 82 | 76 74 45 76 | 80 72 78 76 80 | 35 40 30 35 | 80 82 84 | 80 58 52 | 76 74 60 80'],
  ['alassane-plea', 'Alassane Pléa', '알라산 플레아', 1993, 'France', BMG, BL, 14, 180, 72, 'right', 'ST', ['LW'], 'topClass', 200, false,
    '78 78 | 78 70 66 78 | 72 60 62 55 70 | 35 35 30 35 | 80 80 76 | 76 70 66 | 72 72 55 74'],
  ['denis-zakaria', 'Denis Zakaria', '데니스 자카리아', 1996, 'Switzerland', BMG, BL, 8, 191, 81, 'right', 'CDM', ['CM'], 'topClass', 150, false,
    '70 74 | 60 64 66 58 | 74 70 55 40 66 | 76 76 72 72 | 82 78 70 | 86 80 72 | 70 70 60 82'],
  ['matthias-ginter', 'Matthias Ginter', '마티아스 긴터', 1994, 'Germany', BMG, BL, 28, 191, 88, 'right', 'CB', ['RB', 'CDM'], 'topClass', 250, false,
    '58 70 | 45 52 74 45 | 74 72 50 40 64 | 78 80 78 80 | 66 64 58 | 76 80 76 | 78 76 70 76'],
  ['lars-stindl', 'Lars Stindl', '라르스 슈틴들', 1988, 'Germany', BMG, BL, 13, 181, 80, 'right', 'CAM', ['CF', 'CM'], 'topClass', 250, false,
    '74 80 | 74 72 66 78 | 80 70 64 62 80 | 50 55 45 50 | 66 68 72 | 80 72 66 | 80 78 80 84'],
  // 아인트라흐트 프랑크푸르트
  ['luka-jovic', 'Luka Jović', '루카 요비치', 1997, 'Serbia', SGE, BL, 8, 182, 80, 'right', 'ST', [], 'worldClass', 150, false,
    '72 76 | 84 72 72 84 | 66 52 50 50 64 | 25 30 20 25 | 76 78 72 | 70 76 72 | 76 76 50 70', 7],
  ['sebastien-haller', 'Sébastien Haller', '세바스티앵 알레', 1994, 'France', SGE, BL, 9, 190, 82, 'right', 'ST', ['CF'], 'topClass', 200, false,
    '70 76 | 78 66 82 80 | 74 60 55 50 72 | 35 35 30 35 | 70 70 66 | 80 86 82 | 74 74 66 82'],
  ['ante-rebic', 'Ante Rebić', '안테 레비치', 1993, 'Croatia', SGE, BL, 4, 185, 78, 'right', 'LW', ['ST', 'RW'], 'topClass', 200, false,
    '78 74 | 74 70 66 72 | 66 55 66 50 64 | 45 40 35 40 | 84 84 74 | 82 80 70 | 64 66 55 82'],
  ['filip-kostic', 'Filip Kostić', '필리프 코스티치', 1992, 'Serbia', SGE, BL, 10, 184, 82, 'left', 'LWB', ['LM', 'LW'], 'topClass', 150, false,
    '78 74 | 68 70 55 66 | 70 70 84 66 68 | 55 55 50 52 | 88 86 74 | 90 74 62 | 66 66 55 84'],
  ['makoto-hasebe', 'Makoto Hasebe', '하세베 마코토', 1984, 'Japan', SGE, BL, 20, 180, 72, 'right', 'CB', ['CDM'], 'topClass', 250, false,
    '64 76 | 50 58 62 50 | 80 76 55 50 76 | 74 80 72 82 | 55 55 62 | 72 66 62 | 84 82 84 80'],
  // VfL 볼프스부르크
  ['wout-weghorst', 'Wout Weghorst', '바우트 베흐호르스트', 1992, 'Netherlands', 'VfL Wolfsburg', BL, 9, 197, 84, 'right', 'ST', [], 'special', 150, false,
    '62 70 | 78 62 82 80 | 66 50 50 50 60 | 40 40 35 40 | 66 64 56 | 86 84 84 | 72 72 66 86'],
  ['maximilian-arnold', 'Maximilian Arnold', '막시밀리안 아르놀트', 1994, 'Germany', 'VfL Wolfsburg', BL, 27, 184, 77, 'left', 'CM', ['CDM'], 'topClass', 150, false,
    '70 76 | 64 78 55 60 | 80 82 72 76 76 | 62 66 58 62 | 62 64 68 | 80 68 62 | 72 72 70 76'],
  ['josuha-guilavogui', 'Josuha Guilavogui', '조수아 길라보기', 1990, 'France', 'VfL Wolfsburg', BL, 23, 188, 77, 'right', 'CDM', ['CB'], 'special', 120, false,
    '62 70 | 50 58 66 50 | 72 66 50 40 62 | 76 76 72 74 | 66 66 64 | 82 78 72 | 72 72 76 84'],
  // 베르더 브레멘
  ['max-kruse', 'Max Kruse', '막스 크루제', 1988, 'Germany', 'Werder Bremen', BL, 10, 180, 85, 'right', 'CF', ['CAM', 'ST'], 'topClass', 250, false,
    '78 84 | 76 74 55 78 | 82 72 66 76 84 | 35 40 30 35 | 64 66 72 | 70 70 55 | 82 78 76 70'],
  ['davy-klaassen', 'Davy Klaassen', '데이비 클라선', 1993, 'Netherlands', 'Werder Bremen', BL, 30, 179, 70, 'right', 'CM', ['CAM'], 'topClass', 150, false,
    '74 78 | 70 70 60 74 | 78 70 62 55 74 | 58 60 55 58 | 70 72 74 | 86 64 62 | 72 72 70 84'],
  ['claudio-pizarro', 'Claudio Pizarro', '클라우디오 피사로', 1978, 'Peru', 'Werder Bremen', BL, 14, 184, 84, 'right', 'ST', [], 'topClass', 300, false,
    '64 76 | 76 64 78 80 | 70 55 50 55 70 | 30 30 25 30 | 45 50 55 | 50 72 70 | 82 78 78 64'],
  // 호펜하임
  ['andrej-kramaric', 'Andrej Kramarić', '안드레이 크라마리치', 1991, 'Croatia', 'Hoffenheim', BL, 27, 177, 73, 'right', 'ST', ['CF', 'CAM'], 'topClass', 250, false,
    '78 80 | 82 76 60 82 | 76 64 62 70 76 | 35 35 30 35 | 74 76 80 | 76 66 60 | 80 76 62 76'],
  ['kerem-demirbay', 'Kerem Demirbay', '케렘 데미르바이', 1993, 'Germany', 'Hoffenheim', BL, 10, 183, 80, 'left', 'CM', ['CAM'], 'topClass', 150, false,
    '74 78 | 66 78 55 64 | 80 80 70 78 78 | 58 62 55 58 | 66 66 70 | 78 70 62 | 72 72 62 74'],
  ['joelinton', 'Joelinton', '조엘린통', 1996, 'Brazil', 'Hoffenheim', BL, 34, 186, 81, 'right', 'ST', ['CF'], 'special', 100, false,
    '72 70 | 68 60 72 68 | 64 52 50 40 60 | 45 45 40 42 | 74 72 68 | 80 84 74 | 62 62 55 82', 6],
  // 샬케 04
  ['amine-harit', 'Amine Harit', '아민 아리트', 1997, 'Morocco', 'Schalke 04', BL, 25, 179, 68, 'right', 'CAM', ['LW'], 'topClass', 120, false,
    '84 80 | 64 66 40 64 | 74 64 62 55 74 | 35 40 30 35 | 78 82 86 | 70 56 50 | 66 64 50 66', 7],
  ['weston-mckennie', 'Weston McKennie', '웨스턴 매케니', 1998, 'United States', 'Schalke 04', BL, 2, 185, 84, 'right', 'CM', ['CDM', 'CB'], 'topClass', 100, false,
    '68 70 | 60 62 70 60 | 70 64 55 40 64 | 70 70 66 66 | 74 74 70 | 86 76 74 | 64 66 60 84', 6],
  ['salif-sane', 'Salif Sané', '살리프 사네', 1990, 'Senegal', 'Schalke 04', BL, 26, 196, 85, 'right', 'CB', ['CDM'], 'special', 120, false,
    '55 64 | 40 45 82 40 | 64 60 40 30 52 | 76 74 76 74 | 66 62 50 | 76 86 86 | 70 70 66 74'],
  // 헤르타 BSC
  ['vedad-ibisevic', 'Vedad Ibišević', '베다드 이비셰비치', 1984, 'Bosnia and Herzegovina', 'Hertha BSC', BL, 19, 190, 82, 'right', 'ST', [], 'topClass', 200, false,
    '62 72 | 76 64 80 80 | 66 52 45 50 62 | 30 30 25 30 | 58 60 58 | 66 78 78 | 76 72 78 72'],
  ['ondrej-duda', 'Ondrej Duda', '온드레이 두다', 1994, 'Slovakia', 'Hertha BSC', BL, 10, 180, 74, 'right', 'CAM', ['CM'], 'special', 120, false,
    '76 78 | 74 76 55 74 | 76 70 66 70 76 | 45 50 40 45 | 72 72 74 | 76 64 60 | 72 72 55 74'],
  ['salomon-kalou', 'Salomon Kalou', '살로몽 칼루', 1985, "Côte d'Ivoire", 'Hertha BSC', BL, 8, 184, 74, 'right', 'LW', ['ST'], 'topClass', 200, false,
    '74 76 | 74 68 55 74 | 70 58 62 50 68 | 35 35 30 35 | 70 72 74 | 64 66 60 | 74 72 66 66'],
  // 마인츠 05
  ['jean-philippe-mateta', 'Jean-Philippe Mateta', '장필리프 마테타', 1997, 'France', 'Mainz 05', BL, 9, 192, 84, 'right', 'ST', [], 'special', 80, false,
    '64 66 | 74 60 76 74 | 60 50 45 40 55 | 30 30 25 30 | 74 72 64 | 74 82 78 | 64 64 50 72'],
  ['robin-quaison', 'Robin Quaison', '로빈 콰이슨', 1993, 'Sweden', 'Mainz 05', BL, 7, 183, 80, 'right', 'ST', ['LW', 'CAM'], 'special', 80, false,
    '72 72 | 72 68 62 72 | 70 60 60 55 68 | 40 40 35 40 | 74 74 72 | 76 70 64 | 66 68 55 76'],
  // SC 프라이부르크
  ['nils-petersen', 'Nils Petersen', '닐스 페테르젠', 1988, 'Germany', 'SC Freiburg', BL, 18, 188, 82, 'right', 'ST', [], 'special', 120, false,
    '62 70 | 78 64 76 80 | 64 50 45 50 60 | 30 30 25 30 | 62 64 60 | 74 74 72 | 76 74 66 76'],
  ['christian-gunter', 'Christian Günter', '크리스티안 귄터', 1993, 'Germany', 'SC Freiburg', BL, 30, 184, 81, 'left', 'LB', ['LWB'], 'special', 80, false,
    '64 68 | 50 55 60 50 | 68 66 74 55 62 | 72 72 70 70 | 78 76 70 | 88 72 66 | 66 66 72 86'],
  // VfB 슈투트가르트
  ['benjamin-pavard', 'Benjamin Pavard', '벵자맹 파바르', 1996, 'France', 'VfB Stuttgart', BL, 21, 186, 76, 'right', 'CB', ['RB'], 'topClass', 250, false,
    '64 72 | 55 66 70 50 | 74 72 66 50 66 | 78 76 76 78 | 70 68 66 | 80 76 72 | 76 74 66 80'],
  ['mario-gomez', 'Mario Gómez', '마리오 고메스', 1985, 'Germany', 'VfB Stuttgart', BL, 27, 189, 88, 'right', 'ST', [], 'topClass', 300, false,
    '62 72 | 80 64 82 84 | 64 50 45 45 60 | 30 30 25 30 | 60 62 58 | 64 82 80 | 78 76 72 68'],
  ['daniel-didavi', 'Daniel Didavi', '다니엘 디다비', 1990, 'Germany', 'VfB Stuttgart', BL, 10, 180, 75, 'left', 'CAM', ['CM'], 'special', 100, false,
    '74 78 | 72 78 50 70 | 76 74 70 76 76 | 40 45 35 40 | 64 66 70 | 64 62 55 | 72 70 62 64'],
  // FC 아우크스부르크
  ['philipp-max', 'Philipp Max', '필리프 막스', 1993, 'Germany', 'FC Augsburg', BL, 31, 178, 75, 'left', 'LB', ['LWB', 'LM'], 'special', 100, false,
    '70 72 | 55 64 55 55 | 72 72 84 76 68 | 66 66 64 64 | 80 78 72 | 84 68 62 | 66 66 60 80'],
  ['alfred-finnbogason', 'Alfreð Finnbogason', '알프레드 핀보가손', 1989, 'Iceland', 'FC Augsburg', BL, 27, 184, 77, 'right', 'ST', [], 'special', 120, false,
    '68 72 | 80 66 76 82 | 64 50 45 50 60 | 30 30 25 30 | 68 70 66 | 70 74 72 | 74 72 62 74'],
  ['koo-ja-cheol', 'Koo Ja-cheol', '구자철', 1989, 'Korea Republic', 'FC Augsburg', BL, 19, 182, 75, 'right', 'CAM', ['CM', 'CDM'], 'special', 150, false,
    '72 76 | 66 70 64 68 | 76 70 60 60 74 | 60 64 56 60 | 66 68 72 | 80 70 66 | 72 72 70 80'],
  // 포르투나 뒤셀도르프
  ['dodi-lukebakio', 'Dodi Lukebakio', '도디 루케바키오', 1997, 'Belgium', 'Fortuna Düsseldorf', BL, 14, 187, 79, 'left', 'RW', ['ST'], 'special', 100, false,
    '78 74 | 72 70 55 70 | 64 55 62 50 62 | 30 30 25 30 | 88 86 74 | 72 74 62 | 62 64 50 70', 6],
  ['benito-raman', 'Benito Raman', '베니토 라만', 1994, 'Belgium', 'Fortuna Düsseldorf', BL, 9, 175, 70, 'right', 'ST', ['LW'], 'special', 80, false,
    '74 70 | 70 64 55 70 | 62 52 55 45 60 | 40 40 35 40 | 88 88 80 | 80 62 58 | 62 64 50 82'],
  // 하노버 96
  ['niclas-fullkrug', 'Niclas Füllkrug', '니클라스 퓔크루크', 1993, 'Germany', 'Hannover 96', BL, 9, 189, 85, 'right', 'ST', [], 'special', 80, false,
    '62 68 | 76 66 78 76 | 62 50 45 50 58 | 35 35 30 35 | 64 64 58 | 72 80 76 | 70 70 62 76'],
  ['ihlas-bebou', 'Ihlas Bebou', '일라스 베부', 1994, 'Togo', 'Hannover 96', BL, 13, 183, 77, 'right', 'RW', ['ST'], 'special', 60, false,
    '72 68 | 66 60 55 66 | 60 50 58 40 58 | 35 35 30 35 | 86 86 76 | 72 66 60 | 60 62 50 74'],
  // 1. FC 뉘른베르크
  ['hanno-behrens', 'Hanno Behrens', '하노 베렌스', 1990, 'Germany', '1. FC Nürnberg', BL, 18, 185, 78, 'right', 'CM', ['CAM'], 'normal', 60, false,
    '64 70 | 64 66 64 64 | 70 64 55 50 64 | 60 62 56 58 | 64 64 64 | 82 70 66 | 66 66 72 80'],
  ['mikael-ishak', 'Mikael Ishak', '미카엘 이샤크', 1993, 'Sweden', '1. FC Nürnberg', BL, 9, 185, 80, 'right', 'ST', [], 'special', 60, false,
    '64 68 | 72 60 74 74 | 60 50 45 40 56 | 35 35 30 35 | 70 70 64 | 76 76 72 | 66 66 60 78'],
];

/** 짧은 이름 예외 (stars.ts SHORT_KO 와 같은 뜻): 통칭으로 불리거나 성이 여러 단어인 선수 */
const SHORT_KO: Record<string, string> = {
  'thiago-alcantara': '티아고', 'koo-ja-cheol': '구자철', 'makoto-hasebe': '하세베', joelinton: '조엘린통',
};

export const bundesligaPlayers: FieldPlayerData[] = ROWS.map(
  ([id, name, nameKo, birthYear, nationality, club, league, shirtNumber, height, weight, foot,
    position, subPositions, potentialTier, reputation, legendBadge, attrs, spread]) => ({
    id, name, nameKo, birthYear, nationality, club, league, shirtNumber, height, weight, foot,
    position, subPositions, traits: [], potentialTier, reputation, legendBadge,
    attributes: parseAttrs(id, attrs),
    ...(SHORT_KO[id] ? { shortKo: SHORT_KO[id] } : {}),
    ...(spread !== undefined ? { variance: { spread } } : {}),
  }),
);
