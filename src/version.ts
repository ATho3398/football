// 버전 표시 (21.5.1): 지금 플레이 중인 버전과 세이브를 시작한 버전

import { BALANCE_VERSION } from './config/balance';
import { ENGINE_VERSION } from './engine/config';

/** 패치 이름 = 부록 C의 최신 소절 번호. 패치마다 갱신한다 (CLAUDE.md) */
export const PATCH_LABEL = 'C.75z';
/** 단계 번호 = 기획서 17.2 표의 단계 (C.45 사용자 지시). PATCH_LABEL 과 같이 패치마다 갱신한다 */
export const STAGE_LABEL = '45단계';

// 빌드 시점에 vite.config.ts 의 define 으로 채운다. 없으면(테스트 외 실행 등) dev
declare const __BUILD_COMMIT__: string | undefined;
declare const __BUILD_DATE__: string | undefined;

export const BUILD_COMMIT: string = typeof __BUILD_COMMIT__ === 'string' ? __BUILD_COMMIT__ : 'dev';
export const BUILD_DATE: string = typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : 'dev';

/** 예: "34단계 · 버전 C.45 · 엔진 20 · 밸런스 32 · 2026-10-17 배포 (커밋 abc1234)" */
export function versionLabel(
  b: { patch?: string; stage?: string; commit?: string; date?: string } = {},
): string {
  const patch = b.patch ?? PATCH_LABEL;
  const stage = b.stage ?? STAGE_LABEL;
  const commit = b.commit ?? BUILD_COMMIT;
  const date = b.date ?? BUILD_DATE;
  const built = date === 'dev' ? 'dev 빌드' : `${date} 배포`;
  return `${stage} · 버전 ${patch} · 엔진 ${ENGINE_VERSION} · 밸런스 ${BALANCE_VERSION} · ${built} (커밋 ${commit})`;
}

/** 세이브를 시작한 패치가 지금과 다르면 알림 문구. 같으면 null. startPatch 가 null 이면 기록 이전 세이브 */
export function saveStartNotice(startPatch: string | null, current: string = PATCH_LABEL): string | null {
  if (startPatch === null) return '이전 버전에서 시작한 세이브예요.';
  if (startPatch === current) return null;
  return `이 세이브는 ${startPatch}에서 시작했어요. 이전 버전으로 진행된 경기 기록이 섞여 있어요.`;
}
