// 페이스팩 수집: 실제 선수 사진과 프리미어리그 구단 로고를 위키백과 REST 요약 API 로 받아 작은 이미지로 저장한다.
// 실행: npm run facepack -- [--only players|clubs] [--force]
// 출력: public/facepack/{players,clubs}/*.png (정사각형, 투명 채움), public/facepack/manifest.json, scripts/facepack/report.md
// 원본 내려받기는 저장소 밖 임시 폴더(FACEPACK_RAW_DIR, 기본 OS 임시 폴더/facepack-raw)에 둔다.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { A_GRADE_PLAYERS } from '../../data/players';
import { FUTURE_STARS, LEGENDS } from '../../data/players/legends';
import { initialTeams } from '../../src/league';

const UA = 'PlayerOneFacepack/0.1 (https://github.com/ATho3398/football; personal use)';
const SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const MIN_GAP_MS = 1100;
const BACKOFF_MS = [2000, 4000, 8000, 16000];
const SIZE = 128;

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const OUT = join(ROOT, 'public/facepack');
const REPORT = join(HERE, 'report.md');
const RAW = process.env.FACEPACK_RAW_DIR ?? join(tmpdir(), 'facepack-raw');

/** 이름만으로는 문서가 갈리는 선수: 먼저 시도할 문서 제목 */
const PLAYER_OVERRIDES: Record<string, string[]> = {
  neymar: ['Neymar'],
  son: ['Son Heung-min'],
  vinicius: ['Vinícius Júnior'],
  aguero: ['Sergio Agüero'],
  salah: ['Mohamed Salah'],
  suarez: ['Luis Suárez (Uruguayan footballer)', 'Luis Suárez'],
  pogba: ['Paul Pogba'],
  hazard: ['Eden Hazard'],
  rashford: ['Marcus Rashford'],
  foden: ['Phil Foden'],
  ramos: ['Sergio Ramos'],
  havertz: ['Kai Havertz'],
  kimmich: ['Joshua Kimmich'],
  mane: ['Sadio Mané'],
  kante: ["N'Golo Kanté"],
  ronaldo: ['Cristiano Ronaldo'],
  sancho: ['Jadon Sancho'],
  firmino: ['Roberto Firmino'],
};

/** 구단 문서 제목 우선 후보 (게임 속 이름이 위키 제목과 다른 곳) */
const CLUB_OVERRIDES: Record<string, string[]> = {
  bou: ['AFC Bournemouth'],
  bha: ['Brighton & Hove Albion F.C.'],
  wol: ['Wolverhampton Wanderers F.C.'],
  hud: ['Huddersfield Town A.F.C.'],
  car: ['Cardiff City F.C.'],
  tot: ['Tottenham Hotspur F.C.'],
  whu: ['West Ham United F.C.'],
};

interface Summary {
  type?: string;
  title?: string;
  description?: string;
  extract?: string;
  thumbnail?: { source: string; width: number; height: number };
  originalimage?: { source: string; width: number; height: number };
  content_urls?: { desktop?: { page?: string } };
}

interface ManifestEntry { file: string; source: string; page: string; title: string }
interface Manifest { version: 1; generated: string; players: Record<string, ManifestEntry>; clubs: Record<string, ManifestEntry> }
type Status = '찾음' | '못 찾음' | '의심' | '기존 유지';
interface ReportRow { id: string; name: string; status: Status; title: string; reason: string }

const args = process.argv.slice(2);
const force = args.includes('--force');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : undefined;
if (only !== undefined && only !== 'players' && only !== 'clubs') {
  console.error('--only 는 players 또는 clubs 만 받는다');
  process.exit(2);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
let lastRequest = 0;

/** 모든 요청 사이 최소 간격을 지키고, 429/5xx 는 물러났다 다시 시도한다 */
async function politeFetch(url: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const wait = lastRequest + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    let res: Response | undefined;
    try {
      res = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } });
    } catch (e) {
      if (attempt >= BACKOFF_MS.length) throw e;
    }
    if (res && res.status !== 429 && res.status < 500) return res;
    if (attempt >= BACKOFF_MS.length) {
      if (res) return res;
      throw new Error(`요청 실패: ${url}`);
    }
    const retryAfter = Number(res?.headers.get('retry-after'));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : BACKOFF_MS[attempt]!;
    console.warn(`  ${res?.status ?? '네트워크 오류'} → ${delay / 1000}초 뒤 재시도 (${attempt + 1}/${BACKOFF_MS.length})`);
    await sleep(delay);
  }
}

async function summary(title: string): Promise<Summary | undefined> {
  const res = await politeFetch(SUMMARY + encodeURIComponent(title.replace(/ /g, '_')));
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`요약 API ${res.status}: ${title}`);
  return (await res.json()) as Summary;
}

/** 썸네일이 작으면 표준 크기(330px)로 다시 요청한다. 썸네일이 없으면 원본 */
function imageUrl(s: Summary): string | undefined {
  const t = s.thumbnail;
  if (t) {
    if (t.width < 200 && /\/\d+px-/.test(t.source)) return t.source.replace(/\/\d+px-/, '/330px-');
    return t.source;
  }
  return s.originalimage?.source;
}

async function download(url: string, dest: string): Promise<void> {
  const res = await politeFetch(url);
  if (!res.ok) throw new Error(`이미지 ${res.status}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

// 정사각형 정규화 (C.43 개정, 사용자 "원형 틀 없이 PNG 그대로"): 자르지 않고 긴 쪽을 SIZE 에 맞춘 뒤
// 짧은 쪽을 투명으로 채워 정사각형 PNG 로 저장한다. 얼굴 사진은 아래쪽 맞춤, 로고는 가운데
function squarePng(src: string, dest: string, gravity: 'south' | 'center'): void {
  execFileSync('convert', [
    '-background', 'none', `${src}[0]`, '-auto-orient', '-resize', `${SIZE}x${SIZE}`, '-gravity', gravity,
    '-extent', `${SIZE}x${SIZE}`, '-strip', '-define', 'png:compression-level=9', `PNG32:${dest}`,
  ]);
}

function convertPlayer(src: string, dest: string): void {
  squarePng(src, dest, 'south');
}

function convertClub(src: string, dest: string): void {
  squarePng(src, dest, 'center');
}

const pageUrl = (s: Summary, title: string) =>
  s.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
const uniq = (xs: string[]) => [...new Set(xs)];

interface Candidate { title: string; primary: boolean }
interface Job {
  kind: 'players' | 'clubs';
  id: string;
  name: string;
  candidates: Candidate[];
  accept: (s: Summary) => string | undefined; // 거절 이유, 통과면 undefined
  suspect: (s: Summary, c: Candidate) => string | undefined;
}

async function runJob(job: Job, manifest: Manifest): Promise<ReportRow> {
  const file = `${job.kind}/${job.id}.png`;
  const dest = join(OUT, file);
  const prev = manifest[job.kind][job.id];
  if (!force && existsSync(dest) && prev) {
    // 지난 보고서의 판정(찾음/의심)을 이어받는다
    const old = oldRows.get(`${job.kind}:${job.id}`);
    if (old && old.status !== '못 찾음') return { ...old, title: prev.title };
    return { id: job.id, name: job.name, status: '기존 유지', title: prev.title, reason: '이미 있음 (--force 로 다시 받기)' };
  }
  const tried: string[] = [];
  for (const c of job.candidates) {
    const s = await summary(c.title);
    if (!s) { tried.push(`${c.title}: 문서 없음`); continue; }
    if (s.type === 'disambiguation') { tried.push(`${c.title}: 동음이의`); continue; }
    const bad = job.accept(s);
    if (bad) { tried.push(`${c.title}: ${bad}`); continue; }
    const url = imageUrl(s);
    if (!url) { tried.push(`${c.title}: 이미지 없음`); continue; }
    const ext = (url.split('?')[0]!.match(/\.(\w+)$/)?.[1] ?? 'img').toLowerCase();
    const raw = join(RAW, job.kind, `${job.id}.${ext}`);
    try {
      await download(url, raw);
      (job.kind === 'players' ? convertPlayer : convertClub)(raw, dest);
    } catch (e) {
      tried.push(`${c.title}: ${(e as Error).message}`);
      continue;
    }
    const title = s.title ?? c.title;
    manifest[job.kind][job.id] = { file, source: url, page: pageUrl(s, title), title };
    const sus = job.suspect(s, c);
    return { id: job.id, name: job.name, status: sus ? '의심' : '찾음', title, reason: sus ?? (tried.length ? tried.join('; ') : '') };
  }
  delete manifest[job.kind][job.id];
  return { id: job.id, name: job.name, status: '못 찾음', title: '', reason: tried.join('; ') };
}

function playerJobs(): Job[] {
  return A_GRADE_PLAYERS.map((p) => {
    const over = PLAYER_OVERRIDES[p.id] ?? [];
    const generic = [p.name, `${p.name} (footballer)`, `${p.name} (footballer, born ${p.birthYear})`];
    const candidates = [
      ...over.map((title) => ({ title, primary: true })),
      ...generic.map((title, i) => ({ title, primary: over.length === 0 && i === 0 })),
    ].filter((c, i, a) => a.findIndex((d) => d.title === c.title) === i);
    return {
      kind: 'players' as const, id: p.id, name: p.name, candidates,
      accept: (s: Summary) => (/football|soccer/i.test(`${s.description ?? ''} ${s.extract ?? ''}`) ? undefined : '축구 문서 아님'),
      suspect: (s: Summary, c: Candidate) => {
        const why: string[] = [];
        if (!`${s.description ?? ''} ${s.extract ?? ''}`.includes(String(p.birthYear))) why.push(`출생연도 ${p.birthYear} 미확인`);
        if (!c.primary) why.push(`대체 후보로 찾음 (${c.title})`);
        return why.length ? why.join(', ') : undefined;
      },
    };
  });
}

/** 레전드 팩 (C.47): 출생연도 확인 없이 축구 문서만. 동음이의가 있는 이름은 덮어쓰기 */
const LEGEND_OVERRIDES: Record<string, string[]> = {
  // C.75w 추가 53명
  'lg-juliocesar': ['Júlio César (football goalkeeper, born 1979)'], 'lg-dida': ['Dida (footballer, born 1973)', 'Dida'], 'lg-lucio': ['Lúcio'],
  'lg-pepe': ['Pepe (footballer, born 1983)'], 'lg-marcelo': ['Marcelo (footballer, born 1988)'], 'lg-dunga': ['Dunga'], 'lg-guti': ['Guti (footballer, born 1976)', 'Guti'],
  'lg-dsilva': ['David Silva'], 'lg-gilberto': ['Gilberto Silva'], 'lg-campos': ['Jorge Campos'], 'lg-leewoonjae': ['Lee Woon-jae'],
  'lg-ahnjunghwan': ['Ahn Jung-hwan'], 'lg-rush': ['Ian Rush'], 'lg-iwright': ['Ian Wright'], 'lg-andycole': ['Andrew Cole', 'Andy Cole'],
  'lg-fowler': ['Robbie Fowler'], 'lg-crouch': ['Peter Crouch'], 'lg-petit': ['Emmanuel Petit'], 'lg-rcarvalho': ['Ricardo Carvalho'],
  'lg-zlatan': ['Zlatan Ibrahimović'], 'lg-valdes': ['Víctor Valdés'],
  // C.75x 도르트문트 레전드 · 미래 스타
  'lg-dede': ['Dedé (footballer, born 1978)'], 'lg-jkohler': ['Jürgen Kohler'], 'lg-jkoller': ['Jan Koller'], 'lg-klos': ['Stefan Klos'],
  'lg-sbender': ['Sven Bender'], 'lg-santana': ['Felipe Santana'], 'lg-barrios': ['Lucas Barrios'], 'lg-kuba': ['Jakub Błaszczykowski'],
  'fs-pedri': ['Pedri'], 'fs-gavi': ['Gavi (footballer)', 'Gavi'], 'fs-endrick': ['Endrick (footballer)', 'Endrick'],
  'lg-ronaldo9': ['Ronaldo (Brazilian footballer)'], 'lg-raul': ['Raúl (footballer)'], 'lg-xavi': ['Xavi (footballer, born 1980)'], 'lg-deco': ['Deco'],
  'lg-rivaldo': ['Rivaldo'], 'lg-romario': ['Romário'], 'lg-kaka': ['Kaká'], 'lg-zico': ['Zico (footballer)', 'Zico'],
  'lg-cafu': ['Cafu'], 'lg-pele': ['Pelé'], 'lg-ruicosta': ['Rui Costa'], 'lg-keane': ['Roy Keane'], 'lg-villa': ['David Villa'],
  'lg-torres': ['Fernando Torres'], 'lg-owen': ['Michael Owen'], 'lg-acole': ['Ashley Cole'], 'lg-gneville': ['Gary Neville'],
  'lg-bcharlton': ['Bobby Charlton'], 'lg-best': ['George Best'], 'lg-gmuller': ['Gerd Müller'], 'lg-park': ['Park Ji-sung'],
  'lg-hongmyungbo': ['Hong Myung-bo'], 'lg-leeyoungpyo': ['Lee Young-pyo'], 'lg-chabumkun': ['Cha Bum-kun'], 'lg-yaya': ['Yaya Touré'],
};

function legendJobs(): Job[] {
  return [...LEGENDS, ...FUTURE_STARS].map((l) => {
    const candidates = [...(LEGEND_OVERRIDES[l.id] ?? []), l.name, `${l.name} (footballer)`]
      .filter((t, i, a) => a.indexOf(t) === i).map((title, i) => ({ title, primary: i === 0 }));
    return {
      kind: 'players' as const, id: l.id, name: l.name, candidates,
      accept: (s: Summary) => (/football|soccer/i.test(`${s.description ?? ''} ${s.extract ?? ''}`) ? undefined : '축구 문서 아님'),
      suspect: (_s: Summary, c: Candidate) => (c.primary ? undefined : `대체 후보로 찾음 (${c.title})`),
    };
  });
}

function clubJobs(): Job[] {
  return initialTeams().map((t) => {
    const titles = uniq([...(CLUB_OVERRIDES[t.id] ?? []), `${t.name} F.C.`, t.name, `${t.name} A.F.C.`]);
    return {
      kind: 'clubs' as const, id: t.id, name: t.name,
      candidates: titles.map((title) => ({ title, primary: true })),
      accept: (s: Summary) => (/football club/i.test(`${s.description ?? ''} ${s.extract ?? ''}`) ? undefined : '축구 구단 문서 아님'),
      suspect: () => undefined,
    };
  });
}

function loadManifest(): Manifest {
  const p = join(OUT, 'manifest.json');
  if (existsSync(p)) {
    try {
      const m = JSON.parse(readFileSync(p, 'utf8')) as Manifest;
      return { version: 1, generated: m.generated, players: m.players ?? {}, clubs: m.clubs ?? {} };
    } catch { /* 깨진 매니페스트는 새로 만든다 */ }
  }
  return { version: 1, generated: '', players: {}, clubs: {} };
}

/** 지난 report.md 의 표 행 (kind:id → 행) */
const oldRows = new Map<string, ReportRow>();
function loadOldRows(): void {
  if (!existsSync(REPORT)) return;
  let kind: 'players' | 'clubs' | undefined;
  for (const line of readFileSync(REPORT, 'utf8').split('\n')) {
    if (line.startsWith('## 선수')) kind = 'players';
    else if (line.startsWith('## 구단')) kind = 'clubs';
    else if (line.startsWith('## ')) kind = undefined;
    if (!kind || !line.startsWith('| ') || line.startsWith('| id ')) continue;
    const cells = line.slice(2, -2).split(/ (?<!\\)\| /).map((c) => c.replace(/\\\|/g, '|'));
    if (cells.length < 5) continue;
    const [id, name, status, title, reason] = cells as [string, string, Status, string, string];
    oldRows.set(`${kind}:${id}`, { id, name, status, title, reason });
  }
}

/** 이번에 돌리지 않은 종류는 기존 report.md 의 표를 그대로 둔다 */
function loadOldSection(kind: 'players' | 'clubs'): string | undefined {
  if (!existsSync(REPORT)) return undefined;
  const text = readFileSync(REPORT, 'utf8');
  const head = kind === 'players' ? '## 선수' : '## 구단';
  const i = text.indexOf(head);
  if (i < 0) return undefined;
  const j = text.indexOf('\n## ', i + head.length);
  return text.slice(i, j < 0 ? undefined : j).trimEnd();
}

function section(kind: 'players' | 'clubs', rows: ReportRow[]): string {
  const head = kind === 'players' ? '## 선수' : '## 구단';
  const esc = (s: string) => s.replace(/\|/g, '\\|');
  return [head, '', '| id | 이름 | 상태 | 문서 제목 | 사유 |', '|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.id} | ${esc(r.name)} | ${r.status} | ${esc(r.title)} | ${esc(r.reason)} |`)].join('\n');
}

function dirBytes(dir: string): number {
  let total = 0;
  for (const sub of ['players', 'clubs']) {
    const d = join(dir, sub);
    if (!existsSync(d)) continue;
    for (const f of execFileSync('ls', [d]).toString().split('\n').filter(Boolean)) total += statSync(join(d, f)).size;
  }
  const m = join(dir, 'manifest.json');
  return total + (existsSync(m) ? statSync(m).size : 0);
}

/** --reconvert: 내려받은 원본(RAW)에서 출력 이미지만 다시 만든다 (요청 없음). 옛 .webp 는 지운다 */
function reconvert(): void {
  const manifest = loadManifest();
  for (const kind of ['players', 'clubs'] as const) {
    for (const [id, e] of Object.entries(manifest[kind])) {
      const raw = readdirSync(join(RAW, kind)).find((f) => f.startsWith(`${id}.`));
      if (!raw) { console.log(`[${kind}] ${id}: 원본 없음, 건너뜀`); continue; }
      const file = `${kind}/${id}.png`;
      (kind === 'players' ? convertPlayer : convertClub)(join(RAW, kind, raw), join(OUT, file));
      if (e.file !== file && existsSync(join(OUT, e.file))) rmSync(join(OUT, e.file));
      e.file = file;
    }
  }
  manifest.generated = new Date().toISOString();
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`다시 만듦 · public/facepack ${dirBytes(OUT)} 바이트`);
}

async function main(): Promise<void> {
  if (args.includes('--reconvert')) return reconvert();
  // 연결 확인: 실패하면 출력물을 건드리지 않고 끝낸다
  try {
    const s = await summary('Lionel Messi');
    if (!s?.title) throw new Error('응답 형식이 이상함');
  } catch (e) {
    console.error(`위키백과 REST API 에 연결할 수 없다: ${(e as Error).message}`);
    console.error('네트워크/프록시를 확인한 뒤 다시 실행하라. 출력물은 바꾸지 않았다.');
    process.exit(1);
  }
  for (const d of [join(OUT, 'players'), join(OUT, 'clubs'), join(RAW, 'players'), join(RAW, 'clubs')]) mkdirSync(d, { recursive: true });

  const manifest = loadManifest();
  loadOldRows();
  const results: Partial<Record<'players' | 'clubs', ReportRow[]>> = {};
  for (const kind of ['players', 'clubs'] as const) {
    if (only && only !== kind) continue;
    const jobs = kind === 'players' ? [...playerJobs(), ...legendJobs()] : clubJobs();
    const rows: ReportRow[] = [];
    for (const job of jobs) {
      const row = await runJob(job, manifest);
      console.log(`[${kind}] ${job.id}: ${row.status} ${row.title} ${row.reason}`);
      rows.push(row);
      // 중간에 끊겨도 받은 것까지는 남도록 매번 매니페스트를 쓴다
      manifest.generated = new Date().toISOString();
      writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    }
    results[kind] = rows;
  }

  const players = A_GRADE_PLAYERS.length;
  const clubs = initialTeams().length;
  const foundP = Object.keys(manifest.players).length;
  const foundC = Object.keys(manifest.clubs).length;
  const suspects = (results.players ?? []).filter((r) => r.status === '의심').map((r) => `${r.id} (${r.reason})`);
  const bytes = dirBytes(OUT);
  const report = [
    '# 페이스팩 수집 보고',
    '',
    `생성: ${manifest.generated} · 출처: 위키백과 REST 요약 API · 이미지 ${SIZE}×${SIZE} WebP`,
    '',
    '## 요약',
    '',
    `- 선수 ${foundP}/${players}`,
    `- 구단 ${foundC}/${clubs}`,
    `- 의심: ${suspects.length ? suspects.join('; ') : '없음'}${results.players ? '' : ' (이번 실행에서 선수는 건너뜀)'}`,
    `- public/facepack 전체 ${bytes.toLocaleString('en-US')} 바이트`,
    '',
    results.players ? section('players', results.players) : (loadOldSection('players') ?? '## 선수\n\n(아직 수집 안 함)'),
    '',
    results.clubs ? section('clubs', results.clubs) : (loadOldSection('clubs') ?? '## 구단\n\n(아직 수집 안 함)'),
    '',
  ].join('\n');
  writeFileSync(REPORT, report);
  console.log(`\n선수 ${foundP}/${players}, 구단 ${foundC}/${clubs}, 의심 ${suspects.length}, ${bytes} 바이트`);
  console.log(`보고서: ${REPORT}`);
}

await main();
