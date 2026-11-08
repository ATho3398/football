// C.80a 측정: 한 시즌 NPC 출장 정지 수 (내 리그 팀당 퇴장·옐로 누적 정지), 세이브 크기 증가, 빠른 시즌 시간
// 실행: npx vite-node scripts/c80a-bans.ts -- [quick|engine] [시드 수, 기본 3]
import { BALANCE } from '../src/config/balance';
import { newGame, playRound, selectableRealPlayers } from '../src/game';
import { npcRedTotal } from '../src/npcBan';
import { seasonFrac, yellowBanMatches } from '../src/discipline';
import { serialize } from '../src/save';

const how = process.argv.includes('engine') ? 'engine' : 'quick';
const seeds = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 3);
const run = (seed: string, on: boolean) => {
  (BALANCE.discipline.npc as { on: boolean }).on = on;
  const g = newGame({ mode: 'real', playerId: selectableRealPlayers()[0]!.id, seed, difficulty: 'normal' });
  const t0 = Date.now();
  let mid = 0;
  let maxBanned = 0;
  // 옐로 누적 정지 (C.80d PL 규칙: 진행 비율이 있어 끝난 뒤 누적만으로는 못 셈) — 라운드마다 누적 변화로 센다
  let ybans = 0, ymatches = 0;
  while (g.phase === 'season') {
    const r = g.league.round;
    const before = Object.fromEntries(Object.entries(g.npcBan ?? {}).map(([id, b]) => [id, b[0]]));
    playRound(g, { engine: how === 'engine' ? 'agent' : 'quick', others: how, cards: false });
    for (const [id, b] of Object.entries(g.npcBan ?? {})) {
      const m = yellowBanMatches(before[id] ?? 0, b[0], seasonFrac(r, g.league.schedule.length));
      if (m > 0) { ybans++; ymatches += m; }
    }
    if (g.league.round === 19) mid = JSON.stringify(g.npcBan ?? {}).length;
    for (const t of g.league.teams) {
      const r = g.rosters[t.id];
      if (r) maxBanned = Math.max(maxBanned, r.players.filter((p) => (g.npcBan?.[p.id]?.[1] ?? 0) > 0).length);
    }
  }
  const ms = Date.now() - t0;
  const nt = g.league.teams.length;
  const reds = g.league.teams.reduce((s, t) => s + npcRedTotal(g.npcBan, (g.rosters[t.id]?.players ?? []).map((p) => p.id)), 0) / nt;
  const yel = ybans / nt;
  const ycards = Object.values(g.npcBan ?? {}).reduce((s, b) => s + b[0], 0) / nt;
  return { reds, yel, ym: ymatches / nt, ycards, ms, mid, end: JSON.stringify(g.npcBan ?? {}).length, save: serialize(g).length, maxBanned, entries: Object.keys(g.npcBan ?? {}).length };
};
let R = 0, Y = 0, YC = 0;
for (let k = 0; k < seeds; k++) {
  const a = run(`c80a-${k}`, true);
  const b = how === 'quick' ? run(`c80a-${k}`, false) : null;
  R += a.reds; Y += a.yel; YC += a.ycards;
  console.log(`시드 ${k}: 팀당 퇴장 ${a.reds.toFixed(2)} · 옐로 누적 정지 ${a.yel.toFixed(2)}회(${a.ym.toFixed(2)}경기) · 리그 옐로 ${a.ycards.toFixed(1)}장 · 한 팀 동시 정지 최대 ${a.maxBanned} · 칸 ${a.entries}개 npcBan 크기 시즌 중반 ${a.mid}B 끝 ${a.end}B · 세이브 ${a.save}B · ${a.ms}ms${b ? ` (끔 ${b.ms}ms, 세이브 ${b.save}B)` : ''}`);
}
console.log(`[${how}] 평균 팀당 시즌 퇴장 정지 ${(R / seeds).toFixed(2)} · 옐로 누적 정지 ${(Y / seeds).toFixed(2)} · 리그 옐로 ${(YC / seeds).toFixed(1)}장`);
