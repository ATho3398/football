// C.76f (U8-a): 218 PC 결정 순간·결과 v3 · 240A 몰고 가다 슛 줄 · 236A 못 차는 이유 · 237 하프타임 시트 · 230B 날씨 꼬리표
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { DecisionRecord, Moment } from '../src/engine/moments';
import { tendencyLevels } from '../src/engine/tactics';
import { PATCH_LABEL, STAGE_LABEL } from '../src/version';
import { halftimeSets, halftimeVM } from '../src/ui/viewModels';
import { halftimeView } from '../src/ui/views/tactics';
import { momentView, outcomeView } from '../src/ui/views/moment';
import dump from '../scripts/c75v-moment.json';

const d = dump as unknown as { teams: [string, string]; moment: Moment; log: DecisionRecord[] };
const o0 = d.moment.options[0]!;
const chain = { ...o0, kind: 'gamble' as const, action: 'carry' as const, label: '몰고 가다 슛', p: 0.12, offside: undefined, chain: { type: 'shoot' as const, p: 0.2 } };
const M: Moment = { ...d.moment, sureBack: false, shotNote: '등지고 있어 슛 각이 없어요', options: [o0, chain] };
const vm = { moment: M, teams: d.teams, selected: null, card: null, stop: 'important' as const, last: d.log.at(-1) ?? null, count: 2 };

describe('C.76f 결정 순간 (218 · 240A · 236A)', () => {
  it('버전', () => {
    expect(PATCH_LABEL).toMatch(/^C\.\d+[a-z]?$/);
    expect(STAGE_LABEL).toMatch(/단계$/);
  });
  it('몰고 가다 슛은 머리 글 아래 따로 한 줄, 이름 "몰고 가기 → 슛", 도박 색 · 확정 단추는 "슛"', () => {
    const h = momentView({ ...vm, selected: 1 });
    expect(h).toContain('mo-chainhead');
    expect(h.indexOf('mo-chainhead')).toBeGreaterThan(h.indexOf(o0.label));
    expect(h).toContain('몰고 가기 → 슛');
    expect(h).toMatch(/po-choice--gamble[^"]*is-selected/);
    expect(h).toContain('확정 · 슛 12%');
  });
  it('못 차는 이유 줄 = 슛 아이콘 + 글 (슛 선택지가 없을 때만)', () => {
    expect(momentView(vm)).toMatch(/mo-shotnote">.*<svg[\s\S]*등지고 있어 슛 각이 없어요/);
    const shoot = { ...M, options: [{ ...o0, action: 'shoot' as const }] };
    expect(momentView({ ...vm, moment: shoot })).not.toContain('mo-shotnote');
  });
  it('PC 피치 아래 최근 흐름 · 직전 결정 (흐름 없으면 안내 글)', () => {
    const h = momentView({ ...vm, feed: [{ minute: '17', text: '왼쪽에서 빌드업', kind: 'normal', mine: false }, { minute: '18', text: '측면에서 공을 잡음', kind: 'chance', mine: true }] });
    expect(h).toContain('mo-below__flow');
    expect(h).toContain('측면에서 공을 잡음');
    expect(h).toContain('mo-below__last');
    expect(h).toContain('맡기기');
    expect(momentView(vm)).toContain('경기 흐름을 모으는 중이에요');
    expect(momentView({ ...vm, last: null })).toContain('이번 경기 첫 결정이에요');
  });
  it('결과 재생 중 = 시간 글자 + 진행 막대', () => {
    const h = outcomeView({
      moment: M, teams: d.teams, choice: '안전 · 패스', kind: 'safe', band: { tone: 'success', title: '연결', flow: '', delta: '+0.05' },
      headline: '연결', ratingDelta: 0.05, rating: 7, card: null, score: [0, 1], shown: false,
    });
    expect(h).toContain('id="oc-time"');
    expect(h).toContain('id="oc-bar"');
  });
});

describe('C.76f 하프타임 (237)', () => {
  const base = { tendency: 'balanced' as const, levels: tendencyLevels('balanced') };
  it('위 띠 · 정지 피치 · 세트 3칸 · 성향 7 · 세부 4 · 버튼', () => {
    const h = halftimeView(halftimeVM({ ...base, levels: { ...base.levels }, set: 0 }, base, d.teams, [0, 1], 0));
    expect(h).toContain('ht-top');
    expect(h).toContain('id="mo-canvas"');
    expect(h.match(/class="ht-set[ "]/g)?.length).toBe(3);
    expect(h.match(/data-act="ht-tend"/g)?.length).toBe(7);
    expect(h.match(/class="ht-detail"/g)?.length).toBe(4);
    expect(h).not.toContain('ht-changed');
    expect(h).toContain('바뀐 것 없음');
  });
  it('총공세를 고르면 경기 전과 다른 세부 칸에 "바뀜", [이 전술로 후반] 켜짐', () => {
    const s = halftimeSets(base)[2]!;
    const v = halftimeVM({ tendency: s.tendency, levels: s.levels, set: 2 }, base, d.teams, [0, 1], 0);
    const h = halftimeView(v);
    expect(h.match(/ht-changed/g)?.length).toBe(v.details.filter((x) => x.changed).length);
    expect(v.details.some((x) => x.changed)).toBe(true);
    expect(h).toContain('이 전술로 후반');
  });
});

describe('C.76f 피치 날씨 (230B)', () => {
  it('날씨는 선수 아래, 꼬리표는 맨 위 (그리는 순서)', () => {
    const src = readFileSync(new URL('../src/ui/pitch/renderer.ts', import.meta.url), 'utf8');
    expect(src.match(/drawSky\(ctx, w, h, time\);\n\s+drawPlayersAndBall\([^\n]+\n\s+drawWeatherTag\(ctx, h\);/g)?.length).toBe(2);
  });
});
