// 도트 아이콘 팩 → 인물·유니폼 레이어 (부록 C.45, docs/design/pixel-kits.md 1·2번)
// 실행: npx vite-node scripts/splitPixelPack.ts [-- <zip 경로>]
// zip(신뢰하지 않는 데이터)은 메모리에서만 읽는다. raw16/ 16px 원본 448장을 나눠
//   public/faces/pixel/person/<피부>_<머리>.png (14), public/faces/pixel/kit/<유니폼 키>.png (32),
//   public/faces/pixel/manifest.json (version 2), data/pixelPack.ts (로직·테스트용 같은 표)
// 를 쓴다. 다시 겹쳐 448장이 원본과 픽셀 단위로 같지 않으면 아무것도 쓰지 않고 실패한다

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodePng, kitColors, readPack16, splitLayers } from './pixelPng';

const ROOT = join(import.meta.dirname ?? '.', '..');
const zipPath = process.argv.slice(2).find((a) => a !== '--') ?? join(ROOT, 'docs/design/incoming/kits_full_pack.zip');
const OUT = join(ROOT, 'public/faces/pixel');

const SKIN_ORDER = ['black', 'yellow', 'white', 'mideast'];
const HAIR_ORDER = ['black', 'blonde', 'brown', 'bald'];
const rank = (list: string[], v: string): number => (list.includes(v) ? list.indexOf(v) : list.length);

const images = readPack16(new Uint8Array(readFileSync(zipPath)));
const layers = splitLayers(images);
console.log(`원본 ${images.length}장 → 유니폼 ${layers.kits.size} + 인물 ${layers.people.size}, 픽셀 분류 ${JSON.stringify(layers.stats)}, 겹치는 순서 ${layers.order}${layers.bothOrders ? ' (두 레이어가 겹치지 않아 어느 순서든 같음)' : ''}`);

mkdirSync(join(OUT, 'person'), { recursive: true });
mkdirSync(join(OUT, 'kit'), { recursive: true });

const kits: Record<string, { file: string; colors: string[]; mean: string }> = {};
for (const [key, img] of [...layers.kits].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
  const id = key.split('_')[0]!;
  if (!/^[CS]\d{2}$/.test(id) || kits[id]) throw new Error(`유니폼 키가 이상해요: ${key}`);
  writeFileSync(join(OUT, 'kit', `${key}.png`), encodePng(img));
  kits[id] = { file: `kit/${key}.png`, ...kitColors(img) };
}
const people: Record<string, string[]> = {};
for (const [key, img] of layers.people) {
  writeFileSync(join(OUT, 'person', `${key}.png`), encodePng(img));
  const [skin, hair] = key.split('_') as [string, string];
  (people[skin] ??= []).push(hair);
}
const peopleSorted: Record<string, string[]> = {};
for (const s of Object.keys(people).sort((a, b) => rank(SKIN_ORDER, a) - rank(SKIN_ORDER, b) || (a < b ? -1 : 1))) {
  peopleSorted[s] = people[s]!.sort((a, b) => rank(HAIR_ORDER, a) - rank(HAIR_ORDER, b) || (a < b ? -1 : 1));
}

const manifestPath = join(OUT, 'manifest.json');
let oldPlayers: Record<string, unknown> = {};
try {
  oldPlayers = (JSON.parse(readFileSync(manifestPath, 'utf8')) as { players?: Record<string, unknown> }).players ?? {};
} catch {
  // 처음
}
const manifest = {
  version: 2,
  note: '도트 선수 아이콘 (경기 화면 캐릭터 보기, 부록 C.45). scripts/splitPixelPack.ts 가 만든다. 인물 레이어 위에 유니폼 레이어를 겹친다. colors = 몸통 색(많은 순), mean = 몸통 픽셀 평균(색 거리용). players: 선수 id → 파일(version 1 직접 지정, 먼저 씀) 또는 {skin, hair}',
  size: layers.w,
  order: layers.order,
  kits,
  personDir: 'person',
  people: peopleSorted,
  players: oldPlayers,
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const ts = `// 자동 생성 (scripts/splitPixelPack.ts) — 직접 고치지 마세요. public/faces/pixel/manifest.json 과 같은 표 (부록 C.45).
// 유니폼 id → 레이어 키·몸통 색(많은 순)·몸통 픽셀 평균색, 피부 → 가능한 머리

export const PIXEL_SIZE = ${layers.w};
export const PIXEL_ORDER = '${layers.order}' as const;

export const PIXEL_KITS: Readonly<Record<string, { key: string; colors: readonly string[]; mean: string }>> = {
${Object.entries(kits).map(([id, k]) => `  ${id}: { key: '${k.file.slice(4, -4)}', colors: [${k.colors.map((c) => `'${c}'`).join(', ')}], mean: '${k.mean}' },`).join('\n')}
};

export const PIXEL_PEOPLE: Readonly<Record<string, readonly string[]>> = {
${Object.entries(peopleSorted).map(([s, hs]) => `  ${s}: [${hs.map((h) => `'${h}'`).join(', ')}],`).join('\n')}
};
`;
writeFileSync(join(ROOT, 'data/pixelPack.ts'), ts);
console.log(`썼어요: ${OUT}/{person,kit}/*.png, manifest.json, data/pixelPack.ts`);
