import type { LeagueData } from './types';

// 리그 1 2018-19 (45d2단계, 부록 C.75o): 실제 참가 20팀. 게임에는 아직 연결하지 않는다 (45a·45b).
// 레이팅은 PL 2018 척도(맨시티 85 ~ 허더즈필드 67)에 맞춘 상대 전력 추정치. PSG 외에는 PL 중위권 이하 수준으로 본다.
// 리그 밖 표(data/outsideClubs.ts)에 있는 클럽은 같은 레이팅 (PSG 84·리옹 76·모나코 74). 감독 = 2018-19 개막 감독.

export const LEAGUE: LeagueData = {
  id: 'ligue1',
  name: 'Ligue 1',
  nameKo: '리그 1',
  country: 'France',
  tier: 1,
  season: '2018-19',
  calendar: 'autumn-spring',
  teams: [
    { id: 'ligue1:psg', name: 'Paris Saint-Germain', nameKo: '파리 생제르맹', rating: 84, city: 'Paris', colors: { primary: '#004170', secondary: '#da291c' }, manager: 'Thomas Tuchel', managerKo: '토마스 투헬', stadium: 'Parc des Princes', stadiumKo: '파르크 데 프랭스' },
    { id: 'ligue1:lyo', name: 'Olympique Lyonnais', nameKo: '올랭피크 리옹', rating: 76, city: 'Lyon', colors: { primary: '#ffffff', secondary: '#1a3e8c' }, manager: 'Bruno Génésio', managerKo: '브뤼노 제네시오', stadium: 'Groupama Stadium', stadiumKo: '그루파마 스타디움' },
    { id: 'ligue1:mar', name: 'Olympique de Marseille', nameKo: '올랭피크 마르세유', rating: 75, city: 'Marseille', colors: { primary: '#ffffff', secondary: '#2faee0' }, manager: 'Rudi Garcia', managerKo: '뤼디 가르시아', stadium: 'Orange Vélodrome', stadiumKo: '오랑주 벨로드롬' },
    { id: 'ligue1:asm', name: 'AS Monaco', nameKo: 'AS 모나코', rating: 74, city: 'Monaco', colors: { primary: '#e7001b', secondary: '#ffffff' }, manager: 'Leonardo Jardim', managerKo: '레오나르두 자르딩', stadium: 'Stade Louis II', stadiumKo: '스타드 루이 2세' },
    { id: 'ligue1:lil', name: 'Lille', nameKo: '릴', rating: 73, city: 'Lille', colors: { primary: '#e01e13', secondary: '#20325f' }, manager: 'Christophe Galtier', managerKo: '크리스토프 갈티에', stadium: 'Stade Pierre-Mauroy', stadiumKo: '스타드 피에르 모루아' },
    { id: 'ligue1:ase', name: 'Saint-Étienne', nameKo: '생테티엔', rating: 72, city: 'Saint-Étienne', colors: { primary: '#009639', secondary: '#ffffff' }, manager: 'Jean-Louis Gasset', managerKo: '장루이 가세', stadium: 'Stade Geoffroy-Guichard', stadiumKo: '스타드 조프루아 기샤르' },
    { id: 'ligue1:ren', name: 'Stade Rennais', nameKo: '스타드 렌', rating: 71, city: 'Rennes', colors: { primary: '#e13327', secondary: '#000000' }, manager: 'Sabri Lamouchi', managerKo: '사브리 라무시', stadium: 'Roazhon Park', stadiumKo: '로아종 파르크' },
    { id: 'ligue1:nic', name: 'OGC Nice', nameKo: 'OGC 니스', rating: 71, city: 'Nice', colors: { primary: '#c8102e', secondary: '#000000' }, manager: 'Patrick Vieira', managerKo: '파트리크 비에이라', stadium: 'Allianz Riviera', stadiumKo: '알리안츠 리비에라' },
    { id: 'ligue1:bor', name: 'Bordeaux', nameKo: '보르도', rating: 70, city: 'Bordeaux', colors: { primary: '#1a2a4e', secondary: '#ffffff' }, manager: 'Gustavo Poyet', managerKo: '구스타보 포예트', stadium: 'Matmut Atlantique', stadiumKo: '마트뮈 아틀랑티크' },
    { id: 'ligue1:mtp', name: 'Montpellier', nameKo: '몽펠리에', rating: 70, city: 'Montpellier', colors: { primary: '#1e3a8a', secondary: '#f47920' }, manager: 'Michel Der Zakarian', managerKo: '미셸 데르 자카리앙', stadium: 'Stade de la Mosson', stadiumKo: '스타드 드 라 모송' },
    { id: 'ligue1:nan', name: 'Nantes', nameKo: '낭트', rating: 69, city: 'Nantes', colors: { primary: '#fcd405', secondary: '#00843d' }, manager: 'Miguel Cardoso', managerKo: '미겔 카르도주', stadium: 'Stade de la Beaujoire', stadiumKo: '스타드 드 라 보주아르' },
    { id: 'ligue1:str', name: 'Strasbourg', nameKo: '스트라스부르', rating: 69, city: 'Strasbourg', colors: { primary: '#009fe3', secondary: '#ffffff' }, manager: 'Thierry Laurey', managerKo: '티에리 로레', stadium: 'Stade de la Meinau', stadiumKo: '스타드 드 라 메노' },
    { id: 'ligue1:tou', name: 'Toulouse', nameKo: '툴루즈', rating: 68, city: 'Toulouse', colors: { primary: '#5b2b82', secondary: '#ffffff' }, manager: 'Alain Casanova', managerKo: '알랭 카사노바', stadium: 'Stadium de Toulouse', stadiumKo: '스타디움 드 툴루즈' },
    { id: 'ligue1:ang', name: 'Angers', nameKo: '앙제', rating: 68, city: 'Angers', colors: { primary: '#000000', secondary: '#ffffff' }, manager: 'Stéphane Moulin', managerKo: '스테판 물랭', stadium: 'Stade Raymond Kopa', stadiumKo: '스타드 레몽 코파' },
    { id: 'ligue1:rei', name: 'Reims', nameKo: '랭스', rating: 68, city: 'Reims', colors: { primary: '#e1001a', secondary: '#ffffff' }, manager: 'David Guion', managerKo: '다비드 기옹', stadium: 'Stade Auguste-Delaune', stadiumKo: '스타드 오귀스트 들론' },
    { id: 'ligue1:nim', name: 'Nîmes', nameKo: '님', rating: 67, city: 'Nîmes', colors: { primary: '#e2001a', secondary: '#ffffff' }, manager: 'Bernard Blaquart', managerKo: '베르나르 블라카르', stadium: 'Stade des Costières', stadiumKo: '스타드 데 코스티에르' },
    { id: 'ligue1:cae', name: 'Caen', nameKo: '캉', rating: 66, city: 'Caen', colors: { primary: '#1b3c8f', secondary: '#e2001a' }, manager: 'Fabien Mercadal', managerKo: '파비앵 메르카달', stadium: "Stade Michel d'Ornano", stadiumKo: '스타드 미셸 도르나노' },
    { id: 'ligue1:dij', name: 'Dijon', nameKo: '디종', rating: 66, city: 'Dijon', colors: { primary: '#d4001f', secondary: '#ffffff' }, manager: "Olivier Dall'Oglio", managerKo: '올리비에 달롤리오', stadium: 'Stade Gaston-Gérard', stadiumKo: '스타드 가스통 제라르' },
    { id: 'ligue1:ami', name: 'Amiens', nameKo: '아미앵', rating: 66, city: 'Amiens', colors: { primary: '#ffffff', secondary: '#000000' }, manager: 'Christophe Pélissier', managerKo: '크리스토프 펠리시에', stadium: 'Stade de la Licorne', stadiumKo: '스타드 드 라 리코른' },
    { id: 'ligue1:gui', name: 'Guingamp', nameKo: '갱강', rating: 65, city: 'Guingamp', colors: { primary: '#e2001a', secondary: '#000000' }, manager: 'Antoine Kombouaré', managerKo: '앙투안 콩부아레', stadium: 'Stade du Roudourou', stadiumKo: '스타드 뒤 루두루' },
  ],
  derbies: [
    ['ligue1:psg', 'ligue1:mar', '르 클라시크'],
    ['ligue1:lyo', 'ligue1:ase', '론 더비'],
    ['ligue1:lyo', 'ligue1:mar', '올랭피코'],
    ['ligue1:nic', 'ligue1:asm', '코트다쥐르 더비'],
    ['ligue1:ren', 'ligue1:nan', '브르타뉴 더비'],
    ['ligue1:ren', 'ligue1:gui', '브르타뉴 더비'],
    ['ligue1:nan', 'ligue1:bor', '대서양 더비'],
    ['ligue1:mtp', 'ligue1:nim', '랑그도크 더비'],
    ['ligue1:tou', 'ligue1:bor', '가론 더비'],
  ],
};
