// C.82l: appendix.md 를 docs/game-design.md 의 "### C.82k" 바로 앞에 끼운다 (한 번만)
const fs = require('fs');
const doc = fs.readFileSync('docs/game-design.md', 'utf8');
if (doc.includes('### C.82l ')) { console.log('already'); process.exit(0); }
const app = fs.readFileSync('scripts/diag/c82l/appendix.md', 'utf8').trimEnd() + '\n\n';
if (/\{\{[A-Z0-9_]+\}\}/.test(app)) { console.error('placeholder 남음: ' + app.match(/\{\{[A-Z0-9_]+\}\}/g).join(' ')); process.exit(1); }
const i = doc.indexOf('### C.82k ');
if (i < 0) throw new Error('anchor');
fs.writeFileSync('docs/game-design.md', doc.slice(0, i) + app + doc.slice(i));
console.log('inserted');
