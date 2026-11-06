import type { LeagueData, LeagueTeamData } from './types';

// 리가 포르투갈 2018-19 (45d5, 부록 C.75r): 실제 참가 18팀. 레이팅은 PL 척도(맨시티 85 ~ 허더즈필드 67)에 맞춘 상대 전력 추정치.
// 포르투·벤피카는 리그 밖 표(data/outsideClubs.ts x:fcp 76 · x:slb 75)와 같은 이름·레이팅. 중하위권은 챔피언십 중하위(60~64) 수준.
// 감독 = 2018-19 개막 감독 (벤피카 루이 비토리아 → 2019-01 브루누 라즈, 스포르팅 조제 페세이루 → 2018-11 마르셀 케이저르 → 키카스).

type T = [code: string, name: string, nameKo: string, rating: number, city: string, primary: string, secondary: string,
  manager: string, managerKo: string, stadium: string, stadiumKo: string];

const ROWS: T[] = [
  ['fcp', 'FC Porto', '포르투', 76, 'Porto', '#00428c', '#ffffff', 'Sérgio Conceição', '세르지우 콘세이상', 'Estádio do Dragão', '이스타디우 두 드라강'],
  ['slb', 'Benfica', '벤피카', 75, 'Lisbon', '#e83030', '#ffffff', 'Rui Vitória', '루이 비토리아', 'Estádio da Luz', '이스타디우 다 루스'],
  ['scp', 'Sporting CP', '스포르팅 CP', 73, 'Lisbon', '#008057', '#ffffff', 'José Peseiro', '조제 페세이루', 'Estádio José Alvalade', '이스타디우 조제 알발라드'],
  ['bra', 'SC Braga', '브라가', 71, 'Braga', '#dc0028', '#ffffff', 'Abel Ferreira', '아벨 페헤이라', 'Estádio Municipal de Braga', '이스타디우 무니시팔 드 브라가'],
  ['vsc', 'Vitória de Guimarães', '비토리아 기마랑이스', 67, 'Guimarães', '#ffffff', '#000000', 'Luís Castro', '루이스 카스트루', 'Estádio D. Afonso Henriques', '이스타디우 동 아폰수 엔히케스'],
  ['rav', 'Rio Ave', '히우 아베', 64, 'Vila do Conde', '#00804a', '#ffffff', 'José Gomes', '조제 고메스', 'Estádio do Rio Ave FC', '이스타디우 두 히우 아베'],
  ['mor', 'Moreirense', '모레이렌스', 63, 'Moreira de Cónegos', '#008a3e', '#ffffff', 'Ivo Vieira', '이부 비에이라', 'Parque de Jogos Comendador Joaquim de Almeida Freitas', '파르크 드 조구스 코멘다도르 조아킹 드 알메이다 프레이타스'],
  ['boa', 'Boavista', '보아비스타', 63, 'Porto', '#000000', '#ffffff', 'Jorge Simão', '조르즈 시망', 'Estádio do Bessa', '이스타디우 두 베사'],
  ['mar', 'Marítimo', '마리티무', 62, 'Funchal', '#00843d', '#e30613', 'Cláudio Braga', '클라우디우 브라가', 'Estádio do Marítimo', '이스타디우 두 마리티무'],
  ['scl', 'Santa Clara', '산타 클라라', 62, 'Ponta Delgada', '#e30613', '#ffffff', 'João Henriques', '조앙 엔히케스', 'Estádio de São Miguel', '이스타디우 드 상 미겔'],
  ['bel', 'Belenenses SAD', '벨레넨세스 SAD', 62, 'Oeiras', '#0047ab', '#ffffff', 'Silas', '실라스', 'Estádio Nacional', '이스타디우 나시오날'],
  ['por', 'Portimonense', '포르티모넨스', 61, 'Portimão', '#000000', '#ffffff', 'António Folha', '안토니우 폴랴', 'Estádio Municipal de Portimão', '이스타디우 무니시팔 드 포르티망'],
  ['vfc', 'Vitória de Setúbal', '비토리아 세투발', 61, 'Setúbal', '#00843d', '#ffffff', 'Lito Vidigal', '리투 비디갈', 'Estádio do Bonfim', '이스타디우 두 본핑'],
  ['ton', 'Tondela', '톤델라', 60, 'Tondela', '#ffd700', '#00843d', 'Pepa', '페파', 'Estádio João Cardoso', '이스타디우 조앙 카르도주'],
  ['ave', 'Desportivo das Aves', '아베스', 60, 'Vila das Aves', '#c8102e', '#ffffff', 'José Mota', '조제 모타', 'Estádio do CD Aves', '이스타디우 두 아베스'],
  ['fei', 'Feirense', '페이렌스', 59, 'Santa Maria da Feira', '#003399', '#ffffff', 'Nuno Manta Santos', '누누 만타 산투스', 'Estádio Marcolino de Castro', '이스타디우 마르콜리누 드 카스트루'],
  ['nac', 'Nacional', '나시오날', 59, 'Funchal', '#000000', '#ffffff', 'Costinha', '코스티냐', 'Estádio da Madeira', '이스타디우 다 마데이라'],
  ['cha', 'Chaves', '샤베스', 59, 'Chaves', '#003399', '#c8102e', 'Daniel Ramos', '다니엘 하무스', 'Estádio Municipal Eng. Manuel Branco Teixeira', '이스타디우 무니시팔 마누엘 브랑쿠 테이셰이라'],
];

const teams: LeagueTeamData[] = ROWS.map(([code, name, nameKo, rating, city, primary, secondary, manager, managerKo, stadium, stadiumKo]) => ({
  id: `primeira:${code}`, name, nameKo, rating, city, colors: { primary, secondary }, manager, managerKo, stadium, stadiumKo,
}));

export const LEAGUE: LeagueData = {
  id: 'primeira',
  name: 'Primeira Liga',
  nameKo: '리가 포르투갈',
  country: 'Portugal',
  tier: 1,
  season: '2018-19',
  calendar: 'autumn-spring',
  teams,
  derbies: [
    ['primeira:slb', 'primeira:fcp', '오 클라시쿠'],
    ['primeira:slb', 'primeira:scp', '리스본 더비'],
    ['primeira:fcp', 'primeira:scp', '클라시쿠'],
    ['primeira:bra', 'primeira:vsc', '미뉴 더비'],
    ['primeira:fcp', 'primeira:boa', '포르투 더비'],
    ['primeira:mar', 'primeira:nac', '마데이라 더비'],
  ],
};
