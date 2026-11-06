// C.78t 게겐프레싱 비용 측정 (pending 146 ②): ① 시즌 누적 피로 — 게겐 팀 내 선수 로테이션 없음/있음 시즌 후반 평점·경기 체력
// ② 선수 생명 — 게겐 시즌 수별 30대 OVR 곡선·가상 선수 은퇴 기대 나이 (growNpc · retires 와 같은 곡선 = 본편 경로)
// 사용: npx vite-node scripts/diag/c78t-gegen.ts -- [시드 수(기본 4)] [선수 수(기본 150)] [a|b|ab]
import { BALANCE } from '../../src/config/balance';
import { agingRateShifted } from '../../src/growth';
import { seasonWear, wearAging } from '../../src/load';
import { endDay, isMatchDay, matchFatigue, myClubGegen, newGame, playOthers, playRound, type GameState } from '../../src/game';
import { ensureManager } from '../../src/manager';
import { growNpc } from '../../src/npc';
import { positionOvr } from '../../src/positions';
import { startStamina } from '../../src/engine/setup';

const args = process.argv.slice(2);
const nums = args.filter((a) => /^\d+$/.test(a)).map(Number);
const seeds = nums[0] ?? 4;
const nPool = nums[1] ?? 150;
const part = args.find((a) => /^(a|b|ab)$/.test(a)) ?? 'ab';
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const G = BALANCE.gegenCost as { on: boolean };

if (part.includes('a')) {
  // 토트넘(데이터 성향 게겐) 손흥민, 내 경기는 에이전트 엔진. 강제 선발 = 감독 면담 보상(선호 슬롯 보장)을 매 경기 1로
  const variants: { name: string; on: boolean; forced: boolean }[] = [
    { name: '비용 끔 · 로테이션 없음', on: false, forced: true },
    { name: '비용 켬 · 로테이션 없음', on: true, forced: true },
    { name: '비용 끔 · 감독 로테이션', on: false, forced: false },
    { name: '비용 켬 · 감독 로테이션', on: true, forced: false },
  ];
  console.log(`[C.78t ① 시즌 누적 피로] 손흥민(토트넘 게겐) 1시즌 × 시드 ${seeds} · gegenCost ${JSON.stringify(BALANCE.gegenCost)}`);
  console.log('| 변형 | 출전(선발) | 전반기 평점 | 후반기 평점 | 후반기−전반기 | 전반기 경기 체력 | 후반기 경기 체력 | 시즌 끝 누적 피로(최대) |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const v of variants) {
    G.on = v.on;
    const h1: number[] = []; const h2: number[] = []; const s1: number[] = []; const s2: number[] = []; const sfMax: number[] = [];
    let apps = 0; let starts = 0;
    for (let k = 0; k < seeds; k++) {
      const g: GameState = newGame({ mode: 'real', playerId: 'son', seed: `c78t-a-${k}`, difficulty: 'normal' });
      if (!myClubGegen(g) && v.on) throw new Error('토트넘 성향이 게겐이 아님');
      let mx = 0;
      while (g.phase === 'season') {
        while (g.phase === 'season' && !isMatchDay(g)) { playOthers(g, 'quick'); endDay(g); }
        if (g.phase !== 'season') break;
        if (v.forced) ensureManager(g).perks.slot = 1;
        const month = Number(g.calendar.date.slice(5, 7));
        const late = month <= 6;
        const stamina = startStamina(matchFatigue(g, g.player.fatigue));
        const before = g.player.recentRatings.length + g.player.season.apps * 1000;
        const st0 = (g.player.season as { starts?: number }).starts ?? 0;
        playRound(g, { others: 'quick' });
        mx = Math.max(mx, g.player.seasonFatigue ?? 0);
        const after = g.player.recentRatings.length + g.player.season.apps * 1000;
        if (after !== before) {
          apps++;
          if (((g.player.season as { starts?: number }).starts ?? 0) > st0) starts++;
          const r = g.player.recentRatings.at(-1)!;
          (late ? h2 : h1).push(r);
          (late ? s2 : s1).push(stamina);
        }
      }
      sfMax.push(mx);
    }
    console.log(`| ${v.name} | ${(apps / seeds).toFixed(1)}(${(starts / seeds).toFixed(1)}) | ${avg(h1).toFixed(2)} | ${avg(h2).toFixed(2)} | ${(avg(h2) - avg(h1)).toFixed(2)} | ${avg(s1).toFixed(1)} | ${avg(s2).toFixed(1)} | ${avg(sfMax).toFixed(1)} |`);
  }
  G.on = true;
}

if (part.includes('b')) {
  // 같은 실제 NPC 들을 24세부터 주전(리그 시즌 부하 31 × 게겐 1.15)으로, 게겐 시즌 수만 바꿔 비교 (24세부터 해마다 +1, 상한 n)
  const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c78t-b', difficulty: 'normal' });
  const pool = g.npcs.filter((x) => x.age <= 30 && !x.retired).slice(0, nPool);
  const load = 31 * BALANCE.load.tendency.gegenpress!;
  const ages = [27, 28, 29, 30, 31, 32, 33, 34, 35, 36];
  const variants: [string, number, boolean][] = [['게겐 0시즌(비용 끔)', 99, false], ['게겐 2시즌', 2, true], ['게겐 3시즌', 3, true], ['게겐 5시즌', 5, true], ['게겐 8시즌', 8, true]];
  const rows: { name: string; ovr: number[]; retire: number }[] = [];
  for (const [name, cap, on] of variants) {
    G.on = on;
    const ovrAt = ages.map(() => [] as number[]);
    const ret: number[] = [];
    for (const src of pool) {
      let p = { ...src, attributes: { ...src.attributes }, age: 24 };
      let wear = 0; let gegen = 0; let alive = 1; let e = 0;
      for (let season = 2018; p.age < 38; season++) {
        wear += seasonWear(load);
        if (gegen < cap) gegen++;
        p = growNpc({ ...p, retired: false }, 'c78t-b', season, wear, gegen);
        const k = ages.indexOf(p.age);
        if (k >= 0) ovrAt[k]!.push(positionOvr(p.attributes, p.position));
        const q = p.age >= BALANCE.retirement.forcedAge ? 1 : agingRateShifted(BALANCE.roster.retireChance, p.age, wearAging(wear, p.age, gegen).shift);
        e += alive * q * p.age;
        alive *= 1 - q;
      }
      ret.push(e + alive * BALANCE.retirement.forcedAge);
    }
    rows.push({ name, ovr: ovrAt.map(avg), retire: avg(ret) });
  }
  G.on = true;
  const ref = rows[0]!;
  console.log(`[C.78t ② 선수 생명] 실제 NPC ${pool.length}명 24세부터 게겐 주전(시즌 부하 ${load.toFixed(1)}) · 게겐 시즌만 다름`);
  console.log(`| 변형 | ${ages.map((a) => `${a}세`).join(' | ')} | 가상 은퇴 기대 나이 |`);
  console.log(`|---|${ages.map(() => '---').join('|')}|---|`);
  for (const r of rows) console.log(`| ${r.name} | ${r.ovr.map((x, i) => `${x.toFixed(1)}${r === ref ? '' : ` (${x - ref.ovr[i]! >= 0 ? '+' : ''}${(x - ref.ovr[i]!).toFixed(1)})`}`).join(' | ')} | ${r.retire.toFixed(2)}${r === ref ? '' : ` (${(r.retire - ref.retire).toFixed(2)})`} |`);
  const reach = (r: (typeof rows)[number], t: number) => {
    for (let i = 1; i < ages.length; i++) if (r.ovr[i]! <= t) { const a = r.ovr[i - 1]!; const b = r.ovr[i]!; return ages[i - 1]! + (a - t) / Math.max(1e-9, a - b); }
    return NaN;
  };
  const t = ref.ovr[ages.indexOf(33)]!;
  console.log(`비용 끔 33세 OVR ${t.toFixed(1)} 에 닿는 나이: ${rows.map((r) => `${r.name} ${reach(r, t).toFixed(2)}`).join(' · ')}`);
}
