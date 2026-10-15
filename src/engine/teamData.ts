// 실제 팀 전술 데이터 (23번 팀 데이터, E.18 A5, E.19). 2018-19 시즌 기준

import type { Formation } from '../formations';
import type { Tendency } from './types';

/** 전술 성향과 포메이션 (E.19 AI 팀 전술, 2018-19 감독 기준) */
export const TEAM_TACTICS: Record<string, { tendency: Tendency; formation: Formation }> = {
  mci: { tendency: 'tikitaka', formation: '4-3-3' },
  che: { tendency: 'tikitaka', formation: '4-3-3' },
  ful: { tendency: 'tikitaka', formation: '4-2-3-1' },
  liv: { tendency: 'gegenpress', formation: '4-3-3' },
  tot: { tendency: 'gegenpress', formation: '4-2-3-1' },
  hud: { tendency: 'gegenpress', formation: '4-2-3-1' },
  mun: { tendency: 'counter', formation: '4-3-3' },
  lei: { tendency: 'counter', formation: '4-2-3-1' },
  wol: { tendency: 'counter', formation: '3-5-2' },
  cry: { tendency: 'counter', formation: '4-4-2' },
  ars: { tendency: 'balanced', formation: '4-2-3-1' },
  eve: { tendency: 'balanced', formation: '4-2-3-1' },
  whu: { tendency: 'balanced', formation: '4-2-3-1' },
  bou: { tendency: 'balanced', formation: '4-4-2' },
  sou: { tendency: 'balanced', formation: '4-2-3-1' },
  wat: { tendency: 'direct', formation: '4-4-2' },
  bur: { tendency: 'direct', formation: '4-4-2' },
  car: { tendency: 'direct', formation: '4-4-2' },
  new: { tendency: 'block', formation: '5-3-2' },
  bha: { tendency: 'block', formation: '4-4-2' },
};

/** 빌드업 성향 style: 0 직선형 ~ 1 점유형 (E.18 A5, 2018-19 점유율 순위 참고) */
export const TEAM_STYLE: Record<string, number> = {
  mci: 0.9, che: 0.85, ars: 0.75, liv: 0.7, tot: 0.7, ful: 0.6, mun: 0.55,
  eve: 0.5, whu: 0.5, bou: 0.5, lei: 0.45, wol: 0.45, sou: 0.45, bha: 0.45,
  cry: 0.35, wat: 0.35, hud: 0.35, new: 0.25, bur: 0.15, car: 0.15,
};
