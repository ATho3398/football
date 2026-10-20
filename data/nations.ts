// 국가대표 레이팅 표 (10번·18.12, 부록 C.75z). 2018 월드컵 무렵 전력 근사, 팀 레이팅과 같은 척도 (PL 상위 85 안팎).
// 이름은 선수 데이터 국적 표기(FIFA 영문)와 같다. 표에 없는 국적은 CONFED_DEFAULT (대륙 모름 = UEFA) 로 본다.
// 대륙 대회 참가국은 이 표에서 뽑으므로 대륙마다 대회 참가 수 이상을 둔다 (UEFA 24·AFC 24·CAF 24·CONCACAF 16·CONMEBOL 10·OFC 8 미만이면 다른 대륙 초청).

export type Confed = 'UEFA' | 'CONMEBOL' | 'CONCACAF' | 'AFC' | 'CAF' | 'OFC';

export interface NationData {
  /** 영문 (선수 국적 표기) */
  name: string;
  nameKo: string;
  confed: Confed;
  rating: number;
}

export const CONFED_KO: Record<Confed, string> = {
  UEFA: '유럽', CONMEBOL: '남미', CONCACAF: '북중미', AFC: '아시아', CAF: '아프리카', OFC: '오세아니아',
};

/** 표에 없는 국적의 대륙별 기본 레이팅 */
export const CONFED_DEFAULT: Record<Confed, number> = {
  UEFA: 62, CONMEBOL: 68, CONCACAF: 60, AFC: 58, CAF: 62, OFC: 52,
};

type Row = [name: string, nameKo: string, rating: number];

const TABLE: Record<Confed, Row[]> = {
  UEFA: [
    ['France', '프랑스', 85], ['Belgium', '벨기에', 84], ['Spain', '스페인', 84], ['Germany', '독일', 83], ['England', '잉글랜드', 82],
    ['Portugal', '포르투갈', 81], ['Croatia', '크로아티아', 81], ['Italy', '이탈리아', 80], ['Netherlands', '네덜란드', 80],
    ['Denmark', '덴마크', 78], ['Switzerland', '스위스', 78], ['Sweden', '스웨덴', 76], ['Poland', '폴란드', 76], ['Austria', '오스트리아', 75],
    ['Serbia', '세르비아', 75], ['Ukraine', '우크라이나', 75], ['Russia', '러시아', 74], ['Wales', '웨일스', 74], ['Czech Republic', '체코', 74],
    ['Turkey', '튀르키예', 74], ['Bosnia and Herzegovina', '보스니아 헤르체고비나', 72], ['Scotland', '스코틀랜드', 72], ['Slovakia', '슬로바키아', 72],
    ['Norway', '노르웨이', 72], ['Republic of Ireland', '아일랜드', 71], ['Iceland', '아이슬란드', 71], ['Hungary', '헝가리', 71],
    ['Romania', '루마니아', 71], ['Greece', '그리스', 71], ['Slovenia', '슬로베니아', 70], ['Northern Ireland', '북아일랜드', 69],
    ['Finland', '핀란드', 68], ['Montenegro', '몬테네그로', 68], ['Albania', '알바니아', 68], ['Bulgaria', '불가리아', 67],
    ['North Macedonia', '북마케도니아', 67], ['Israel', '이스라엘', 67], ['Georgia', '조지아', 67], ['Kosovo', '코소보', 66],
    ['Belarus', '벨라루스', 65], ['Armenia', '아르메니아', 65], ['Luxembourg', '룩셈부르크', 62], ['Estonia', '에스토니아', 62],
    ['Cyprus', '키프로스', 62], ['Kazakhstan', '카자흐스탄', 61], ['Latvia', '라트비아', 60], ['Lithuania', '리투아니아', 60],
    ['Azerbaijan', '아제르바이잔', 60], ['Faroe Islands', '페로 제도', 58], ['Moldova', '몰도바', 58], ['Malta', '몰타', 56],
    ['Andorra', '안도라', 54], ['Liechtenstein', '리히텐슈타인', 53], ['Gibraltar', '지브롤터', 52], ['San Marino', '산마리노', 48],
  ],
  CONMEBOL: [
    ['Brazil', '브라질', 85], ['Argentina', '아르헨티나', 82], ['Uruguay', '우루과이', 80], ['Colombia', '콜롬비아', 79], ['Chile', '칠레', 76],
    ['Peru', '페루', 75], ['Ecuador', '에콰도르', 73], ['Paraguay', '파라과이', 72], ['Venezuela', '베네수엘라', 71], ['Bolivia', '볼리비아', 66],
  ],
  CONCACAF: [
    ['Mexico', '멕시코', 77], ['United States', '미국', 74], ['Costa Rica', '코스타리카', 72], ['Jamaica', '자메이카', 68], ['Panama', '파나마', 68],
    ['Canada', '캐나다', 68], ['Honduras', '온두라스', 67], ['El Salvador', '엘살바도르', 64], ['Haiti', '아이티', 64], ['Curaçao', '퀴라소', 64],
    ['Trinidad and Tobago', '트리니다드 토바고', 63], ['Guatemala', '과테말라', 62], ['Martinique', '마르티니크', 60], ['Suriname', '수리남', 60],
    ['Nicaragua', '니카라과', 58], ['Cuba', '쿠바', 58], ['Bermuda', '버뮤다', 57], ['Guyana', '가이아나', 57],
  ],
  AFC: [
    ['Japan', '일본', 74], ['Iran', '이란', 74], ['Korea Republic', '대한민국', 73], ['Australia', '호주', 73], ['Saudi Arabia', '사우디아라비아', 69],
    ['Qatar', '카타르', 69], ['China', '중국', 67], ['United Arab Emirates', '아랍에미리트', 67], ['Iraq', '이라크', 67], ['Uzbekistan', '우즈베키스탄', 67],
    ['Syria', '시리아', 66], ['Oman', '오만', 64], ['Jordan', '요르단', 64], ['Vietnam', '베트남', 64], ['Bahrain', '바레인', 63],
    ['Lebanon', '레바논', 63], ['Thailand', '태국', 63], ['Palestine', '팔레스타인', 62], ['Korea DPR', '북한', 62], ['Kyrgyzstan', '키르기스스탄', 61],
    ['Tajikistan', '타지키스탄', 61], ['India', '인도', 60], ['Turkmenistan', '투르크메니스탄', 59], ['Malaysia', '말레이시아', 59],
    ['Philippines', '필리핀', 58], ['Indonesia', '인도네시아', 58], ['Yemen', '예멘', 57], ['Hong Kong', '홍콩', 57],
  ],
  CAF: [
    ['Senegal', '세네갈', 76], ['Morocco', '모로코', 75], ['Nigeria', '나이지리아', 74], ['Egypt', '이집트', 74], ['Algeria', '알제리', 74],
    ["Côte d'Ivoire", '코트디부아르', 74], ['Tunisia', '튀니지', 73], ['Ghana', '가나', 73], ['Cameroon', '카메룬', 73], ['Mali', '말리', 71],
    ['DR Congo', '콩고민주공화국', 71], ['Burkina Faso', '부르키나파소', 70], ['South Africa', '남아프리카공화국', 69], ['Guinea', '기니', 69],
    ['Cape Verde', '카보베르데', 68], ['Gabon', '가봉', 67], ['Uganda', '우간다', 67], ['Zambia', '잠비아', 66], ['Benin', '베냉', 66],
    ['Angola', '앙골라', 65], ['Kenya', '케냐', 64], ['Madagascar', '마다가스카르', 64], ['Zimbabwe', '짐바브웨', 64], ['Togo', '토고', 64],
    ['Mauritania', '모리타니', 63], ['Guinea-Bissau', '기니비사우', 63], ['Libya', '리비아', 63], ['Equatorial Guinea', '적도 기니', 63],
    ['Tanzania', '탄자니아', 62], ['Namibia', '나미비아', 62], ['Sierra Leone', '시에라리온', 62], ['Burundi', '부룬디', 61],
    ['Mozambique', '모잠비크', 61], ['Sudan', '수단', 60],
  ],
  OFC: [
    ['New Zealand', '뉴질랜드', 64], ['New Caledonia', '뉴칼레도니아', 55], ['Solomon Islands', '솔로몬 제도', 54], ['Fiji', '피지', 54],
    ['Tahiti', '타히티', 53], ['Papua New Guinea', '파푸아뉴기니', 52], ['Vanuatu', '바누아투', 52],
  ],
};

export const NATIONS: readonly NationData[] = (Object.keys(TABLE) as Confed[]).flatMap((confed) =>
  TABLE[confed].map(([name, nameKo, rating]) => ({ name, nameKo, confed, rating })));

const BY_NAME = new Map(NATIONS.map((n) => [n.name, n]));
/** 선수 데이터의 다른 표기 */
const ALIAS: Record<string, string> = { 'Ivory Coast': "Côte d'Ivoire", 'South Korea': 'Korea Republic', 'Korea': 'Korea Republic', USA: 'United States', Ireland: 'Republic of Ireland', Czechia: 'Czech Republic', 'Türkiye': 'Turkey' };

/** 국적 → 국가 (표에 없으면 대륙 UEFA 기본값으로 만든다) */
export function nationOf(name: string): NationData {
  const n = BY_NAME.get(ALIAS[name] ?? name);
  if (n) return n;
  return { name, nameKo: name, confed: 'UEFA', rating: CONFED_DEFAULT.UEFA };
}

export const nationsIn = (confed: Confed): NationData[] => NATIONS.filter((n) => n.confed === confed);
