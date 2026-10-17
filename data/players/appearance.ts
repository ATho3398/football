import type { Appearance } from '../../src/appearance';

// 실제 선수 외모군 (부록 C.43). 사진이 없을 때 기본 얼굴 이미지를 고르는 데 쓴다. 표에 없으면 국적 분포로 뽑는다
export const REAL_APPEARANCE: Readonly<Record<string, Appearance>> = {
  messi: 'latinMideast', salah: 'latinMideast', 'van-dijk': 'black', mane: 'black', firmino: 'latinMideast',
  'alexander-arnold': 'white', 'de-bruyne': 'irish', aguero: 'latinMideast', sterling: 'black', sane: 'black',
  foden: 'white', hazard: 'white', kane: 'white', son: 'eastAsian', eriksen: 'white', pogba: 'black',
  rashford: 'black', aubameyang: 'black', ronaldo: 'latinMideast', neymar: 'latinMideast', mbappe: 'black',
  griezmann: 'white', modric: 'white', ramos: 'latinMideast', kroos: 'white', lewandowski: 'white',
  suarez: 'latinMideast', busquets: 'latinMideast', sancho: 'black', vinicius: 'black', dybala: 'latinMideast',
  kimmich: 'white', havertz: 'white',
};
