// 팩 개봉 연출 고르기 (C.76o) — 이 한 줄만 바꾸면 대체 연출로 바뀐다. 방법은 docs/pack-animation.md
// 표지 한 장(가장 쉬움): public/anim/pack/cover.png (종류별 cover-<종류>.png) 만 넣으면 팩 그림이 그 이미지로 바뀐다 (설정 없음).
//   코드 모션 그래픽(기본):   { kind: 'motion' }
//   영상(희귀도별 webm/mp4):  { kind: 'video', ext: 'webm' }        → public/anim/pack/pack-<희귀도>.webm
//   PNG 시퀀스:               { kind: 'sequence', frames: 60, fps: 30 } → public/anim/pack/pack-<희귀도>/0001.png …
// 영상·시퀀스가 끝나면 카드 공개(뒤집기)는 코드 연출이 이어서 한다 (reveal: false 면 바로 결과). 파일을 못 읽으면 코드 연출로 돌아간다.

import type { PackAnimConfig } from './types';

export const PACK_ANIM: PackAnimConfig = { kind: 'motion' };

/**
 * 표지 이미지 (지금 cover.webp = 사용자 완성 패키지 800×1310, 투명 배경·로고·봉합선 포함). 이미지가 없으면 코드로 그린 기본 팩.
 * tear = 찢는 선 위치(위에서 비율, 위 톱니 봉합선 바로 아래) · aspect = 가로/세로 · cut = 전면 그림을 팩 실루엣으로 자르기
 * labels = 게임 이름·팩 이름 글자를 코드로 얹기 · glare = 포일 반사광 세기(0~1, 그림에 비닐 광이 있으면 약하게)
 */
export const PACK_COVER = { tear: 0.07, aspect: 800 / 1310, cut: false, labels: false, glare: 0.35 };
