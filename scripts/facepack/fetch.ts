// 페이스팩 수집: 실제 선수 사진과 구단 로고를 위키백과 REST 요약 API 로 받아 작은 이미지로 저장한다.
// 실행: npm run facepack -- [--only players|clubs] [--league <id,...>] [--force] [--cutout] [--license] [--reconvert]
// 출력: public/facepack/{players,clubs}/*.png (정사각형, 투명 채움), public/facepack/manifest.json, scripts/facepack/report.md
// 리그 데이터(C.75n~s) 구단·실명 선수는 하위 폴더 clubs/<리그>/<코드>.png, players/<리그>/<선수 id>.png (리그별 지연 로딩, C.77u)
// 선수 사진은 배경을 지운다(C.77u, scripts/facepack/cutout.py · rembg, 로컬). 파이썬은 FACEPACK_PYTHON(기본 python3)
// 원본 내려받기는 저장소 밖 임시 폴더(FACEPACK_RAW_DIR, 기본 OS 임시 폴더/facepack-raw)에 둔다.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { A_GRADE_PLAYERS, LEAGUE_GOALKEEPERS, LEAGUE_PLAYERS } from '../../data/players';
import { FUTURE_STARS, LEGENDS } from '../../data/players/legends';
import { allLeagueData } from '../../data/leagues';
import { LEAGUE_CLUB_OVERRIDES } from './overrides';

const UA = 'PlayerOneFacepack/0.2 (https://github.com/ATho3398/football; personal use)';
const SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const API = 'https://en.wikipedia.org/w/api.php';
const MIN_GAP_MS = 1100;
const BACKOFF_MS = [2000, 4000, 8000, 16000];
const SIZE = 128;

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const OUT = join(ROOT, 'public/facepack');
const REPORT = join(HERE, 'report.md');
const RAW = process.env.FACEPACK_RAW_DIR ?? join(tmpdir(), 'facepack-raw');
const PYTHON = process.env.FACEPACK_PYTHON ?? 'python3';
const CUTOUT_MODEL = process.env.FACEPACK_CUTOUT_MODEL ?? 'isnet-general-use';

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

/** 구단 문서 제목 우선 후보 (게임 속 이름이 위키 제목과 다른 곳). 리그 데이터 구단은 overrides.ts */
const CLUB_OVERRIDES: Record<string, string[]> = {
  bou: ['AFC Bournemouth'],
  bha: ['Brighton & Hove Albion F.C.'],
  wol: ['Wolverhampton Wanderers F.C.'],
  hud: ['Huddersfield Town A.F.C.'],
  car: ['Cardiff City F.C.'],
  tot: ['Tottenham Hotspur F.C.'],
  whu: ['West Ham United F.C.'],
  ...LEAGUE_CLUB_OVERRIDES,
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

interface ManifestEntry {
  file: string; source: string; page: string; title: string;
  /** 배경을 지운 사진 (C.77u). 128px 라 미페 머리말 큰 누끼(cutout, C.57)는 켜지 않고 액자 안에 보인다 */
  nobg?: boolean;
  /** 머리말 큰 누끼로 보일 사진 (C.57). 고해상도 원본으로 크게 만들 때만 손으로 켠다 */
  cutout?: boolean;
  /** 리그 데이터 항목이면 리그 id (C.77u, 지연 로딩 폴더와 같다) */
  league?: string;
  /** 위키미디어 파일 메타데이터 (C.77u): 라이선스 약칭, 저작자(태그 뺀 글), 파일 문서 */
  license?: string; artist?: string; filePage?: string;
}
interface Manifest { version: 1; generated: string; players: Record<string, ManifestEntry>; clubs: Record<string, ManifestEntry> }
type Kind = 'players' | 'clubs';
type Status = '찾음' | '못 찾음' | '의심' | '기존 유지';
interface ReportRow { id: string; name: string; status: Status; title: string; reason: string; league: string }

const args = process.argv.slice(2);
const force = args.includes('--force');
const argOf = (k: string): string | undefined => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = argOf('--only');
if (only !== undefined && only !== 'players' && only !== 'clubs') {
  console.error('--only 는 players 또는 clubs 만 받는다');
  process.exit(2);
}
/** --league pl,laliga,... : 그 리그만 (pl = 프리미어리그 구단 + A등급·레전드·미래 스타) */
const leagueFilter = argOf('--league')?.split(',').filter(Boolean);

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

/**
 * 받을 이미지 주소: 썸네일을 원하는 폭으로 다시 요청한다(로고 330px, 선수 640px — 배경 제거·얼굴 크롭에 해상도가 필요).
 * 원본이 그보다 작으면 원본, 썸네일이 없으면 원본
 */
function imageUrl(s: Summary, px: number): string | undefined {
  const t = s.thumbnail;
  const o = s.originalimage;
  if (t) {
    if (o && o.width <= px && !/\.svg$/i.test(o.source)) return o.source;
    if (t.width !== px && /\/\d+px-/.test(t.source)) return t.source.replace(/\/\d+px-/, `/${px}px-`);
    return t.source;
  }
  return o?.source;
}

async function download(url: string, dest: string): Promise<void> {
  const res = await politeFetch(url);
  if (!res.ok) throw new Error(`이미지 ${res.status}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

/** 이미지 주소 → 위키 파일 이름 (File: 없이, 디코드) */
function fileNameOf(url: string): string | undefined {
  const m = url.split('?')[0]!.match(/\/wikipedia\/[a-z-]+\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/);
  return m ? decodeURIComponent(m[1]!) : undefined;
}

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();

/** 위키미디어 파일 메타데이터 (en 위키 API 는 커먼즈 파일도 같이 답한다) */
async function license(url: string): Promise<Pick<ManifestEntry, 'license' | 'artist' | 'filePage'> | undefined> {
  const name = fileNameOf(url);
  if (!name) return undefined;
  const q = `${API}?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=extmetadata%7Curl&titles=${encodeURIComponent(`File:${name}`)}`;
  const res = await politeFetch(q);
  if (!res.ok) return undefined;
  const j = (await res.json()) as { query?: { pages?: { imageinfo?: { descriptionurl?: string; extmetadata?: Record<string, { value?: string }> }[] }[] } };
  const info = j.query?.pages?.[0]?.imageinfo?.[0];
  if (!info) return undefined;
  const md = info.extmetadata ?? {};
  const lic = md.LicenseShortName?.value ?? (md.NonFree?.value ? 'Non-free (fair use)' : undefined);
  const artist = md.Artist?.value ? stripHtml(md.Artist.value).slice(0, 120) : undefined;
  return { license: lic ? stripHtml(lic) : undefined, artist, filePage: info.descriptionurl };
}

// 정사각형 정규화 (C.43 개정, 사용자 "원형 틀 없이 PNG 그대로"): 자르지 않고 긴 쪽을 SIZE 에 맞춘 뒤
// 짧은 쪽을 투명으로 채워 정사각형 PNG 로 저장한다. 얼굴 사진은 아래쪽 맞춤, 로고는 가운데
function squarePng(src: string, dest: string, gravity: 'south' | 'center'): void {
  execFileSync('convert', [
    '-background', 'none', `${src}[0]`, '-auto-orient', '-resize', `${SIZE}x${SIZE}`, '-gravity', gravity,
    '-extent', `${SIZE}x${SIZE}`, '-strip', '-define', 'png:compression-level=9', `PNG32:${dest}`,
  ]);
}

/** 배경 제거를 쓸 수 있는지 (파이썬 + rembg). 없으면 선수 사진은 배경 그대로(squarePng) */
function cutoutReady(): boolean {
  try {
    execFileSync(PYTHON, ['-c', 'import rembg, PIL'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** 배경 제거 + 얼굴·상반신 크롭 (cutout.py) 한 번에 여러 장. 성공한 출력 경로 */
function cutoutBatch(pairs: [src: string, dest: string][]): Set<string> {
  const done = new Set<string>();
  for (let i = 0; i < pairs.length; i += 40) {
    const chunk = pairs.slice(i, i + 40);
    try {
      const out = execFileSync(PYTHON, [join(HERE, 'cutout.py'), '--size', String(SIZE), '--model', CUTOUT_MODEL, ...chunk.flat()], { stdio: ['ignore', 'pipe', 'inherit'] });
      for (const line of out.toString().split('\n')) {
        const m = line.match(/ -> (.+)$/);
        if (m) done.add(m[1]!);
      }
    } catch (e) {
      console.warn(`  배경 제거 실패 (${chunk.length}장): ${(e as Error).message.split('\n')[0]}`);
    }
  }
  return done;
}

const pageUrl = (s: Summary, title: string) =>
  s.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
const uniq = (xs: string[]) => [...new Set(xs)];

/** 출력 파일 (public/facepack 기준). 리그 데이터 id(`리그:코드`)·리그 선수는 리그 폴더로 */
function outFile(kind: Kind, id: string, league?: string): string {
  if (kind === 'clubs' && id.includes(':')) {
    const [lg, code] = id.split(':') as [string, string];
    return `clubs/${lg}/${code}.png`;
  }
  return league ? `${kind}/${league}/${id}.png` : `${kind}/${id}.png`;
}
const rawBase = (kind: Kind, id: string) => join(RAW, kind, id.replace(/[:/]/g, '__'));

interface Candidate { title: string; primary: boolean }
interface Job {
  kind: Kind;
  id: string;
  name: string;
  /** 리그 데이터 항목이면 리그 id (PL·A등급·레전드는 'pl') */
  league: string;
  /** 리그 폴더에 둘 때 그 리그 (PL 은 없음) */
  folder?: string;
  candidates: Candidate[];
  accept: (s: Summary) => string | undefined; // 거절 이유, 통과면 undefined
  suspect: (s: Summary, c: Candidate) => string | undefined;
}

/** 이번 실행에서 새로 받은 선수 원본 → 배경 제거 대기 */
const pendingCutout: { id: string; raw: string; dest: string }[] = [];

async function runJob(job: Job, manifest: Manifest, withCutout: boolean): Promise<ReportRow> {
  const file = outFile(job.kind, job.id, job.folder);
  const dest = join(OUT, file);
  const prev = manifest[job.kind][job.id];
  const base = { id: job.id, name: job.name, league: job.league };
  if (!force && prev && existsSync(join(OUT, prev.file))) {
    // 지난 보고서의 판정(찾음/의심)을 이어받는다
    const old = oldRows.get(`${job.kind}:${job.id}`);
    if (old && old.status !== '못 찾음') return { ...old, ...base, title: prev.title };
    return { ...base, status: '기존 유지', title: prev.title, reason: '이미 있음 (--force 로 다시 받기)' };
  }
  mkdirSync(dirname(dest), { recursive: true });
  const tried: string[] = [];
  for (const c of job.candidates) {
    const s = await summary(c.title);
    if (!s) { tried.push(`${c.title}: 문서 없음`); continue; }
    if (s.type === 'disambiguation') { tried.push(`${c.title}: 동음이의`); continue; }
    const bad = job.accept(s);
    if (bad) { tried.push(`${c.title}: ${bad}`); continue; }
    const url = imageUrl(s, job.kind === 'players' ? 640 : 330);
    if (!url) { tried.push(`${c.title}: 이미지 없음`); continue; }
    const ext = (url.split('?')[0]!.match(/\.(\w+)$/)?.[1] ?? 'img').toLowerCase();
    const raw = `${rawBase(job.kind, job.id)}.${ext}`;
    try {
      await download(url, raw);
      // 우선 배경 그대로 정사각형으로 만들어 둔다 (배경 제거는 끝에 한꺼번에)
      squarePng(raw, dest, job.kind === 'players' ? 'south' : 'center');
    } catch (e) {
      tried.push(`${c.title}: ${(e as Error).message}`);
      continue;
    }
    const title = s.title ?? c.title;
    const entry: ManifestEntry = { file, source: url, page: pageUrl(s, title), title };
    if (job.league !== 'pl') entry.league = job.league;
    try {
      Object.assign(entry, await license(url));
    } catch { /* 메타데이터는 --license 로 다시 채울 수 있다 */ }
    if (prev && prev.file !== file && existsSync(join(OUT, prev.file))) rmSync(join(OUT, prev.file));
    manifest[job.kind][job.id] = entry;
    if (job.kind === 'players' && withCutout) pendingCutout.push({ id: job.id, raw, dest });
    const sus = job.suspect(s, c);
    return { ...base, status: sus ? '의심' : '찾음', title, reason: sus ?? (tried.length ? tried.join('; ') : '') };
  }
  return { ...base, status: '못 찾음', title: '', reason: tried.join('; ') };
}

const isFootball = (s: Summary) => (/football|soccer/i.test(`${s.description ?? ''} ${s.extract ?? ''}`) ? undefined : '축구 문서 아님');

/** 출생연도를 아는 실제 선수 (A등급·리그 데이터 선수·리그 GK) */
function realPlayerJob(p: { id: string; name: string; birthYear: number }, league: string, folder?: string): Job {
  const over = PLAYER_OVERRIDES[p.id] ?? [];
  const generic = [p.name, `${p.name} (footballer)`, `${p.name} (footballer, born ${p.birthYear})`];
  const candidates = [
    ...over.map((title) => ({ title, primary: true })),
    ...generic.map((title, i) => ({ title, primary: over.length === 0 && i === 0 })),
  ].filter((c, i, a) => a.findIndex((d) => d.title === c.title) === i);
  return {
    kind: 'players', id: p.id, name: p.name, league, folder, candidates,
    accept: isFootball,
    suspect: (s: Summary, c: Candidate) => {
      const why: string[] = [];
      if (!`${s.description ?? ''} ${s.extract ?? ''}`.includes(String(p.birthYear))) why.push(`출생연도 ${p.birthYear} 미확인`);
      if (!c.primary) why.push(`대체 후보로 찾음 (${c.title})`);
      return why.length ? why.join(', ') : undefined;
    },
  };
}

function playerJobs(): Job[] {
  return A_GRADE_PLAYERS.map((p) => realPlayerJob(p, 'pl'));
}

/** 리그 데이터 실명 선수 (C.77u): 필드 선수 + GK, players/<리그>/ 폴더 */
function leaguePlayerJobs(): Job[] {
  const seen = new Set(A_GRADE_PLAYERS.map((p) => p.id));
  const jobs: Job[] = [];
  for (const lg of Object.keys(LEAGUE_PLAYERS)) {
    for (const p of [...(LEAGUE_PLAYERS[lg] ?? []), ...(LEAGUE_GOALKEEPERS[lg] ?? [])]) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      jobs.push(realPlayerJob(p, lg, lg));
    }
  }
  return jobs;
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
      kind: 'players' as const, id: l.id, name: l.name, league: 'pl', candidates,
      accept: isFootball,
      suspect: (_s: Summary, c: Candidate) => (c.primary ? undefined : `대체 후보로 찾음 (${c.title})`),
    };
  });
}

/** 등록된 모든 리그 구단 (C.77u: PL 20 → 전 리그) */
function clubJobs(): Job[] {
  return allLeagueData().flatMap((d) => d.teams.map((t): Job => {
    const titles = uniq([...(CLUB_OVERRIDES[t.id] ?? []), `${t.name} F.C.`, t.name, `${t.name} FC`, `${t.name} A.F.C.`]);
    return {
      kind: 'clubs', id: t.id, name: t.name, league: d.id,
      candidates: titles.map((title) => ({ title, primary: true })),
      accept: (s: Summary) => (/football|soccer|futebol|club/i.test(`${s.description ?? ''} ${s.extract ?? ''}`) ? undefined : '축구 구단 문서 아님'),
      suspect: () => undefined,
    };
  }));
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

function saveManifest(m: Manifest): void {
  m.generated = new Date().toISOString();
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(m, null, 2) + '\n');
}

/** 지난 report.md 의 표 행 (kind:id → 행) */
const oldRows = new Map<string, ReportRow>();
function loadOldRows(): void {
  if (!existsSync(REPORT)) return;
  let kind: Kind | undefined;
  for (const line of readFileSync(REPORT, 'utf8').split('\n')) {
    if (line.startsWith('## 선수')) kind = 'players';
    else if (line.startsWith('## 구단')) kind = 'clubs';
    else if (line.startsWith('## ')) kind = undefined;
    if (!kind || !line.startsWith('| ') || line.startsWith('| id ')) continue;
    const cells = line.slice(2, -2).split(/ (?<!\\)\| /).map((c) => c.replace(/\\\|/g, '|'));
    if (cells.length < 5) continue;
    // 옛 표(5칸) = id 이름 상태 제목 사유, 새 표(6칸) = id 리그 이름 상태 제목 사유
    const [id, league, name, status, title, reason] = (cells.length >= 6 ? cells : [cells[0], 'pl', ...cells.slice(1)]) as [string, string, string, Status, string, string];
    oldRows.set(`${kind}:${id}`, { id, name, status, title, reason, league });
  }
}

/** 이번에 돌리지 않은 종류는 기존 report.md 의 표를 그대로 둔다 */
function loadOldSection(kind: Kind): string | undefined {
  if (!existsSync(REPORT)) return undefined;
  const text = readFileSync(REPORT, 'utf8');
  const head = kind === 'players' ? '## 선수' : '## 구단';
  const i = text.indexOf(head);
  if (i < 0) return undefined;
  const j = text.indexOf('\n## ', i + head.length);
  return text.slice(i, j < 0 ? undefined : j).trimEnd();
}

function section(kind: Kind, rows: ReportRow[]): string {
  const head = kind === 'players' ? '## 선수' : '## 구단';
  const esc = (s: string) => s.replace(/\|/g, '\\|');
  return [head, '', '| id | 리그 | 이름 | 상태 | 문서 제목 | 사유 |', '|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.id} | ${r.league} | ${esc(r.name)} | ${r.status} | ${esc(r.title)} | ${esc(r.reason)} |`)].join('\n');
}

/** 리그별 수집 수 (매니페스트 기준) */
function leagueTable(manifest: Manifest): string {
  const lp = leaguePlayerJobs();
  const rows = allLeagueData().map((d) => {
    const clubs = d.teams.length;
    const gotC = d.teams.filter((t) => manifest.clubs[t.id]).length;
    const ids = d.id === 'pl' ? [...A_GRADE_PLAYERS, ...LEGENDS, ...FUTURE_STARS].map((p) => p.id) : lp.filter((j) => j.league === d.id).map((j) => j.id);
    const gotP = ids.filter((id) => manifest.players[id]).length;
    const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '-');
    return `| ${d.id} | ${gotC}/${clubs} (${pct(gotC, clubs)}) | ${gotP}/${ids.length} (${pct(gotP, ids.length)}) |`;
  });
  return ['| 리그 | 구단 로고 | 실명 선수 사진 |', '|---|---|---|', ...rows].join('\n');
}

function dirBytes(dir: string): number {
  let total = 0;
  const walk = (d: string): void => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else total += st.size;
    }
  };
  if (existsSync(dir)) walk(dir);
  return total;
}

function findRaw(kind: Kind, id: string): string | undefined {
  const dir = join(RAW, kind);
  if (!existsSync(dir)) return undefined;
  const stem = rawBase(kind, id).slice(dir.length + 1);
  const f = readdirSync(dir).find((n) => n.startsWith(`${stem}.`));
  return f ? join(dir, f) : undefined;
}

/** --reconvert: 내려받은 원본(RAW)에서 출력 이미지만 다시 만든다 (요청 없음). 선수는 배경 제거까지 */
function reconvert(): void {
  const manifest = loadManifest();
  const cut = cutoutReady();
  const pairs: [string, string][] = [];
  for (const kind of ['players', 'clubs'] as const) {
    for (const [id, e] of Object.entries(manifest[kind])) {
      const raw = findRaw(kind, id);
      if (!raw) { console.log(`[${kind}] ${id}: 원본 없음, 건너뜀`); continue; }
      const file = outFile(kind, id, e.league && kind === 'players' ? e.league : undefined);
      mkdirSync(dirname(join(OUT, file)), { recursive: true });
      squarePng(raw, join(OUT, file), kind === 'players' ? 'south' : 'center');
      if (e.file !== file && existsSync(join(OUT, e.file))) rmSync(join(OUT, e.file));
      e.file = file;
      if (kind === 'players') {
        delete e.nobg;
        if (cut) pairs.push([raw, join(OUT, file)]);
      }
    }
  }
  markCutout(manifest, cutoutBatch(pairs));
  saveManifest(manifest);
  console.log(`다시 만듦 · public/facepack ${dirBytes(OUT)} 바이트`);
}

function markCutout(manifest: Manifest, done: Set<string>): void {
  for (const e of Object.values(manifest.players)) if (done.has(join(OUT, e.file))) e.nobg = true;
}

/**
 * --cutout: 배경이 남은 선수 사진(nobg 표시 없음)만 배경 제거 (요청 없음). 원본(RAW)이 있으면 원본에서, 없으면 지금 PNG 에서
 */
function cutoutExisting(): void {
  if (!cutoutReady()) {
    console.error(`배경 제거 도구가 없다: ${PYTHON} -m pip install "rembg[cpu]" (또는 FACEPACK_PYTHON 으로 rembg 가 깔린 파이썬 지정)`);
    process.exit(1);
  }
  const manifest = loadManifest();
  const pairs: [string, string][] = [];
  for (const [id, e] of Object.entries(manifest.players)) {
    if (e.nobg) continue;
    const dest = join(OUT, e.file);
    if (!existsSync(dest)) continue;
    pairs.push([findRaw('players', id) ?? dest, dest]);
  }
  console.log(`배경 제거 ${pairs.length}장 (모델 ${CUTOUT_MODEL})`);
  const done = cutoutBatch(pairs);
  markCutout(manifest, done);
  saveManifest(manifest);
  console.log(`배경 제거 ${done.size}/${pairs.length} · public/facepack ${dirBytes(OUT)} 바이트`);
}

/** --license: 라이선스 메타데이터가 없는 항목만 채운다 */
async function fillLicenses(): Promise<void> {
  const manifest = loadManifest();
  let n = 0;
  for (const kind of ['players', 'clubs'] as const) {
    for (const [id, e] of Object.entries(manifest[kind])) {
      if (e.license) continue;
      const lic = await license(e.source).catch(() => undefined);
      if (!lic) { console.log(`[${kind}] ${id}: 메타데이터 없음`); continue; }
      Object.assign(e, lic);
      n++;
      if (n % 20 === 0) saveManifest(manifest);
    }
  }
  saveManifest(manifest);
  console.log(`라이선스 채움 ${n}건`);
}

async function main(): Promise<void> {
  if (args.includes('--reconvert')) return reconvert();
  if (args.includes('--cutout')) return cutoutExisting();
  // 연결 확인: 실패하면 출력물을 건드리지 않고 끝낸다
  try {
    const s = await summary('Lionel Messi');
    if (!s?.title) throw new Error('응답 형식이 이상함');
  } catch (e) {
    console.error(`위키백과 REST API 에 연결할 수 없다: ${(e as Error).message}`);
    console.error('네트워크/프록시(en.wikipedia.org, upload.wikimedia.org 허용)를 확인한 뒤 다시 실행하라. 출력물은 바꾸지 않았다.');
    process.exit(1);
  }
  if (args.includes('--license')) return fillLicenses();
  for (const d of [join(OUT, 'players'), join(OUT, 'clubs'), join(RAW, 'players'), join(RAW, 'clubs')]) mkdirSync(d, { recursive: true });

  const withCutout = cutoutReady();
  if (!withCutout) console.warn(`배경 제거 도구(${PYTHON} + rembg)가 없어 선수 사진은 배경 그대로 둔다. 나중에 --cutout 으로 처리할 수 있다`);
  const manifest = loadManifest();
  loadOldRows();
  const results: Partial<Record<Kind, ReportRow[]>> = {};
  for (const kind of ['players', 'clubs'] as const) {
    if (only && only !== kind) continue;
    const all = kind === 'players' ? [...playerJobs(), ...legendJobs(), ...leaguePlayerJobs()] : clubJobs();
    const jobs = leagueFilter ? all.filter((j) => leagueFilter.includes(j.league)) : all;
    const rows: ReportRow[] = [];
    for (const job of jobs) {
      const row = await runJob(job, manifest, withCutout);
      console.log(`[${kind}] ${job.id}: ${row.status} ${row.title} ${row.reason}`);
      rows.push(row);
      // 중간에 끊겨도 받은 것까지는 남도록 매번 매니페스트를 쓴다
      saveManifest(manifest);
    }
    // 이번에 거르지 않은 리그의 지난 행은 그대로 둔다
    if (leagueFilter) {
      const ran = new Set(rows.map((r) => r.id));
      const keep = [...oldRows.entries()].filter(([k, r]) => k.startsWith(`${kind}:`) && !ran.has(r.id)).map(([, r]) => r);
      rows.unshift(...keep);
    }
    results[kind] = rows;
  }
  if (pendingCutout.length) {
    console.log(`배경 제거 ${pendingCutout.length}장…`);
    markCutout(manifest, cutoutBatch(pendingCutout.map((p) => [p.raw, p.dest])));
  }
  saveManifest(manifest);

  const suspects = (results.players ?? []).filter((r) => r.status === '의심').map((r) => `${r.id} (${r.reason})`);
  const bytes = dirBytes(OUT);
  const cutouts = Object.values(manifest.players).filter((e) => e.nobg).length;
  const report = [
    '# 페이스팩 수집 보고',
    '',
    `생성: ${manifest.generated} · 출처: 위키백과 REST 요약 API · 이미지 ${SIZE}×${SIZE} PNG · 선수 배경 제거 ${cutouts}장 (rembg ${CUTOUT_MODEL})`,
    '',
    '## 요약',
    '',
    leagueTable(manifest),
    '',
    `- 의심: ${suspects.length ? suspects.join('; ') : '없음'}${results.players ? '' : ' (이번 실행에서 선수는 건너뜀)'}`,
    `- public/facepack 전체 ${bytes.toLocaleString('en-US')} 바이트`,
    '',
    results.players ? section('players', results.players) : (loadOldSection('players') ?? '## 선수\n\n(아직 수집 안 함)'),
    '',
    results.clubs ? section('clubs', results.clubs) : (loadOldSection('clubs') ?? '## 구단\n\n(아직 수집 안 함)'),
    '',
  ].join('\n');
  writeFileSync(REPORT, report);
  console.log(`\n${leagueTable(manifest)}\n의심 ${suspects.length}, ${bytes} 바이트`);
  console.log(`보고서: ${REPORT}`);
}

await main();
