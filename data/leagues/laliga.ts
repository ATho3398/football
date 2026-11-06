import type { LeagueData } from './types';

// 라리가 2018-19 (45d1, 부록 C.75n). 데이터만 — 게임 연결은 45a·45b.
// 레이팅은 PL 척도(맨시티 85 ~ 허더즈필드 67)에 맞춘 상대 전력. 리그 밖 표(data/outsideClubs.ts)에 있는 클럽
// (바르셀로나 86·레알 85·아틀레티코 82·발렌시아 77·세비야 76·비야레알 74)은 이름·레이팅을 그대로 맞췄다.
// 감독 = 시즌 개막 감독 (레알 로페테기, 세비야 마친, 셀타 모하메드 등은 시즌 중 교체). 순서 = 2018-19 최종 순위.
export const LEAGUE: LeagueData = {
  id: 'laliga',
  name: 'La Liga',
  nameKo: '라리가',
  country: 'Spain',
  tier: 1,
  season: '2018-19',
  calendar: 'autumn-spring',
  teams: [
    { id: 'laliga:bar', name: 'FC Barcelona', nameKo: '바르셀로나', rating: 86, city: 'Barcelona', colors: { primary: '#a50044', secondary: '#004d98' }, manager: 'Ernesto Valverde', managerKo: '에르네스토 발베르데', stadium: 'Camp Nou', stadiumKo: '캄 노우' },
    { id: 'laliga:atm', name: 'Atlético Madrid', nameKo: '아틀레티코 마드리드', rating: 82, city: 'Madrid', colors: { primary: '#cb3524', secondary: '#272e61' }, manager: 'Diego Simeone', managerKo: '디에고 시메오네', stadium: 'Wanda Metropolitano', stadiumKo: '완다 메트로폴리타노' },
    { id: 'laliga:rma', name: 'Real Madrid', nameKo: '레알 마드리드', rating: 85, city: 'Madrid', colors: { primary: '#ffffff', secondary: '#febe10' }, manager: 'Julen Lopetegui', managerKo: '훌렌 로페테기', stadium: 'Santiago Bernabéu', stadiumKo: '산티아고 베르나베우' },
    { id: 'laliga:val', name: 'Valencia', nameKo: '발렌시아', rating: 77, city: 'Valencia', colors: { primary: '#ffffff', secondary: '#ee3524' }, manager: 'Marcelino', managerKo: '마르셀리노', stadium: 'Mestalla', stadiumKo: '메스타야' },
    { id: 'laliga:get', name: 'Getafe', nameKo: '헤타페', rating: 73, city: 'Getafe', colors: { primary: '#005999', secondary: '#ffffff' }, manager: 'José Bordalás', managerKo: '호세 보르달라스', stadium: 'Coliseum Alfonso Pérez', stadiumKo: '콜리세움 알폰소 페레스' },
    { id: 'laliga:sev', name: 'Sevilla', nameKo: '세비야', rating: 76, city: 'Seville', colors: { primary: '#ffffff', secondary: '#d4021d' }, manager: 'Pablo Machín', managerKo: '파블로 마친', stadium: 'Ramón Sánchez Pizjuán', stadiumKo: '라몬 산체스 피스후안' },
    { id: 'laliga:esp', name: 'Espanyol', nameKo: '에스파뇰', rating: 72, city: 'Barcelona', colors: { primary: '#007fc8', secondary: '#ffffff' }, manager: 'Rubi', managerKo: '루비', stadium: 'RCDE Stadium', stadiumKo: 'RCDE 스타디움' },
    { id: 'laliga:ath', name: 'Athletic Bilbao', nameKo: '아틀레틱 빌바오', rating: 73, city: 'Bilbao', colors: { primary: '#ee2523', secondary: '#ffffff' }, manager: 'Eduardo Berizzo', managerKo: '에두아르도 베리소', stadium: 'San Mamés', stadiumKo: '산 마메스' },
    { id: 'laliga:rso', name: 'Real Sociedad', nameKo: '레알 소시에다드', rating: 74, city: 'San Sebastián', colors: { primary: '#0067b1', secondary: '#ffffff' }, manager: 'Asier Garitano', managerKo: '아시에르 가리타노', stadium: 'Anoeta', stadiumKo: '아노에타' },
    { id: 'laliga:bet', name: 'Real Betis', nameKo: '레알 베티스', rating: 75, city: 'Seville', colors: { primary: '#00954c', secondary: '#ffffff' }, manager: 'Quique Setién', managerKo: '키케 세티엔', stadium: 'Benito Villamarín', stadiumKo: '베니토 비야마린' },
    { id: 'laliga:ala', name: 'Alavés', nameKo: '알라베스', rating: 70, city: 'Vitoria-Gasteiz', colors: { primary: '#0761af', secondary: '#ffffff' }, manager: 'Abelardo', managerKo: '아벨라르도', stadium: 'Mendizorrotza', stadiumKo: '멘디소로차' },
    { id: 'laliga:eib', name: 'Eibar', nameKo: '에이바르', rating: 71, city: 'Eibar', colors: { primary: '#004b9d', secondary: '#a6192e' }, manager: 'José Luis Mendilibar', managerKo: '호세 루이스 멘딜리바르', stadium: 'Ipurua', stadiumKo: '이푸루아' },
    { id: 'laliga:leg', name: 'Leganés', nameKo: '레가네스', rating: 70, city: 'Leganés', colors: { primary: '#ffffff', secondary: '#0055a4' }, manager: 'Mauricio Pellegrino', managerKo: '마우리시오 펠레그리노', stadium: 'Butarque', stadiumKo: '부타르케' },
    { id: 'laliga:vil', name: 'Villarreal', nameKo: '비야레알', rating: 74, city: 'Villarreal', colors: { primary: '#ffe667', secondary: '#005187' }, manager: 'Javier Calleja', managerKo: '하비에르 카예하', stadium: 'Estadio de la Cerámica', stadiumKo: '에스타디오 데 라 세라미카' },
    { id: 'laliga:lev', name: 'Levante', nameKo: '레반테', rating: 70, city: 'Valencia', colors: { primary: '#004d98', secondary: '#b4053f' }, manager: 'Paco López', managerKo: '파코 로페스', stadium: 'Ciutat de València', stadiumKo: '시우타트 데 발렌시아' },
    { id: 'laliga:vll', name: 'Real Valladolid', nameKo: '레알 바야돌리드', rating: 69, city: 'Valladolid', colors: { primary: '#921b88', secondary: '#ffffff' }, manager: 'Sergio González', managerKo: '세르히오 곤살레스', stadium: 'José Zorrilla', stadiumKo: '호세 소리야' },
    { id: 'laliga:cel', name: 'Celta Vigo', nameKo: '셀타 비고', rating: 72, city: 'Vigo', colors: { primary: '#8ac3ee', secondary: '#e5254e' }, manager: 'Antonio Mohamed', managerKo: '안토니오 모하메드', stadium: 'Balaídos', stadiumKo: '발라이도스' },
    { id: 'laliga:gir', name: 'Girona', nameKo: '지로나', rating: 70, city: 'Girona', colors: { primary: '#cd2534', secondary: '#ffffff' }, manager: 'Eusebio Sacristán', managerKo: '에우세비오 사크리스탄', stadium: 'Montilivi', stadiumKo: '몬틸리비' },
    { id: 'laliga:hue', name: 'Huesca', nameKo: '우에스카', rating: 68, city: 'Huesca', colors: { primary: '#0a2a6b', secondary: '#c8102e' }, manager: 'Leo Franco', managerKo: '레오 프랑코', stadium: 'El Alcoraz', stadiumKo: '엘 알코라스' },
    { id: 'laliga:ray', name: 'Rayo Vallecano', nameKo: '라요 바예카노', rating: 68, city: 'Madrid', colors: { primary: '#ffffff', secondary: '#e30613' }, manager: 'Míchel', managerKo: '미첼', stadium: 'Estadio de Vallecas', stadiumKo: '바예카스' },
  ],
  derbies: [
    ['laliga:bar', 'laliga:rma', '엘 클라시코'],
    ['laliga:rma', 'laliga:atm', '마드리드 더비'],
    ['laliga:sev', 'laliga:bet', '세비야 더비'],
    ['laliga:bar', 'laliga:esp', '바르셀로나 더비'],
    ['laliga:ath', 'laliga:rso', '바스크 더비'],
    ['laliga:val', 'laliga:lev', '발렌시아 더비'],
    ['laliga:val', 'laliga:vil', '발렌시아 지방 더비'],
    ['laliga:get', 'laliga:leg', '마드리드 남부 더비'],
    ['laliga:ath', 'laliga:ala', '바스크 더비'],
    ['laliga:rso', 'laliga:eib', '기푸스코아 더비'],
  ],
};
