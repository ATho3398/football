import type { LeagueData, LeagueTeamData } from './types';

// 2. 분데스리가 2018-19 (C.75p, 45d3): 실제 참가 18팀. 레이팅은 PL 척도(맨시티 85 ~ 허더즈필드 67).
// 강등팀 쾰른·함부르크 64 ~ 승격팀 마그데부르크 56: 챔피언십보다 한 단계 낮게 잡았다(리그 밖 표에는 독일 2부 팀이 없다).
// 감독 = 2018-19 개막 감독. 팀 행: [3글자, 영문, 한글, 레이팅, 도시, 주 색, 보조 색, 감독, 감독 한글, 홈구장, 홈구장 한글]

type T = [code: string, name: string, nameKo: string, rating: number, city: string, primary: string, secondary: string,
  manager: string, managerKo: string, stadium: string, stadiumKo: string];

const ID = 'bundesliga2';

const TEAMS: T[] = [
  ['koe', '1. FC Köln', '쾰른', 64, 'Cologne', '#ed1c24', '#ffffff', 'Markus Anfang', '마르쿠스 안팡', 'RheinEnergieStadion', '라인에네르기 슈타디온'],
  ['hsv', 'Hamburger SV', '함부르크 SV', 64, 'Hamburg', '#005ca9', '#ffffff', 'Christian Titz', '크리스티안 티츠', 'Volksparkstadion', '폴크스파르크슈타디온'],
  ['fcu', '1. FC Union Berlin', '우니온 베를린', 62, 'Berlin', '#eb1923', '#ffffff', 'Urs Fischer', '우르스 피셔', 'Stadion An der Alten Försterei', '알테 푀르스테라이'],
  ['boc', 'VfL Bochum', '보훔', 60, 'Bochum', '#005ba4', '#ffffff', 'Robin Dutt', '로빈 두트', 'Vonovia Ruhrstadion', '보노비아 루르슈타디온'],
  ['fch', '1. FC Heidenheim', '하이덴하임', 60, 'Heidenheim', '#e30613', '#003b79', 'Frank Schmidt', '프랑크 슈미트', 'Voith-Arena', '포이트 아레나'],
  ['ksv', 'Holstein Kiel', '홀슈타인 킬', 60, 'Kiel', '#00519e', '#e30613', 'Tim Walter', '팀 발터', 'Holstein-Stadion', '홀슈타인 슈타디온'],
  ['stp', 'FC St. Pauli', '장크트 파울리', 60, 'Hamburg', '#624839', '#ffffff', 'Markus Kauczinski', '마르쿠스 카우친스키', 'Millerntor-Stadion', '밀레른토어 슈타디온'],
  ['scp', 'SC Paderborn 07', '파더보른', 59, 'Paderborn', '#005ca9', '#000000', 'Steffen Baumgart', '슈테펜 바움가르트', 'Benteler-Arena', '벤텔러 아레나'],
  ['dsc', 'Arminia Bielefeld', '아르미니아 빌레펠트', 59, 'Bielefeld', '#004e95', '#000000', 'Jeff Saibene', '제프 자이베네', 'SchücoArena', '쉬코 아레나'],
  ['fci', 'FC Ingolstadt 04', '잉골슈타트', 59, 'Ingolstadt', '#000000', '#ce1126', 'Stefan Leitl', '슈테판 라이틀', 'Audi Sportpark', '아우디 슈포르트파르크'],
  ['ssv', 'SSV Jahn Regensburg', '얀 레겐스부르크', 58, 'Regensburg', '#da251d', '#ffffff', 'Achim Beierlorzer', '아힘 바이어로르처', 'Continental Arena', '콘티넨탈 아레나'],
  ['sgd', 'Dynamo Dresden', '디나모 드레스덴', 58, 'Dresden', '#ffdd00', '#000000', 'Uwe Neuhaus', '우베 노이하우스', 'Rudolf-Harbig-Stadion', '루돌프 하르비히 슈타디온'],
  ['d98', 'SV Darmstadt 98', '다름슈타트', 58, 'Darmstadt', '#004e9e', '#ffffff', 'Dirk Schuster', '디르크 슈스터', 'Merck-Stadion am Böllenfalltor', '뵐렌팔토어'],
  ['sgf', 'SpVgg Greuther Fürth', '그로이터 퓌르트', 58, 'Fürth', '#009b48', '#ffffff', 'Damir Burić', '다미르 부리치', 'Sportpark Ronhof Thomas Sommer', '론호프'],
  ['aue', 'Erzgebirge Aue', '에르츠게비르게 아우에', 57, 'Aue', '#522d80', '#ffffff', 'Daniel Meyer', '다니엘 마이어', 'Erzgebirgsstadion', '에르츠게비르게 슈타디온'],
  ['svs', 'SV Sandhausen', '잔트하우젠', 56, 'Sandhausen', '#000000', '#ffffff', 'Kenan Koçak', '케난 코착', 'Hardtwaldstadion', '하르트발트 슈타디온'],
  ['msv', 'MSV Duisburg', '뒤스부르크', 56, 'Duisburg', '#004b9c', '#ffffff', 'Ilia Gruev', '일리야 그루예프', 'Schauinsland-Reisen-Arena', '샤우인슬란트 라이젠 아레나'],
  ['fcm', '1. FC Magdeburg', '마그데부르크', 56, 'Magdeburg', '#004c9f', '#ffffff', 'Jens Härtel', '옌스 헤르텔', 'MDCC-Arena', 'MDCC 아레나'],
];

const id = (c: string): string => `${ID}:${c}`;

export const LEAGUE: LeagueData = {
  id: ID,
  name: '2. Bundesliga',
  nameKo: '2. 분데스리가',
  country: 'Germany',
  tier: 2,
  season: '2018-19',
  calendar: 'autumn-spring',
  teams: TEAMS.map(([code, name, nameKo, rating, city, primary, secondary, manager, managerKo, stadium, stadiumKo]): LeagueTeamData => ({
    id: id(code), name, nameKo, rating, city, colors: { primary, secondary }, manager, managerKo, stadium, stadiumKo,
  })),
  derbies: [
    [id('hsv'), id('stp'), '함부르크 더비'],
    [id('hsv'), id('ksv'), '북부 더비'],
    [id('sgd'), id('aue'), '작센 더비'],
    [id('sgd'), id('fcm'), '동독 더비'],
    [id('boc'), id('msv'), '루르 더비'],
    [id('fci'), id('ssv'), '도나우 더비'],
    [id('koe'), id('boc'), '라인·루르 더비'],
    [id('fcu'), id('sgd'), '동부 더비'],
    [id('d98'), id('svs'), '남서부 더비'],
  ],
};
