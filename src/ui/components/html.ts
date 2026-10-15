// 컴포넌트 공통 도우미: 문자열 템플릿용 이스케이프, 클래스 합치기, 동작 속성 (이벤트는 main.ts 가 data-act 로 위임 처리)

export const esc = (s: string | number): string =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function cx(...xs: (string | false | null | undefined | 0)[]): string {
  return xs.filter(Boolean).join(' ');
}

/** 동작: React 의 onClick 대신 data-act 와 data-* 속성 (main.ts 이벤트 위임) */
export interface Action {
  act?: string;
  data?: Record<string, string | number>;
}

export function actAttrs(a: Action): string {
  if (!a.act) return '';
  const extra = Object.entries(a.data ?? {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  return ` data-act="${esc(a.act)}"${extra}`;
}

/** 평점·변화 표기 (bundle.js fmt1, signed): 소수 첫째 자리, 변화는 유니코드 마이너스 */
export const fmt1 = (n: number): string => (Math.round(n * 10) / 10).toFixed(1);

export function signed(n: number, digits?: number): string {
  const d = digits ?? (Math.abs(n * 10 - Math.round(n * 10)) > 1e-6 ? 2 : 1);
  const s = d === 0 ? String(Math.round(Math.abs(n))) : Math.abs(n).toFixed(d);
  return (n > 0 ? '+' : n < 0 ? '−' : '±') + s;
}
