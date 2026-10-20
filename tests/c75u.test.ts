// C.75u: 홈 머리말 긴 이름 잘림 — 한 줄 유지, 글씨만 줄여 맞춘다
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HERO_NAME, heroNameEm, heroNameSize } from '../src/ui/components';

describe('C.75u 머리말 이름 맞춤', () => {
  it('첫 추정은 slack 2px 안쪽으로 잡는다 (율리안 린트너 46 → 45)', () => {
    expect(heroNameSize('율리안 린트너')).toBe(45);
    for (const n of ['율리안 린트너', '로베르트 레반도프스키', '바스티안 슈바인슈타이거', '손흥민']) {
      expect(heroNameEm(n) * heroNameSize(n)).toBeLessThanOrEqual(HERO_NAME.width - HERO_NAME.slack);
    }
  });
  it('짧은 이름은 그대로 풀 크기', () => {
    expect(heroNameSize('손흥민')).toBe(HERO_NAME.full);
  });
  it('fitHeroNames는 정수 scrollWidth 대신 Range 실폭으로 넘침을 보고, 글꼴 loadingdone 때 다시 맞춘다', () => {
    const main = readFileSync('src/ui/main.ts', 'utf8');
    const fn = main.slice(main.indexOf('function fitHeroNames'), main.indexOf("addEventListener?.('loadingdone'"));
    expect(fn).toContain('createRange');
    expect(fn).not.toContain('el.scrollWidth > el.clientWidth + 0.5');
    expect(main).toContain("document.fonts?.addEventListener?.('loadingdone', () => fitHeroNames())");
  });
});

describe('C.75u 버전', () => {
  it('PATCH_LABEL · STAGE_LABEL', async () => {
    const { PATCH_LABEL, STAGE_LABEL } = await import('../src/version');
    expect(PATCH_LABEL).toBe('C.75u');
    expect(STAGE_LABEL).toBe('45단계');
  });
});
