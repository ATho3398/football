// 실제 선수 약발 1~5 (부록 C.45, pending 47 1). 2018-19 시즌 무렵 공개 게임 데이터(FIFA 19 약발 별점) 기준 근사값.
// 키·몸무게·주발은 선수 데이터(stars.ts·messi.ts)의 2018-19 값을 그대로 쓴다. 'both'(손흥민)는 오른발 + 약발 5로 읽는다

export const REAL_WEAK_FOOT: Readonly<Record<string, 1 | 2 | 3 | 4 | 5>> = {
  messi: 4, salah: 3, 'van-dijk': 3, mane: 4, firmino: 4, 'alexander-arnold': 3, 'de-bruyne': 5, aguero: 4, sterling: 3, sane: 2,
  foden: 3, hazard: 4, kante: 3, kane: 4, son: 5, eriksen: 3, pogba: 4, rashford: 3, aubameyang: 4, ronaldo: 4, neymar: 5, mbappe: 4,
  griezmann: 3, modric: 4, ramos: 3, kroos: 5, lewandowski: 4, suarez: 4, busquets: 3, sancho: 3, vinicius: 4, dybala: 3, kimmich: 4,
  havertz: 3,
};
