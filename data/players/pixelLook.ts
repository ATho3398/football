// 실제 선수 도트 아이콘 인물 (부록 C.45, docs/design/pixel-kits.md 5번): 2018-19 시즌 모습 기준(웹 검색 확인).
// 피부·머리 키는 내부용(화면에 노출하지 않음). 표에 없는 실제 선수는 외모군 분포 규칙(src/pixel.ts). 실제 선수를 늘릴 때 이 표도 같이 채운다

export interface PixelLook { skin: string; hair: string }

export const REAL_PIXEL_LOOK: Readonly<Record<string, PixelLook>> = {
  messi: { skin: 'white', hair: 'brown' },
  salah: { skin: 'mideast', hair: 'black' }, // 곱슬
  'van-dijk': { skin: 'black', hair: 'black' },
  mane: { skin: 'black', hair: 'black' },
  firmino: { skin: 'mideast', hair: 'black' },
  'alexander-arnold': { skin: 'mideast', hair: 'black' }, // 혼혈, 중간 톤
  'de-bruyne': { skin: 'white', hair: 'blonde' }, // 붉은 머리 대용
  aguero: { skin: 'mideast', hair: 'black' },
  sterling: { skin: 'black', hair: 'black' },
  sane: { skin: 'black', hair: 'black' },
  foden: { skin: 'white', hair: 'brown' },
  hazard: { skin: 'white', hair: 'brown' },
  kante: { skin: 'black', hair: 'black' },
  kane: { skin: 'white', hair: 'brown' },
  son: { skin: 'yellow', hair: 'black' },
  eriksen: { skin: 'white', hair: 'blonde' },
  pogba: { skin: 'black', hair: 'black' }, // 2018 월드컵 무렵은 염색 없음
  rashford: { skin: 'black', hair: 'black' },
  aubameyang: { skin: 'black', hair: 'black' }, // 2018 염색 기록 없음
  ronaldo: { skin: 'white', hair: 'black' },
  neymar: { skin: 'white', hair: 'blonde' }, // 2018 월드컵 백금발, mideast+금발 조합이 없어 white
  mbappe: { skin: 'black', hair: 'bald' }, // 짧게 민 머리
  griezmann: { skin: 'white', hair: 'brown' }, // 2018은 짙은 짧은 머리
  modric: { skin: 'white', hair: 'brown' },
  ramos: { skin: 'mideast', hair: 'brown' },
  kroos: { skin: 'white', hair: 'blonde' },
  lewandowski: { skin: 'white', hair: 'black' },
  suarez: { skin: 'mideast', hair: 'black' },
  busquets: { skin: 'white', hair: 'black' },
  sancho: { skin: 'black', hair: 'black' },
  vinicius: { skin: 'black', hair: 'black' },
  dybala: { skin: 'white', hair: 'black' },
  kimmich: { skin: 'white', hair: 'brown' },
  havertz: { skin: 'white', hair: 'blonde' },
};
