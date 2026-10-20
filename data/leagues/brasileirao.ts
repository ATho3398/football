import type { LeagueData, LeagueTeamData } from './types';

// 브라질 세리에 A 2018 (45d5, 부록 C.75r): 실제 참가 20팀 (2018-04 ~ 12, 춘추제). 레이팅은 PL 척도(맨시티 85 ~ 허더즈필드 67) 상대 전력 추정치.
// 상위권(파우메이라스·플라멩구·그레미우) ≈ 포르투갈 3위권, 하위권 ≈ 챔피언십 중하위. 리그 밖 표에 같은 클럽 없음.
// 감독 = 2018 개막(4월) 감독 (파우메이라스 호제르 마샤두 → 7월 루이스 펠리피 스콜라리 등 시즌 중 교체는 반영 안 함).

type T = [code: string, name: string, nameKo: string, rating: number, city: string, primary: string, secondary: string,
  manager: string, managerKo: string, stadium: string, stadiumKo: string];

const ROWS: T[] = [
  ['pal', 'Palmeiras', '파우메이라스', 73, 'São Paulo', '#006437', '#ffffff', 'Roger Machado', '호제르 마샤두', 'Allianz Parque', '알리안츠 파르키'],
  ['fla', 'Flamengo', '플라멩구', 73, 'Rio de Janeiro', '#c4161c', '#000000', 'Maurício Barbieri', '마우리시우 바르비에리', 'Maracanã', '마라카낭'],
  ['gre', 'Grêmio', '그레미우', 72, 'Porto Alegre', '#0d80bf', '#000000', 'Renato Portaluppi', '헤나투 포르탈루피', 'Arena do Grêmio', '아레나 두 그레미우'],
  ['cru', 'Cruzeiro', '크루제이루', 70, 'Belo Horizonte', '#2f529e', '#ffffff', 'Mano Menezes', '마누 메네지스', 'Mineirão', '미네이랑'],
  ['cor', 'Corinthians', '코린치앙스', 70, 'São Paulo', '#ffffff', '#000000', 'Fábio Carille', '파비우 카릴리', 'Arena Corinthians', '아레나 코린치앙스'],
  ['int', 'Internacional', '인테르나시오나우', 70, 'Porto Alegre', '#e5050f', '#ffffff', 'Odair Hellmann', '오다이르 헬만', 'Beira-Rio', '베이라히우'],
  ['sao', 'São Paulo', '상파울루', 69, 'São Paulo', '#ffffff', '#fe0000', 'Diego Aguirre', '디에고 아기레', 'Morumbi', '모룸비'],
  ['cam', 'Atlético Mineiro', '아틀레치쿠 미네이루', 69, 'Belo Horizonte', '#000000', '#ffffff', 'Thiago Larghi', '치아구 라르기', 'Independência', '인데펜덴시아'],
  ['san', 'Santos', '산투스', 68, 'Santos', '#ffffff', '#000000', 'Jair Ventura', '자이르 벤투라', 'Vila Belmiro', '빌라 베우미루'],
  ['cap', 'Athletico Paranaense', '아틀레치쿠 파라나엔시', 68, 'Curitiba', '#c8102e', '#000000', 'Fernando Diniz', '페르난두 지니스', 'Arena da Baixada', '아레나 다 바이샤다'],
  ['flu', 'Fluminense', '플루미넨시', 66, 'Rio de Janeiro', '#870a28', '#00613c', 'Abel Braga', '아베우 브라가', 'Maracanã', '마라카낭'],
  ['bot', 'Botafogo', '보타포구', 66, 'Rio de Janeiro', '#000000', '#ffffff', 'Alberto Valentim', '아우베르투 발렌칭', 'Estádio Nilton Santos', '이스타지우 닐통 산투스'],
  ['vas', 'Vasco da Gama', '바스쿠 다 가마', 65, 'Rio de Janeiro', '#000000', '#ffffff', 'Zé Ricardo', '제 히카르두', 'São Januário', '상 자누아리우'],
  ['bah', 'Bahia', '바이아', 65, 'Salvador', '#0060a8', '#e30613', 'Guto Ferreira', '구투 페헤이라', 'Arena Fonte Nova', '아레나 폰치 노바'],
  ['spo', 'Sport Recife', '스포르트 헤시피', 63, 'Recife', '#c8102e', '#000000', 'Nelsinho Baptista', '네우지뉴 바치스타', 'Ilha do Retiro', '이야 두 헤치루'],
  ['cha', 'Chapecoense', '샤페코엔시', 63, 'Chapecó', '#00a14b', '#ffffff', 'Gilson Kleina', '지우송 클레이나', 'Arena Condá', '아레나 콘다'],
  ['vit', 'Vitória', '비토리아', 63, 'Salvador', '#c8102e', '#000000', 'Vágner Mancini', '바그네르 만시니', 'Barradão', '바하당'],
  ['cea', 'Ceará', '세아라', 63, 'Fortaleza', '#000000', '#ffffff', 'Marcelo Chamusca', '마르셀루 샤무스카', 'Castelão', '카스텔랑'],
  ['ame', 'América Mineiro', '아메리카 미네이루', 63, 'Belo Horizonte', '#00843d', '#000000', 'Enderson Moreira', '엔데르송 모레이라', 'Independência', '인데펜덴시아'],
  ['par', 'Paraná', '파라나', 60, 'Curitiba', '#002d72', '#c8102e', 'Wagner Lopes', '바그네르 로페스', 'Vila Capanema', '빌라 카파네마'],
];

const teams: LeagueTeamData[] = ROWS.map(([code, name, nameKo, rating, city, primary, secondary, manager, managerKo, stadium, stadiumKo]) => ({
  id: `brasileirao:${code}`, name, nameKo, rating, city, colors: { primary, secondary }, manager, managerKo, stadium, stadiumKo,
}));

export const LEAGUE: LeagueData = {
  id: 'brasileirao',
  name: 'Campeonato Brasileiro Série A',
  nameKo: '브라질 세리에 A',
  country: 'Brazil',
  tier: 1,
  season: '2018',
  calendar: 'spring-autumn',
  teams,
  derbies: [
    ['brasileirao:pal', 'brasileirao:cor', '데르비 파울리스타'],
    ['brasileirao:pal', 'brasileirao:sao', '쇼키헤이'],
    ['brasileirao:cor', 'brasileirao:sao', '마제스토주'],
    ['brasileirao:san', 'brasileirao:sao', '산사웅'],
    ['brasileirao:san', 'brasileirao:cor', '클라시쿠 아우비네그루'],
    ['brasileirao:fla', 'brasileirao:flu', '플라플루'],
    ['brasileirao:fla', 'brasileirao:vas', '클라시쿠 두스 밀로이스'],
    ['brasileirao:flu', 'brasileirao:bot', '클라시쿠 보부'],
    ['brasileirao:gre', 'brasileirao:int', '그레나우'],
    ['brasileirao:cam', 'brasileirao:cru', '클라시쿠 미네이루'],
    ['brasileirao:bah', 'brasileirao:vit', '바비'],
  ],
};
