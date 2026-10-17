// 필드 플레이어 능력치 25개와 7개 묶음 (docs/design-notes.md 참고)

export const ATTRIBUTE_GROUPS = {
  ballHandling: ['dribbling', 'ballControl'],
  finishing: ['shooting', 'longShots', 'heading', 'offTheBall'],
  passing: ['shortPassing', 'longPassing', 'crossing', 'freeKick', 'vision'],
  defending: ['tackling', 'interception', 'marking', 'defensivePositioning'],
  pace: ['pace', 'acceleration', 'agility'],
  physical: ['stamina', 'strength', 'jumping'],
  mental: ['composure', 'bigMatch', 'leadership', 'workRate'],
} as const;

export type AttributeGroup = keyof typeof ATTRIBUTE_GROUPS;
export type FieldAttribute = (typeof ATTRIBUTE_GROUPS)[AttributeGroup][number];
export type FieldAttributes = Record<FieldAttribute, number>;

export const GROUP_NAMES = Object.keys(ATTRIBUTE_GROUPS) as AttributeGroup[];

export const FIELD_ATTRIBUTES = GROUP_NAMES.flatMap(
  (g) => ATTRIBUTE_GROUPS[g] as readonly FieldAttribute[],
);

// 능력치의 한글 이름 (bigMatch = 결정력, 큰 경기 집중력)
export const ATTRIBUTE_NAMES_KO: Record<FieldAttribute, string> = {
  dribbling: '드리블', ballControl: '볼 컨트롤(퍼스트 터치·키핑)',
  shooting: '슈팅', longShots: '중거리 슛', heading: '헤더', offTheBall: '공격 위치선정',
  shortPassing: '숏패스', longPassing: '롱패스', crossing: '크로스', freeKick: '프리킥', vision: '시야',
  tackling: '태클', interception: '인터셉트', marking: '마킹', defensivePositioning: '수비 포지셔닝',
  pace: '속도', acceleration: '가속', agility: '민첩성',
  stamina: '지구력', strength: '근력', jumping: '점프',
  composure: '침착성', bigMatch: '결정력', leadership: '리더십', workRate: '노력',
};

// 다른 묶음에도 약하게 걸치는 능력치 (가중치 0~1, 소속 묶음 운과 섞임)
export const SECONDARY_GROUPS: Partial<Record<FieldAttribute, { group: AttributeGroup; weight: number }>> = {
  heading: { group: 'physical', weight: 0.4 },
  bigMatch: { group: 'finishing', weight: 0.3 },
  composure: { group: 'finishing', weight: 0.3 },
  longShots: { group: 'passing', weight: 0.2 },
  freeKick: { group: 'finishing', weight: 0.3 },
  agility: { group: 'ballHandling', weight: 0.3 },
  vision: { group: 'mental', weight: 0.3 },
};

export function groupOf(attr: FieldAttribute): AttributeGroup {
  for (const g of GROUP_NAMES) {
    if ((ATTRIBUTE_GROUPS[g] as readonly string[]).includes(attr)) return g;
  }
  throw new Error(`unknown attribute: ${attr}`);
}

// 골키퍼 (NPC 전용, 25개와 별개)
export type GkType = 'sweeper' | 'classic';
export const GK_ATTRIBUTES = ['shotStopping', 'handling', 'commandOfArea', 'distribution'] as const;
export type GkAttribute = (typeof GK_ATTRIBUTES)[number];
export type GkAttributes = Record<GkAttribute, number>;

// ── 화면 1~20 표시 (C.44 pending 47 3번): 내부 0~99 그대로(엔진·밸런스 불변), 화면만 내부 ÷ 5 반올림, 최소 1 ──

/** 화면에 보이는 능력치 1~20 */
export const attrDisplay = (v: number): number => Math.max(1, Math.round(v / 5));

/** 표시 d 칸의 내부 시작 값 (d = 1 은 0부터) */
export const displayFloor = (d: number): number => (d <= 1 ? 0 : 5 * d - 2);

/** 다음 표시 칸(+1)이 시작하는 내부 값. 표시 20 이면 null */
export function nextDisplayAt(v: number): number | null {
  const d = attrDisplay(v);
  return d >= 20 ? null : 5 * d + 3;
}

/** 다음 칸까지 진행 (0~1, 이 칸 안에서 내부 값이 어디쯤인지) */
export function displayProgress(v: number): number {
  const next = nextDisplayAt(v);
  if (next === null) return 1;
  const lo = displayFloor(attrDisplay(v));
  return Math.max(0, Math.min(1, (v - lo) / (next - lo)));
}

/** 글 속 "능력치 이름 + 내부 숫자"를 1~20 표시로 (카드 조건 등, "볼 컨트롤 70" → "볼 컨트롤 14") */
export function attrTextToDisplay(s: string): string {
  const names = Object.values(ATTRIBUTE_NAMES_KO).map((n) => n.replace(/\(.*\)$/, '')).sort((a, b) => b.length - a.length);
  const re = new RegExp(`(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}) (\\d{2})(?!\\d| ?m|%)`, 'g');
  return s.replace(re, (_, n: string, v: string) => `${n} ${attrDisplay(+v)}`).replace(/시작 덱 (\d{2})/g, (_, v: string) => `시작 덱 ${attrDisplay(+v)}`);
}

/** 내부 변화량을 1~20 칸 단위로 ("+0.4", "−1", 한 칸 = 내부 5) */
export function displayDelta(n: number): string {
  const v = Math.round((n / 5) * 10) / 10;
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}`;
}
