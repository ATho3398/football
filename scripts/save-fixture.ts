// 세이브 이전 테스트용 예시 세이브 만들기 (C.80y): 지금 SAVE_FORMAT_VERSION 형식의 실제 세이브를 tests/fixtures/saves/v{n}.json 으로.
// 새 게임(유망주 ST, 고정 시드) → 소집부터 약 6주(엔진 경기 1 + 간이 경기들) 진행 → serialize.
// SAVE_FORMAT_VERSION 을 올리는 패치는 이전 단계를 넣은 뒤 이 스크립트로 새 버전 fixture 를 추가한다 (옛 fixture 는 지우지 않는다).
// 사용: npm run save:fixture [-- --out 디렉터리]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { addDays } from '../src/calendar';
import { endDay, isMatchDay, newGame, playOthers, playRound, SAVE_FORMAT_VERSION } from '../src/game';
import { serialize } from '../src/save';

const outArg = process.argv.indexOf('--out');
const dir = outArg >= 0 ? process.argv[outArg + 1]! : 'tests/fixtures/saves';
const g = newGame({ mode: 'prospect', position: 'ST', seed: 'save-fixture', difficulty: 'normal', name: '픽스처' });
const until = addDays(g.calendar.date, 42);
let matches = 0;
while (g.phase === 'season' && g.calendar.date < until) {
  if (isMatchDay(g)) {
    playRound(g, matches === 0 ? {} : { engine: 'quick' });
    matches++;
  } else {
    playOthers(g, 'quick');
    endDay(g);
  }
}
const json = serialize(g);
mkdirSync(dir, { recursive: true });
const file = join(dir, `v${SAVE_FORMAT_VERSION}.json`);
writeFileSync(file, json + '\n');
console.log(`${file}: 형식 ${SAVE_FORMAT_VERSION} · ${g.calendar.date} · 라운드 ${g.league.round} · 내 경기 ${matches} · ${(json.length / 1024).toFixed(0)} KB`);
