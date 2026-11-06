import type { LeagueData, LeagueTeamData } from './types';

// 에레디비시 2018-19 (C.75p, 45d3): 실제 참가 18팀. 레이팅은 PL 척도(맨시티 85 ~ 허더즈필드 67).
// 아약스 76·PSV 72 는 리그 밖 표(data/outsideClubs.ts)와 같게 맞췄다. 중위권 이하는 챔피언십 중하위와 비슷한 수준으로 잡았다.
// 감독 = 2018-19 개막 감독. 팀 행: [3글자, 영문, 한글, 레이팅, 도시, 주 색, 보조 색, 감독, 감독 한글, 홈구장, 홈구장 한글]

type T = [code: string, name: string, nameKo: string, rating: number, city: string, primary: string, secondary: string,
  manager: string, managerKo: string, stadium: string, stadiumKo: string];

const ID = 'eredivisie';

const TEAMS: T[] = [
  ['ajx', 'Ajax', '아약스', 76, 'Amsterdam', '#ffffff', '#d2122e', 'Erik ten Hag', '에릭 텐 하흐', 'Johan Cruijff ArenA', '요한 크라위프 아레나'],
  ['psv', 'PSV', 'PSV', 72, 'Eindhoven', '#ed1c24', '#ffffff', 'Mark van Bommel', '마르크 판보멀', 'Philips Stadion', '필립스 스타디온'],
  ['fey', 'Feyenoord', '페예노르트', 71, 'Rotterdam', '#e30613', '#000000', 'Giovanni van Bronckhorst', '조바니 판브롱크호르스트', 'De Kuip', '더 카위프'],
  ['alk', 'AZ', 'AZ 알크마르', 68, 'Alkmaar', '#db0021', '#ffffff', 'John van den Brom', '욘 판덴브롬', 'AFAS Stadion', 'AFAS 스타디온'],
  ['vit', 'Vitesse', '피테서', 66, 'Arnhem', '#ffd700', '#000000', 'Leonid Slutsky', '레오니트 슬루츠키', 'GelreDome', '헬레돔'],
  ['utr', 'FC Utrecht', '위트레흐트', 65, 'Utrecht', '#e2001a', '#ffffff', 'Jean-Paul de Jong', '장폴 더용', 'Stadion Galgenwaard', '갈겐바르트'],
  ['her', 'Heracles Almelo', '헤라클레스 알멜로', 62, 'Almelo', '#000000', '#ffffff', 'Frank Wormuth', '프랑크 보어무트', 'Erve Asito', '에르버 아시토'],
  ['gro', 'FC Groningen', '흐로닝언', 62, 'Groningen', '#00843d', '#ffffff', 'Danny Buijs', '대니 바위스', 'Hitachi Capital Mobility Stadion', '유로보르흐'],
  ['hee', 'SC Heerenveen', '헤이렌베인', 62, 'Heerenveen', '#005ca9', '#ffffff', 'Jan Olde Riekerink', '얀 올더 리케링크', 'Abe Lenstra Stadion', '아버 렌스트라 스타디온'],
  ['ado', 'ADO Den Haag', 'ADO 덴하흐', 61, 'The Hague', '#00a651', '#ffd200', 'Alfons Groenendijk', '알폰스 흐루넨데이크', 'Cars Jeans Stadion', '카스 진스 스타디온'],
  ['wil', 'Willem II', '빌럼 II', 61, 'Tilburg', '#e2001a', '#00337a', 'Adrie Koster', '아드리 코스터르', 'Koning Willem II Stadion', '코닝 빌럼 II 스타디온'],
  ['pec', 'PEC Zwolle', 'PEC 즈볼레', 61, 'Zwolle', '#0055a4', '#ffffff', "John van 't Schip", '욘 판트 스힙', 'MAC³PARK Stadion', 'MAC³PARK 스타디온'],
  ['vvv', 'VVV-Venlo', 'VVV 펜로', 60, 'Venlo', '#ffe500', '#000000', 'Maurice Steijn', '마우리세 스테인', 'De Koel', '더 쿨'],
  ['for', 'Fortuna Sittard', '포르투나 시타르트', 58, 'Sittard', '#ffd200', '#00843d', 'Sunday Oliseh', '선데이 올리세', 'Fortuna Sittard Stadion', '포르투나 시타르트 스타디온'],
  ['exc', 'Excelsior', '엑셀시오르', 58, 'Rotterdam', '#e30613', '#000000', 'Adrie Poldervaart', '아드리 폴더르바르트', 'Van Donge & De Roo Stadion', '바우데스테인'],
  ['nac', 'NAC Breda', 'NAC 브레다', 58, 'Breda', '#ffe600', '#000000', 'Mitchell van der Gaag', '미철 판데르하흐', 'Rat Verlegh Stadion', '랏 페를레흐 스타디온'],
  ['emm', 'FC Emmen', 'FC 에먼', 57, 'Emmen', '#e30613', '#ffffff', 'Dick Lukkien', '딕 뤼킨', 'De Oude Meerdijk', '더 아우더 메이르데이크'],
  ['gra', 'De Graafschap', '더 흐라프스합', 57, 'Doetinchem', '#005bac', '#ffffff', 'Henk de Jong', '헹크 더용', 'De Vijverberg', '더 페이버르베르흐'],
];

const id = (c: string): string => `${ID}:${c}`;

export const LEAGUE: LeagueData = {
  id: ID,
  name: 'Eredivisie',
  nameKo: '에레디비시',
  country: 'Netherlands',
  tier: 1,
  season: '2018-19',
  calendar: 'autumn-spring',
  teams: TEAMS.map(([code, name, nameKo, rating, city, primary, secondary, manager, managerKo, stadium, stadiumKo]): LeagueTeamData => ({
    id: id(code), name, nameKo, rating, city, colors: { primary, secondary }, manager, managerKo, stadium, stadiumKo,
  })),
  derbies: [
    [id('ajx'), id('fey'), '더 클라시커르'],
    [id('ajx'), id('psv'), '더 톱퍼르'],
    [id('fey'), id('psv'), '더 그로터 클라시커르'],
    [id('ajx'), id('alk'), '노르트홀란트 더비'],
    [id('ajx'), id('utr'), '아약스·위트레흐트 라이벌'],
    [id('fey'), id('exc'), '로테르담 더비'],
    [id('fey'), id('ado'), '로테르담·헤이그 라이벌'],
    [id('vit'), id('gra'), '헬데를란트 더비'],
    [id('nac'), id('wil'), '브라반트 더비'],
    [id('psv'), id('wil'), '브라반트 더비'],
    [id('gro'), id('hee'), '북부 더비'],
    [id('vvv'), id('for'), '림뷔르흐 더비'],
    [id('her'), id('pec'), '오버레이설 더비'],
  ],
};
