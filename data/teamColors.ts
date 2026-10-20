import { allLeagueData } from './leagues';
import { aliasOf } from './clubAlias';

// 구단 색 2개 (부록 C.43): 자동 엠블럼(로고 이미지가 없을 때)에 쓴다. [주 색, 보조 색]. 표에 없는 구단은 이름 시드로 고른다
const BASE: Readonly<Record<string, readonly [string, string]>> = {
  mci: ['#6cabdd', '#1c2c5b'], liv: ['#c8102e', '#f6eb61'], che: ['#034694', '#ffffff'], tot: ['#132257', '#ffffff'],
  mun: ['#da291c', '#fbe122'], ars: ['#ef0107', '#ffffff'], eve: ['#003399', '#ffffff'], lei: ['#003090', '#fdbe11'],
  whu: ['#7a263a', '#1bb1e7'], wol: ['#fdb913', '#231f20'], cry: ['#1b458f', '#c4122e'], wat: ['#fbee23', '#ed2127'],
  bou: ['#da291c', '#000000'], new: ['#241f20', '#ffffff'], sou: ['#d71920', '#ffffff'], bur: ['#6c1d45', '#99d6ea'],
  bha: ['#0057b8', '#ffffff'], ful: ['#ffffff', '#000000'], car: ['#0070b5', '#d11524'], hud: ['#0e63ad', '#ffffff'],
  'x:bar': ['#a50044', '#004d98'], 'x:rma': ['#ffffff', '#febe10'], 'x:juv': ['#000000', '#ffffff'], 'x:bay': ['#dc052d', '#0066b2'],
  'x:psg': ['#004170', '#da291c'], 'x:atm': ['#cb3524', '#272e61'], 'x:bvb': ['#fde100', '#000000'], 'x:nap': ['#12a0d7', '#ffffff'],
  'x:int': ['#0068a8', '#000000'], 'x:rom': ['#8e1f2f', '#f0bc42'], 'x:mil': ['#fb090b', '#000000'], 'x:b04': ['#e32221', '#000000'],
  'x:sev': ['#ffffff', '#d4021d'], 'x:ol': ['#ffffff', '#14387f'], 'x:ajx': ['#d2122e', '#ffffff'], 'x:fcp': ['#00428c', '#ffffff'],
  'x:slb': ['#e83030', '#ffffff'], 'x:vil': ['#ffe667', '#005187'], 'x:zen': ['#0091d0', '#ffffff'], 'x:asm': ['#e51b22', '#ffffff'],
  'x:gal': ['#a90432', '#fdb912'], 'x:cel': ['#018749', '#ffffff'], 'x:psv': ['#ed1c24', '#ffffff'], 'x:avl': ['#670e36', '#95bfe5'],
  'x:wba': ['#122f67', '#ffffff'], 'x:lee': ['#ffffff', '#1d428a'], 'x:sto': ['#e03a3e', '#ffffff'], 'x:der': ['#ffffff', '#000000'],
  'x:nor': ['#fff200', '#00a650'], 'x:bri': ['#e21a23', '#ffffff'], 'x:not': ['#dd0000', '#ffffff'], 'x:mid': ['#e11b22', '#ffffff'],
  'x:ipw': ['#3a64a3', '#ffffff'], 'x:wig': ['#1d59af', '#ffffff'],
};

/** 표 + 리그 데이터 팀 (C.76c, 45b): 같은 클럽(x: 짝)은 표 색을 같이 쓰고, 표에 없으면 리그 데이터 색 */
export const TEAM_COLORS: Readonly<Record<string, readonly [string, string]>> = (() => {
  const out: Record<string, readonly [string, string]> = { ...BASE };
  for (const d of allLeagueData()) {
    for (const t of d.teams) {
      const a = aliasOf(t.id);
      const c = BASE[t.id] ?? (a ? BASE[a] : undefined) ?? (t.colors ? [t.colors.primary.toLowerCase(), t.colors.secondary.toLowerCase()] as const : undefined);
      if (c) {
        out[t.id] = c;
        if (a && !out[a]) out[a] = c;
      }
    }
  }
  return out;
})();
