// 더비·라이벌 (C.44 pending 52 5번): 2018-19 프리미어리그 기준 팀별 라이벌. 명시 표가 먼저,
// 표에 없는 구단(리그 밖·앞으로의 가상 구단)은 같은 지역(REGION)이면 지역 더비로 자동 지정한다.
// 경기 영향(5-2 라이벌 이벤트·큰 경기 배율)은 아직 없다 — BALANCE.derby 훅(배율 1)

export interface DerbyDef {
  /** 두 팀 id (순서 없음) */
  teams: readonly [string, string];
  /** 더비 이름 */
  name: string;
  /** 큰 더비 (북런던·머지사이드·맨체스터·노스웨스트 등). 5-2 큰 경기 배율 훅 */
  big?: boolean;
}

export const DERBIES: readonly DerbyDef[] = [
  { teams: ['ars', 'tot'], name: '북런던 더비', big: true },
  { teams: ['liv', 'eve'], name: '머지사이드 더비', big: true },
  { teams: ['mun', 'mci'], name: '맨체스터 더비', big: true },
  { teams: ['liv', 'mun'], name: '노스웨스트 더비', big: true },
  { teams: ['che', 'ars'], name: '런던 더비' },
  { teams: ['che', 'tot'], name: '런던 더비' },
  { teams: ['whu', 'tot'], name: '런던 더비' },
  { teams: ['whu', 'che'], name: '런던 더비' },
  { teams: ['whu', 'ars'], name: '런던 더비' },
  { teams: ['che', 'ful'], name: '서런던 더비' },
  { teams: ['cry', 'bha'], name: 'M23 더비' },
  { teams: ['sou', 'bou'], name: '사우스코스트 더비' },
  { teams: ['sou', 'bha'], name: '사우스코스트 더비' },
  { teams: ['new', 'x:mid'], name: '티스–타인 더비' },
  { teams: ['wol', 'x:wba'], name: '블랙 컨트리 더비' },
  { teams: ['wol', 'x:avl'], name: '웨스트 미들랜즈 더비' },
  { teams: ['x:wba', 'x:avl'], name: '웨스트 미들랜즈 더비' },
  { teams: ['lei', 'x:not'], name: '이스트 미들랜즈 더비' },
  { teams: ['x:der', 'x:not'], name: '이스트 미들랜즈 더비', big: true },
  { teams: ['hud', 'x:lee'], name: '웨스트 요크셔 더비' },
  { teams: ['mun', 'x:lee'], name: '장미 더비' },
  { teams: ['x:nor', 'x:ipw'], name: '이스트 앵글리아 더비', big: true },
  { teams: ['x:rma', 'x:atm'], name: '마드리드 더비', big: true },
  { teams: ['x:rma', 'x:bar'], name: '엘 클라시코', big: true },
  { teams: ['x:int', 'x:mil'], name: '밀라노 더비', big: true },
  { teams: ['x:int', 'x:juv'], name: '데르비 디탈리아', big: true },
  { teams: ['x:bay', 'x:bvb'], name: '데어 클라시커', big: true },
  { teams: ['x:fcp', 'x:slb'], name: '오 클라시코', big: true },
  { teams: ['x:ajx', 'x:psv'], name: '더 토퍼르', big: true },
  { teams: ['x:psg', 'x:ol'], name: '르 클라시크' },
];

/** 연고 지역: 명시 표에 없는 조합의 자동 더비에 쓴다 (같은 지역 = 지역 더비) */
export const REGION: Readonly<Record<string, string>> = {
  ars: 'london', tot: 'london', che: 'london', whu: 'london', cry: 'london', ful: 'london',
  liv: 'merseyside', eve: 'merseyside', mun: 'manchester', mci: 'manchester',
  new: 'northeast', 'x:mid': 'northeast', sou: 'southcoast', bou: 'southcoast', bha: 'southcoast',
  wol: 'westmidlands', 'x:wba': 'westmidlands', 'x:avl': 'westmidlands', lei: 'eastmidlands', 'x:not': 'eastmidlands', 'x:der': 'eastmidlands',
  hud: 'yorkshire', 'x:lee': 'yorkshire', bur: 'lancashire', wat: 'hertfordshire', car: 'wales',
  'x:sto': 'staffordshire', 'x:nor': 'eastanglia', 'x:ipw': 'eastanglia', 'x:bri': 'westcountry', 'x:wig': 'lancashire',
  'x:rma': 'madrid', 'x:atm': 'madrid', 'x:bar': 'catalonia', 'x:int': 'milan', 'x:mil': 'milan', 'x:juv': 'turin', 'x:rom': 'rome', 'x:nap': 'naples',
  'x:bay': 'bavaria', 'x:bvb': 'ruhr', 'x:b04': 'rhineland', 'x:psg': 'paris', 'x:ol': 'lyon', 'x:asm': 'monaco',
  'x:sev': 'seville', 'x:vil': 'valencia', 'x:ajx': 'amsterdam', 'x:psv': 'eindhoven', 'x:fcp': 'porto', 'x:slb': 'lisbon',
  'x:zen': 'stpetersburg', 'x:gal': 'istanbul', 'x:cel': 'glasgow',
};

/** 지역 더비 이름 (자동) */
export const REGION_DERBY_KO: Readonly<Record<string, string>> = {
  london: '런던 더비', merseyside: '머지사이드 더비', manchester: '맨체스터 더비', northeast: '북동부 더비', southcoast: '사우스코스트 더비',
  westmidlands: '웨스트 미들랜즈 더비', eastmidlands: '이스트 미들랜즈 더비', yorkshire: '요크셔 더비', lancashire: '랭커셔 더비', eastanglia: '이스트 앵글리아 더비',
  madrid: '마드리드 더비', milan: '밀라노 더비',
};
