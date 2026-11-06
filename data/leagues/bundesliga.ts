import type { LeagueData } from './types';

// 분데스리가 2018-19 (45d2단계, 부록 C.75o): 실제 참가 18팀. 게임에는 아직 연결하지 않는다 (45a·45b).
// 레이팅은 PL 2018 척도(맨시티 85 ~ 허더즈필드 67)에 맞춘 상대 전력 추정치. 리그 밖 표(data/outsideClubs.ts)에 있는 클럽은 같은 레이팅
// (바이에른 84·도르트문트 80·레버쿠젠 77·샬케 76·호펜하임 75). 감독 = 2018-19 개막 감독.

export const LEAGUE: LeagueData = {
  id: 'bundesliga',
  name: 'Bundesliga',
  nameKo: '분데스리가',
  country: 'Germany',
  tier: 1,
  season: '2018-19',
  calendar: 'autumn-spring',
  teams: [
    { id: 'bundesliga:bay', name: 'Bayern Munich', nameKo: '바이에른 뮌헨', rating: 84, city: 'Munich', colors: { primary: '#dc052d', secondary: '#0066b2' }, manager: 'Niko Kovač', managerKo: '니코 코바치', stadium: 'Allianz Arena', stadiumKo: '알리안츠 아레나' },
    { id: 'bundesliga:bvb', name: 'Borussia Dortmund', nameKo: '보루시아 도르트문트', rating: 80, city: 'Dortmund', colors: { primary: '#fde100', secondary: '#000000' }, manager: 'Lucien Favre', managerKo: '뤼시앵 파브르', stadium: 'Signal Iduna Park', stadiumKo: '지그날 이두나 파르크' },
    { id: 'bundesliga:rbl', name: 'RB Leipzig', nameKo: 'RB 라이프치히', rating: 77, city: 'Leipzig', colors: { primary: '#ffffff', secondary: '#dd0741' }, manager: 'Ralf Rangnick', managerKo: '랄프 랑닉', stadium: 'Red Bull Arena', stadiumKo: '레드불 아레나' },
    { id: 'bundesliga:b04', name: 'Bayer Leverkusen', nameKo: '바이어 레버쿠젠', rating: 77, city: 'Leverkusen', colors: { primary: '#e32221', secondary: '#000000' }, manager: 'Heiko Herrlich', managerKo: '하이코 헤를리히', stadium: 'BayArena', stadiumKo: '바이아레나' },
    { id: 'bundesliga:bmg', name: 'Borussia Mönchengladbach', nameKo: '보루시아 묀헨글라트바흐', rating: 75, city: 'Mönchengladbach', colors: { primary: '#ffffff', secondary: '#000000' }, manager: 'Dieter Hecking', managerKo: '디터 헤킹', stadium: 'Borussia-Park', stadiumKo: '보루시아 파르크' },
    { id: 'bundesliga:s04', name: 'Schalke 04', nameKo: '샬케 04', rating: 76, city: 'Gelsenkirchen', colors: { primary: '#004d9d', secondary: '#ffffff' }, manager: 'Domenico Tedesco', managerKo: '도메니코 테데스코', stadium: 'Veltins-Arena', stadiumKo: '펠틴스 아레나' },
    { id: 'bundesliga:tsg', name: 'Hoffenheim', nameKo: '호펜하임', rating: 75, city: 'Sinsheim', colors: { primary: '#1961b5', secondary: '#ffffff' }, manager: 'Julian Nagelsmann', managerKo: '율리안 나겔스만', stadium: 'Rhein-Neckar-Arena', stadiumKo: '라인네카어 아레나' },
    { id: 'bundesliga:sge', name: 'Eintracht Frankfurt', nameKo: '아인트라흐트 프랑크푸르트', rating: 74, city: 'Frankfurt', colors: { primary: '#e1000f', secondary: '#000000' }, manager: 'Adi Hütter', managerKo: '아디 휘터', stadium: 'Commerzbank-Arena', stadiumKo: '코메르츠방크 아레나' },
    { id: 'bundesliga:wob', name: 'VfL Wolfsburg', nameKo: 'VfL 볼프스부르크', rating: 73, city: 'Wolfsburg', colors: { primary: '#65b32e', secondary: '#ffffff' }, manager: 'Bruno Labbadia', managerKo: '브루노 라바디아', stadium: 'Volkswagen Arena', stadiumKo: '폭스바겐 아레나' },
    { id: 'bundesliga:svw', name: 'Werder Bremen', nameKo: '베르더 브레멘', rating: 73, city: 'Bremen', colors: { primary: '#1d9053', secondary: '#ffffff' }, manager: 'Florian Kohfeldt', managerKo: '플로리안 코펠트', stadium: 'Weserstadion', stadiumKo: '베저슈타디온' },
    { id: 'bundesliga:bsc', name: 'Hertha BSC', nameKo: '헤르타 BSC', rating: 72, city: 'Berlin', colors: { primary: '#005ca9', secondary: '#ffffff' }, manager: 'Pál Dárdai', managerKo: '팔 다르다이', stadium: 'Olympiastadion', stadiumKo: '올림피아슈타디온' },
    { id: 'bundesliga:m05', name: 'Mainz 05', nameKo: '마인츠 05', rating: 70, city: 'Mainz', colors: { primary: '#c3141e', secondary: '#ffffff' }, manager: 'Sandro Schwarz', managerKo: '산드로 슈바르츠', stadium: 'Opel Arena', stadiumKo: '오펠 아레나' },
    { id: 'bundesliga:scf', name: 'SC Freiburg', nameKo: 'SC 프라이부르크', rating: 70, city: 'Freiburg', colors: { primary: '#000000', secondary: '#e2001a' }, manager: 'Christian Streich', managerKo: '크리스티안 슈트라이히', stadium: 'Schwarzwald-Stadion', stadiumKo: '슈바르츠발트 슈타디온' },
    { id: 'bundesliga:vfb', name: 'VfB Stuttgart', nameKo: 'VfB 슈투트가르트', rating: 71, city: 'Stuttgart', colors: { primary: '#ffffff', secondary: '#e32219' }, manager: 'Tayfun Korkut', managerKo: '타이푼 코르쿠트', stadium: 'Mercedes-Benz Arena', stadiumKo: '메르세데스벤츠 아레나' },
    { id: 'bundesliga:fca', name: 'FC Augsburg', nameKo: 'FC 아우크스부르크', rating: 70, city: 'Augsburg', colors: { primary: '#ba3733', secondary: '#46714d' }, manager: 'Manuel Baum', managerKo: '마누엘 바움', stadium: 'WWK Arena', stadiumKo: 'WWK 아레나' },
    { id: 'bundesliga:f95', name: 'Fortuna Düsseldorf', nameKo: '포르투나 뒤셀도르프', rating: 68, city: 'Düsseldorf', colors: { primary: '#e30613', secondary: '#ffffff' }, manager: 'Friedhelm Funkel', managerKo: '프리드헬름 풍켈', stadium: 'Merkur Spiel-Arena', stadiumKo: '메르쿠어 슈필 아레나' },
    { id: 'bundesliga:h96', name: 'Hannover 96', nameKo: '하노버 96', rating: 68, city: 'Hanover', colors: { primary: '#008c3c', secondary: '#000000' }, manager: 'André Breitenreiter', managerKo: '안드레 브라이텐라이터', stadium: 'HDI-Arena', stadiumKo: 'HDI 아레나' },
    { id: 'bundesliga:fcn', name: '1. FC Nürnberg', nameKo: '1. FC 뉘른베르크', rating: 66, city: 'Nuremberg', colors: { primary: '#aa1124', secondary: '#ffffff' }, manager: 'Michael Köllner', managerKo: '미하엘 쾰너', stadium: 'Max-Morlock-Stadion', stadiumKo: '막스 모를로크 슈타디온' },
  ],
  derbies: [
    ['bundesliga:bay', 'bundesliga:bvb', '데어 클라시커'],
    ['bundesliga:bvb', 'bundesliga:s04', '레비어 더비'],
    ['bundesliga:bay', 'bundesliga:fcn', '바이에른 더비'],
    ['bundesliga:bay', 'bundesliga:vfb', '남부 더비'],
    ['bundesliga:bmg', 'bundesliga:f95', '라인 더비'],
    ['bundesliga:b04', 'bundesliga:bmg', '라인 더비'],
    ['bundesliga:svw', 'bundesliga:h96', '북부 더비'],
    ['bundesliga:wob', 'bundesliga:h96', '니더작센 더비'],
    ['bundesliga:sge', 'bundesliga:m05', '라인마인 더비'],
    ['bundesliga:vfb', 'bundesliga:scf', '바덴뷔르템베르크 더비'],
    ['bundesliga:vfb', 'bundesliga:tsg', '바덴뷔르템베르크 더비'],
  ],
};
