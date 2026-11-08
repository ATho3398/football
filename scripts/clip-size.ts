// C.77o 하이라이트 클립 세이브 크기 측정 (24.6): 경기당 클립 JSON·gzip 크기와 CLIP.keep 경기를 담은 세이브 증가분
import { gzipSync } from 'node:zlib';
import { playMyMatch } from '../src/engine/adapter';
import { packReplay } from '../src/replayCodec';
import { CLIP, makeMatchClips, withClips, type MatchClips } from '../src/highlightClips';
import { createTeamRoster } from '../src/roster';
import { newGame } from '../src/game';
import { serialize } from '../src/save';

const my = createTeamRoster({ id: 'h', rating: 76 }, 'cs-h', 2018, []);
const opp = createTeamRoster({ id: 'a', rating: 75 }, 'cs-a', 2018, []);
const sizes: number[] = [], gz: number[] = [], counts: number[] = [], full: number[] = [];
let list: MatchClips[] = [];
const N = Number(process.argv[2] ?? 12);
for (let s = 1; s <= N; s++) {
  const r = playMyMatch({
    myRoster: my, oppRoster: opp, myRating: 76, oppRating: 75, home: s % 2 === 0,
    me: { position: 'ST', attributes: my.players.find((p) => p.position === 'ST')!.attributes!, fatigue: 0, form: 0 },
    plan: { started: true, minutes: { start: 0, end: 90 } }, difficulty: 'normal', seed: s, worldSeed: 'cs',
  }, { teams: ['홈', '원정'] }).replay!;
  const mc = makeMatchClips(r, { season: 2018, round: s, label: `${s}R` });
  if (!mc) continue;
  const j = JSON.stringify(mc);
  sizes.push(j.length); gz.push(gzipSync(j).length); counts.push(mc.clips.length);
  full.push(gzipSync(JSON.stringify(packReplay(r))).length);
  list = withClips(list, mc);
}
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const g = newGame({ mode: 'prospect', position: 'ST', seed: 'cs', difficulty: 'normal' });
const s0 = serialize(g);
g.clips = list;
const s1 = serialize(g);
console.log(`경기 ${sizes.length} · 클립 평균 ${avg(counts).toFixed(2)}개`);
console.log(`경기당 클립 JSON 평균 ${(avg(sizes) / 1024).toFixed(1)} KB · gzip ${(avg(gz) / 1024).toFixed(1)} KB (참고: 최근 경기 전체 리플레이(packReplay) gzip ${(avg(full) / 1024).toFixed(0)} KB)`);
console.log(`세이브(새 게임) JSON ${(s0.length / 1024).toFixed(0)} KB · gzip ${(gzipSync(s0).length / 1024).toFixed(0)} KB`);
console.log(`+ 클립 ${list.length}경기(keep ${CLIP.keep}) JSON ${(s1.length / 1024).toFixed(0)} KB · gzip ${(gzipSync(s1).length / 1024).toFixed(0)} KB`);
