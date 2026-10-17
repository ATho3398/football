// 도트 아이콘 팩 처리 도구 (부록 C.45, docs/design/pixel-kits.md): Node 전용, 새 npm 의존성 없이 node:zlib 만 쓴다.
// - 아주 작은 zip 읽기(무압축·deflate, 메모리에서만. 파일 이름은 키로만 쓰고 디스크에 풀지 않는다)
// - 아주 작은 PNG 읽기(8비트, 비월 없음: 회색·RGB·팔레트·회색+알파·RGBA)·쓰기(RGBA)
// - 16px 원본 448장을 인물 레이어 14장 + 유니폼 레이어 32장으로 나누고, 다시 겹쳐 원본과 같은지 확인

import { deflateSync, inflateRawSync, inflateSync } from 'node:zlib';

// ── zip 읽기 ──

export interface ZipFile { name: string; data: Uint8Array }

/** 신뢰하지 않는 zip: 엔트리 수·크기를 막고, 이름은 그대로 키로만 돌려준다 */
export function readZipSync(buf: Uint8Array, limits = { maxEntries: 5000, maxEntryBytes: 8 << 20 }): ZipFile[] {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('zip: 끝 레코드가 없어요');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  if (count > limits.maxEntries) throw new Error('zip: 엔트리가 너무 많아요');
  const dec = new TextDecoder();
  const out: ZipFile[] = [];
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || dv.getUint32(p, true) !== 0x02014b50) throw new Error('zip: 중앙 디렉터리가 깨졌어요');
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const usize = dv.getUint32(p + 24, true);
    const nlen = dv.getUint16(p + 28, true);
    const xlen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    if (name.endsWith('/')) continue;
    if (usize > limits.maxEntryBytes) throw new Error(`zip: ${name} 이 너무 커요`);
    if (local + 30 > buf.length || dv.getUint32(local, true) !== 0x04034b50) throw new Error('zip: 로컬 헤더가 깨졌어요');
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const raw = buf.subarray(start, start + csize);
    let data: Uint8Array;
    if (method === 0) data = raw.slice();
    else if (method === 8) data = new Uint8Array(inflateRawSync(raw, { maxOutputLength: limits.maxEntryBytes }));
    else throw new Error(`zip: 지원하지 않는 압축 방식 ${method} (${name})`);
    if (data.length !== usize) throw new Error(`zip: ${name} 크기가 달라요`);
    out.push({ name, data });
  }
  return out;
}

// ── PNG ──

export interface Rgba { w: number; h: number; /** RGBA, w*h*4 */ px: Uint8Array }

const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];

export function decodePng(buf: Uint8Array): Rgba {
  for (let i = 0; i < 8; i++) if (buf[i] !== PNG_SIG[i]) throw new Error('PNG 서명이 아니에요');
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let p = 8;
  let w = 0, h = 0, depth = 0, ctype = 0, interlace = 0;
  let plte: Uint8Array | null = null;
  let trns: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  while (p + 8 <= buf.length) {
    const len = dv.getUint32(p);
    const type = String.fromCharCode(...buf.subarray(p + 4, p + 8));
    const body = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = dv.getUint32(p + 8);
      h = dv.getUint32(p + 12);
      depth = buf[p + 16]!;
      ctype = buf[p + 17]!;
      interlace = buf[p + 20]!;
    } else if (type === 'PLTE') plte = body;
    else if (type === 'tRNS') trns = body;
    else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8 || interlace !== 0 || w <= 0 || h <= 0 || w > 4096 || h > 4096) throw new Error(`PNG: 지원하지 않는 형식 (깊이 ${depth}, 비월 ${interlace})`);
  const ch = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[ctype];
  if (!ch) throw new Error(`PNG: 색 형식 ${ctype}`);
  const total = idat.reduce((t, c) => t + c.length, 0);
  const z = new Uint8Array(total);
  let o = 0;
  for (const c of idat) {
    z.set(c, o);
    o += c.length;
  }
  const stride = w * ch;
  const raw = new Uint8Array(inflateSync(z, { maxOutputLength: (stride + 1) * h }));
  const img = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]!;
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = img.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? img.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? row[x - ch]! : 0;
      const b = prev ? prev[x]! : 0;
      const c = prev && x >= ch ? prev[x - ch]! : 0;
      let v = src[x]!;
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (f !== 0) throw new Error(`PNG: 필터 ${f}`);
      row[x] = v & 255;
    }
  }
  const px = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const s = i * ch;
    let r: number, g: number, b: number, a = 255;
    if (ctype === 0) {
      r = g = b = img[s]!;
      if (trns && trns.length >= 2 && ((trns[0]! << 8) | trns[1]!) === r) a = 0;
    } else if (ctype === 4) {
      r = g = b = img[s]!;
      a = img[s + 1]!;
    } else if (ctype === 2) {
      r = img[s]!;
      g = img[s + 1]!;
      b = img[s + 2]!;
      if (trns && trns.length >= 6 && ((trns[0]! << 8) | trns[1]!) === r && ((trns[2]! << 8) | trns[3]!) === g && ((trns[4]! << 8) | trns[5]!) === b) a = 0;
    } else if (ctype === 3) {
      const k = img[s]!;
      if (!plte || k * 3 + 2 >= plte.length) throw new Error('PNG: 팔레트 밖');
      r = plte[k * 3]!;
      g = plte[k * 3 + 1]!;
      b = plte[k * 3 + 2]!;
      a = trns && k < trns.length ? trns[k]! : 255;
    } else {
      r = img[s]!;
      g = img[s + 1]!;
      b = img[s + 2]!;
      a = img[s + 3]!;
    }
    px.set([r, g, b, a], i * 4);
  }
  return { w, h, px };
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + body.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, body.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  dv.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
  return out;
}

/** RGBA 8비트 PNG (필터 0, 투명 픽셀은 0,0,0,0 으로 정리해 파일을 작게) */
export function encodePng(img: Rgba): Uint8Array {
  const { w, h, px } = img;
  const raw = new Uint8Array((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      const d = y * (w * 4 + 1) + 1 + x * 4;
      if (px[s + 3] === 0) continue;
      raw.set(px.subarray(s, s + 4), d);
    }
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const parts = [new Uint8Array(PNG_SIG), chunk('IHDR', ihdr), chunk('IDAT', new Uint8Array(deflateSync(raw, { level: 9 }))), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((t, c) => t + c.length, 0));
  let o = 0;
  for (const c of parts) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

// ── 팩 읽기·레이어 나누기 ──

export interface PackImage { kit: string; skin: string; hair: string; img: Rgba }

/** zip 의 `raw16/` 16px 원본: `<유니폼 키>_<피부>_<머리>.png` (유니폼 키 = 앞부분 전체, 예 C01_solid_red) */
export function readPack16(zip: Uint8Array): PackImage[] {
  const out: PackImage[] = [];
  for (const f of readZipSync(zip)) {
    const m = /(?:^|\/)raw16\/([A-Za-z0-9_-]+)\.png$/.exec(f.name);
    if (!m) continue;
    const parts = m[1]!.split('_');
    if (parts.length < 3) throw new Error(`이름 형식이 달라요: ${f.name}`);
    const hair = parts.pop()!;
    const skin = parts.pop()!;
    out.push({ kit: parts.join('_'), skin, hair, img: decodePng(f.data) });
  }
  return out;
}

export interface Layers {
  w: number;
  h: number;
  kits: Map<string, Rgba>;
  /** 키 `<피부>_<머리>` */
  people: Map<string, Rgba>;
  /** 겹치는 순서: 'kit-over-person' = 인물 먼저, 그 위에 유니폼 */
  order: 'kit-over-person' | 'person-over-kit';
  /** 두 레이어가 겹치지 않아 어느 순서로 겹쳐도 같은가 */
  bothOrders: boolean;
  /** 픽셀 분류 개수 */
  stats: { kitOnly: number; personOnly: number; common: number; mixed: number };
}

const same = (a: Uint8Array, i: number, b: Uint8Array, j: number): boolean => a[i] === b[j] && a[i + 1] === b[j + 1] && a[i + 2] === b[j + 2] && a[i + 3] === b[j + 3];

/** 아래 → 위로 겹치기 (알파 0/255 만: 위가 불투명이면 위, 투명이면 아래) */
export function composite(bottom: Rgba, top: Rgba): Rgba {
  const px = bottom.px.slice();
  for (let i = 0; i < px.length; i += 4) {
    const a = top.px[i + 3]!;
    if (a === 255) px.set(top.px.subarray(i, i + 4), i);
    else if (a !== 0) throw new Error('반투명 픽셀은 지원하지 않아요');
  }
  return { w: bottom.w, h: bottom.h, px };
}

/**
 * 유니폼 레이어 = 같은 유니폼 14장에서 값이 같은 픽셀, 인물 레이어 = 같은 인물 32장에서 값이 같은 픽셀(나머지 투명).
 * 448장 모두에서 같은 픽셀(공통 배경·윤곽)은 인물 레이어에만 둔다. 두 순서로 겹쳐 보고 원본과 모두 같은 순서를 고른다. 안 되면 오류
 */
export function splitLayers(images: PackImage[]): Layers {
  if (!images.length) throw new Error('이미지가 없어요');
  const { w, h } = images[0]!.img;
  const kitKeys = [...new Set(images.map((i) => i.kit))].sort();
  const personKeys = [...new Set(images.map((i) => `${i.skin}_${i.hair}`))];
  const at = new Map(images.map((i) => [`${i.kit}|${i.skin}_${i.hair}`, i.img]));
  for (const k of kitKeys) for (const p of personKeys) if (!at.has(`${k}|${p}`)) throw new Error(`조합이 빠졌어요: ${k} ${p}`);
  for (const i of images) if (i.img.w !== w || i.img.h !== h) throw new Error('크기가 다른 이미지가 있어요');
  const blank = (): Rgba => ({ w, h, px: new Uint8Array(w * h * 4) });
  const kits = new Map(kitKeys.map((k) => [k, blank()]));
  const people = new Map(personKeys.map((p) => [p, blank()]));
  const stats = { kitOnly: 0, personOnly: 0, common: 0, mixed: 0 };
  const ref = at.get(`${kitKeys[0]}|${personKeys[0]}`)!.px;
  for (let i = 0; i < w * h * 4; i += 4) {
    const allSame = images.every((im) => same(im.img.px, i, ref, i));
    if (allSame) {
      stats.common++;
      for (const p of people.values()) p.px.set(ref.subarray(i, i + 4), i);
      continue;
    }
    let kitPx = true;
    for (const k of kitKeys) {
      const a = at.get(`${k}|${personKeys[0]}`)!.px;
      const ok = personKeys.every((p) => same(at.get(`${k}|${p}`)!.px, i, a, i));
      if (ok) kits.get(k)!.px.set(a.subarray(i, i + 4), i);
      else kitPx = false;
    }
    let personPx = true;
    for (const p of personKeys) {
      const a = at.get(`${kitKeys[0]}|${p}`)!.px;
      const ok = kitKeys.every((k) => same(at.get(`${k}|${p}`)!.px, i, a, i));
      if (ok) people.get(p)!.px.set(a.subarray(i, i + 4), i);
      else personPx = false;
    }
    if (kitPx && !personPx) stats.kitOnly++;
    else if (personPx && !kitPx) stats.personOnly++;
    else stats.mixed++;
  }
  const check = (order: Layers['order']): boolean => images.every((im) => {
    const kit = kits.get(im.kit)!;
    const person = people.get(`${im.skin}_${im.hair}`)!;
    let c: Rgba;
    try {
      c = order === 'kit-over-person' ? composite(person, kit) : composite(kit, person);
    } catch {
      return false;
    }
    for (let i = 0; i < c.px.length; i += 4) {
      // 투명 픽셀은 색값이 달라도 같다
      if (c.px[i + 3] === 0 && im.img.px[i + 3] === 0) continue;
      if (!same(c.px, i, im.img.px, i)) return false;
    }
    return true;
  });
  const kitTop = check('kit-over-person');
  const personTop = check('person-over-kit');
  const order = kitTop ? 'kit-over-person' : personTop ? 'person-over-kit' : null;
  if (!order) throw new Error(`레이어로 나눠 겹쳐도 원본이 안 나와요 (섞인 픽셀 ${stats.mixed}개)`);
  return { w, h, kits, people, order, bothOrders: kitTop && personTop, stats };
}

/**
 * 유니폼 레이어의 몸통 색 (매니페스트 kits.colors·mean): 불투명 픽셀(= 몸통)의 서로 다른 색을 많은 순서로, 그리고 픽셀 평균색.
 * 색 거리(원정·GK 충돌)는 평균색으로 잰다
 */
export function kitColors(kit: Rgba): { colors: string[]; mean: string } {
  const hex = (c: readonly number[]): string => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  const cnt = new Map<string, number>();
  const sum = [0, 0, 0];
  let n = 0;
  for (let i = 0; i < kit.px.length; i += 4) {
    if (kit.px[i + 3] !== 255) continue;
    const c = [kit.px[i]!, kit.px[i + 1]!, kit.px[i + 2]!];
    cnt.set(hex(c), (cnt.get(hex(c)) ?? 0) + 1);
    for (let k = 0; k < 3; k++) sum[k] = sum[k]! + c[k]!;
    n++;
  }
  if (!n) return { colors: [], mean: '#000000' };
  const colors = [...cnt].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([h]) => h);
  return { colors, mean: hex(sum.map((s) => s / n)) };
}

