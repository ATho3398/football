// 한국어 템플릿 (20.7 2번, 부록 C.63): {변수} 치환 + 조사 자동 처리. AI 호출 없이 변형 문장 중 하나를 고른다.
// 조사 토큰 {은/는} {이/가} {을/를} {과/와} {으로/로} {아/야} 는 바로 앞 글자의 받침으로 고른다 (숫자는 한국어 읽기 받침)

/** 받침: 0 = 없음, 8 = ㄹ (으로/로 판별), 그 밖 = 있음. 한글이 아니면 숫자 읽기 → 영문은 없음으로 본다 */
function batchim(ch: string): number {
  const c = ch.charCodeAt(0);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28;
  // 숫자 끝자리 읽기: 영(ㅇ) 일(ㄹ) 이 삼(ㅁ) 사 오 육(ㄱ) 칠(ㄹ) 팔(ㄹ) 구
  const DIGIT = [21, 8, 0, 16, 0, 0, 1, 8, 8, 0];
  if (ch >= '0' && ch <= '9') return DIGIT[+ch]!;
  return 0;
}

const PAIRS: Record<string, [string, string]> = {
  '은/는': ['은', '는'], '이/가': ['이', '가'], '을/를': ['을', '를'], '과/와': ['과', '와'], '으로/로': ['으로', '로'], '아/야': ['아', '야'], '이에요/예요': ['이에요', '예요'],
};

/** 앞 글자에 맞는 조사 */
export function josa(word: string, pair: string): string {
  const p = PAIRS[pair];
  if (!p) return pair;
  const last = [...word.replace(/[\s)\]"'.·]+$/, '')].pop() ?? '';
  const b = batchim(last);
  if (pair === '으로/로') return b === 0 || b === 8 ? p[1] : p[0];
  return b === 0 ? p[1] : p[0];
}

/** 템플릿 채우기: {name}{은/는} → "손흥민은". 모르는 변수는 그대로 둔다 */
export function fill(tpl: string, vars: Readonly<Record<string, string | number>>): string {
  let out = '';
  const re = /\{([^{}]+)\}/g;
  let at = 0;
  for (let m = re.exec(tpl); m; m = re.exec(tpl)) {
    out += tpl.slice(at, m.index);
    const key = m[1]!;
    if (key in PAIRS) out += josa(out, key);
    else if (key in vars) out += String(vars[key]);
    else out += m[0];
    at = m.index + m[0].length;
  }
  return out + tpl.slice(at);
}

/** 변형 문장 중 하나 (r = 0~1 난수) */
export function pickText(list: readonly string[], r: number): string {
  return list[Math.min(list.length - 1, Math.floor(r * list.length))] ?? '';
}
