// 팀별 감독·홈구장 (C.62, 18.2·C.53 남은 질문 1): 2018-19 시즌 개막 기준. 성향은 감독 신뢰도가 움직이는 방식(BALANCE.manager.styles)과
// 선수 기용(C.79i, BALANCE.selection — 선발 점수 가중)을 바꾼다
// youth = 유망주 중용(21세 이하 시작 신뢰도 +, 23세 이하 선발 가산), strict = 엄격(내려갈 때 더 크게, 신뢰도·직전 평점 크게),
// steady = 주전 고정(오르내림이 느림, 직전 경기 선발 가산), neutral = 실용(기본),
// star = 스타 중용(오버롤·이름값 위주, 폼·피로 덜 봄), competitive = 경쟁형(최근·직전 평점 크게), rotation = 로테이션(피로 크게, 연속 선발 감점)
// 감독 경질·교체는 5-2 이벤트에서 (지금은 시즌이 지나도 그대로)

import { allLeagueData } from './leagues';
import { OUTSIDE_TO_LEAGUE } from './clubAlias';

export type ManagerStyle = 'youth' | 'strict' | 'steady' | 'neutral' | 'star' | 'competitive' | 'rotation';

export interface ManagerData {
  name: string;
  nameKo: string;
  style: ManagerStyle;
  stadiumKo: string;
}

const MANAGERS_BASE: Readonly<Record<string, ManagerData>> = {
  mci: { name: 'Pep Guardiola', nameKo: '펩 과르디올라', style: 'rotation', stadiumKo: '에티하드 스타디움' },
  liv: { name: 'Jürgen Klopp', nameKo: '위르겐 클롭', style: 'steady', stadiumKo: '안필드' },
  che: { name: 'Maurizio Sarri', nameKo: '마우리치오 사리', style: 'steady', stadiumKo: '스탬퍼드 브리지' },
  tot: { name: 'Mauricio Pochettino', nameKo: '마우리시오 포체티노', style: 'star', stadiumKo: '웸블리 스타디움(임시)' },
  mun: { name: 'José Mourinho', nameKo: '조제 무리뉴', style: 'strict', stadiumKo: '올드 트래퍼드' },
  ars: { name: 'Unai Emery', nameKo: '우나이 에메리', style: 'competitive', stadiumKo: '에미레이츠 스타디움' },
  eve: { name: 'Marco Silva', nameKo: '마르쿠 실바', style: 'neutral', stadiumKo: '구디슨 파크' },
  lei: { name: 'Claude Puel', nameKo: '클로드 퓌엘', style: 'youth', stadiumKo: '킹 파워 스타디움' },
  whu: { name: 'Manuel Pellegrini', nameKo: '마누엘 펠레그리니', style: 'neutral', stadiumKo: '런던 스타디움' },
  wol: { name: 'Nuno Espírito Santo', nameKo: '누누 이스피리투 산투', style: 'steady', stadiumKo: '몰리뉴 스타디움' },
  cry: { name: 'Roy Hodgson', nameKo: '로이 호지슨', style: 'steady', stadiumKo: '셀허스트 파크' },
  wat: { name: 'Javi Gracia', nameKo: '하비 그라시아', style: 'neutral', stadiumKo: '비커리지 로드' },
  bou: { name: 'Eddie Howe', nameKo: '에디 하우', style: 'youth', stadiumKo: '바이탈리티 스타디움' },
  new: { name: 'Rafael Benítez', nameKo: '라파엘 베니테스', style: 'rotation', stadiumKo: '세인트 제임스 파크' },
  sou: { name: 'Mark Hughes', nameKo: '마크 휴스', style: 'strict', stadiumKo: '세인트 메리스 스타디움' },
  bur: { name: 'Sean Dyche', nameKo: '션 다이크', style: 'steady', stadiumKo: '터프 무어' },
  bha: { name: 'Chris Hughton', nameKo: '크리스 휴턴', style: 'steady', stadiumKo: '아멕스 스타디움' },
  ful: { name: 'Slaviša Jokanović', nameKo: '슬라비샤 요카노비치', style: 'neutral', stadiumKo: '크레이븐 코티지' },
  car: { name: 'Neil Warnock', nameKo: '닐 워녹', style: 'strict', stadiumKo: '카디프 시티 스타디움' },
  hud: { name: 'David Wagner', nameKo: '다비트 바그너', style: 'youth', stadiumKo: '존 스미스 스타디움' },
};

export const MANAGER_STYLE_KO: Readonly<Record<ManagerStyle, string>> = {
  youth: '유망주 중용', strict: '엄격', steady: '주전 고정', neutral: '실용', star: '스타 중용', competitive: '경쟁형', rotation: '로테이션',
};

/** 기용 성향 한 줄 (C.79i, 홈 주전 경쟁 카드) */
export const MANAGER_STYLE_HINT: Readonly<Record<ManagerStyle, string>> = {
  youth: '23세 이하에게 기회 — 약한 상대일수록 더',
  strict: '감독 신뢰와 직전 경기 평점이 중요',
  steady: '주전을 잘 바꾸지 않음 — 지난 경기 선발이 유리',
  neutral: '오버롤 위주, 최근 평점·피로도 고려',
  star: '오버롤·이름값 위주 — 폼과 피로는 덜 봄',
  competitive: '최근 5경기·직전 경기 평점이 중요',
  rotation: '피로를 크게 보고 연속 선발을 줄임',
};

/**
 * 리그 데이터 팀 감독 성향 (C.79i, pending 143): 2018-19 시즌 무렵 널리 알려진 기용 성향. 이름으로 찾고, 없으면 실용(neutral).
 * (안첼로티 나폴리 로테이션 · 시메오네 엄격 · 바이에른 코바치 스타 · 파브르 도르트문트 유망주 · 나겔스만·랑닉 유망주 · 사리·마르셀리노 주전 고정 등)
 */
const STYLE_BY_NAME: Readonly<Record<string, ManagerStyle>> = {
  'Carlo Ancelotti': 'rotation', 'Diego Simeone': 'strict', 'Ernesto Valverde': 'steady', 'Julen Lopetegui': 'competitive',
  'Massimiliano Allegri': 'rotation', 'Niko Kovač': 'star', 'Lucien Favre': 'youth', 'Julian Nagelsmann': 'youth',
  'Ralf Rangnick': 'youth', 'Thomas Tuchel': 'rotation', 'Leonardo Jardim': 'youth', 'Marcelino': 'steady',
  'Luciano Spalletti': 'strict', 'Gennaro Gattuso': 'competitive', 'Gian Piero Gasperini': 'competitive', 'Eusebio Di Francesco': 'youth',
  'Simone Inzaghi': 'steady', 'Jorge Jesus': 'strict', 'Domenico Tedesco': 'youth', 'Christian Streich': 'steady',
  'Adi Hütter': 'competitive', 'Bruno Génésio': 'youth', 'Christophe Galtier': 'strict', 'Quique Setién': 'steady',
  'José Bordalás': 'strict', 'Walter Mazzarri': 'strict', 'Roberto De Zerbi': 'youth', 'Rudi Garcia': 'star',
  'Patrick Vieira': 'youth', 'Ange Postecoglou': 'competitive', 'Gerardo Martino': 'star', 'Jesse Marsch': 'youth',
  'Hwang Sun-hong': 'strict', 'Choi Kang-hee': 'steady', 'Pablo Machín': 'competitive', 'Rubi': 'competitive',
};

/**
 * 표 + 리그 데이터 팀 감독 (C.76c, 45b): 리그 데이터는 이름·홈구장만 있어 성향은 STYLE_BY_NAME(C.79i), 없으면 실용(neutral).
 * 리그 밖 x: 클럽은 같은 클럽의 리그 데이터 감독
 */
export const MANAGERS: Readonly<Record<string, ManagerData>> = (() => {
  const out: Record<string, ManagerData> = { ...MANAGERS_BASE };
  for (const d of allLeagueData()) {
    for (const t of d.teams) {
      if (out[t.id] || !t.manager) continue;
      out[t.id] = { name: t.manager, nameKo: t.managerKo ?? t.manager, style: STYLE_BY_NAME[t.manager] ?? 'neutral', stadiumKo: t.stadiumKo ?? t.stadium ?? '' };
    }
  }
  for (const [x, l] of Object.entries(OUTSIDE_TO_LEAGUE)) if (out[l] && !out[x]) out[x] = out[l]!;
  return out;
})();

/** 리그 밖·가상 구단은 데이터가 없어 null (화면은 "감독 정보 없음") */
export function managerOf(teamId: string): ManagerData | null {
  return MANAGERS[teamId] ?? null;
}
