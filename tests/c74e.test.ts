// C.74e: PC(넓은 화면)에서도 사진이 있으면 미페 머리말 — 홈 · 선수. 사진 없음 · A 테마는 일반 머리말 그대로
import { afterEach, describe, expect, it } from 'vitest';
import { newGame } from '../src/game';
import { homeVM, playerVM } from '../src/ui/viewModels';
import { homeFace, homeView } from '../src/ui/views/home';
import { playerFace, playerView } from '../src/ui/views/player';
import { setSkin, setWideForTest } from '../src/ui/skin';

const parts = { tab: 'attrs' as const, body: '', market: null, points: 0, retired: false };
afterEach(() => { setWideForTest(null); setSkin('b'); });

describe('C.74e PC 미페 머리말', () => {
  it('생성 선수(기본 사진): PC 홈 · 선수도 미페 머리말 + 2열', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c74e', difficulty: 'normal' });
    setSkin('b');
    setWideForTest(true);
    expect(homeFace(homeVM(g))).toEqual({ src: expect.stringContaining(`faces/default/${g.player.facePhoto}`), cutout: true });
    const h = homeView(homeVM(g));
    expect(h).toContain('po-hero--face');
    expect(h).toContain('pc2 hm-pc');
    const p = playerView(playerVM(g), parts);
    expect(p).toContain('po-hero--face po-hero--compact');
    expect(p).toContain('pc2 pl-pc');
    expect(playerFace(playerVM(g))).not.toBeNull();
  });
  it('사진 없음(테스트엔 facepack 없음) · A 테마는 PC 에서도 일반 머리말', () => {
    const real = newGame({ mode: 'real', playerId: 'son', seed: 'c74e-son', difficulty: 'normal' });
    setSkin('b');
    setWideForTest(true);
    expect(homeView(homeVM(real))).not.toContain('po-hero--face');
    expect(playerView(playerVM(real), parts)).not.toContain('po-hero--face');
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c74e', difficulty: 'normal' });
    setSkin('a');
    expect(homeView(homeVM(g))).not.toContain('po-hero--face');
    expect(playerView(playerVM(g), parts)).not.toContain('po-hero--face');
  });
});

describe('C.74e 가로 폰은 그대로', () => {
  it('가로 폰(넓은 배치 + 낮은 높이)은 지금처럼 일반 머리말', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c74e', difficulty: 'normal' });
    setSkin('b');
    setWideForTest(true, true);
    expect(homeView(homeVM(g))).not.toContain('po-hero--face');
    expect(playerView(playerVM(g), parts)).not.toContain('po-hero--face');
  });
});
