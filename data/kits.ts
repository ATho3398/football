// 구단·대표팀 유니폼 (부록 C.45, docs/design/pixel-kits.md 4번): 도트 팩 32종(단색 C01~C11, 줄무늬 S01~S21) 중 실제 색에 가장 가까운 것(근사).
// 원정은 2018-19 원정 유니폼 색 기준, 팩에 없는 색(분홍·회색 등)은 가까운 색으로 바꿨다. 표에 없는 구단은 TEAM_COLORS 주 색에서 자동(src/pixel.ts)
// 단색: C01 빨강 C02 흰 C03 파랑 C04 하늘 C05 검정 C06 노랑 C07 초록 C08 남색 C09 주황 C10 보라 C11 클라렛

import { OUTSIDE_TO_LEAGUE } from './clubAlias';

export interface KitPair { home: string; away: string }

/** 구단 id → 홈·원정 (PL 20 + 리그 밖 34, 4.1·4.2) */
const CLUB_KITS_BASE: Readonly<Record<string, KitPair>> = {
  // PL 2018-19
  mci: { home: 'C04', away: 'C08' },
  liv: { home: 'C01', away: 'C02' },
  che: { home: 'C03', away: 'C02' },
  tot: { home: 'C02', away: 'C08' },
  mun: { home: 'C01', away: 'C02' }, // 실제 원정 분홍
  ars: { home: 'C01', away: 'C08' },
  eve: { home: 'C03', away: 'C05' },
  lei: { home: 'C03', away: 'C05' },
  whu: { home: 'C11', away: 'C04' },
  wol: { home: 'C09', away: 'C05' }, // 금색 대용
  cry: { home: 'S10', away: 'C02' },
  wat: { home: 'C06', away: 'C05' },
  bou: { home: 'S04', away: 'C03' }, // 적흑 줄
  new: { home: 'S01', away: 'C08' }, // 흑백 줄
  sou: { home: 'S05', away: 'C05' }, // 적백 줄
  bur: { home: 'C11', away: 'C04' },
  bha: { home: 'S06', away: 'C06' }, // 청백 줄
  ful: { home: 'C02', away: 'C05' },
  car: { home: 'C03', away: 'C05' },
  hud: { home: 'S06', away: 'C06' },
  // 리그 밖 (data/outsideClubs.ts)
  'x:bar': { home: 'S02', away: 'C06' },
  'x:rma': { home: 'C02', away: 'C08' },
  'x:juv': { home: 'S01', away: 'C08' },
  'x:bay': { home: 'C01', away: 'C02' },
  'x:psg': { home: 'S21', away: 'C02' },
  'x:atm': { home: 'S05', away: 'C08' },
  'x:bvb': { home: 'C06', away: 'C05' },
  'x:nap': { home: 'C04', away: 'C02' },
  'x:int': { home: 'S03', away: 'C02' },
  'x:rom': { home: 'C11', away: 'C02' },
  'x:mil': { home: 'S04', away: 'C02' },
  'x:b04': { home: 'C01', away: 'C05' },
  'x:sev': { home: 'C02', away: 'C01' },
  'x:ol': { home: 'C02', away: 'C08' },
  'x:ajx': { home: 'S18', away: 'C08' },
  'x:fcp': { home: 'S06', away: 'C05' },
  'x:slb': { home: 'C01', away: 'C02' },
  'x:vil': { home: 'C06', away: 'C08' },
  'x:zen': { home: 'C04', away: 'C02' },
  'x:asm': { home: 'S19', away: 'C05' }, // 적백 반반
  'x:gal': { home: 'C01', away: 'C02' },
  'x:cel': { home: 'S13', away: 'C06' },
  'x:psv': { home: 'S05', away: 'C05' },
  'x:avl': { home: 'C11', away: 'C04' },
  'x:wba': { home: 'S08', away: 'C06' },
  'x:lee': { home: 'C02', away: 'C08' },
  'x:sto': { home: 'S05', away: 'C05' },
  'x:der': { home: 'C02', away: 'C05' },
  'x:nor': { home: 'C06', away: 'C05' },
  'x:bri': { home: 'C01', away: 'C02' },
  'x:not': { home: 'C01', away: 'C02' },
  'x:mid': { home: 'C01', away: 'C05' },
  'x:ipw': { home: 'C03', away: 'C01' },
  'x:wig': { home: 'S06', away: 'C01' },
};

/** 국가(BALANCE.appearance.byNationality 이름) → 홈·원정 (2018 월드컵 무렵, 4.3). 대표팀 경기 팀 id 는 `n:<국가>` */
/** 구단 표 + 같은 클럽의 리그 데이터 id (C.75y, 45b: laliga:bar = x:bar). 표에 없는 리그 팀은 팀 색에서 자동 (src/pixel.ts) */
export const CLUB_KITS: Readonly<Record<string, KitPair>> = {
  ...CLUB_KITS_BASE,
  ...Object.fromEntries(Object.entries(CLUB_KITS_BASE).flatMap(([id, k]) => (OUTSIDE_TO_LEAGUE[id] ? [[OUTSIDE_TO_LEAGUE[id]!, k] as const] : []))),
};

export const NATION_KITS: Readonly<Record<string, KitPair>> = {
  England: { home: 'C02', away: 'C01' },
  Scotland: { home: 'C08', away: 'C02' },
  'Republic of Ireland': { home: 'C07', away: 'C02' },
  'Northern Ireland': { home: 'C07', away: 'C02' },
  Wales: { home: 'C01', away: 'C05' },
  France: { home: 'C08', away: 'C02' },
  Spain: { home: 'C01', away: 'C02' },
  Portugal: { home: 'C11', away: 'C02' },
  Germany: { home: 'C02', away: 'C07' },
  Netherlands: { home: 'C09', away: 'C08' },
  Belgium: { home: 'C01', away: 'C06' },
  Brazil: { home: 'C06', away: 'C03' },
  Argentina: { home: 'S07', away: 'C05' }, // 하늘·흰 줄
  Uruguay: { home: 'C04', away: 'C02' },
  Senegal: { home: 'C02', away: 'C07' },
  Nigeria: { home: 'C07', away: 'C02' },
  Egypt: { home: 'C01', away: 'C02' },
  Gabon: { home: 'C06', away: 'C07' },
  Denmark: { home: 'C01', away: 'C02' },
  Norway: { home: 'C01', away: 'C02' },
  'Korea Republic': { home: 'C01', away: 'C02' },
  Japan: { home: 'C08', away: 'C02' },
  China: { home: 'C01', away: 'C02' },
};
