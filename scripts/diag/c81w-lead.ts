// C.81w: 저장본 리그별 득점 1~3위 (이름·골·OVR 군) — 시즌별
import { readdirSync, readFileSync } from 'node:fs';
import type { GameState } from '../../src/game';
import { buildResumes } from '../../src/awards';
const dirs = process.argv.slice(2).filter((a) => a !== '--');
const BIG = ['pl', 'laliga', 'seriea', 'bundesliga', 'ligue1'];
for (const dir of dirs) for (const f of readdirSync(dir).filter((f) => /^(all|mine)-.*-s\d+\.json$/.test(f)).sort()) {
  const g = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as GameState;
  const my = (g.league as { id: string }).id;
  const rs = buildResumes(g).filter((r) => !r.me);
  const line = BIG.map((lg) => { const t = rs.filter((r) => r.lg === lg).sort((a, b) => b.goals - a.goals).slice(0, 3); return `${lg === my ? '*' : ''}${lg} ${t.map((r) => `${r.name.slice(0, 6)}${r.goals}(${r.group})`).join(' ')}`; });
  console.log(f.replace('.json', ''), '|', line.join(' | '));
}
