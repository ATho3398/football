// 선수 이름 3종 (부록 C.44a): 풀네임(nameKo), 짧은 이름, 별명. 경기 화면 라벨에만 쓴다 (다른 화면은 풀네임 그대로).
// 짧은 이름 = 유명한 이름(성·통칭)만. 실제 선수는 shortKo 표가 우선, 나머지는 마지막 단어(반·더 같은 접두어는 붙여서).
// 같은 짧은 이름이 세계에 2명 이상이면 그 선수들만 "영문 이름 첫 글자 + . + 짧은 이름"(A.산체스), 그래도 겹치면 첫 두 글자.
// 표시용 계산이라 세이브에 넣지 않는다. 사용자가 고친 짧은 이름·별명은 세이브 nameOverrides.

/** 사용자가 고친 이름 (세이브, 선수 id → 값) */
export interface NameOverride {
  nickname?: string;
  shortName?: string;
}
export type NameOverrides = Record<string, NameOverride>;

/** 성 앞에 붙는 접두어 (한국 통용 표기: van → 반, van der → 반 데르, de → 더 등). 짧은 이름에서는 성에 붙여 한 단어로 */
const PARTICLES = new Set(['반', '판', '데르', '더', '데', '디', '델', '다', '도스', '두', '드', '폰', '반데르']);

/** 자동 짧은 이름: 한 단어(네이마르·손흥민)는 그대로, 아니면 마지막 단어 + 앞 접두어 (버질 반 다이크 → 반다이크) */
export function autoShortKo(nameKo: string): string {
  const parts = nameKo.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return nameKo.trim();
  let i = parts.length - 1;
  while (i > 1 && PARTICLES.has(parts[i - 1]!)) i--;
  return parts.slice(i).join('');
}

export interface NameEntry {
  id: string;
  /** 영문 이름 (첫 글자 붙이기용). 없으면 한글 첫 글자 */
  name?: string;
  nameKo: string;
  /** 실제 선수 통칭 (표에서 직접 지정) */
  shortKo?: string;
}

function lead(e: NameEntry, n: number): string {
  const first = (e.name ?? '').trim().split(/\s+/)[0] ?? '';
  const src = /^[A-Za-zÀ-ÿ]/.test(first) ? first : e.nameKo.trim();
  const s = src.normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, n);
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * 모든 선수의 짧은 이름 (id → 이름). 같은 짧은 이름끼리만 첫 글자(그래도 겹치면 두 글자)를 붙인다.
 * 같은 id 가 여러 번 오면 처음 것을 쓴다
 */
export function shortNames(entries: Iterable<NameEntry>): Map<string, string> {
  const uniq = new Map<string, NameEntry>();
  for (const e of entries) if (!uniq.has(e.id)) uniq.set(e.id, e);
  const base = new Map<string, string>();
  const groups = new Map<string, NameEntry[]>();
  for (const e of uniq.values()) {
    const s = e.shortKo?.trim() || autoShortKo(e.nameKo);
    base.set(e.id, s);
    const g = groups.get(s);
    if (g) g.push(e);
    else groups.set(s, [e]);
  }
  const out = new Map(base);
  for (const [s, g] of groups) {
    if (g.length < 2) continue;
    // 첫 글자로 갈리는 선수는 A.산체스, 첫 글자까지 같은 선수만 두 글자 (Da.산체스)
    const t1 = new Map(g.map((e) => [e.id, `${lead(e, 1)}.${s}`]));
    const n1 = new Map<string, number>();
    for (const t of t1.values()) n1.set(t, (n1.get(t) ?? 0) + 1);
    for (const e of g) out.set(e.id, n1.get(t1.get(e.id)!) === 1 ? t1.get(e.id)! : `${lead(e, 2)}.${s}`);
  }
  return out;
}

/** 경기 화면 라벨: 별명 > 직접 고친 짧은 이름 > 자동 짧은 이름 */
export function labelName(id: string, auto: string | undefined, fallback: string, ov?: NameOverrides): string {
  const o = ov?.[id];
  return o?.nickname?.trim() || o?.shortName?.trim() || auto || autoShortKo(fallback);
}

/** 별명·짧은 이름 고치기 (빈 값이면 지운다). 둘 다 비면 항목을 없앤다 */
export function setNameOverride(ov: NameOverrides, id: string, field: keyof NameOverride, value: string): void {
  const v = value.trim().slice(0, 16);
  const cur = { ...(ov[id] ?? {}) };
  if (v) cur[field] = v;
  else delete cur[field];
  if (cur.nickname || cur.shortName) ov[id] = cur;
  else delete ov[id];
}
