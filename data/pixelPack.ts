// 자동 생성 (scripts/splitPixelPack.ts) — 직접 고치지 마세요. public/faces/pixel/manifest.json 과 같은 표 (부록 C.45).
// 유니폼 id → 레이어 키·몸통 색(많은 순)·몸통 픽셀 평균색, 피부 → 가능한 머리

export const PIXEL_SIZE = 16;
export const PIXEL_ORDER = 'kit-over-person' as const;

export const PIXEL_KITS: Readonly<Record<string, { key: string; colors: readonly string[]; mean: string }>> = {
  C01: { key: 'C01_solid_red', colors: ['#c8102e'], mean: '#c8102e' },
  C02: { key: 'C02_solid_white', colors: ['#f5f5f5'], mean: '#f5f5f5' },
  C03: { key: 'C03_solid_blue', colors: ['#1d4ed8'], mean: '#1d4ed8' },
  C04: { key: 'C04_solid_sky', colors: ['#6cabdd'], mean: '#6cabdd' },
  C05: { key: 'C05_solid_black', colors: ['#1a1a1a'], mean: '#1a1a1a' },
  C06: { key: 'C06_solid_yellow', colors: ['#f5c518'], mean: '#f5c518' },
  C07: { key: 'C07_solid_green', colors: ['#1b8a3a'], mean: '#1b8a3a' },
  C08: { key: 'C08_solid_navy', colors: ['#1f2a44'], mean: '#1f2a44' },
  C09: { key: 'C09_solid_orange', colors: ['#f36c21'], mean: '#f36c21' },
  C10: { key: 'C10_solid_purple', colors: ['#5b2c83'], mean: '#5b2c83' },
  C11: { key: 'C11_solid_claret', colors: ['#7a263a'], mean: '#7a263a' },
  S01: { key: 'S01_juventus', colors: ['#1a1a1a', '#f5f5f5'], mean: '#797979' },
  S02: { key: 'S02_barcelona', colors: ['#1d4ed8', '#7a263a'], mean: '#453d93' },
  S03: { key: 'S03_inter', colors: ['#1a1a1a', '#1d4ed8'], mean: '#1b316d' },
  S04: { key: 'S04_ac_milan', colors: ['#c8102e', '#1a1a1a'], mean: '#7c1425' },
  S05: { key: 'S05_atletico', colors: ['#c8102e', '#f5f5f5'], mean: '#dc7485' },
  S06: { key: 'S06_porto', colors: ['#1d4ed8', '#f5f5f5'], mean: '#7b97e5' },
  S07: { key: 'S07_racing_club', colors: ['#6cabdd', '#f5f5f5'], mean: '#a8cbe7' },
  S08: { key: 'S08_west_brom', colors: ['#1f2a44', '#f5f5f5'], mean: '#7c8291' },
  S09: { key: 'S09_hull_city', colors: ['#f36c21', '#1a1a1a'], mean: '#95481e' },
  S10: { key: 'S10_crystal_palace', colors: ['#c8102e', '#1d4ed8'], mean: '#7e2b78' },
  S11: { key: 'S11_valladolid', colors: ['#5b2c83', '#f5f5f5'], mean: '#9e83b5' },
  S12: { key: 'S12_vitesse', colors: ['#f5c518', '#1a1a1a'], mean: '#967b19' },
  S13: { key: 'S13_celtic', colors: ['#1b8a3a', '#f5f5f5'], mean: '#7ab98b' },
  S14: { key: 'S14_flamengo', colors: ['#c8102e', '#1a1a1a'], mean: '#7c1425' },
  S15: { key: 'S15_boca_juniors', colors: ['#1f2a44', '#f5c518'], mean: '#4e4c3a' },
  S16: { key: 'S16_river_plate', colors: ['#f5f5f5', '#c8102e'], mean: '#e9b9c1' },
  S17: { key: 'S17_vasco_da_gama', colors: ['#1a1a1a', '#f5f5f5'], mean: '#535353' },
  S18: { key: 'S18_ajax', colors: ['#f5f5f5', '#c8102e'], mean: '#e1919e' },
  S19: { key: 'S19_feyenoord', colors: ['#c8102e', '#f5f5f5'], mean: '#df8392' },
  S20: { key: 'S20_blackburn', colors: ['#1d4ed8', '#f5f5f5'], mean: '#89a2e7' },
  S21: { key: 'S21_psg', colors: ['#1f2a44', '#c8102e', '#f5f5f5'], mean: '#725066' },
};

export const PIXEL_PEOPLE: Readonly<Record<string, readonly string[]>> = {
  black: ['black', 'blonde', 'bald'],
  yellow: ['black', 'blonde', 'brown', 'bald'],
  white: ['black', 'blonde', 'brown', 'bald'],
  mideast: ['black', 'brown', 'bald'],
};
