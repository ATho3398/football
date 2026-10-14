// 결정적 난수 (E.3): hash(경기 시드, 틱, 에이전트, 용도)

function fmix(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** 용도 코드. 같은 틱, 같은 에이전트라도 용도가 다르면 독립 */
const PURPOSES = [
  'Decide', 'Pass', 'Intercept', 'Loose', 'Control', 'Offball', 'Run', 'Mark', 'Dribble', 'Tackle', 'Shot', 'Save',
  'Aerial', 'Foul', 'Card', 'Restart', 'Added', 'Cross', 'Sub', 'Advantage', 'Offside', 'Corner', 'Injury', 'Block',
  'Keeper', 'Misc', 'Rating', 'Header', 'Clear', 'Penalty', 'FreeKick',
] as const;
export const Purpose = Object.fromEntries(PURPOSES.map((p, i) => [p, i + 1])) as Record<(typeof PURPOSES)[number], number>;

/** [0, 1) */
export function rand(seed: number, tick: number, agent: number, purpose: number, k = 0): number {
  let h = fmix(seed ^ 0x9e3779b9);
  h = fmix(h ^ Math.imul(tick + 1, 0x27d4eb2d));
  h = fmix(h ^ Math.imul(agent + 3, 0x165667b1));
  h = fmix(h ^ Math.imul(purpose * 31 + k + 7, 0x7feb352d));
  return h / 4294967296;
}

/** 표준정규 */
export function randn(seed: number, tick: number, agent: number, purpose: number, k = 0): number {
  const u = Math.max(rand(seed, tick, agent, purpose, k * 2), 1e-12);
  const v = rand(seed, tick, agent, purpose, k * 2 + 1);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
