// 서비스 워커 캐시 이름 앞머리 (swBuild·register 공용, C.80x: 브라우저 코드가 node 모듈을 끌어오지 않게 따로)
export const CACHE_PREFIX = 'po-';
/** 새 배포 확인 파일 (C.80x): 서비스 워커가 캐시하지 않는다 */
export const VERSION_FILE = 'version.json';
