// 가상 선수 이름 풀 (23번). 국적별 [영문, 한글] 이름과 성.
// weight 는 2018-19 프리미어리그 로스터의 대략적인 국적 비율

export interface NamePool {
  nationality: string;
  weight: number;
  given: [string, string][];
  family: [string, string][];
}

export const NAME_POOLS: NamePool[] = [
  {
    nationality: 'England',
    weight: 34,
    given: [
      ['Jack', '잭'], ['Harry', '해리'], ['James', '제임스'], ['Tom', '톰'], ['Danny', '대니'], ['Ben', '벤'],
      ['Luke', '루크'], ['Callum', '캘럼'], ['Josh', '조시'], ['Ryan', '라이언'], ['Jordan', '조던'], ['Mason', '메이슨'],
      ['Lewis', '루이스'], ['Kyle', '카일'], ['Nathan', '네이선'], ['Joe', '조'],
    ],
    family: [
      ['Walker', '워커'], ['Taylor', '테일러'], ['Clarke', '클라크'], ['Robinson', '로빈슨'], ['Wright', '라이트'],
      ['Thompson', '톰프슨'], ['Hughes', '휴스'], ['Mitchell', '미첼'], ['Barnes', '반스'], ['Cooper', '쿠퍼'],
      ['Parker', '파커'], ['Turner', '터너'], ['Ward', '워드'], ['Fletcher', '플레처'], ['Holt', '홀트'], ['Shaw', '쇼'],
    ],
  },
  {
    nationality: 'Scotland',
    weight: 5,
    given: [['Andrew', '앤드루'], ['Scott', '스콧'], ['Ross', '로스'], ['Stuart', '스튜어트'], ['Kenny', '케니'], ['Craig', '크레이그']],
    family: [['McGregor', '맥그리거'], ['Robertson', '로버트슨'], ['Fraser', '프레이저'], ['Campbell', '캠벨'], ['Murray', '머리'], ['Ferguson', '퍼거슨']],
  },
  {
    nationality: 'Republic of Ireland',
    weight: 4,
    given: [['Sean', '숀'], ['Conor', '코너'], ['Shane', '셰인'], ['Darragh', '대러'], ['Cian', '키언'], ['Aiden', '에이든']],
    family: [['Doherty', '도허티'], ['Kelly', '켈리'], ['Byrne', '번'], ['Quinn', '퀸'], ['Walsh', '월시'], ['Brennan', '브레넌']],
  },
  {
    nationality: 'Wales',
    weight: 3,
    given: [['Gareth', '개러스'], ['Rhys', '리스'], ['Owain', '오와인'], ['Dylan', '딜런'], ['Ethan', '이선']],
    family: [['Davies', '데이비스'], ['Evans', '에번스'], ['Jones', '존스'], ['Williams', '윌리엄스'], ['Morgan', '모건']],
  },
  {
    nationality: 'France',
    weight: 8,
    given: [
      ['Lucas', '뤼카'], ['Théo', '테오'], ['Hugo', '위고'], ['Antoine', '앙투안'], ['Mathis', '마티스'], ['Yann', '얀'],
      ['Kévin', '케빈'], ['Romain', '로맹'],
    ],
    family: [
      ['Martin', '마르탱'], ['Bernard', '베르나르'], ['Dubois', '뒤부아'], ['Moreau', '모로'], ['Laurent', '로랑'],
      ['Girard', '지라르'], ['Fournier', '푸르니에'], ['Mendy', '멘디'],
    ],
  },
  {
    nationality: 'Spain',
    weight: 6,
    given: [['Pablo', '파블로'], ['Javier', '하비에르'], ['Sergio', '세르히오'], ['Álvaro', '알바로'], ['Diego', '디에고'], ['Marcos', '마르코스']],
    family: [['García', '가르시아'], ['Fernández', '페르난데스'], ['López', '로페스'], ['Moreno', '모레노'], ['Navarro', '나바로'], ['Ruiz', '루이스']],
  },
  {
    nationality: 'Portugal',
    weight: 4,
    given: [['João', '주앙'], ['Rúben', '후벵'], ['Diogo', '디오구'], ['Tiago', '티아구'], ['André', '안드레']],
    family: [['Silva', '실바'], ['Santos', '산투스'], ['Costa', '코스타'], ['Pereira', '페레이라'], ['Moutinho', '모티뉴']],
  },
  {
    nationality: 'Germany',
    weight: 4,
    given: [['Lukas', '루카스'], ['Jonas', '요나스'], ['Leon', '레온'], ['Felix', '펠릭스'], ['Niklas', '니클라스']],
    family: [['Müller', '뮐러'], ['Schmidt', '슈미트'], ['Becker', '베커'], ['Wagner', '바그너'], ['Hoffmann', '호프만']],
  },
  {
    nationality: 'Netherlands',
    weight: 4,
    given: [['Daan', '단'], ['Joris', '요리스'], ['Bram', '브람'], ['Stefan', '스테판'], ['Jesper', '예스퍼']],
    family: [['de Jong', '더 용'], ['Bakker', '바커르'], ['Visser', '피서르'], ['van Dam', '반 담'], ['Smit', '스밋']],
  },
  {
    nationality: 'Belgium',
    weight: 4,
    given: [['Thomas', '토마스'], ['Dries', '드리스'], ['Youri', '유리'], ['Leander', '레안더르'], ['Michy', '미치']],
    family: [['Peeters', '페이터르스'], ['Janssens', '얀선스'], ['Maes', '마스'], ['Claes', '클라스'], ['Vermeulen', '페르묄런']],
  },
  {
    nationality: 'Brazil',
    weight: 5,
    given: [['Gabriel', '가브리에우'], ['Rafael', '하파에우'], ['Felipe', '펠리피'], ['Lucas', '루카스'], ['Matheus', '마테우스']],
    family: [['Souza', '소자'], ['Oliveira', '올리베이라'], ['Lima', '리마'], ['Ribeiro', '히베이루'], ['Alves', '아우베스']],
  },
  {
    nationality: 'Argentina',
    weight: 3,
    given: [['Juan', '후안'], ['Nicolás', '니콜라스'], ['Matías', '마티아스'], ['Franco', '프랑코']],
    family: [['González', '곤살레스'], ['Rodríguez', '로드리게스'], ['Romero', '로메로'], ['Acosta', '아코스타']],
  },
  {
    nationality: 'Senegal',
    weight: 3,
    given: [['Moussa', '무사'], ['Cheikhou', '셰이쿠'], ['Idrissa', '이드리사'], ['Ismaïla', '이스마일라']],
    family: [['Diop', '디오프'], ['Ndiaye', '은디아예'], ['Sarr', '사르'], ['Gueye', '게예']],
  },
  {
    nationality: 'Nigeria',
    weight: 3,
    given: [['Ahmed', '아메드'], ['Kelechi', '켈레치'], ['Samuel', '새뮤얼'], ['Victor', '빅터']],
    family: [['Okafor', '오카포르'], ['Adeyemi', '아데예미'], ['Musa', '무사'], ['Eze', '에제']],
  },
  {
    nationality: 'Denmark',
    weight: 3,
    given: [['Mads', '마스'], ['Kasper', '카스페르'], ['Mikkel', '미켈'], ['Rasmus', '라스무스']],
    family: [['Jensen', '옌센'], ['Nielsen', '닐센'], ['Hansen', '한센'], ['Larsen', '라르센']],
  },
  {
    nationality: 'Norway',
    weight: 2,
    given: [['Magnus', '망누스'], ['Sander', '산데르'], ['Henrik', '헨리크']],
    family: [['Berg', '베르그'], ['Haugen', '하우겐'], ['Solberg', '솔베르그']],
  },
];
