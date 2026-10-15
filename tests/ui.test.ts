import { describe, expect, it } from 'vitest';
import { playMyMatch } from '../src/engine/adapter';
import type { TeamStats } from '../src/engine/types';
import { selectScenes } from '../src/highlights';
import { restartLabel } from '../src/replay';
import { createTeamRoster } from '../src/roster';
import { commonVerdict, reportInput, tacticalReport, tendencyVerdict, type ReportInput, type ReportSide } from '../src/tacticalReport';
import { Button, FeedItem, HeroPanel, ScoreBar, StatBar, Tabs } from '../src/ui/components';
import { feedKind } from '../src/ui/viewModels';
import { ReplayPlayer } from '../src/ui/views/replay';

const side = (o: Partial<ReportSide> = {}): ReportSide => ({
  poss: 50, shots: 12, onTarget: 4, counterShots: 2, oppHalfWins: 15, passes: 400, passesCompleted: 336, longPasses: 90, longCompleted: 58,
  offsides: 1, crosses: 8, crossesCompleted: 2, centralShots: 4, ...o,
});
const input = (tendency: ReportInput['tendency'], own: Partial<ReportSide> = {}, opp: Partial<ReportSide> = {}): ReportInput => ({
  tendency, own: side({ ...own, poss: own.poss ?? 50 }), opp: side({ ...opp, poss: 100 - (own.poss ?? 50) }),
});

describe('전술 리포트 (21.5.2)', () => {
  it('역습: 역습 슈팅이 많으면 ✓, 없으면 ✗, 그 사이는 표시하지 않는다', () => {
    expect(tendencyVerdict(input('counter', { shots: 12, counterShots: 4 }))?.ok).toBe(true);
    expect(tendencyVerdict(input('counter', { counterShots: 0 }))?.ok).toBe(false);
    expect(tendencyVerdict(input('counter', { shots: 20, counterShots: 2 }))).toBeNull();
  });
  it('문장은 "제목 · 근거 숫자" 형식이고 근거에 실제 숫자가 들어간다', () => {
    const v = tendencyVerdict(input('counter', { shots: 9, counterShots: 5 }))!;
    expect(v.title).toBe('역습이 통했어요');
    expect(v.detail).toBe('슈팅 9개 중 5개가 역습에서 나왔어요');
  });
  it('공통 판정은 우선순위가 가장 높은 1장만', () => {
    const r = input('balanced', { offsides: 7 }, { counterShots: 6 });
    expect(commonVerdict(r)?.id).toBe('common:1');
  });
  it('티키타카 팀에는 "점유를 슈팅으로 못 바꿨어요"를 내지 않는다', () => {
    const r = input('tikitaka', { poss: 60, shots: 8 }, { shots: 12 });
    expect(commonVerdict(r)?.id).not.toBe('common:2');
    expect(tendencyVerdict(r)?.ok).toBe(false);
  });
  it('판정 카드는 최대 2장, 숫자 줄은 항상 6개', () => {
    const rep = tacticalReport(input('gegenpress', { oppHalfWins: 30 }, { oppHalfWins: 10, counterShots: 5 }));
    expect(rep.verdicts.length).toBeLessThanOrEqual(2);
    expect(rep.rows.map((x) => x.label)).toEqual(['점유율', '슈팅(유효)', '역습 슈팅', '상대 진영 탈취', '롱패스 비율', '패스 성공률']);
  });
  it('엔진 팀 통계에서 내 팀 시점으로 뒤집는다 (원정이면 [1, 0])', () => {
    const t = (shots: number, ticks: number) => ({ shots, possessionTicks: ticks } as unknown as TeamStats);
    const r = reportInput([t(5, 300), t(9, 100)], 1, 'block');
    expect(r.own.shots).toBe(9);
    expect(r.own.poss).toBe(25);
    expect(r.opp.poss).toBe(75);
  });
});

const my = createTeamRoster({ id: 'h', rating: 75 }, 'hl-h', 2018, []);
const opp = createTeamRoster({ id: 'a', rating: 75 }, 'hl-a', 2018, []);
const r = playMyMatch({
  myRoster: my, oppRoster: opp, myRating: 75, oppRating: 75, home: true,
  me: { position: 'ST', attributes: my.players.find((p) => p.position === 'ST')!.attributes!, fatigue: 0, form: 0 },
  plan: { started: true, minutes: { start: 0, end: 90 } }, difficulty: 'normal', seed: 91, worldSeed: 'hl',
}, { teams: ['홈', '원정'] }).replay!;

describe('재생 데이터: 재개 대기와 전술 (21.5.2 3번)', () => {
  it('공이 죽어 있는 프레임에는 재개 종류가 붙고, 라벨이 나온다', () => {
    const dead = r.frames.filter((f) => f.restart && f.restart !== 'kickoff');
    expect(dead.length).toBeGreaterThan(20);
    const labels = new Set(dead.map((f) => restartLabel(r, f, f.e)));
    expect([...labels].some((l) => l === '스로인 준비' || l === '골킥')).toBe(true);
    const live = r.frames.find((f) => !f.restart)!;
    expect(restartLabel(r, live, live.e)).toBeNull();
  });
  it('양 팀 통계와 전술이 담긴다', () => {
    expect(r.stats).toHaveLength(2);
    expect(r.tactics[0].formation).toMatch(/\d-\d/);
  });
  it('피드 종류: 우리 골은 goal, 상대 골은 concede', () => {
    for (const g of r.events.filter((x) => x.type === 'goal')) expect(feedKind(g, r.side)).toBe(g.team === r.side ? 'goal' : 'concede');
  });
  it('[하이라이트로 돌아가기]는 지금 시점 뒤의 다음 장면부터', () => {
    const scenes = selectScenes(r);
    const p = new ReplayPlayer(r, () => {});
    p.goLive();
    p.advance(1);
    p.backToHighlight();
    expect(p.mode).toBe('scene');
    expect(p.e).toBe(scenes[1]!.start);
  });
});

describe('디자인 컴포넌트 (H.6 2번)', () => {
  it('bundle.css 클래스와 동작 속성을 쓴다', () => {
    const b = Button({ variant: 'secondary', size: 'lg', block: true, act: 'go', data: { to: 'home' }, children: '홈' });
    expect(b).toContain('po-btn po-btn--secondary po-btn--lg po-btn--block');
    expect(b).toContain('data-act="go" data-to="home"');
    expect(Tabs({ items: [{ id: 'a', label: 'A' }], value: 'a', variant: 'nav', act: 'go-tab' })).toContain('po-tab is-on');
  });
  it('글자는 이스케이프한다', () => {
    expect(FeedItem({ text: '<b>x</b>' })).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(HeroPanel({ title: 'a&b' })).toContain('a&amp;b');
  });
  it('설정 동작이 없으면 경기 상단 띠에 톱니를 그리지 않는다 (I.19 8번)', () => {
    const s = ScoreBar({ home: 'A', away: 'B', homeScore: 0, awayScore: 0, minute: 1, view: 'highlight', scene: { index: 1, total: 7 } });
    expect(s).toContain('po-strip--highlight');
    expect(s).not.toContain('po-strip__gear');
  });
  it('StatBar 편집형은 비용과 OVR 변화를 보여 준다', () => {
    const s = StatBar({ label: '슈팅', value: 60, add: 1, editable: true, cost: 2, ovrDelta: 0.3 });
    expect(s).toContain('is-warn');
    expect(s).toContain('OVR +0.3');
  });
});
