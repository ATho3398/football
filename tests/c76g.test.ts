// C.76g (U8-b 컴포넌트·홈, 디자인 통합 2부 195·197·198·202·203·204·211·228·236 · 적용 명세 docs/ui-requests/7-13-part2-apply.md)
import { afterEach, describe, expect, it } from 'vitest';
import { newGame, playRound } from '../src/game';
import { homeVM } from '../src/ui/viewModels';
import { goalsCardVM, rivalCardVM } from '../src/ui/inboxVM';
import { competitionVM } from '../src/ui/managerVM';
import { goalsSection, rivalSection } from '../src/ui/views/inbox';
import { competitionSection } from '../src/ui/views/manager';
import { homeView } from '../src/ui/views/home';
import { HeroPanel } from '../src/ui/components';
import { ICON_PATHS } from '../src/ui/components/iconPaths';
import { setWideForTest } from '../src/ui/skin';
import { PATCH_LABEL } from '../src/version';

const son = () => newGame({ mode: 'real', playerId: 'son', seed: 'c76g-son', difficulty: 'normal' });

afterEach(() => setWideForTest(null));

describe('C.76g 공통 컴포넌트', () => {
  it('PATCH_LABEL · 아이콘(날씨·심판 + fog · album)', () => {
    expect(PATCH_LABEL).toMatch(/^C\.\d+[a-z]?$/);
    for (const k of ['sun', 'cloud', 'rain', 'snow', 'wind', 'fog', 'whistle', 'album'] as const) expect(ICON_PATHS[k]).toBeTruthy();
  });
  it('HeroPanel: 네모 사진 = po-hero--photo, 누끼는 아님 · 오른쪽 글자 판 10자부터 is-long (202)', () => {
    expect(HeroPanel({ title: '홈', face: 'a.jpg', cutout: false, name: '손흥민', value: 80 })).toContain('po-hero--photo');
    expect(HeroPanel({ title: '홈', face: 'a.png', cutout: true, name: '손흥민', value: 80 })).not.toContain('po-hero--photo');
    expect(HeroPanel({ title: '선수', right: '웨스트햄 유나이티드', compact: true, value: 59 })).toMatch(/po-hero__right is-text is-long/);
    expect(HeroPanel({ title: '선수', right: '사우샘프턴', compact: true, value: 58 })).toMatch(/po-hero__right is-text"/);
  });
});

describe('C.76g 홈', () => {
  it('머리말 도구: 안 읽은 인박스 → 알림 종 배지, 코치 후보 → 재정 동전 배지 (197·211), 도감 = album', () => {
    const vm = homeVM(son());
    expect(homeView({ ...vm, inbox: 0, money: 0 })).not.toContain('data-to="inbox"');
    const html = homeView({ ...vm, inbox: 3, money: 2 });
    expect(html).toContain('aria-label="알림 3"');
    expect(html).toContain('aria-label="재정 · 코치 후보 2"');
    expect(html).toContain(ICON_PATHS.album.slice(0, 20));
  });
  it('부상 칩 (228) · 시즌 목표는 다음 경기 바로 아래 (204)', () => {
    const g = son();
    const vm = homeVM(g);
    const html = homeView({ ...vm, injuryDays: 8 }, '', '<i id="notice"></i>', '<i id="train"></i>', '', '<i id="goals"></i>');
    expect(html).toContain('부상 · 8일 남음');
    expect(html.indexOf('next-card')).toBeLessThan(html.indexOf('id="goals"'));
    expect(html.indexOf('id="goals"')).toBeLessThan(html.indexOf('id="train"'));
  });
  it('시즌 목표 줄 보상 = XP · 카드 선택권 칩 · TP (204), 라이벌 비교 표 (195), 주전 경쟁 감독 줄 (198)', () => {
    const g = son();
    for (let i = 0; i < 3; i++) playRound(g);
    const gl = goalsCardVM(g);
    if (gl) {
      const h = goalsSection(gl);
      expect(h).toContain('gl-xp');
      expect(h).toMatch(/카드 선택권 \+1 · \S+/);
      expect(h).toContain('gl-tp');
    }
    const rv = rivalCardVM(g);
    if (rv) {
      const h = rivalSection(rv);
      for (const k of ['경기', '골', '도움', '평균 평점', '골+도움']) expect(h).toContain(`<span>${k}</span>`);
      expect(h).toMatch(/앞섬|뒤짐|동률/);
      expect(rv.me.apps).toBe(g.player.season.apps);
    }
    const cp = competitionVM(g);
    if (cp) {
      const h = competitionSection(cp);
      expect(h).toContain('mg-boss');
      expect(h).toContain(`aria-valuenow="${cp.trust}"`);
    }
    expect(gl || rv || cp).toBeTruthy();
  });
});
