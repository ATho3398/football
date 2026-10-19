// 팀별 감독·홈구장 (C.62, 18.2·C.53 남은 질문 1): 2018-19 시즌 개막 기준. 성향은 감독 신뢰도가 움직이는 방식만 바꾼다 (BALANCE.manager.styles)
// youth = 유망주 중용(21세 이하 시작 신뢰도 +), strict = 엄격(내려갈 때 더 크게), steady = 주전 고정(오르내림이 느림), neutral = 실용(기본)
// 감독 경질·교체는 5-2 이벤트에서 (지금은 시즌이 지나도 그대로)

export type ManagerStyle = 'youth' | 'strict' | 'steady' | 'neutral';

export interface ManagerData {
  name: string;
  nameKo: string;
  style: ManagerStyle;
  stadiumKo: string;
}

export const MANAGERS: Readonly<Record<string, ManagerData>> = {
  mci: { name: 'Pep Guardiola', nameKo: '펩 과르디올라', style: 'youth', stadiumKo: '에티하드 스타디움' },
  liv: { name: 'Jürgen Klopp', nameKo: '위르겐 클롭', style: 'steady', stadiumKo: '안필드' },
  che: { name: 'Maurizio Sarri', nameKo: '마우리치오 사리', style: 'steady', stadiumKo: '스탬퍼드 브리지' },
  tot: { name: 'Mauricio Pochettino', nameKo: '마우리시오 포체티노', style: 'youth', stadiumKo: '웸블리 스타디움(임시)' },
  mun: { name: 'José Mourinho', nameKo: '조제 무리뉴', style: 'strict', stadiumKo: '올드 트래퍼드' },
  ars: { name: 'Unai Emery', nameKo: '우나이 에메리', style: 'neutral', stadiumKo: '에미레이츠 스타디움' },
  eve: { name: 'Marco Silva', nameKo: '마르쿠 실바', style: 'neutral', stadiumKo: '구디슨 파크' },
  lei: { name: 'Claude Puel', nameKo: '클로드 퓌엘', style: 'youth', stadiumKo: '킹 파워 스타디움' },
  whu: { name: 'Manuel Pellegrini', nameKo: '마누엘 펠레그리니', style: 'neutral', stadiumKo: '런던 스타디움' },
  wol: { name: 'Nuno Espírito Santo', nameKo: '누누 이스피리투 산투', style: 'steady', stadiumKo: '몰리뉴 스타디움' },
  cry: { name: 'Roy Hodgson', nameKo: '로이 호지슨', style: 'steady', stadiumKo: '셀허스트 파크' },
  wat: { name: 'Javi Gracia', nameKo: '하비 그라시아', style: 'neutral', stadiumKo: '비커리지 로드' },
  bou: { name: 'Eddie Howe', nameKo: '에디 하우', style: 'youth', stadiumKo: '바이탈리티 스타디움' },
  new: { name: 'Rafael Benítez', nameKo: '라파엘 베니테스', style: 'strict', stadiumKo: '세인트 제임스 파크' },
  sou: { name: 'Mark Hughes', nameKo: '마크 휴스', style: 'strict', stadiumKo: '세인트 메리스 스타디움' },
  bur: { name: 'Sean Dyche', nameKo: '션 다이크', style: 'steady', stadiumKo: '터프 무어' },
  bha: { name: 'Chris Hughton', nameKo: '크리스 휴턴', style: 'steady', stadiumKo: '아멕스 스타디움' },
  ful: { name: 'Slaviša Jokanović', nameKo: '슬라비샤 요카노비치', style: 'neutral', stadiumKo: '크레이븐 코티지' },
  car: { name: 'Neil Warnock', nameKo: '닐 워녹', style: 'strict', stadiumKo: '카디프 시티 스타디움' },
  hud: { name: 'David Wagner', nameKo: '다비트 바그너', style: 'youth', stadiumKo: '존 스미스 스타디움' },
};

export const MANAGER_STYLE_KO: Readonly<Record<ManagerStyle, string>> = {
  youth: '유망주 중용', strict: '엄격', steady: '주전 고정', neutral: '실용',
};

/** 리그 밖·가상 구단은 데이터가 없어 null (화면은 "감독 정보 없음") */
export function managerOf(teamId: string): ManagerData | null {
  return MANAGERS[teamId] ?? null;
}
