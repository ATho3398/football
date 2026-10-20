import { describe, expect, it } from 'vitest';
import { playMyMatch } from '../src/engine/adapter';
import { ENGINE } from '../src/engine/config';
import { bandKind, bestChoice, type Moment, type MomentPolicy } from '../src/engine/moments';
import type { Candidate } from '../src/engine/onball';
import { newGame, roundMatch, selectableRealPlayers } from '../src/game';
import { posGroup } from '../src/roster';
import { PATCH_LABEL } from '../src/version';

const M = ENGINE.moments;
const sameAs = (x: Candidate, y: Candidate) => x.type === y.type && x.receiver === y.receiver && Math.abs(x.x - y.x) < 0.5 && Math.abs(x.y - y.y) < 0.5;

/** 직접 모드 봇 경기에서 소유 정지를 모은다 (선수 기본 덱, 모든 순간) */
function collect(groups: string[], seeds: number, prefix = 'c75v', from = 0): (Moment & { cands?: Candidate[] })[] {
  const seen: (Moment & { cands?: Candidate[] })[] = [];
  const pol: MomentPolicy = (m) => {
    if (m.type === 'onball') seen.push(m as Moment & { cands?: Candidate[] });
    return bestChoice(m);
  };
  for (const grp of groups) {
    for (let k = from; k < seeds; k++) {
      const p = selectableRealPlayers().find((x) => posGroup(x.position) === grp)!;
      const g = newGame({ mode: 'real', playerId: p.id, seed: `${prefix}-${k}-${p.id}`, difficulty: 'normal' });
      const rm = roundMatch(g);
      playMyMatch({ ...rm.input, control: { mode: 'direct', stop: 'all', policy: pol } });
    }
  }
  return seen;
}

describe('C.75v 결정 순간 선택지 라벨·확실한 선택지·최대 5개', () => {
  it('라벨 = 성공 확률 구간: 50% 이상 안전, 25~50% 균형, 25% 미만 도박, 판정 없음은 기본값', () => {
    expect(bandKind(0.13)).toBe('gamble');
    expect(bandKind(0.25)).toBe('balanced');
    expect(bandKind(0.49)).toBe('balanced');
    expect(bandKind(0.5)).toBe('safe');
    expect(bandKind(0.95)).toBe('safe');
    expect(bandKind(null)).toBe('safe');
    expect(bandKind(null, 'balanced')).toBe('balanced');
    expect(M.labelBands).toEqual({ safe: 0.5, balanced: 0.25 });
    expect(PATCH_LABEL).toMatch(/^C\.\d+[a-z]?$/); // 병렬 패치끼리 라벨이 바뀌어도 통과 (C.76c 병합)
  });

  // CDM 시드는 C.76a(엔진 28, 위협 가중 수비) 뒤 c75v-0~2 에 sureBack 장면이 없어져 c76b-0~2(2장면) 로
  // C.76p(엔진 30, 깊은 블록 밀집·1대1 보너스) 뒤 c76b-0~2 에도 없어져 c76p 시드로
  const all = [...collect(['ST', 'WING', 'CM', 'FB'], 2), ...collect(['CDM'], 3, 'c76p')];

  it('소유 정지: 최대 5개 · 같은 후보/같은 이름 줄 없음 · 확률 순(몰고 가다 슛은 끝) · 라벨은 구간', () => {
    expect(all.length).toBeGreaterThan(20);
    let five = 0;
    for (const m of all) {
      expect(m.options.length).toBeLessThanOrEqual(M.maxOptions);
      expect(new Set(m.options.map((o) => o.label)).size).toBe(m.options.length);
      const cs = m.cands!;
      const picked = m.options.filter((o) => !o.chain).map((o) => cs[o.ref]!);
      for (let i = 0; i < picked.length; i++) for (let j = i + 1; j < picked.length; j++) expect(sameAs(picked[i]!, picked[j]!)).toBe(false);
      const ps = m.options.filter((o) => !o.chain).map((o) => o.p!);
      expect([...ps].sort((a, b) => b - a)).toEqual(ps);
      const ci = m.options.findIndex((o) => o.chain);
      if (ci >= 0) expect(ci).toBe(m.options.length - 1);
      for (const o of m.options) expect(o.kind).toBe(bandKind(o.p));
      if (m.options.length === 5) five++;
    }
    // 5개 장면이 실제로 나온다 (뻔한 것으로 채우지는 않지만 고를 거리가 있으면)
    expect(five).toBeGreaterThan(0);
  });

  it('확실한 선택지 다시 넣기(B): 나머지가 모두 30% 미만일 때만, 맨 위 1개, 90% 초과, 안전, 확실한 것은 90% 이상', () => {
    for (const m of all) {
      // 90% 초과로 보이는 줄은 확실한 선택지뿐 (상대 분석·동료 호흡 배율은 거르기 뒤에 붙어 90%를 조금 넘을 수 있다, C.74c)
      const over = m.options.filter((o) => o.p !== null && o.p > M.maxP + 1e-9 && !o.exploit && o.action !== 'pass' && o.action !== 'through');
      if (!m.sureBack) {
        expect(over.length).toBe(0);
        continue;
      }
      expect(m.sure).toBe(true);
      expect(m.options[0]!.p!).toBeGreaterThan(M.maxP - 0.01);
      expect(m.options[0]!.kind).toBe('safe');
      for (const o of m.options.slice(1)) expect(o.p!).toBeLessThan(M.sureBackBelow);
    }
  });

  it('B 조건이 맞는 정지는 늘 다시 넣는다: 확실한 것을 뺐고 남은 선택지가 모두 30% 미만이면 sureBack', () => {
    // CDM c76b 시드에 발동 장면이 있다 (C.76a 전에는 c75v-2: 전진 패스 98% / 침투 패스 10%)
    expect(all.filter((m) => m.sureBack).length).toBeGreaterThan(0);
    for (const m of all) {
      if (!m.sure) continue;
      const rest = m.options.filter((o) => !o.chain && !(m.sureBack && o === m.options[0]));
      if (rest.length && rest.every((o) => (o.p ?? 1) < M.sureBackBelow)) expect(m.sureBack).toBe(true);
    }
  });
});
