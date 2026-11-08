// C.82e: 게겐 행 6칸만 다시 잰 960 을 기준 960(c81z) 위에 끼워 전체 표를 만든다. 대조 칸(균형/티키)은 기준과 비트 단위로 같아야 한다(다른 15칸이 무변경이라는 증거).
// node scripts/diag/c82e/splice.cjs out.json base.json new.json
const fs = require('fs');
const [out, baseF, newF] = process.argv.slice(2);
const base = JSON.parse(fs.readFileSync(baseF, 'utf8'));
const nw = JSON.parse(fs.readFileSync(newF, 'utf8'));
const key = (r) => `${r.a}/${r.b}`;
const m = new Map(nw.map((r) => [key(r), r]));
const ctrl = m.get('balanced/tikitaka');
const bctrl = base.find((r) => key(r) === 'balanced/tikitaka');
const same = ctrl && bctrl && ctrl.gf === bctrl.gf && ctrl.ga === bctrl.ga && ctrl.n === bctrl.n && JSON.stringify(ctrl.unit) === JSON.stringify(bctrl.unit);
console.log(`대조 칸 균형/티키 기준과 ${same ? '같음 ✓' : '다름 ✗'} (gf ${bctrl?.gf} → ${ctrl?.gf}, ga ${bctrl?.ga} → ${ctrl?.ga})`);
const merged = base.map((r) => (key(r) !== 'balanced/tikitaka' && m.has(key(r)) ? m.get(key(r)) : r));
fs.writeFileSync(out, JSON.stringify(merged));
console.log(`${out}: 바뀐 칸 ${merged.filter((r, i) => r !== base[i]).length}`);
