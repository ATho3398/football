// 팩 개봉 연출 고르기 (C.76o) — 이 한 줄만 바꾸면 대체 연출로 바뀐다. 방법은 docs/pack-animation.md
//   코드 모션 그래픽(기본):   { kind: 'motion' }
//   영상(희귀도별 webm/mp4):  { kind: 'video', ext: 'webm' }        → public/anim/pack/pack-<희귀도>.webm
//   PNG 시퀀스:               { kind: 'sequence', frames: 60, fps: 30 } → public/anim/pack/pack-<희귀도>/0001.png …
// 영상·시퀀스가 끝나면 카드 공개(뒤집기)는 코드 연출이 이어서 한다 (reveal: false 면 바로 결과). 파일을 못 읽으면 코드 연출로 돌아간다.

import type { PackAnimConfig } from './types';

export const PACK_ANIM: PackAnimConfig = { kind: 'motion' };
