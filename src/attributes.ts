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
  dribbling: '드리블', ballControl: '볼 컨트롤',
  shooting: '슈팅', longShots: '중거리 슛', heading: '헤더', offTheBall: '공격 위치선정',
  shortPassing: '숏패스', longPassing: '롱패스', crossing: '크로스', freeKick: '프리킥', vision: '시야',
  tackling: '태클', interception: '인터셉트', marking: '마킹', defensivePositioning: '수비 포지셔닝',
  pace: '속도', acceleration: '가속', agility: '민첩성',
  stamina: '체력', strength: '근력', jumping: '점프',
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
