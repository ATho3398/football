import { FIELD_ATTRIBUTES, type FieldAttributes } from '../../src/attributes';
import type { FieldPlayerData, Foot, Position, Tier } from '../../src/types';

// J1리그 2018 유명 선수 (C.75q, 45d4). stars.ts 와 같은 Row 형식, 필드 선수만. 데이터만 — 게임 연결은 45b.
// 능력치는 2018 시즌 기준 나이·실력으로 stars.ts 척도에 맞춰 보수적으로 잡았다(리그 정상급 ≈ 70대 중후반).
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

const JL = 'J1 League';
const JPN = 'Japan';

const ROWS: Row[] = [
  // 가와사키 프론탈레
  ['kengo-nakamura', 'Kengo Nakamura', '나카무라 겐고', 1980, JPN, 'Kawasaki Frontale', JL, 14, 175, 66, 'right', 'CM', ['CAM'], 'topClass', 130, false,
    '72 80 | 64 72 46 62 | 82 80 70 70 82 | 50 56 46 50 | 54 58 68 | 66 54 50 | 80 70 76 78'],
  ['yu-kobayashi', 'Yu Kobayashi', '고바야시 유', 1987, JPN, 'Kawasaki Frontale', JL, 11, 177, 72, 'right', 'ST', ['RW'], 'special', 110, false,
    '72 72 | 76 66 58 80 | 66 54 56 50 64 | 30 32 28 30 | 74 78 74 | 76 60 60 | 74 74 60 78'],
  ['akihiro-ienaga', 'Akihiro Ienaga', '이에나가 아키히로', 1986, JPN, 'Kawasaki Frontale', JL, 41, 173, 70, 'left', 'RW', ['CAM'], 'special', 100, false,
    '78 78 | 70 76 44 70 | 74 70 72 76 76 | 30 34 28 30 | 68 72 78 | 70 56 52 | 74 70 56 70'],
  ['ryota-oshima', 'Ryota Oshima', '오시마 료타', 1993, JPN, 'Kawasaki Frontale', JL, 10, 168, 64, 'right', 'CM', ['CDM'], 'special', 80, false,
    '72 76 | 54 62 42 56 | 78 74 60 55 76 | 58 62 54 58 | 64 68 74 | 70 52 50 | 72 62 52 74'],
  ['shogo-taniguchi', 'Shogo Taniguchi', '다니구치 쇼고', 1991, JPN, 'Kawasaki Frontale', JL, 5, 183, 75, 'right', 'CB', ['CDM'], 'normal', 70, false,
    '58 66 | 42 46 70 42 | 70 66 44 40 60 | 72 72 70 72 | 64 62 60 | 76 72 72 | 70 62 68 78'],
  // 가시마 앤틀러스
  ['yuma-suzuki', 'Yuma Suzuki', '스즈키 유마', 1996, JPN, 'Kashima Antlers', JL, 9, 182, 75, 'right', 'ST', ['RW'], 'special', 70, false,
    '68 68 | 70 62 66 72 | 60 52 54 45 58 | 34 34 30 32 | 74 74 70 | 78 72 68 | 64 66 54 80', 6],
  ['leo-silva', 'Léo Silva', '레오 시우바', 1985, 'Brazil', 'Kashima Antlers', JL, 4, 172, 70, 'right', 'CDM', ['CM'], 'normal', 80, false,
    '68 74 | 52 60 50 52 | 76 72 56 50 70 | 74 76 70 72 | 60 62 68 | 76 66 58 | 74 64 66 76'],
  ['atsuto-uchida', 'Atsuto Uchida', '우치다 아쓰토', 1988, JPN, 'Kashima Antlers', JL, 2, 176, 67, 'right', 'RB', [], 'special', 140, false,
    '66 72 | 46 50 46 54 | 72 66 70 45 64 | 66 68 64 68 | 70 70 72 | 60 58 56 | 72 60 66 70'],
  // 산프레체 히로시마
  ['patric', 'Patric', '파트릭', 1987, 'Brazil', 'Sanfrecce Hiroshima', JL, 39, 189, 82, 'right', 'ST', [], 'normal', 70, false,
    '66 66 | 74 66 78 76 | 56 50 44 45 52 | 25 28 22 25 | 72 70 62 | 70 80 78 | 66 70 50 72'],
  ['toshihiro-aoyama', 'Toshihiro Aoyama', '아오야마 도시히로', 1986, JPN, 'Sanfrecce Hiroshima', JL, 6, 174, 73, 'right', 'CDM', ['CM'], 'special', 90, false,
    '66 74 | 54 66 48 54 | 80 82 62 60 78 | 64 68 60 64 | 58 60 66 | 76 60 54 | 76 64 72 76'],
  // 우라와 레드 다이아몬즈
  ['shinzo-koroki', 'Shinzo Koroki', '고로키 신조', 1986, JPN, 'Urawa Red Diamonds', JL, 30, 175, 75, 'right', 'ST', ['CF'], 'special', 100, false,
    '72 74 | 76 68 64 80 | 68 56 54 50 66 | 30 32 28 30 | 70 72 74 | 74 66 64 | 76 76 58 76'],
  ['yosuke-kashiwagi', 'Yosuke Kashiwagi', '가시와기 요스케', 1987, JPN, 'Urawa Red Diamonds', JL, 10, 176, 73, 'left', 'CAM', ['CM'], 'normal', 80, false,
    '72 76 | 60 68 44 60 | 78 76 72 72 78 | 40 44 36 40 | 64 66 72 | 72 56 50 | 72 64 56 70'],
  ['yuki-abe', 'Yuki Abe', '아베 유키', 1981, JPN, 'Urawa Red Diamonds', JL, 22, 177, 77, 'right', 'CDM', ['CB'], 'special', 100, false,
    '60 70 | 50 60 62 50 | 76 74 56 55 70 | 72 74 70 74 | 52 54 58 | 66 68 62 | 78 66 80 78'],
  // 세레소 오사카
  ['hiroshi-kiyotake', 'Hiroshi Kiyotake', '기요타케 히로시', 1989, JPN, 'Cerezo Osaka', JL, 10, 172, 66, 'right', 'CAM', ['RW', 'CM'], 'special', 120, false,
    '76 78 | 64 70 40 64 | 78 76 74 78 78 | 34 38 30 34 | 68 70 76 | 70 52 48 | 72 66 54 72'],
  ['kenyu-sugimoto', 'Kenyu Sugimoto', '스기모토 겐유', 1992, JPN, 'Cerezo Osaka', JL, 9, 187, 79, 'right', 'ST', [], 'normal', 70, false,
    '66 68 | 70 64 72 70 | 62 52 46 45 58 | 25 28 22 25 | 68 66 62 | 70 74 72 | 64 66 50 68'],
  // FC 도쿄
  ['diego-oliveira', 'Diego Oliveira', '디에구 올리베이라', 1990, 'Brazil', 'FC Tokyo', JL, 9, 179, 77, 'right', 'ST', [], 'normal', 80, false,
    '70 70 | 72 66 66 74 | 60 52 46 50 58 | 30 32 28 30 | 70 72 70 | 80 78 66 | 68 70 60 82'],
  // 비셀 고베
  ['lukas-podolski', 'Lukas Podolski', '루카스 포돌스키', 1985, 'Germany', 'Vissel Kobe', JL, 10, 182, 83, 'left', 'ST', ['LW', 'CF'], 'topClass', 300, false,
    '70 76 | 78 84 62 72 | 72 70 66 74 70 | 25 28 22 25 | 62 64 64 | 62 76 60 | 76 74 74 64'],
  ['hotaru-yamaguchi', 'Hotaru Yamaguchi', '야마구치 호타루', 1990, JPN, 'Vissel Kobe', JL, 5, 173, 72, 'right', 'CDM', ['CM'], 'special', 100, false,
    '64 70 | 52 64 50 54 | 74 72 56 50 68 | 74 74 68 72 | 68 70 70 | 86 66 60 | 70 62 64 84'],
  // 홋카이도 콘사도레 삿포로
  ['jay-bothroyd', 'Jay Bothroyd', '제이 보스로이드', 1982, 'England', 'Hokkaido Consadole Sapporo', JL, 48, 191, 89, 'left', 'ST', [], 'normal', 80, false,
    '66 72 | 74 70 74 74 | 64 56 46 60 60 | 22 25 20 22 | 54 54 54 | 58 82 70 | 72 70 62 62'],
  ['chanathip-songkrasin', 'Chanathip Songkrasin', '차나팁 송끄라신', 1993, 'Thailand', 'Hokkaido Consadole Sapporo', JL, 18, 158, 56, 'right', 'CAM', ['LW', 'CM'], 'special', 110, false,
    '80 76 | 60 62 30 64 | 74 64 62 55 74 | 34 38 28 32 | 76 82 86 | 72 44 46 | 68 62 52 76'],
  // 감바 오사카
  ['yasuhito-endo', 'Yasuhito Endo', '엔도 야스히토', 1980, JPN, 'Gamba Osaka', JL, 7, 178, 75, 'right', 'CM', ['CDM'], 'topClass', 140, false,
    '68 80 | 62 70 44 58 | 84 82 66 80 84 | 50 58 48 52 | 46 48 60 | 62 56 48 | 84 70 74 70'],
  // 나고야 그램퍼스
  ['jo', 'Jô', '조', 1987, 'Brazil', 'Nagoya Grampus', JL, 7, 192, 88, 'right', 'ST', [], 'normal', 110, false,
    '64 70 | 78 66 78 80 | 62 52 44 45 58 | 22 25 20 22 | 60 58 56 | 66 82 76 | 74 78 56 66'],
  // 주빌로 이와타
  ['shunsuke-nakamura', 'Shunsuke Nakamura', '나카무라 슌스케', 1978, JPN, 'Júbilo Iwata', JL, 10, 178, 70, 'left', 'CAM', ['RM'], 'topClass', 150, false,
    '70 80 | 60 72 40 58 | 80 80 78 88 82 | 30 36 28 30 | 46 48 60 | 54 52 44 | 80 68 72 66'],
];

/** 짧은 이름 예외 (stars.ts SHORT_KO 와 같은 뜻): 일본 선수는 한국 언론처럼 성(앞 단어), 나머지는 마지막 단어(names.ts autoShortKo) */
const SHORT_KO: Record<string, string> = {
  'kengo-nakamura': '나카무라', 'yu-kobayashi': '고바야시', 'akihiro-ienaga': '이에나가', 'ryota-oshima': '오시마',
  'shogo-taniguchi': '다니구치', 'yuma-suzuki': '스즈키', 'atsuto-uchida': '우치다', 'toshihiro-aoyama': '아오야마',
  'shinzo-koroki': '고로키', 'yosuke-kashiwagi': '가시와기', 'yuki-abe': '아베', 'hiroshi-kiyotake': '기요타케',
  'kenyu-sugimoto': '스기모토', 'hotaru-yamaguchi': '야마구치', 'yasuhito-endo': '엔도', 'shunsuke-nakamura': '나카무라',
  'leo-silva': '레오 시우바', 'diego-oliveira': '디에구', 'chanathip-songkrasin': '차나팁',
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
