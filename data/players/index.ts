import type { FieldPlayerData } from '../../src/types';
import { messi } from './messi';
import { stars } from './stars';
import { REAL_RETIRED_2018_2020 } from './legends';

/** 1단계 A등급 선수 전체. 2018-07 ~ 2020-12 은퇴자는 레전드 팩으로만 나온다 (C.47, pending 63) */
export const A_GRADE_PLAYERS: FieldPlayerData[] = [messi, ...stars].filter((p) => !(p.id in REAL_RETIRED_2018_2020));
