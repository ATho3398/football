import type { LeagueData } from './types';

// MLS 2018 시즌 (45d6, 부록 C.75s): 실제 참가 23팀. 단일 리그로 두고 동·서부 컨퍼런스는 팀 줄 메모와 MLS_CONFERENCE 로 남긴다.
// 레이팅은 PL 척도(맨시티 85 ~ 허더즈필드 67)에 맞춘 상대 전력 추정치: 리그 1위권(뉴욕 레드불스·애틀랜타) ≈ 챔피언십 상위(68), 하위권 59~61.
// 2018 정규 시즌 승점·득실과 선수단(지정 선수)을 기준으로 한 기억 기반 초안. 감독 = 2018 개막 감독, 홈구장 = 개막 시점(D.C. 유나이티드는 7월 아우디 필드 이전 전 RFK).

export const LEAGUE: LeagueData = {
  id: 'mls',
  name: 'Major League Soccer',
  nameKo: 'MLS',
  country: 'United States',
  tier: 1,
  season: '2018',
  calendar: 'spring-autumn',
  teams: [
    // ── 동부 컨퍼런스 (11) ──
    { id: 'mls:atl', name: 'Atlanta United', nameKo: '애틀랜타 유나이티드', rating: 68, city: 'Atlanta', colors: { primary: '#80000A', secondary: '#221F1F' },
      manager: 'Gerardo Martino', managerKo: '헤라르도 마르티노', stadium: 'Mercedes-Benz Stadium', stadiumKo: '메르세데스벤츠 스타디움' },
    { id: 'mls:nyr', name: 'New York Red Bulls', nameKo: '뉴욕 레드불스', rating: 68, city: 'Harrison', colors: { primary: '#ED1E36', secondary: '#23326A' },
      manager: 'Jesse Marsch', managerKo: '제시 마치', stadium: 'Red Bull Arena', stadiumKo: '레드불 아레나' },
    { id: 'mls:nyc', name: 'New York City FC', nameKo: '뉴욕 시티', rating: 65, city: 'New York', colors: { primary: '#6CACE4', secondary: '#041E42' },
      manager: 'Patrick Vieira', managerKo: '파트리크 비에이라', stadium: 'Yankee Stadium', stadiumKo: '양키 스타디움' },
    { id: 'mls:clb', name: 'Columbus Crew', nameKo: '콜럼버스 크루', rating: 64, city: 'Columbus', colors: { primary: '#FEDD00', secondary: '#000000' },
      manager: 'Gregg Berhalter', managerKo: '그레그 버핼터', stadium: 'Mapfre Stadium', stadiumKo: '맵프리 스타디움' },
    { id: 'mls:dcu', name: 'D.C. United', nameKo: 'D.C. 유나이티드', rating: 64, city: 'Washington, D.C.', colors: { primary: '#000000', secondary: '#EF3E42' },
      manager: 'Ben Olsen', managerKo: '벤 올슨', stadium: 'RFK Stadium', stadiumKo: 'RFK 스타디움' },
    { id: 'mls:phi', name: 'Philadelphia Union', nameKo: '필라델피아 유니언', rating: 63, city: 'Chester', colors: { primary: '#071B2C', secondary: '#B19B69' },
      manager: 'Jim Curtin', managerKo: '짐 커틴', stadium: 'Talen Energy Stadium', stadiumKo: '탤런 에너지 스타디움' },
    { id: 'mls:tor', name: 'Toronto FC', nameKo: '토론토 FC', rating: 64, city: 'Toronto', colors: { primary: '#B81137', secondary: '#455560' },
      manager: 'Greg Vanney', managerKo: '그레그 버니', stadium: 'BMO Field', stadiumKo: 'BMO 필드' },
    { id: 'mls:mtl', name: 'Montreal Impact', nameKo: '몬트리올 임팩트', rating: 62, city: 'Montreal', colors: { primary: '#0033A1', secondary: '#000000' },
      manager: 'Rémi Garde', managerKo: '레미 가르드', stadium: 'Stade Saputo', stadiumKo: '스타드 사푸토' },
    { id: 'mls:ner', name: 'New England Revolution', nameKo: '뉴잉글랜드 레볼루션', rating: 61, city: 'Foxborough', colors: { primary: '#0A2240', secondary: '#CE0E2D' },
      manager: 'Brad Friedel', managerKo: '브래드 프리델', stadium: 'Gillette Stadium', stadiumKo: '질레트 스타디움' },
    { id: 'mls:chi', name: 'Chicago Fire', nameKo: '시카고 파이어', rating: 61, city: 'Bridgeview', colors: { primary: '#C8102E', secondary: '#0A174A' },
      manager: 'Veljko Paunović', managerKo: '벨리코 파우노비치', stadium: 'Toyota Park', stadiumKo: '토요타 파크' },
    { id: 'mls:orl', name: 'Orlando City SC', nameKo: '올랜도 시티', rating: 60, city: 'Orlando', colors: { primary: '#633492', secondary: '#FDE192' },
      manager: 'Jason Kreis', managerKo: '제이슨 크라이스', stadium: 'Orlando City Stadium', stadiumKo: '올랜도 시티 스타디움' },
    // ── 서부 컨퍼런스 (12) ──
    { id: 'mls:skc', name: 'Sporting Kansas City', nameKo: '스포팅 캔자스시티', rating: 66, city: 'Kansas City', colors: { primary: '#93B1D7', secondary: '#002F65' },
      manager: 'Peter Vermes', managerKo: '피터 버미스', stadium: "Children's Mercy Park", stadiumKo: '칠드런스 머시 파크' },
    { id: 'mls:sea', name: 'Seattle Sounders FC', nameKo: '시애틀 사운더스', rating: 66, city: 'Seattle', colors: { primary: '#5D9741', secondary: '#005595' },
      manager: 'Brian Schmetzer', managerKo: '브라이언 슈메처', stadium: 'CenturyLink Field', stadiumKo: '센추리링크 필드' },
    { id: 'mls:lfc', name: 'Los Angeles FC', nameKo: 'LAFC', rating: 66, city: 'Los Angeles', colors: { primary: '#000000', secondary: '#C39E6D' },
      manager: 'Bob Bradley', managerKo: '밥 브래들리', stadium: 'Banc of California Stadium', stadiumKo: '뱅크 오브 캘리포니아 스타디움' },
    { id: 'mls:dal', name: 'FC Dallas', nameKo: 'FC 댈러스', rating: 65, city: 'Frisco', colors: { primary: '#E81F3E', secondary: '#2A4076' },
      manager: 'Óscar Pareja', managerKo: '오스카르 파레하', stadium: 'Toyota Stadium', stadiumKo: '토요타 스타디움' },
    { id: 'mls:por', name: 'Portland Timbers', nameKo: '포틀랜드 팀버스', rating: 65, city: 'Portland', colors: { primary: '#004812', secondary: '#EBE72B' },
      manager: 'Giovanni Savarese', managerKo: '조반니 사바레세', stadium: 'Providence Park', stadiumKo: '프로비던스 파크' },
    { id: 'mls:rsl', name: 'Real Salt Lake', nameKo: '레알 솔트레이크', rating: 63, city: 'Sandy', colors: { primary: '#B30838', secondary: '#013A81' },
      manager: 'Mike Petke', managerKo: '마이크 페트키', stadium: 'Rio Tinto Stadium', stadiumKo: '리오 틴토 스타디움' },
    { id: 'mls:lag', name: 'LA Galaxy', nameKo: 'LA 갤럭시', rating: 63, city: 'Carson', colors: { primary: '#00245D', secondary: '#FFD200' },
      manager: 'Sigi Schmid', managerKo: '지기 슈미트', stadium: 'StubHub Center', stadiumKo: '스텁허브 센터' },
    { id: 'mls:van', name: 'Vancouver Whitecaps FC', nameKo: '밴쿠버 화이트캡스', rating: 62, city: 'Vancouver', colors: { primary: '#00245E', secondary: '#9DC2EA' },
      manager: 'Carl Robinson', managerKo: '칼 로빈슨', stadium: 'BC Place', stadiumKo: 'BC 플레이스' },
    { id: 'mls:hou', name: 'Houston Dynamo', nameKo: '휴스턴 다이너모', rating: 62, city: 'Houston', colors: { primary: '#F68712', secondary: '#101820' },
      manager: 'Wilmer Cabrera', managerKo: '윌메르 카브레라', stadium: 'BBVA Compass Stadium', stadiumKo: 'BBVA 컴퍼스 스타디움' },
    { id: 'mls:min', name: 'Minnesota United FC', nameKo: '미네소타 유나이티드', rating: 61, city: 'Minneapolis', colors: { primary: '#8CD2F4', secondary: '#231F20' },
      manager: 'Adrian Heath', managerKo: '에이드리언 히스', stadium: 'TCF Bank Stadium', stadiumKo: 'TCF 뱅크 스타디움' },
    { id: 'mls:col', name: 'Colorado Rapids', nameKo: '콜로라도 래피즈', rating: 60, city: 'Commerce City', colors: { primary: '#960A2C', secondary: '#9CC2EA' },
      manager: 'Anthony Hudson', managerKo: '앤서니 허드슨', stadium: "Dick's Sporting Goods Park", stadiumKo: '딕스 스포팅 굿즈 파크' },
    { id: 'mls:sje', name: 'San Jose Earthquakes', nameKo: '산호세 어스퀘이크스', rating: 59, city: 'San Jose', colors: { primary: '#0067B1', secondary: '#000000' },
      manager: 'Mikael Stahre', managerKo: '미카엘 스타르', stadium: 'Avaya Stadium', stadiumKo: '어바이어 스타디움' },
  ],
  derbies: [
    ['mls:lag', 'mls:lfc', '엘 트라피코'],
    ['mls:sea', 'mls:por', '캐스케이디아 컵'],
    ['mls:sea', 'mls:van', '캐스케이디아 컵'],
    ['mls:por', 'mls:van', '캐스케이디아 컵'],
    ['mls:nyc', 'mls:nyr', '허드슨 리버 더비'],
    ['mls:dcu', 'mls:nyr', '애틀랜틱 컵'],
    ['mls:hou', 'mls:dal', '텍사스 더비'],
    ['mls:col', 'mls:rsl', '로키 마운틴 컵'],
    ['mls:lag', 'mls:sje', '캘리포니아 클라시코'],
    ['mls:mtl', 'mls:tor', '캐나디언 클라시크'],
    ['mls:clb', 'mls:tor', '트릴리엄 컵'],
  ],
};

/** 컨퍼런스 메모 (게임은 단일 리그로 쓴다) */
export const MLS_CONFERENCE: Readonly<Record<string, 'east' | 'west'>> = Object.fromEntries(
  LEAGUE.teams.map((t, i) => [t.id, i < 11 ? 'east' : 'west'] as const),
);
