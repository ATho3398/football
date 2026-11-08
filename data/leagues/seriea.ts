import type { LeagueData } from './types';

// 세리에 A 2018-19 (45d1, 부록 C.75n). 데이터만 — 게임 연결은 45a·45b.
// 레이팅은 PL 척도(맨시티 85 ~ 허더즈필드 67)에 맞춘 상대 전력. 리그 밖 표(data/outsideClubs.ts)에 있는 클럽
// (유벤투스 85·나폴리 80·인테르 79·로마 78·AC 밀란 77)은 이름·레이팅을 그대로 맞췄다.
// 감독 = 시즌 개막 감독 (로마 디프란체스코, 키에보 단나 등은 시즌 중 교체). 순서 = 2018-19 최종 순위.
export const LEAGUE: LeagueData = {
  id: 'seriea',
  name: 'Serie A',
  nameKo: '세리에 A',
  country: 'Italy',
  tier: 1,
  season: '2018-19',
  calendar: 'autumn-spring',
  teams: [
    { id: 'seriea:juv', name: 'Juventus', nameKo: '유벤투스', rating: 85, city: 'Turin', colors: { primary: '#000000', secondary: '#ffffff' }, manager: 'Massimiliano Allegri', managerKo: '마시밀리아노 알레그리', stadium: 'Allianz Stadium', stadiumKo: '알리안츠 스타디움' },
    { id: 'seriea:nap', name: 'Napoli', nameKo: '나폴리', rating: 80, city: 'Naples', colors: { primary: '#12a0d7', secondary: '#ffffff' }, manager: 'Carlo Ancelotti', managerKo: '카를로 안첼로티', stadium: 'Stadio San Paolo', stadiumKo: '스타디오 산 파올로' },
    { id: 'seriea:ata', name: 'Atalanta', nameKo: '아탈란타', rating: 76, city: 'Bergamo', colors: { primary: '#1e71b8', secondary: '#000000' }, manager: 'Gian Piero Gasperini', managerKo: '잔 피에로 가스페리니', stadium: "Stadio Atleti Azzurri d'Italia", stadiumKo: '스타디오 아틀레티 아추리 디탈리아' },
    { id: 'seriea:int', name: 'Inter', nameKo: '인테르', rating: 79, city: 'Milan', colors: { primary: '#0068a8', secondary: '#000000' }, manager: 'Luciano Spalletti', managerKo: '루치아노 스팔레티', stadium: 'San Siro', stadiumKo: '산 시로' },
    { id: 'seriea:mil', name: 'AC Milan', nameKo: 'AC 밀란', rating: 77, city: 'Milan', colors: { primary: '#fb090b', secondary: '#000000' }, manager: 'Gennaro Gattuso', managerKo: '젠나로 가투소', stadium: 'San Siro', stadiumKo: '산 시로' },
    { id: 'seriea:rom', name: 'Roma', nameKo: '로마', rating: 78, city: 'Rome', colors: { primary: '#8e1f2f', secondary: '#f0bc42' }, manager: 'Eusebio Di Francesco', managerKo: '에우세비오 디프란체스코', stadium: 'Stadio Olimpico', stadiumKo: '스타디오 올림피코' },
    { id: 'seriea:tor', name: 'Torino', nameKo: '토리노', rating: 73, city: 'Turin', colors: { primary: '#881f19', secondary: '#ffffff' }, manager: 'Walter Mazzarri', managerKo: '발터 마차리', stadium: 'Stadio Olimpico Grande Torino', stadiumKo: '스타디오 올림피코 그란데 토리노' },
    { id: 'seriea:laz', name: 'Lazio', nameKo: '라치오', rating: 77, city: 'Rome', colors: { primary: '#87d8f7', secondary: '#ffffff' }, manager: 'Simone Inzaghi', managerKo: '시모네 인자기', stadium: 'Stadio Olimpico', stadiumKo: '스타디오 올림피코' },
    { id: 'seriea:sam', name: 'Sampdoria', nameKo: '삼프도리아', rating: 72, city: 'Genoa', colors: { primary: '#1b5497', secondary: '#ffffff' }, manager: 'Marco Giampaolo', managerKo: '마르코 잠파올로', stadium: 'Stadio Luigi Ferraris', stadiumKo: '스타디오 루이지 페라리스' },
    { id: 'seriea:bol', name: 'Bologna', nameKo: '볼로냐', rating: 70, city: 'Bologna', colors: { primary: '#1a2f48', secondary: '#a21c26' }, manager: 'Filippo Inzaghi', managerKo: '필리포 인자기', stadium: "Stadio Renato Dall'Ara", stadiumKo: '스타디오 레나토 달라라' },
    { id: 'seriea:sas', name: 'Sassuolo', nameKo: '사수올로', rating: 71, city: 'Sassuolo', colors: { primary: '#00a752', secondary: '#000000' }, manager: 'Roberto De Zerbi', managerKo: '로베르토 데체르비', stadium: 'Mapei Stadium', stadiumKo: '마페이 스타디움' },
    { id: 'seriea:udi', name: 'Udinese', nameKo: '우디네세', rating: 70, city: 'Udine', colors: { primary: '#000000', secondary: '#ffffff' }, manager: 'Julio Velázquez', managerKo: '훌리오 벨라스케스', stadium: 'Dacia Arena', stadiumKo: '다치아 아레나' },
    { id: 'seriea:spa', name: 'SPAL', nameKo: 'SPAL', rating: 69, city: 'Ferrara', colors: { primary: '#ffffff', secondary: '#4ea8de' }, manager: 'Leonardo Semplici', managerKo: '레오나르도 셈플리치', stadium: 'Stadio Paolo Mazza', stadiumKo: '스타디오 파올로 마차' },
    { id: 'seriea:par', name: 'Parma', nameKo: '파르마', rating: 69, city: 'Parma', colors: { primary: '#ffd200', secondary: '#1b3e8f' }, manager: "Roberto D'Aversa", managerKo: '로베르토 다베르사', stadium: 'Stadio Ennio Tardini', stadiumKo: '스타디오 엔니오 타르디니' },
    { id: 'seriea:cag', name: 'Cagliari', nameKo: '칼리아리', rating: 70, city: 'Cagliari', colors: { primary: '#a6192e', secondary: '#002350' }, manager: 'Rolando Maran', managerKo: '롤란도 마란', stadium: 'Sardegna Arena', stadiumKo: '사르데냐 아레나' },
    { id: 'seriea:fio', name: 'Fiorentina', nameKo: '피오렌티나', rating: 73, city: 'Florence', colors: { primary: '#482e92', secondary: '#ffffff' }, manager: 'Stefano Pioli', managerKo: '스테파노 피올리', stadium: 'Stadio Artemio Franchi', stadiumKo: '스타디오 아르테미오 프란키' },
    { id: 'seriea:gen', name: 'Genoa', nameKo: '제노아', rating: 70, city: 'Genoa', colors: { primary: '#a6192e', secondary: '#002d62' }, manager: 'Davide Ballardini', managerKo: '다비데 발라르디니', stadium: 'Stadio Luigi Ferraris', stadiumKo: '스타디오 루이지 페라리스' },
    { id: 'seriea:emp', name: 'Empoli', nameKo: '엠폴리', rating: 68, city: 'Empoli', colors: { primary: '#005baa', secondary: '#ffffff' }, manager: 'Aurelio Andreazzoli', managerKo: '아우렐리오 안드레아촐리', stadium: 'Stadio Carlo Castellani', stadiumKo: '스타디오 카를로 카스텔라니' },
    { id: 'seriea:fro', name: 'Frosinone', nameKo: '프로시노네', rating: 66, city: 'Frosinone', colors: { primary: '#ffdc00', secondary: '#004b93' }, manager: 'Moreno Longo', managerKo: '모레노 롱고', stadium: 'Stadio Benito Stirpe', stadiumKo: '스타디오 베니토 스티르페' },
    { id: 'seriea:chi', name: 'Chievo', nameKo: '키에보', rating: 66, city: 'Verona', colors: { primary: '#ffdd00', secondary: '#0d2d6b' }, manager: "Lorenzo D'Anna", managerKo: '로렌초 단나', stadium: "Stadio Marc'Antonio Bentegodi", stadiumKo: '스타디오 마르칸토니오 벤테고디' },
  ],
  derbies: [
    ['seriea:int', 'seriea:mil', '밀라노 더비'],
    ['seriea:rom', 'seriea:laz', '로마 더비'],
    ['seriea:juv', 'seriea:int', '데르비 디탈리아'],
    ['seriea:juv', 'seriea:tor', '토리노 더비'],
    ['seriea:gen', 'seriea:sam', '제노바 더비'],
    ['seriea:juv', 'seriea:nap', '남북 더비'],
    ['seriea:juv', 'seriea:mil', '이탈리아 클라시코'],
    ['seriea:fio', 'seriea:juv', '피오렌티나–유벤투스 라이벌'],
  ],
};
