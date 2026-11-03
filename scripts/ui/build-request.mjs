// UI_6 요청서 마무리: 문서의 {{장면이름}} 자리를 캡처 번호(P###·C###)로 바꾸고, 못 찍은 목록과 통합_프롬프트.txt 를 만든다.
// 실행: node scripts/ui/build-request.mjs   (capture-all.ts 가 captures/index-phone.json · index-pc.json 을 만든 뒤)
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = new URL('../../docs/ui-requests/17-full/', import.meta.url).pathname;
const CAP = join(DIR, 'captures');
const files = { phone: readdirSync(join(CAP, 'phone')), pc: readdirSync(join(CAP, 'pc')) };
// 장면 이름: index-phone.json(전체 실행) + 파일 이름(부분 실행으로 더 찍은 장면)
const idx = ['index-phone.json', 'index.json'].map((f) => join(CAP, f)).find((f) => existsSync(f));
const names = (idx ? JSON.parse(readFileSync(idx, 'utf8')) : []).map((r) => ({ no: r.no, name: r.name }));
for (const f of [...files.phone, ...files.pc]) {
  const m = /^(\d{3})_(.+)\.png$/.exec(f);
  if (m && !names.some((x) => x.no === m[1])) names.push({ no: m[1], name: m[2] });
}
names.sort((a, b) => a.no.localeCompare(b.no));
const shot = (dev, no) => files[dev].some((f) => f.startsWith(`${no}_`));
const ref = new Map(names.map(({ no, name }) => {
  const p = shot('phone', no), c = shot('pc', no);
  return [name, p && c ? `P${no}·C${no}` : p ? `P${no}` : c ? `C${no}` : `(${name} 못 찍음)`];
}));

const DOCS = ['00_요약.md', '01_화면카드.md', '02_공통컴포넌트.md', '03_숨은정보.md', '04_체크리스트.md'];
const missing = [];
for (const d of DOCS) {
  const path = join(DIR, d);
  let s = readFileSync(path, 'utf8');
  s = s.replace(/\{\{([^}]+)\}\}/g, (_, n) => { if (!ref.has(n)) missing.push(n); return ref.get(n) ?? `(${n}?)`; });
  writeFileSync(path, s);
}
if (missing.length) console.error('모르는 장면 이름:', [...new Set(missing)].join(', '));

// 캡처 목록 (index.json 합치기)
const index = names.map(({ no, name }) => ({ no, name, phone: shot('phone', no) ? files.phone.find((f) => f.startsWith(`${no}_`)) : null, pc: shot('pc', no) ? files.pc.find((f) => f.startsWith(`${no}_`)) : null }));
writeFileSync(join(CAP, 'index.json'), JSON.stringify(index, null, 1));
const lost = index.filter((r) => !r.phone || !r.pc).map((r) => `- ${r.no} ${r.name}: ${!r.phone && !r.pc ? '폰·PC 모두' : !r.phone ? '폰' : 'PC'} 없음`);
console.log(`캡처: 장면 ${index.length} · 폰 ${index.filter((r) => r.phone).length} · PC ${index.filter((r) => r.pc).length}`);
console.log(lost.join('\n'));

// 통합본
const head = `PLAYER ONE — 전체 UI 재설계 요청 (한 벌짜리 · 17차, 2026-11-04)
이 글 하나 + 캡처 폴더(captures/phone, captures/pc)만 보면 돼요. 지난 차수별 요청(1~259)은 전부 이걸로 대체해요.
캡처 폴더: docs/ui-requests/17-full/captures/phone/NNN_화면_상태.png (390×844 다크, 긴 화면은 전체 길이) · captures/pc/NNN_화면_상태.png (1280×800 다크) · captures/index.json
캡처 번호 표기: P012 = phone/012_*.png, C012 = pc/012_*.png
`;
const body = DOCS.map((d) => readFileSync(join(DIR, d), 'utf8')).join('\n\n---\n\n');
writeFileSync(join(DIR, '통합_프롬프트.txt'), `${head}\n${body}\n`);
console.log('통합_프롬프트.txt', Math.round(Buffer.byteLength(head + body) / 1024), 'KB');
