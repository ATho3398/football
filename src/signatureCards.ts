// 역할 시그니처 카드 31장 (부록 E.6 표 "시그니처 카드" 열, F.0 3번, F.4). E3.7 은 데이터만 정의한다.
// 효과는 3단계(카드 시스템)에서 결정 순간(E4)에 붙인다. 모두 희귀, 그 역할일 때만 사용, 그 역할로 10경기 출전하면 해금.
// 판정은 E.8 기본 판정에 ±15%p 이내 보정이다 (E.6, F.0 2번)

export interface SignatureCard {
  id: string;
  /** 역할 id (src/engine/roles.ts) */
  role: string;
  name: string;
  kind: 'signature';
  rarity: 'rare';
  /** 해금: 그 역할로 출전한 경기 수 */
  unlockMatches: number;
  /** 조건 (장면) */
  condition: string;
  /** 효과 (문구, 3단계에서 효과 스키마로 옮긴다) */
  effect: string;
}

const UNLOCK = 10;
const c = (role: string, name: string, condition: string, effect: string): SignatureCard => ({
  id: `sig-${role}`, role, name, kind: 'signature', rarity: 'rare', unlockMatches: UNLOCK, condition, effect,
});

export const SIGNATURE_CARDS: readonly SignatureCard[] = [
  // 윙
  c('classicWinger', '바이라인 컷백', '측면 1대1 돌파 성공', '바로 컷백 선택지, 컷백 +8%p'),
  c('wingForward', '접고 감아차기', '측면에서 중앙으로 드리블한 뒤 슛 장면', '감아차기 +5%p'),
  c('crackWinger', '연속 제치기', '돌파 성공 직후', '두 번째 돌파 선택지, +5%p'),
  c('raumdeuter', '빈 공간 원터치', '박스 안 마크 이탈 상태로 수신', '원터치 슛, 압박 영향 × 0.6'),
  c('wideMid', '측면 복귀 태클', '뒤에서 따라붙는 태클 장면', '태클 +10%p'),
  // ST
  c('poacher', '원터치 마무리', '박스 안 수신', '즉시 슛, 침착성·결정력 비중 상향'),
  c('targetMan', '등지고 버티기', '등지고 받은 장면', '버티기 +10%p, 성공 후 레이오프 선택지'),
  c('falseNine', '내려와서 연계', '레이오프 장면', '레이오프 후 원투 침투 선택지, 리턴 +10%p'),
  c('advancedForward', '라인 깨기', '내가 받는 침투 패스', '오프사이드 × 0.6, GK 1대1이면 칩슛 선택지'),
  // CAM
  c('classic10', '기다렸다 킬패스', '1초 유지 후 침투 패스', '패스 레인 위험 × 0.6'),
  c('shadowStriker', '늦은 침투', '침투 장면', '마크 이탈 확률 증가, 수신 시 원터치 슛'),
  c('freeRole', '자유 이동 원투', '어느 위치든 패스 장면', '원투 선택지, 리턴 +8%p'),
  c('boxCrasher', '리바운드 반응', '세이브/블록 직후', '세컨드볼 우선, 리바운드 슛 +10%p'),
  c('enganche', '시간 멈추기', '압박 속 유지 장면', '유지 +10%p, 다음 패스 레인 위험 × 0.7'),
  // CM
  c('boxToBox', '박스에서 박스로', '내 진영 탈취 직후', '40 m 운반 선택지, 압박 영향 × 0.8'),
  c('deepPlaymaker', '대각선 전환', '반대 측면 롱패스 장면', '롱패스 +10%p, 상대 블록 재정렬 2초 지연'),
  c('mezzala', '하프스페이스 침투 슛', '박스 경계 하프스페이스 슛 장면', '슛 +8%p'),
  c('carrier', '라인 돌파 운반', '운반 중 수비 1명과 맞섬', '제치기 +8%p'),
  c('holdingCM', '커버 슬라이드', '동료 뒤 공간 커버 장면', '인터셉트 +8%p'),
  // CDM
  c('anchor', '라인 사이 차단', '상대 중앙 전진 패스', '인터셉트 +10%p'),
  c('ballWinner', '뒤에서 낚아채기', '등진 소유자에게 태클', '태클 +10%p, 파울 +5%p'),
  c('regista', '한 번에 전방으로', '자기 진영에서 최전방 침투자에게 패스', '롱 스루패스 +10%p'),
  c('halfBack', '3백 빌드업 기점', 'CB 사이에서 압박 받는 패스 장면', '압박 회피 패스 +8%p'),
  // 풀백
  c('attackingFullback', '오버래핑 크로스', '오버래핑 후 크로스 장면', '크로스 +8%p, 이후 내 측면 뒷공간 노출 증가'),
  c('defensiveFullback', '측면 봉쇄', '측면 1대1 수비', '상대 드리블 −10%p'),
  c('invertedFullback', '중앙으로 좁히기', '중앙 전진 패스 장면', '전진 패스 +8%p, 수신 압박 영향 × 0.8'),
  c('completeWingback', '끝까지 오버래핑', '최종 구역 진입', '컷백/크로스 선택, 그 장면 스태미나 소모 없음'),
  // CB
  c('stopper', '전진 차단', '등지고 받는 ST', '전진 인터셉트/태클 +10%p, 실패 시 뒷공간'),
  c('ballPlayingCB', '전진 패스 꽂기', '라인 사이 전진 패스 장면', '전진 패스 +10%p'),
  c('coverCB', '최후의 태클', '뒷공간 1대1', '태클 +10%p, 실패 시 PK/퇴장 위험'),
  c('libero', '라인 깨는 운반', '중원까지 운반', '압박 영향 × 0.8'),
];
