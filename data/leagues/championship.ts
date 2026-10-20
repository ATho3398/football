import type { LeagueData, LeagueTeamData } from './types';

// EFL 챔피언십 2018-19 (C.75p, 45d3): 실제 참가 24팀. 레이팅은 PL 척도(맨시티 85 ~ 허더즈필드 67).
// 리그 밖 표(data/outsideClubs.ts)에 있는 12팀은 이름·레이팅을 그대로 맞췄다(빌라 69 ~ 위건 60). 나머지는 2018-19 성적·예산 기준 추정.
// 감독 = 2018-19 개막 감독. 팀 행: [3글자, 영문, 한글, 레이팅, 도시, 주 색, 보조 색, 감독, 감독 한글, 홈구장, 홈구장 한글]

type T = [code: string, name: string, nameKo: string, rating: number, city: string, primary: string, secondary: string,
  manager: string, managerKo: string, stadium: string, stadiumKo: string];

const ID = 'championship';

const TEAMS: T[] = [
  ['avl', 'Aston Villa', '애스턴 빌라', 69, 'Birmingham', '#670e36', '#95bfe5', 'Steve Bruce', '스티브 브루스', 'Villa Park', '빌라 파크'],
  ['wba', 'West Bromwich Albion', '웨스트 브로미치', 68, 'West Bromwich', '#122f67', '#ffffff', 'Darren Moore', '대런 무어', 'The Hawthorns', '더 호손스'],
  ['lee', 'Leeds United', '리즈 유나이티드', 68, 'Leeds', '#ffffff', '#1d428a', 'Marcelo Bielsa', '마르셀로 비엘사', 'Elland Road', '엘런드 로드'],
  ['sto', 'Stoke City', '스토크 시티', 67, 'Stoke-on-Trent', '#e03a3e', '#ffffff', 'Gary Rowett', '개리 로웻', 'bet365 Stadium', 'bet365 스타디움'],
  ['der', 'Derby County', '더비 카운티', 66, 'Derby', '#ffffff', '#000000', 'Frank Lampard', '프랭크 램파드', 'Pride Park', '프라이드 파크'],
  ['mid', 'Middlesbrough', '미들즈브러', 65, 'Middlesbrough', '#e11b22', '#ffffff', 'Tony Pulis', '토니 풀리스', 'Riverside Stadium', '리버사이드 스타디움'],
  ['nor', 'Norwich City', '노리치 시티', 65, 'Norwich', '#fff200', '#00a650', 'Daniel Farke', '다니엘 파르케', 'Carrow Road', '캐로 로드'],
  ['bri', 'Bristol City', '브리스틀 시티', 64, 'Bristol', '#e21b23', '#ffffff', 'Lee Johnson', '리 존슨', 'Ashton Gate', '애슈턴 게이트'],
  ['not', 'Nottingham Forest', '노팅엄 포리스트', 64, 'Nottingham', '#dd0000', '#ffffff', 'Aitor Karanka', '아이토르 카랑카', 'City Ground', '시티 그라운드'],
  ['swa', 'Swansea City', '스완지 시티', 64, 'Swansea', '#ffffff', '#000000', 'Graham Potter', '그레이엄 포터', 'Liberty Stadium', '리버티 스타디움'],
  ['shu', 'Sheffield United', '셰필드 유나이티드', 64, 'Sheffield', '#ee2737', '#ffffff', 'Chris Wilder', '크리스 와일더', 'Bramall Lane', '브러멀 레인'],
  ['bre', 'Brentford', '브렌트퍼드', 63, 'London', '#e30613', '#ffffff', 'Dean Smith', '딘 스미스', 'Griffin Park', '그리핀 파크'],
  ['bla', 'Blackburn Rovers', '블랙번 로버스', 62, 'Blackburn', '#009ee0', '#ffffff', 'Tony Mowbray', '토니 모브레이', 'Ewood Park', '이우드 파크'],
  ['bir', 'Birmingham City', '버밍엄 시티', 62, 'Birmingham', '#1c3f94', '#ffffff', 'Garry Monk', '개리 몽크', "St Andrew's", '세인트 앤드루스'],
  ['pre', 'Preston North End', '프레스턴 노스엔드', 62, 'Preston', '#ffffff', '#002855', 'Alex Neil', '알렉스 닐', 'Deepdale', '딥데일'],
  ['shw', 'Sheffield Wednesday', '셰필드 웬즈데이', 62, 'Sheffield', '#2c4fa1', '#ffffff', 'Jos Luhukay', '요스 루후카이', 'Hillsborough', '힐즈버러'],
  ['hul', 'Hull City', '헐 시티', 61, 'Hull', '#f5a12d', '#000000', 'Nigel Adkins', '나이절 앳킨스', 'KCOM Stadium', 'KCOM 스타디움'],
  ['qpr', 'Queens Park Rangers', '퀸스 파크 레인저스', 61, 'London', '#1d5ba4', '#ffffff', 'Steve McClaren', '스티브 매클래런', 'Loftus Road', '로프터스 로드'],
  ['mil', 'Millwall', '밀월', 61, 'London', '#001d5e', '#ffffff', 'Neil Harris', '닐 해리스', 'The Den', '더 덴'],
  ['ipw', 'Ipswich Town', '입스위치 타운', 60, 'Ipswich', '#3a64a3', '#ffffff', 'Paul Hurst', '폴 허스트', 'Portman Road', '포트먼 로드'],
  ['wig', 'Wigan Athletic', '위건 애슬레틱', 60, 'Wigan', '#1d59af', '#ffffff', 'Paul Cook', '폴 쿡', 'DW Stadium', 'DW 스타디움'],
  ['rea', 'Reading', '레딩', 60, 'Reading', '#004494', '#ffffff', 'Paul Clement', '폴 클레멘트', 'Madejski Stadium', '마데스키 스타디움'],
  ['bol', 'Bolton Wanderers', '볼턴 원더러스', 58, 'Bolton', '#ffffff', '#263c7e', 'Phil Parkinson', '필 파킨슨', 'University of Bolton Stadium', '볼턴 대학교 스타디움'],
  ['rot', 'Rotherham United', '로더럼 유나이티드', 58, 'Rotherham', '#e21b23', '#ffffff', 'Paul Warne', '폴 원', 'New York Stadium', '뉴욕 스타디움'],
];

const id = (c: string): string => `${ID}:${c}`;

export const LEAGUE: LeagueData = {
  id: ID,
  name: 'EFL Championship',
  nameKo: '챔피언십',
  country: 'England',
  tier: 2,
  season: '2018-19',
  calendar: 'autumn-spring',
  teams: TEAMS.map(([code, name, nameKo, rating, city, primary, secondary, manager, managerKo, stadium, stadiumKo]): LeagueTeamData => ({
    id: id(code), name, nameKo, rating, city, colors: { primary, secondary }, manager, managerKo, stadium, stadiumKo,
  })),
  derbies: [
    [id('avl'), id('bir'), '세컨드 시티 더비'],
    [id('shu'), id('shw'), '스틸 시티 더비'],
    [id('der'), id('not'), '이스트 미들랜즈 더비'],
    [id('nor'), id('ipw'), '이스트 앵글리아 더비'],
    [id('bla'), id('pre'), '랭커셔 더비'],
    [id('bla'), id('bol'), '랭커셔 더비'],
    [id('bre'), id('qpr'), '웨스트 런던 더비'],
    [id('lee'), id('mil'), '리즈·밀월 라이벌'],
    [id('avl'), id('wba'), '미들랜즈 더비'],
    [id('bir'), id('wba'), '미들랜즈 더비'],
    [id('rot'), id('shu'), '사우스 요크셔 더비'],
    [id('rot'), id('shw'), '사우스 요크셔 더비'],
    [id('lee'), id('shw'), '요크셔 더비'],
    [id('bri'), id('swa'), '세번 강 더비'],
  ],
};
