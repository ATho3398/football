// 카드 그림 (부록 C.48, pending 70, 명세 docs/ui-requests/card-art-batch03-apply.md). 이미지 우선순위: 사용자 그림(IndexedDB `card:<카드 id>`)
// > 기본 그림(public/cards/art/<파일>.webp, 시그니처는 역할 id 파일) > 지금 기본 장면(GameCard SVG). faces.ts 페이스온과 같은 구조.
// 화면은 문자열로 그리므로 동기 조회만 한다. 사용자 그림은 시작할 때 읽고 다 읽으면 다시 그린다

import { exportSave, importSave } from '../save';
import type { GameState } from '../game';
import { storeBackend } from '../saveStore';
import { CARD_ART_TABLE, type ArtDefault } from './cardArtTable';

export const CARD_ART_DIR = 'cards/art/';

/** 기본 그림이 있는 파일 (일반 카드 id, 시그니처는 역할 id). set61 (2026-10-19, 61장, C.68c — BATCH 03 17장 대체) */
export const CARD_ART_FILES: ReadonlySet<string> = new Set(Object.keys(CARD_ART_TABLE));

/** 그림 위치·확대 (디자인 GameCard `artPos`): x 오른쪽(%), y 위로(%) — 그림 칸(280×210) 기준, zoom 1~4, flip 좌우 반전, rotate 도(−45~45, 시계 +) */
export type { ArtPos } from './components/gameCard';
import type { ArtPos } from './components/gameCard';
export const ART_POS_DEFAULT: Readonly<ArtPos> = { x: 0, y: 0, zoom: 1 };

/** IndexedDB 에 담는 사용자 그림 한 건 (키 `card:<카드 id>`) */
export interface CardArtRecord { blob: Blob; pos: ArtPos; updated: number }

const user = new Map<string, { url: string; pos: ArtPos }>();

/** 카드 id → 기본 그림 파일 이름 (시그니처 `sig-<역할>` → 역할) */
export function artFile(id: string): string {
  return id.startsWith('sig-') ? id.slice(4) : id;
}

export function defaultArtUrl(id: string): string | undefined {
  const f = artFile(id);
  return CARD_ART_FILES.has(f) ? `${CARD_ART_DIR}${f}.webp` : undefined;
}

/** 카드 VM 이 그림을 정할 때 쓰는 한 함수: 사용자 그림 → 기본 그림 → undefined (기본 장면) */
export function cardArtUrl(id: string): string | undefined {
  return user.get(id)?.url ?? defaultArtUrl(id);
}

/** 기본 그림의 기본 위치표 (C.68c): 크기별 full·mini + 1:1 원본 여부 */
export function defaultArtPos(id: string): ArtDefault | undefined {
  return CARD_ART_TABLE[artFile(id)];
}

/** 사용자 그림의 위치·확대 (기본 그림은 defaultArtPos) */
export function cardArtPos(id: string): ArtPos | undefined {
  return user.get(id)?.pos;
}

export type CardArtSource = 'user' | 'default' | 'none';
export function cardArtSource(id: string): CardArtSource {
  return user.has(id) ? 'user' : defaultArtUrl(id) ? 'default' : 'none';
}

export function userArtCount(): number {
  return user.size;
}

function apply(id: string, rec: CardArtRecord | undefined): void {
  const old = user.get(id);
  if (old) URL.revokeObjectURL(old.url);
  if (rec) user.set(id, { url: URL.createObjectURL(rec.blob), pos: { ...ART_POS_DEFAULT, ...rec.pos } });
  else user.delete(id);
}

export async function initCardArt(): Promise<void> {
  try {
    for (const [id, rec] of await allCardArt()) apply(id, rec);
  } catch {
    // 저장소를 못 열면 사용자 그림 없이
  }
}

export async function setCardArt(id: string, blob: Blob, pos: ArtPos = ART_POS_DEFAULT): Promise<void> {
  const rec: CardArtRecord = { blob, pos: { ...pos }, updated: Date.now() };
  await storeBackend().put(`card:${id}`, rec);
  apply(id, rec);
}

/** 위치·확대만 바꾸기 (그림 그대로) */
export async function setCardArtPos(id: string, pos: ArtPos): Promise<void> {
  const rec = await storeBackend().get<CardArtRecord>(`card:${id}`);
  if (!rec) return;
  await setCardArt(id, rec.blob, pos);
}

/** [기본으로]: 사용자 그림 지우기 */
export async function clearCardArt(id: string): Promise<void> {
  await storeBackend().del(`card:${id}`);
  apply(id, undefined);
}

export async function userArtBlob(id: string): Promise<Blob | undefined> {
  return (await storeBackend().get<CardArtRecord>(`card:${id}`))?.blob;
}

export async function allCardArt(): Promise<[string, CardArtRecord][]> {
  const store = storeBackend();
  const out: [string, CardArtRecord][] = [];
  for (const k of await store.keys()) {
    if (!k.startsWith('card:')) continue;
    const rec = await store.get<CardArtRecord>(k);
    if (rec?.blob) out.push([k.slice(5), rec]);
  }
  return out;
}

// ── 이미지 정규화 (브라우저): 긴 변을 maxSide 로 줄여 WebP(안 되면 PNG). 자르지 않는다(위치·확대는 pos 로 표시할 때) ──

export async function normalizeArt(img: HTMLImageElement, maxSide = 900): Promise<Blob> {
  const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const as = (type: string, q?: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, q));
  const webp = await as('image/webp', 0.86);
  if (webp && webp.type === 'image/webp') return webp;
  const png = await as('image/png');
  if (!png) throw new Error('이미지 변환 실패');
  return png;
}

// ── zip 묶음: cards/<카드 id>.<확장자> + cardart.json (페이스팩 zip·세이브 내보내기 공용) ──

const extOf = (type: string): string => (type === 'image/webp' ? 'webp' : type === 'image/jpeg' ? 'jpg' : 'png');
const typeOf = (file: string): string => (/\.webp$/i.test(file) ? 'image/webp' : /\.jpe?g$/i.test(file) ? 'image/jpeg' : 'image/png');

export interface ZipFile { name: string; data: Uint8Array }

export async function cardArtZipEntries(): Promise<ZipFile[]> {
  const entries: ZipFile[] = [];
  const index: { id: string; file: string; pos: ArtPos }[] = [];
  for (const [id, rec] of await allCardArt()) {
    const file = `cards/${id}.${extOf(rec.blob.type)}`;
    entries.push({ name: file, data: new Uint8Array(await rec.blob.arrayBuffer()) });
    index.push({ id, file, pos: rec.pos });
  }
  if (index.length) entries.push({ name: 'cardart.json', data: new TextEncoder().encode(JSON.stringify({ version: 1, entries: index }, null, 1)) });
  return entries;
}

/** zip 파일 목록에서 카드 그림을 넣는다: cardart.json 이 있으면 그 id·위치, 없으면 cards/<카드 id>.png. known = 있는 카드 id 인지 */
export async function importCardArtEntries(files: ZipFile[], known: (id: string) => boolean): Promise<{ added: number; skipped: string[] }> {
  const byName = new Map(files.map((f) => [f.name, f]));
  const jobs = new Map<string, { id: string; pos: ArtPos }>();
  const meta = byName.get('cardart.json');
  if (meta) {
    const idx = JSON.parse(new TextDecoder().decode(meta.data)) as { entries?: { id: string; file: string; pos?: ArtPos }[] };
    for (const e of idx.entries ?? []) if (byName.has(e.file)) jobs.set(e.file, { id: e.id, pos: { ...ART_POS_DEFAULT, ...e.pos } });
  }
  for (const f of files) {
    if (!f.name.startsWith('cards/') || jobs.has(f.name) || !/\.(png|jpe?g|webp)$/i.test(f.name)) continue;
    jobs.set(f.name, { id: f.name.slice('cards/'.length).replace(/\.[^.]+$/, ''), pos: { ...ART_POS_DEFAULT } });
  }
  let added = 0;
  const skipped: string[] = [];
  for (const [file, { id, pos }] of jobs) {
    if (!known(id)) {
      skipped.push(file);
      continue;
    }
    const data = byName.get(file)!.data;
    await setCardArt(id, new Blob([data as Uint8Array<ArrayBuffer>], { type: typeOf(file) }), pos);
    added++;
  }
  return { added, skipped };
}

// ── 세이브 파일 내보내기 "카드 이미지 포함" (기본 끔): 끄면 지금 그대로(.fcsave.gz), 켜면 zip(save.fcsave.gz + cards/ + cardart.json) ──

export const SAVE_IN_ZIP = 'save.fcsave.gz';

export async function exportSaveFile(state: GameState, withCards: boolean): Promise<{ bytes: Uint8Array; zip: boolean; cards: number }> {
  const save = await exportSave(state);
  if (!withCards) return { bytes: save, zip: false, cards: 0 };
  const { writeZip } = await import('./zip');
  const cards = await cardArtZipEntries();
  return { bytes: writeZip([{ name: SAVE_IN_ZIP, data: save }, ...cards]), zip: true, cards: cards.filter((c) => c.name.startsWith('cards/')).length };
}

/** 가져오기: zip(PK) 이면 세이브 + 카드 그림, 아니면 세이브만 */
export async function importSaveFile(bytes: Uint8Array, known: (id: string) => boolean): Promise<{ state: GameState; cards: number }> {
  if (bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const { readZip } = await import('./zip');
    const files = await readZip(bytes);
    const save = files.find((f) => /\.fcsave\.gz$|\.json$/i.test(f.name) && f.name !== 'cardart.json');
    if (!save) throw new Error('zip 안에 세이브 파일이 없어요');
    const state = await importSave(save.data);
    const r = await importCardArtEntries(files, known);
    return { state, cards: r.added };
  }
  return { state: await importSave(bytes), cards: 0 };
}
