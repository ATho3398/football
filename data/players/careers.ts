// 실제 선수 유스 구단·지금 구단 입단 시즌 (C.45 14번, 커리어 태그 판정). 2018-19 시즌 무렵 공개 경력 기준.
// youth: 게임 구단 id(리그 밖은 `x:...`) 또는 게임에 없는 구단이면 한글 이름. since: 지금 구단 1군 첫 시즌(시작 연도)

export const REAL_CAREER: Readonly<Record<string, { youth: string; since: number }>> = {
  messi: { youth: 'x:bar', since: 2004 }, salah: { youth: '엘 모카울룬', since: 2017 }, 'van-dijk': { youth: '빌럼 II', since: 2017 },
  mane: { youth: '제네라시옹 풋', since: 2016 }, firmino: { youth: '피게이렌스', since: 2015 }, 'alexander-arnold': { youth: 'liv', since: 2016 },
  'de-bruyne': { youth: '헹크', since: 2015 }, aguero: { youth: '인데펜디엔테', since: 2011 }, sterling: { youth: 'QPR', since: 2015 },
  sane: { youth: '샬케 04', since: 2016 }, foden: { youth: 'mci', since: 2017 }, hazard: { youth: '릴', since: 2012 },
  kante: { youth: 'JS 쉬렌', since: 2016 }, kane: { youth: 'tot', since: 2011 }, son: { youth: '함부르크', since: 2015 },
  eriksen: { youth: 'x:ajx', since: 2013 }, pogba: { youth: 'mun', since: 2016 }, rashford: { youth: 'mun', since: 2015 },
  aubameyang: { youth: 'x:mil', since: 2017 }, ronaldo: { youth: '스포르팅', since: 2018 }, neymar: { youth: '산투스', since: 2017 },
  mbappe: { youth: 'x:asm', since: 2017 }, griezmann: { youth: '레알 소시에다드', since: 2014 }, modric: { youth: '디나모 자그레브', since: 2012 },
  ramos: { youth: 'x:sev', since: 2005 }, kroos: { youth: 'x:bay', since: 2014 }, lewandowski: { youth: '델타 바르샤바', since: 2014 },
  suarez: { youth: '나시오날', since: 2014 }, busquets: { youth: 'x:bar', since: 2008 }, sancho: { youth: 'mci', since: 2017 },
  vinicius: { youth: '플라멩구', since: 2018 }, dybala: { youth: '인스티투토', since: 2015 }, kimmich: { youth: '슈투트가르트', since: 2015 },
  havertz: { youth: 'x:b04', since: 2016 },
};
