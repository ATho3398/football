// 결정 순간 측정 (E.11, F.7, 부록 C.34, C.40 최소 보장 없음·90% 필터): 실제 선수 커리어의 내 경기를 같은 입력으로 자동 / 직접(정책)으로 돌려 비교한다.
// - 정지 횟수: 정지 빈도 3단계(모든 / 중요한(기본) / 결정적)별 경기당 턴 수, 포지션군별 (맡기기 정책이라 경기는 자동과 같다)
// - 평점: 자동 대 직접 최적 플레이 봇(기대 평점 최대 선택지) / 균형만 / 맡기기(= 자동, 결정성 확인)
// npm run balance:moments -- [포지션군당 선수 수=3] [라운드 수=10]
import { autoAllocate } from '../src/growth';
import { newGame, playRound, roundMatch, selectableRealPlayers } from '../src/game';
import { playMyMatch } from '../src/engine/adapter';
import { bestChoice, type MomentControl, type MomentPolicy, type StopLevel } from '../src/engine/moments';
import { posGroup } from '../src/roster';
import { setEnvironmentFixed } from '../src/weather';
import { newShape, optionLine, shaped, shapeLine } from './moment-shape';

// 측정은 맑음·보통 심판 고정 (부록 C.74a): 기존 기준 그대로 비교
setEnvironmentFixed(true);

const args = process.argv.slice(2).filter((a) => a !== '--');
const perGroup = Number(args[0] ?? 3);
const rounds = Number(args[1] ?? 10);

const groups = ['ST', 'WING', 'CAM', 'CM', 'CDM', 'FB', 'CB'];
const pool = selectableRealPlayers();
const picks = groups.flatMap((g) => pool.filter((p) => posGroup(p.position) === g).slice(0, perGroup));

const delegate: MomentPolicy = () => 'delegate';
/** 맡기기 + 선택지 2개만 남은 정지 세기 (C.40) */
let twoN = 0;
const countTwo: MomentPolicy = (m) => {
  if (m.options.length === 2) twoN++;
  return 'delegate';
};
const balanced: MomentPolicy = (m) => Math.max(0, m.options.findIndex((o) => o.kind === 'balanced'));
/** 최적 플레이 봇 (카드 없이): 기대 평점 최대 선택지, 확실한 선택지를 뺀 순간 남은 것이 못하면 맡기기 (C.40) */
/** 몰고 가다 슛 (C.75k): 봇 정지 중 선택지에 보인 수 / 봇이 고른 수 */
const carry = { shown: 0, picked: 0 };
const bot: MomentPolicy = (m) => {
  const c = bestChoice(m, Infinity);
  const i = m.options.findIndex((o) => o.chain);
  if (i >= 0) {
    carry.shown++;
    if (c === i) carry.picked++;
  }
  return c;
};
const safe: MomentPolicy = (m) => Math.max(0, m.options.findIndex((o) => o.kind === 'safe'));
const gamble: MomentPolicy = (m) => Math.max(0, m.options.findIndex((o) => o.kind === 'gamble'));

type Row = { g: string; stops: Record<StopLevel, number>; auto: number; del: number; bot: number; bal: number; safe: number; gamble: number; botStops: number; two: number };
const rows: Row[] = [];
const shape = newShape();
const t0 = Date.now();
let slow = 0;
for (const p of picks) {
  const g = newGame({ mode: 'real', playerId: p.id, seed: `moments-${p.id}`, difficulty: 'normal' });
  for (let k = 0; k < rounds && g.phase === 'season'; k++) {
    const rm = roundMatch(g);
    const run = (control?: MomentControl) => {
      const s = Date.now();
      const o = playMyMatch({ ...rm.input, ...(control ? { control } : {}) });
      if (Date.now() - s > 2000) slow++;
      return o;
    };
    const auto = run();
    if (rm.plan.started && auto.my) {
      const grp = posGroup(auto.my.position);
      const stops = {} as Record<StopLevel, number>;
      let del = 0;
      let two = 0;
      for (const stop of ['all', 'important', 'critical'] as StopLevel[]) {
        const o = run({ mode: 'direct', stop, policy: stop === 'important' ? countTwo : delegate });
        stops[stop] = o.engine.decisions.length;
        if (stop === 'important') {
          del = o.result.rating ?? 0;
          two = twoN;
          twoN = 0;
        }
      }
      const ob = run({ mode: 'direct', stop: 'important', policy: shaped(shape, bot) });
      const ol = run({ mode: 'direct', stop: 'important', policy: balanced });
      const os = run({ mode: 'direct', stop: 'important', policy: safe });
      const og = run({ mode: 'direct', stop: 'important', policy: gamble });
      rows.push({
        g: grp, stops, auto: auto.result.rating ?? 0, del, bot: ob.result.rating ?? 0, bal: ol.result.rating ?? 0,
        safe: os.result.rating ?? 0, gamble: og.result.rating ?? 0, botStops: ob.engine.decisions.length, two,
      });
    }
    playRound(g, { engineOut: auto });
    autoAllocate(g.player);
  }
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const f = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
console.log(`결정 순간 측정: 선수 ${picks.length}명 × ${rounds}라운드, 선발 경기 ${rows.length}개, ${((Date.now() - t0) / 1000).toFixed(0)}초, 2초 넘은 경기 ${slow}`);
console.log('포지션군 | 경기 | 턴(모든/중요/결정적) | 중요 0회 경기 | 중요 중 선택지 2개 | 자동 평점 | 맡기기 | 봇 | 봇−자동 | 균형만−자동 | 안전만−자동 | 도박만−자동');
for (const grp of [...groups, '전체']) {
  const rs = grp === '전체' ? rows : rows.filter((r) => r.g === grp);
  if (!rs.length) continue;
  const a = avg(rs.map((r) => r.auto));
  console.log(`${grp} | ${rs.length} | ${f(avg(rs.map((r) => r.stops.all)), 1)} / ${f(avg(rs.map((r) => r.stops.important)), 1)} / ${f(avg(rs.map((r) => r.stops.critical)), 1)} | ${Math.round((100 * rs.filter((r) => r.stops.important === 0).length) / rs.length)}% | ${f(avg(rs.map((r) => r.two)), 1)} | ${f(a)} | ${f(avg(rs.map((r) => r.del)))} | ${f(avg(rs.map((r) => r.bot)))} | ${f(avg(rs.map((r) => r.bot)) - a)} | ${f(avg(rs.map((r) => r.bal)) - a)} | ${f(avg(rs.map((r) => r.safe)) - a)} | ${f(avg(rs.map((r) => r.gamble)) - a)}`);
}
const se = (k: 'bot' | 'bal' | 'safe' | 'gamble') => {
  const d = rows.map((r) => r[k] - r.auto);
  const m = avg(d);
  return `${f(m)} ± ${f(Math.sqrt(avg(d.map((x) => (x - m) ** 2)) / Math.max(1, d.length - 1)))}`;
};
console.log(`직접 − 자동 (평균 ± 표준오차, 같은 경기 짝): 봇 ${se('bot')}, 균형만 ${se('bal')}, 안전만 ${se('safe')}, 도박만 ${se('gamble')}`);
const mismatch = rows.filter((r) => Math.abs(r.del - r.auto) > 1e-9).length;
console.log(`맡기기 = 자동 (결정성): 다른 경기 ${mismatch} / ${rows.length}`);
const under = rows.filter((r) => r.stops.important < 3).length;
const over = rows.filter((r) => r.stops.important > 8).length;
const zero = rows.filter((r) => r.stops.important === 0).length;
console.log(`중요한 순간만: 0회 ${zero} (${Math.round((100 * zero) / Math.max(1, rows.length))}%), 3회 미만 ${under}, 8회 초과 ${over} / ${rows.length}`);
console.log(`봇 결정 순간 모양 (C.75a, 선수 기본 덱): ${shapeLine(shape, rows.length)}`);
console.log(`봇 선택지 모양 (C.75v): ${optionLine(shape)}`);
const botStops = rows.reduce((t, r) => t + r.botStops, 0);
console.log(`몰고 가다 슛 (C.75k, 봇·중요한 순간만): 보임 ${carry.shown} / 봇 정지 ${botStops} (${((100 * carry.shown) / Math.max(1, botStops)).toFixed(1)}%) · 고름 ${carry.picked} (보인 것의 ${((100 * carry.picked) / Math.max(1, carry.shown)).toFixed(0)}%)`);
process.exit(0);
