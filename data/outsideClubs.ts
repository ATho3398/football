// 리그 밖 클럽 (18.6, 부록 C.42): 가상 레이팅 팀 풀. 리그 선수가 나가는 목적지이자 빈자리를 채우는 선수의 공급원.
// 로스터는 만들지 않는다 (경기가 없다). 레이팅은 2018-19 기준 초기 추정치

export interface OutsideClub {
  id: string;
  name: string;
  nameKo: string;
  rating: number;
}

export const OUTSIDE_CLUBS: readonly OutsideClub[] = [
  { id: 'x:bar', name: 'FC Barcelona', nameKo: '바르셀로나', rating: 86 },
  { id: 'x:rma', name: 'Real Madrid', nameKo: '레알 마드리드', rating: 85 },
  { id: 'x:juv', name: 'Juventus', nameKo: '유벤투스', rating: 85 },
  { id: 'x:bay', name: 'Bayern München', nameKo: '바이에른 뮌헨', rating: 84 },
  { id: 'x:psg', name: 'Paris Saint-Germain', nameKo: '파리 생제르맹', rating: 84 },
  { id: 'x:atm', name: 'Atlético Madrid', nameKo: '아틀레티코 마드리드', rating: 82 },
  { id: 'x:bvb', name: 'Borussia Dortmund', nameKo: '도르트문트', rating: 80 },
  { id: 'x:nap', name: 'Napoli', nameKo: '나폴리', rating: 80 },
  { id: 'x:int', name: 'Inter', nameKo: '인테르', rating: 79 },
  { id: 'x:rom', name: 'Roma', nameKo: '로마', rating: 78 },
  { id: 'x:mil', name: 'AC Milan', nameKo: 'AC 밀란', rating: 77 },
  { id: 'x:b04', name: 'Bayer Leverkusen', nameKo: '레버쿠젠', rating: 77 },
  { id: 'x:sev', name: 'Sevilla', nameKo: '세비야', rating: 76 },
  { id: 'x:ol', name: 'Olympique Lyonnais', nameKo: '리옹', rating: 76 },
  { id: 'x:ajx', name: 'Ajax', nameKo: '아약스', rating: 76 },
  { id: 'x:fcp', name: 'FC Porto', nameKo: '포르투', rating: 76 },
  { id: 'x:slb', name: 'Benfica', nameKo: '벤피카', rating: 75 },
  { id: 'x:vil', name: 'Villarreal', nameKo: '비야레알', rating: 74 },
  { id: 'x:zen', name: 'Zenit', nameKo: '제니트', rating: 74 },
  { id: 'x:asm', name: 'AS Monaco', nameKo: 'AS 모나코', rating: 74 },
  { id: 'x:gal', name: 'Galatasaray', nameKo: '갈라타사라이', rating: 72 },
  { id: 'x:cel', name: 'Celtic', nameKo: '셀틱', rating: 71 },
  { id: 'x:psv', name: 'PSV', nameKo: 'PSV', rating: 72 },
  { id: 'x:avl', name: 'Aston Villa', nameKo: '애스턴 빌라', rating: 69 },
  { id: 'x:wba', name: 'West Bromwich Albion', nameKo: '웨스트 브로미치', rating: 68 },
  { id: 'x:lee', name: 'Leeds United', nameKo: '리즈 유나이티드', rating: 68 },
  { id: 'x:sto', name: 'Stoke City', nameKo: '스토크 시티', rating: 67 },
  { id: 'x:der', name: 'Derby County', nameKo: '더비 카운티', rating: 66 },
  { id: 'x:nor', name: 'Norwich City', nameKo: '노리치 시티', rating: 65 },
  { id: 'x:bri', name: 'Bristol City', nameKo: '브리스틀 시티', rating: 64 },
  { id: 'x:not', name: 'Nottingham Forest', nameKo: '노팅엄 포리스트', rating: 64 },
  { id: 'x:mid', name: 'Middlesbrough', nameKo: '미들즈브러', rating: 65 },
  { id: 'x:ipw', name: 'Ipswich Town', nameKo: '입스위치 타운', rating: 60 },
  { id: 'x:wig', name: 'Wigan Athletic', nameKo: '위건 애슬레틱', rating: 60 },
];

export const OUTSIDE_BY_ID: Readonly<Record<string, OutsideClub>> = Object.fromEntries(OUTSIDE_CLUBS.map((c) => [c.id, c]));

/**
 * 컵 전용 클럽 (C.67a): 이적 목적지가 아니고 컵 경기에만 나온다 (OUTSIDE_CLUBS 에 넣으면 NPC 이적 결과가 바뀐다).
 * FA컵 하부 가상 12팀 = 리그 밖 잉글랜드 클럽 11 + 이 목록
 */
export const CUP_ONLY_CLUBS: readonly OutsideClub[] = [
  { id: 'x:swa', name: 'Swansea City', nameKo: '스완지 시티', rating: 64 },
];

/** FA컵 하부 가상 팀 (리그 밖 잉글랜드 클럽, 레이팅 순) */
export const FA_CUP_EXTRA: readonly string[] = ['x:avl', 'x:wba', 'x:lee', 'x:sto', 'x:der', 'x:mid', 'x:nor', 'x:bri', 'x:not', 'x:swa', 'x:ipw', 'x:wig'];

/** 경기에 나올 수 있는 리그 밖 클럽 전체 (이름·레이팅 조회) */
export const CLUB_BY_ID: Readonly<Record<string, OutsideClub>> = Object.fromEntries([...OUTSIDE_CLUBS, ...CUP_ONLY_CLUBS].map((c) => [c.id, c]));
