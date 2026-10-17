import { marketValue, valueLabel } from '../../src/finance';
const ex: [string, number, number, number, number, number?][] = [
 ['살라 급 (OVR 87, 26세, 4년)', 87, 26, 4, 88],
 ['더 브라위너 급 (85, 27세, 3년)', 85, 27, 3, 85],
 ['손흥민 급 (81, 26세, 3년)', 81, 26, 3, 82],
 ['알렉산더아놀드 급 (74, 20세, 4년, 전성기 84)', 74, 20, 4, 84],
 ['포든 급 (60, 18세, 3년, 전성기 85)', 60, 18, 3, 85],
 ['33세 베테랑 (80, 33세, 1년)', 80, 33, 1, 80],
 ['계약 만료 케인 급 (88, 25세, 0년)', 88, 25, 0, 89],
];
for (const [n, o, a, y, pk] of ex) console.log(n, valueLabel(marketValue({ ovr: o, age: a, yearsLeft: y, peak: pk })));
