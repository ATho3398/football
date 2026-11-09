// @ts-nocheck C.82j: tests/highlights.test.ts 시드 탐색 — 첫 장면 시작 뒤 1초 재생이 경기 1초인가
import { playMyMatch } from '../../../src/engine/adapter';
import { HL, selectScenes } from '../../../src/highlights';
import { ReplayPlayer } from '../../../src/ui/views/replay';
import { createTeamRoster } from '../../../src/roster';
const my = createTeamRoster({ id: 'h', rating: 75 }, 'hl-h', 2018, []);
const opp = createTeamRoster({ id: 'a', rating: 75 }, 'hl-a', 2018, []);
for (let seed = 111; seed <= 126; seed++) {
  const r = playMyMatch({ myRoster: my, oppRoster: opp, myRating: 75, oppRating: 75, home: true, me: { position: 'ST', attributes: my.players.find((p) => p.position === 'ST')!.attributes!, fatigue: 0, form: 0 }, plan: { started: true, minutes: { start: 0, end: 90 } }, difficulty: 'normal', seed, worldSeed: 'hl' }, { teams: ['홈', '원정'] }).replay!;
  const scenes = selectScenes(r);
  const p = new ReplayPlayer(r, () => {}); p.advance(1);
  const ok1 = Math.abs(p.e - (scenes[0].start + 1)) < 1e-6;
  p.speed = 2; p.advance(1);
  const ok2 = Math.abs(p.e - (scenes[0].start + 3)) < 1e-6;
  p.speed = 1; p.advance(scenes[0].end - p.e); const ok3 = p.mode === 'transition'; p.advance(HL.transition); const ok4 = p.mode === 'scene' && p.e === scenes[1]?.start;
  console.log(seed, ok1 && ok2 && ok3 && ok4 ? '✓' : '✗', ok1, ok2, ok3, ok4, scenes.length);
}
process.exit(0);
