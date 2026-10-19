// C.55 (34k, U-B1): B 테마(브로드캐스트) 층 — skin-b.css · 글꼴 4 · 기본 B · 설정 A/B · 독 라이트 토큰
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { skin, SKIN_KO, setSkin } from '../src/ui/skin';
import { settingsView } from '../src/ui/views/settings';
import { versionVM } from '../src/ui/viewModels';

const css = readFileSync('src/ui/design/skin-b.css', 'utf8');

describe('C.55 B 층', () => {
  it('기본은 B, 기기 설정으로 A/B 전환', () => {
    expect(skin()).toBe('b');
    expect(readFileSync('index.html', 'utf8')).toContain('data-skin="b"');
    setSkin('a');
    expect(skin()).toBe('a');
    setSkin('b');
    expect(Object.keys(SKIN_KO)).toEqual(['a', 'b']);
  });
  it('모든 규칙이 [data-skin="b"] 아래 (빼면 A 그대로)', () => {
    const body = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@font-face\s*\{[^}]*\}/g, '');
    const sels = [...body.matchAll(/([^{}]+)\{[^}]*\}/g)].map((m) => m[1]!.trim()).filter(Boolean);
    expect(sels.length).toBeGreaterThan(80);
    for (const s of sels) for (const part of s.split(/,(?![^(]*\))/)) expect(part, part).toMatch(/html\[data-skin="b"\]/);
  });
  it('글꼴 4개 로컬 woff2 · 독 바탕은 토큰(라이트 surface-1)', () => {
    for (const f of ['BarlowCondensed-600-italic', 'BarlowCondensed-700-italic', 'BarlowCondensed-800-italic', 'BlackHanSans']) {
      expect(existsSync(`src/ui/design/fonts/${f}.woff2`)).toBe(true);
      expect(css).toContain(`fonts/${f}.woff2`);
    }
    expect(css).not.toMatch(/background:\s*#0f1013/);
    expect(css).toMatch(/\[data-theme="light"\] \{ --dock-bg: var\(--surface-1\); \}/);
  });
  it('설정에 화면 스타일 한 줄', () => {
    const h = settingsView(null, { tab: 'players', q: '', sel: null, crop: null }, versionVM(null));
    expect(h).toContain('화면 스타일');
    expect(h).toContain('data-act="skin-set"');
  });
});
