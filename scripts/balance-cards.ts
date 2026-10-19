// 카드 밸런스 (부록 F.7, C.36): 실제 선수 커리어의 내 경기를 같은 입력으로
//   자동(카드 없음, C.35) / 자동(카드, F.5 규칙) / 직접 최적 플레이 봇(카드까지 고름, "중요한 순간만")
// 으로 돌려 직접(봇) − 자동 평점 격차(목표 +0.3~0.5)와 카드별 사용률·성공률을 잰다.
// 덱: 시작 덱(포지션군 일반 8장) 또는 --rich (시작 덱 + 그 포지션군·공용 희귀/에픽 카드로 14장)
// npm run balance:cards -- [포지션군당 선수 수=3] [라운드 수=10] [--rich] [--th=임계값 배수]
import { autoAllocate } from '../src/growth';
import { newGame, playRound, roundMatch, selectableRealPlayers } from '../src/game';
import { playMyMatch } from '../src/engine/adapter';
import { bestChoice, type MomentControl } from '../src/engine/moments';
import { ENGINE } from '../src/engine/config';
import { posGroup } from '../src/roster';
import { CARDS, cardById, starterDeck } from '../src/config/cards';
import { groupOfPosition } from '../src/cardCollection';
import { setEnvironmentFixed } from '../src/weather';

// 측정은 맑음·보통 심판 고정 (부록 C.74a): 기존 기준 그대로 비교
setEnvironmentFixed(true);

const raw = process.argv.slice(2).filter((a) => a !== '--');
const rich = raw.includes('--rich');
const args = raw.filter((a) => !a.startsWith('--'));
const perGroup = Number(args[0] ?? 3);
// --th=배수: 직접 모드 "중요한 순간만" 임계값을 배수로 바꿔 잰다 (C.40 정지 조건 조정용, 자동 카드 기회는 autoThreshold 라 그대로)
const thArg = raw.find((a) => a.startsWith('--th='));
if (thArg) for (const k of Object.keys(ENGINE.moments.threshold)) ENGINE.moments.threshold[k]! *= Number(thArg.slice(5));
const rounds = Number(args[1] ?? 10);

const groups = ['ST', 'WING', 'CAM', 'CM', 'CDM', 'FB', 'CB'];
const pool = selectableRealPlayers();
const picks = groups.flatMap((g) => pool.filter((p) => posGroup(p.position) === g).slice(0, perGroup));

function deckFor(position: string): string[] {
  const g = groupOfPosition(position);
  const deck = starterDeck(g).map((c) => c.id);
  if (!rich) return deck;
  const extra = CARDS.filter((c) => (c.group === g || c.group === 'common') && (c.rarity === 'rare' || c.rarity === 'epic') && c.kind !== 'signature' && c.kind !== 'directive');
  for (const c of extra) if (deck.length < 14 && (c.kind !== 'setPiece' || deck.filter((x) => cardById(x)!.kind === 'setPiece').length < 3)) deck.push(c.id);
  return deck;
}

type Row = { g: string; none: number; auto: number; bot: number; botCards: number; autoCards: number; ms: number; stops: number; react: number };
const rows: Row[] = [];
/** 카드 장면 정지 (C.40) */
const REACT = new Set(['aerial', 'corner', 'oppShot', 'oppCorner', 'oppFreeKick']);
const use: Record<string, { auto: number; bot: number; autoOk: number; botOk: number; inDeck: number }> = {};
const t0 = Date.now();
let slow = 0;
let maxMs = 0;
for (const p of picks) {
  const g = newGame({ mode: 'real', playerId: p.id, seed: `cards-${p.id}`, difficulty: 'normal' });
  const deck = deckFor(p.position);
  for (let k = 0; k < rounds && g.phase === 'season'; k++) {
    const rm = roundMatch(g, { cards: false });
    const run = (control?: MomentControl, cards = true) => {
      const s = Date.now();
      const o = playMyMatch({ ...rm.input, ...(control ? { control } : {}), ...(cards ? { cards: { deck } } : {}) });
      const ms = Date.now() - s;
      if (ms > 2000) slow++;
      maxMs = Math.max(maxMs, ms);
      return { o, ms };
    };
    const none = run(undefined, false);
    if (rm.plan.started && none.o.my) {
      const auto = run();
      const bot = run({ mode: 'direct', stop: 'important', policy: (m) => bestChoice(m) });
      for (const id of new Set(deck)) (use[id] ??= { auto: 0, bot: 0, autoOk: 0, botOk: 0, inDeck: 0 }).inDeck++;
      for (const u of auto.o.engine.cards?.uses ?? []) {
        use[u.id]!.auto++;
        if (u.result === 'success') use[u.id]!.autoOk++;
      }
      for (const u of bot.o.engine.cards?.uses ?? []) {
        use[u.id]!.bot++;
        if (u.result === 'success') use[u.id]!.botOk++;
      }
      rows.push({
        g: posGroup(none.o.my.position), none: none.o.result.rating ?? 0, auto: auto.o.result.rating ?? 0, bot: bot.o.result.rating ?? 0,
        botCards: bot.o.engine.cards?.uses.length ?? 0, autoCards: auto.o.engine.cards?.uses.length ?? 0, ms: auto.ms,
        stops: bot.o.engine.decisions.length, react: bot.o.engine.decisions.filter((d) => REACT.has(d.scene)).length,
      });
    }
    playRound(g, { engineOut: none.o });
    autoAllocate(g.player);
  }
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const f = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const se = (d: number[]) => {
  const m = avg(d);
  return `${f(m)} ± ${f(Math.sqrt(avg(d.map((x) => (x - m) ** 2)) / Math.max(1, d.length - 1)))}`;
};
console.log(`카드 밸런스 (${rich ? '풍부한 덱 14장' : '시작 덱 8장'}): 선수 ${picks.length}명 × ${rounds}라운드, 선발 경기 ${rows.length}개, ${((Date.now() - t0) / 1000).toFixed(0)}초, 2초 넘은 경기 ${slow} (최대 ${maxMs} ms)`);
console.log('포지션군 | 경기 | 자동(카드 없음) | 자동(카드) | 봇 | 봇−자동 | 자동 카드−없음 | 경기당 카드 자동/봇 | 봇 정지/경기 (카드 장면) | 정지 0회');
for (const grp of [...groups, '전체']) {
  const rs = grp === '전체' ? rows : rows.filter((r) => r.g === grp);
  if (!rs.length) continue;
  console.log(`${grp} | ${rs.length} | ${f(avg(rs.map((r) => r.none)))} | ${f(avg(rs.map((r) => r.auto)))} | ${f(avg(rs.map((r) => r.bot)))} | ${se(rs.map((r) => r.bot - r.auto))} | ${f(avg(rs.map((r) => r.auto - r.none)))} | ${f(avg(rs.map((r) => r.autoCards)), 1)} / ${f(avg(rs.map((r) => r.botCards)), 1)} | ${f(avg(rs.map((r) => r.stops)), 1)} (${f(avg(rs.map((r) => r.react)), 1)}) | ${Math.round((100 * rs.filter((r) => r.stops === 0).length) / rs.length)}%`);
}
console.log(`직접(봇) − 자동(카드) (같은 경기 짝, 평균 ± 표준오차): ${se(rows.map((r) => r.bot - r.auto))} · 목표 +0.30~0.50`);
console.log('카드 | 덱에 든 경기 | 자동 사용/경기 (성공률) | 봇 사용/경기 (성공률)');
for (const [id, u] of Object.entries(use).sort((a, b) => b[1].bot / b[1].inDeck - a[1].bot / a[1].inDeck)) {
  console.log(`${cardById(id)?.name ?? id} | ${u.inDeck} | ${f(u.auto / u.inDeck)} (${u.auto ? Math.round((100 * u.autoOk) / u.auto) : '-'}%) | ${f(u.bot / u.inDeck)} (${u.bot ? Math.round((100 * u.botOk) / u.bot) : '-'}%)`);
}
process.exit(0);
