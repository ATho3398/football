// C.81p 캡처용 긴 이름 세이브 2벌 (vite-node): ① 피르미누(실제 선수, 리버풀) — 모든 로스터 이름을 긴 이름으로 바꾸고 엔진 경기 6번
// ② 은퇴한 가상 선수 "엘리아키무 망갈라" (34세 한 시즌 → 은퇴). 사용: npx vite-node scripts/c81p-save.ts -- <저장 폴더>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { endDay, isMatchDay, newGame, playOthers, playRound, retire, type GameState } from '../src/game';
import { serialize } from '../src/save';

const dir = process.argv.at(-1)!.endsWith('.ts') ? 'tmp-c81p' : process.argv.at(-1)!;
mkdirSync(dir, { recursive: true });
const LONG = ['엘리아키무 망갈라', '스튜어트 플렉', '트렌트 알렉산더아놀드', '알렉스 옥슬레이드체임벌린', '조르지니우 바이날둠', '크리스티안 풀리시치', '피에르에메릭 오바메양', '오렐리앵 추아메니', '세르지 그나브리', '안드레 프랑크 잠보앙귀사'];

function lengthen(g: GameState): void {
  let k = 0;
  for (const r of Object.values(g.rosters)) for (const p of r.players) { p.nameKo = LONG[k++ % LONG.length]!; }
}
function play(g: GameState, matches: number): void {
  let n = 0;
  while (g.phase === 'season' && n < matches) {
    if (isMatchDay(g)) { playRound(g, {}); n++; } else { playOthers(g, 'quick'); endDay(g); }
  }
}

const a = newGame({ mode: 'real', playerId: 'firmino', seed: 'c81p-firmino', difficulty: 'normal' });
play(a, 4); // 마지막이 리그 경기
lengthen(a); // 경기 중 로스터를 다시 만들 수 있어 경기 뒤에 바꾼다
// 마지막 경기 득점 기록: 우리 팀 첫 골 = 내 골(도움 = 긴 이름 동료) — "골! 호베르투 피르미누 (도움 엘리아키무 망갈라)" 줄
{
  const m = a.lastMatch!;
  const fx = a.league.schedule[m.round - 1]!.find((f) => f.home === a.player.teamId || f.away === a.player.teamId)!;
  const side = fx.home === a.player.teamId ? 0 : 1;
  const mate = a.rosters[a.player.teamId]!.players.find((p) => p.nameKo === LONG[0]) ?? a.rosters[a.player.teamId]!.players[0]!;
  mate.nameKo = LONG[0]!;
  const g0 = fx.g?.find((x) => x[1] === side);
  if (g0) { g0[2] = 'me'; g0[3] = mate.id; }
} // 마지막이 리그 경기(양 팀 득점자 = 긴 이름 로스터)
writeFileSync(join(dir, 'firmino.json'), serialize(a));
console.log('firmino', a.player.name, a.calendar.date, a.league.round, a.lastMatch?.result.goalsFor, a.lastMatch?.result.goalsAgainst);

// ③ 시즌 후반(3월) 피르미누 — 컵·챔스 녹아웃 결과가 쌓인 상태 (빠른 경기)
const c = newGame({ mode: 'real', playerId: 'firmino', seed: 'c81p-firmino', difficulty: 'normal' });
while (c.phase === 'season' && c.league.round < 30) { if (isMatchDay(c)) playRound(c, { engine: 'quick' }); else { playOthers(c, 'quick'); endDay(c); } }
lengthen(c);
writeFileSync(join(dir, 'firmino-late.json'), serialize(c));
console.log('late', c.calendar.date, c.league.round);

const b = newGame({ mode: 'prospect', position: 'ST', seed: 'c81p-ret', difficulty: 'normal', name: '엘리아키무 망갈라' });
b.player.age = 34;
while (b.phase === 'season') playRound(b, { engine: 'quick' });
retire(b);
writeFileSync(join(dir, 'retired.json'), serialize(b));
console.log('retired', b.player.name, b.phase, b.player.age);
