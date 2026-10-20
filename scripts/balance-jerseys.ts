// 유니폼 교환 성공률 측정 (C.75w): 위상 티어 × 관계별로 1000번 요청을 굴려 성공률을 잰다.
// 상대 멘탈 = 새 게임 로스터의 실제 선수(도감 번호가 있는 선수) (침착성 + 리더십) / 2 분포에서 뽑고,
// 오늘 평점 = 티어별 평균(무명 6.4 → 레전더리 7.4) ± 0.7 정규분포. 실행: npx vite-node scripts/balance-jerseys.ts [-- --n 1000]
import { newGame, selectableRealPlayers } from '../src/game';
import { chanceFrom, type RelationKind } from '../src/jerseys';
import { DEX_NO } from '../src/photocards';
import { createRng, gaussian, hashSeed } from '../src/rng';
import { TIER_NAMES_KO } from '../src/growth';
import type { Tier } from '../src/types';

const argN = process.argv.indexOf('--n');
const N = argN > 0 ? Number(process.argv[argN + 1]) : 1000;
const g = newGame({ mode: 'real', playerId: selectableRealPlayers()[0]!.id, seed: 'jersey-measure', difficulty: 'normal', legends: true });
const mentals: (number | null)[] = [];
for (const r of Object.values(g.rosters)) for (const p of r.players) {
  if (DEX_NO.has(p.id)) mentals.push(p.attributes ? (p.attributes.composure + p.attributes.leadership) / 2 : null);
}
const TIERS: Tier[] = ['normal', 'special', 'topClass', 'worldClass', 'legendary'];
const RATING: Record<Tier, number> = { normal: 6.4, special: 6.6, topClass: 6.8, worldClass: 7.1, legendary: 7.4 };
const RELS: [string, RelationKind[]][] = [['관계 없음', []], ['더비', ['derby']], ['큰 더비', ['derby', 'bigDerby']], ['라이벌', ['rival']], ['같은 국적', ['sameNation']], ['옛 팀', ['formerClub']]];

console.log(`실제 선수 ${mentals.length}명 (멘탈 있는 선수 ${mentals.filter((x) => x !== null).length}), 요청 ${N}번씩`);
console.log(`| 위상 | ${RELS.map(([k]) => k).join(' | ')} |`);
console.log(`|---|${RELS.map(() => '---').join('|')}|`);
for (const tier of TIERS) {
  const cells = RELS.map(([name, rels]) => {
    const rng = createRng(hashSeed(`jersey:${tier}:${name}`));
    let ok = 0;
    for (let i = 0; i < N; i++) {
      const mental = mentals[Math.floor(rng() * mentals.length)]!;
      const rating = Math.min(10, Math.max(3, RATING[tier] + gaussian(rng) * 0.7));
      if (rng() < chanceFrom({ tier, mental, rating, relations: rels }).p) ok++;
    }
    return `${((ok / N) * 100).toFixed(1)}%`;
  });
  console.log(`| ${TIER_NAMES_KO[tier]} | ${cells.join(' | ')} |`);
}
