import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { CARDS, cardById } from '../src/config/cards';
import { newGame } from '../src/game';
import { memoryBackend, setStoreBackend } from '../src/saveStore';
import {
  allCardArt, artFile, CARD_ART_DIR, CARD_ART_FILES, cardArtPos, cardArtSource, cardArtUrl, clearCardArt, defaultArtUrl, exportSaveFile, importSaveFile, setCardArt,
} from '../src/ui/cardArt';
import { readZip } from '../src/ui/zip';
import { GameCard } from '../src/ui/components';
import { gameCardData } from '../src/ui/views/deck';
import { cardArtList } from '../src/ui/views/cardArtSettings';

const png = (n = 1) => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, n])], { type: 'image/png' });

beforeEach(() => setStoreBackend(memoryBackend()));
afterEach(async () => {
  for (const [id] of await allCardArt()) await clearCardArt(id);
  setStoreBackend(null);
});

describe('카드 그림 (C.48)', () => {
  it('기본 그림 17장: 파일이 public/cards/art 에 있고, 표의 id 는 모두 실제 카드(시그니처는 역할 id)', () => {
    expect(CARD_ART_FILES.size).toBe(17);
    for (const f of CARD_ART_FILES) {
      expect(existsSync(`public/${CARD_ART_DIR}${f}.webp`)).toBe(true);
      expect(cardById(f) ?? cardById(`sig-${f}`)).toBeTruthy();
    }
    expect(artFile('sig-targetMan')).toBe('targetMan');
    expect(defaultArtUrl('sig-targetMan')).toBe('cards/art/targetMan.webp');
    expect(defaultArtUrl('elastico')).toBe('cards/art/elastico.webp');
    expect(defaultArtUrl('sig-poacher')).toBeUndefined();
  });

  it('cardArtUrl 우선순위: 사용자 그림 > 기본 그림 > 없음', async () => {
    expect(cardArtSource('sig-targetMan')).toBe('default');
    expect(cardArtSource('sig-poacher')).toBe('none');
    expect(cardArtUrl('sig-poacher')).toBeUndefined();
    await setCardArt('sig-targetMan', png(), { x: 5, y: 10, zoom: 1.5 });
    await setCardArt('sig-poacher', png(2));
    expect(cardArtSource('sig-targetMan')).toBe('user');
    expect(cardArtUrl('sig-targetMan')).toMatch(/^blob:/);
    expect(cardArtPos('sig-targetMan')).toEqual({ x: 5, y: 10, zoom: 1.5 });
    expect(cardArtUrl('sig-poacher')).toMatch(/^blob:/);
    // 기본으로 (지우기): 기본 그림이 있으면 기본 그림, 없으면 그림 없음
    await clearCardArt('sig-targetMan');
    await clearCardArt('sig-poacher');
    expect(cardArtUrl('sig-targetMan')).toBe('cards/art/targetMan.webp');
    expect(cardArtPos('sig-targetMan')).toBeUndefined();
    expect(cardArtSource('sig-poacher')).toBe('none');
    expect(await allCardArt()).toHaveLength(0);
  });

  it('사용자 그림 저장·삭제는 저장소 키 card:<카드 id>', async () => {
    await setCardArt('elastico', png());
    const store = (await import('../src/saveStore')).storeBackend();
    expect(await store.keys()).toContain('card:elastico');
    await clearCardArt('elastico');
    expect(await store.keys()).not.toContain('card:elastico');
  });

  it('카드 VM 이 그림을 넣고 GameCard 가 full·mini 에 lazy 이미지를 그린다 (그림 없으면 기본 장면만)', async () => {
    const d = cardById('elastico')!;
    const data = gameCardData(d);
    expect(data.art).toBe('cards/art/elastico.webp');
    const full = GameCard({ card: data, size: 'full' });
    expect(full).toContain('po-gc__photo');
    expect(full).toContain('loading="lazy"');
    expect(full).toContain('po-gc__art'); // 기본 장면은 밑에 그대로
    expect(GameCard({ card: data, size: 'mini' })).toContain('po-mc__photo');
    expect(GameCard({ card: data, size: 'hand', state: 'disabled', reason: '못 씀' })).toContain('is-disabled');
    const none = gameCardData(cardById('sig-poacher')!);
    expect(none.art).toBeUndefined();
    expect(GameCard({ card: none, size: 'full' })).not.toContain('po-art');
    await setCardArt('sig-poacher', png(), { x: 10, y: 0, zoom: 2 });
    expect(GameCard({ card: gameCardData(cardById('sig-poacher')!), size: 'full' })).toContain('translate(10%,0%) scale(2)');
  });

  it('설정 목록 거르기: 종류·검색·그림 없음만', async () => {
    const sig = cardArtList({ q: '', kind: 'signature', none: false });
    expect(sig.length).toBe(CARDS.filter((c) => c.kind === 'signature').length);
    const noneSig = cardArtList({ q: '', kind: 'signature', none: true });
    expect(noneSig.length).toBe(sig.length - 16);
    expect(cardArtList({ q: '엘라스', kind: 'all', none: false }).map((d) => d.id)).toEqual(['elastico']);
    await setCardArt('sig-poacher', png());
    expect(cardArtList({ q: '', kind: 'signature', none: true }).some((d) => d.id === 'sig-poacher')).toBe(false);
  });

  it('세이브 내보내기 "카드 이미지 포함": 끄면 세이브 파일 그대로, 켜면 zip(세이브 + cards/ + cardart.json) → 가져오기로 복원', async () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c48-export', difficulty: 'normal' });
    await setCardArt('elastico', png(3), { x: 0, y: 12, zoom: 1.2 });
    const off = await exportSaveFile(g, false);
    expect(off.zip).toBe(false);
    expect(off.bytes[0] === 0x50 && off.bytes[1] === 0x4b).toBe(false);
    const on = await exportSaveFile(g, true);
    expect(on.zip).toBe(true);
    expect(on.cards).toBe(1);
    const names = (await readZip(on.bytes)).map((f) => f.name);
    expect(names).toEqual(expect.arrayContaining(['save.fcsave.gz', 'cards/elastico.png', 'cardart.json']));
    // 다른 기기: 저장소 비우고 가져오기
    setStoreBackend(memoryBackend());
    await clearCardArt('elastico');
    const back = await importSaveFile(on.bytes, (id) => !!cardById(id));
    expect(back.state.player.name).toBe(g.player.name);
    expect(back.cards).toBe(1);
    expect(cardArtSource('elastico')).toBe('user');
    expect(cardArtPos('elastico')).toEqual({ x: 0, y: 12, zoom: 1.2 });
    const plain = await importSaveFile(off.bytes, () => true);
    expect(plain.cards).toBe(0);
  });
});
