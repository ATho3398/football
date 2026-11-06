// C.77u: 페이스팩 확장 — 배경 지운 선수 사진(nobg), 리그 폴더 지연 로딩, 사진·로고 출처 목록
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { allLeagueData } from '../data/leagues';
import { precached, swSource } from '../src/pwa/swBuild';
import { crestSrc, heroFaceOf, initFaces, photoCredits } from '../src/ui/faces';
import { settingsView } from '../src/ui/views/settings';
import { CARD_ART_UI_DEFAULT } from '../src/ui/views/cardArtSettings';
import { versionVM } from '../src/ui/viewModels';
import { PATCH_LABEL } from '../src/version';

const PUB = join(__dirname, '../public');
interface Entry { file: string; source: string; page: string; title: string; nobg?: boolean; cutout?: boolean; league?: string; license?: string }
const manifest = JSON.parse(readFileSync(join(PUB, 'facepack/manifest.json'), 'utf8')) as { players: Record<string, Entry>; clubs: Record<string, Entry> };

describe('페이스팩 매니페스트 (C.77u)', () => {
  it('모든 항목의 파일이 있고, 리그 데이터 구단(리그:코드)은 clubs/<리그>/<코드>.png', () => {
    for (const kind of ['players', 'clubs'] as const) {
      for (const [id, e] of Object.entries(manifest[kind])) {
        expect(existsSync(join(PUB, 'facepack', e.file)), `${kind}/${id}`).toBe(true);
        if (kind === 'clubs' && id.includes(':')) expect(e.file).toBe(`clubs/${id.replace(':', '/')}.png`);
        if (kind === 'players' && e.league) expect(e.file).toBe(`players/${e.league}/${id}.png`);
      }
    }
    const teamIds = new Set(allLeagueData().flatMap((d) => d.teams.map((t) => t.id)));
    for (const id of Object.keys(manifest.clubs)) expect(teamIds.has(id), id).toBe(true);
  });

  it('선수 사진은 배경을 지웠다 (nobg 표시, 128×128 RGBA PNG). 머리말 큰 누끼(cutout)는 128px 라 켜지 않는다', () => {
    const players = Object.values(manifest.players);
    expect(players.length).toBeGreaterThanOrEqual(237);
    expect(players.every((e) => e.nobg === true)).toBe(true);
    // 머리말 큰 누끼(cutout)는 사용자가 준 고해상도 사진만 (위키 128px 는 액자)
    expect(Object.entries(manifest.players).filter(([, e]) => e.cutout).map(([id]) => id).sort()).toEqual(
      Object.entries(manifest.players).filter(([, e]) => e.source === '사용자').map(([id]) => id).sort());
    const png = readFileSync(join(PUB, 'facepack', manifest.players.son!.file));
    expect(png.readUInt32BE(16)).toBe(128); // IHDR 폭
    expect(png.readUInt32BE(20)).toBe(128);
    expect(png[25]).toBe(6); // 색 형식 6 = RGBA
  });
});

describe('리그별 지연 로딩 (C.77u)', () => {
  it('리그 폴더 페이스팩은 미리 캐시하지 않는다, PL·A등급·레전드와 매니페스트는 미리 캐시', () => {
    expect(precached('facepack/clubs/mci.png')).toBe(true);
    expect(precached('facepack/players/son.png')).toBe(true);
    expect(precached('facepack/manifest.json')).toBe(true);
    expect(precached('facepack/clubs/laliga/bar.png')).toBe(false);
    expect(precached('facepack/players/laliga/coutinho.png')).toBe(false);
    const src = swSource(['index.html', 'facepack/clubs/mci.png', 'facepack/clubs/laliga/bar.png'], 'v1-deadbeef');
    expect(src).toContain('"./","./index.html","./facepack/clubs/mci.png"]');
    expect(src).not.toContain('laliga/bar.png');
  });
});

describe('사진·로고 출처 (C.77u)', () => {
  beforeAll(async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      const p = join(PUB, String(url));
      return existsSync(p) ? new Response(readFileSync(p)) : new Response('', { status: 404 });
    });
    await initFaces();
  });

  it('매니페스트를 읽으면 출처 목록이 구단 → 선수 순서로 찬다, 배경 지운 사진도 머리말은 액자(cutout 아님)', () => {
    const list = photoCredits();
    expect(list.length).toBe(Object.keys(manifest.players).length + Object.keys(manifest.clubs).length);
    expect(list[0]!.kind).toBe('clubs');
    expect(list.find((c) => c.id === 'son')?.page).toContain('wikipedia.org');
    expect(heroFaceOf({ id: 'son' })).toEqual({ src: 'facepack/players/son.png', cutout: false });
    expect(crestSrc('mci')).toBe('facepack/clubs/mci.png');
    // 사용자 사진·로고 1차 (UI_5): 레반도프스키 교체·로이스 새로(머리말 누끼), 분데스리가 키 → 리그 폴더, 리그 밖 x:bay 도 같은 로고
    expect(heroFaceOf({ id: 'lewandowski' })).toEqual({ src: 'facepack/players/lewandowski.png', cutout: true });
    expect(heroFaceOf({ id: 'marco-reus' })).toEqual({ src: 'facepack/players/bundesliga/marco-reus.png', cutout: true });
    expect(crestSrc('bundesliga:bvb')).toBe('facepack/clubs/bundesliga/bvb.png');
    expect(crestSrc('x:bay')).toBe('facepack/clubs/bundesliga/bay.png');
  });

  it('설정 › 저장과 안내: 출처 한 줄은 늘, 목록은 펼쳤을 때만', () => {
    const view = (credits: boolean) => settingsView(null, { tab: 'players', q: '', sel: null, crop: null }, versionVM(null),
      { q: '', team: '', sel: null }, { tab: 'players', q: '', team: '', sel: null, kitSel: null }, CARD_ART_UI_DEFAULT, false,
      { page: 'main', open: 'saves', credits });
    const closed = view(false);
    expect(closed).toContain('사진·로고 출처: 위키백과/위키미디어 커먼즈');
    expect(closed).toContain('data-act="set-credits"');
    expect(closed).not.toContain('class="set-credits"');
    const open = view(true);
    expect(open).toContain('class="set-credits"');
    expect(open).toContain('href="https://en.wikipedia.org/wiki/Son_Heung-min"');
    expect(open).toContain('target="_blank" rel="noopener"');
  });

  it('패치 라벨', () => {
    // C.77w 뒤에도 깨지지 않게: 라벨 형식만 본다 (최신 소절은 패치마다 바뀐다)
    expect(PATCH_LABEL).toMatch(/^C\.\d+[a-z]*$/);
  });
});
