// 도트 선수 아이콘 화면 쪽 (부록 C.45): 게임 상태에서 선수 인물·경기 유니폼을 골라 레이어 이미지 주소로 바꾼다.
// 경기 화면(캐릭터 보기)과 설정 → 경기 아이콘 미리보기가 같이 쓴다. 겉모습만(경기 결과·시드와 무관)

import { A_GRADE_PLAYERS } from '../../data/players';
import { REAL_PIXEL_LOOK } from '../../data/players/pixelLook';
import { PIXEL_PEOPLE } from '../../data/pixelPack';
import { realAppearance, type Appearance } from '../appearance';
import { SKIN_OF } from './customVM';
import type { GameState } from '../game';
import { autoPerson, kitFor, matchKits, personOf, type MatchKits, type PeopleTable, type PixelPerson } from '../pixel';
import { clubOf, pixelDirect, pixelLayerUrls, pixelManifestLooks, pixelPeople, pixelSrc } from './faces';
import { myFace } from './viewModels';

export function peopleTable(): PeopleTable {
  return pixelPeople() ?? PIXEL_PEOPLE;
}

/** 실제 선수 표 + 매니페스트 version 2 `players` (매니페스트가 먼저) */
function realTable(): Record<string, PixelPerson> {
  return { ...REAL_PIXEL_LOOK, ...pixelManifestLooks() };
}

interface Who { id: string; appearance?: Appearance; hair?: string; skin?: string; teamId?: string }

let index: { of: unknown; npcs: unknown; map: Map<string, Who> } | null = null;

/** 선수 id → 외모군·소속 (로스터 → NPC → 실제 선수 데이터). isMe 면 내 선수 (리플레이의 내 id 는 엔진 id) */
export function whoOf(g: GameState, id: string, isMe = false): Who {
  const me = myFace(g);
  // 내 가상 선수 (C.73c): 피부 = 고른 인종 피부 (기본 사진이 있는 선수)
  if (isMe || id === me.id) return { id: me.id, ...(me.appearance ? { appearance: me.appearance } : {}), ...(g.player.pixelHair ? { hair: g.player.pixelHair } : {}),
    ...(me.photo && me.appearance ? { skin: SKIN_OF[me.appearance] } : {}), teamId: g.player.teamId };
  if (index?.of !== g.rosters || index.npcs !== g.npcs) {
    const map = new Map<string, Who>();
    for (const [teamId, r] of Object.entries(g.rosters ?? {})) for (const p of r.players) map.set(p.id, { id: p.id, appearance: p.appearance, teamId });
    for (const n of g.npcs) if (!map.has(n.id)) map.set(n.id, { id: n.id, appearance: realAppearance(n.id, ''), ...(clubOf(n.club)?.id ? { teamId: clubOf(n.club)!.id } : {}) });
    index = { of: g.rosters, npcs: g.npcs, map };
  }
  const hit = index.map.get(id);
  if (hit) return hit;
  const d = A_GRADE_PLAYERS.find((p) => p.id === id);
  return d ? { id, appearance: realAppearance(id, d.nationality), ...(clubOf(d.club)?.id ? { teamId: clubOf(d.club)!.id } : {}) } : { id };
}

/** 지금 인물 (사용자 지정 > 실제 선수 표 > 자동) */
export function playerPerson(g: GameState, id: string, isMe = false): PixelPerson {
  const w = whoOf(g, id, isMe);
  return personOf(w.id, w.appearance, { overrides: g.pixelOverrides, real: realTable(), hair: w.hair, skin: w.skin, people: peopleTable() });
}

/** 되돌리면 이렇게 (사용자 지정 없이) */
export function playerAutoPerson(g: GameState, id: string, isMe = false): PixelPerson {
  const w = whoOf(g, id, isMe);
  return autoPerson(w.id, w.appearance, { real: realTable(), hair: w.hair, skin: w.skin, people: peopleTable() });
}

/** 리플레이 팀 이름(한글 이름 등) 또는 id → 팀 id */
export function teamIdOf(nameOrId: string): string {
  return clubOf(nameOrId)?.id ?? nameOrId;
}

let kitCache: { key: string; kits: MatchKits } | null = null;

/** 경기 유니폼 (홈·원정·GK). 사용자 지정이 바뀌면 다시 계산 */
export function matchKitsOf(g: GameState | null, teams: readonly [string, string]): MatchKits {
  const key = `${teams[0]}|${teams[1]}|${JSON.stringify(g?.pixelOverrides?.kits ?? {})}`;
  if (kitCache?.key !== key) kitCache = { key, kits: matchKits(teamIdOf(teams[0]), teamIdOf(teams[1]), g?.pixelOverrides) };
  return kitCache.kits;
}

/**
 * 선수 아이콘 이미지 (아래 → 위로 겹칠 주소들). 사용자 지정 인물 > version 1 직접 지정 파일 > 레이어(인물 + 유니폼) > version 1 외모군 목록.
 * 없으면 undefined (등번호)
 */
export function playerIcon(g: GameState, id: string, isMe: boolean, kit: string): string[] | undefined {
  const w = whoOf(g, id, isMe);
  if (!g.pixelOverrides?.players?.[w.id]) {
    const direct = pixelDirect(w.id);
    if (direct) return [direct];
  }
  const layers = pixelLayerUrls(playerPerson(g, id, isMe), kit);
  if (layers) return layers;
  const old = pixelSrc({ id: w.id, ...(w.appearance ? { appearance: w.appearance } : {}) });
  return old ? [old] : undefined;
}

/** 그 선수 소속 구단의 홈 유니폼 (설정 미리보기) */
export function homeKitOf(g: GameState, id: string, isMe = false): string {
  const t = whoOf(g, id, isMe).teamId;
  return kitFor(t ?? '', g.pixelOverrides).home;
}

/** 미리보기 HTML: 16px 레이어를 정수 배로 겹쳐 보인다 (보간 끔). 이미지가 없으면 빈 칸 */
export function pixelIconHtml(layers: string[] | undefined, scale = 3, label = ''): string {
  const s = 16 * scale;
  const esc = (x: string) => x.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const imgs = (layers ?? []).map((u) => `<img src="${esc(u)}" alt="" width="${s}" height="${s}" loading="lazy">`).join('');
  return `<span class="px-icon${layers ? '' : ' is-empty'}" style="width:${s}px;height:${s}px"${label ? ` aria-label="${esc(label)}" role="img"` : ' aria-hidden="true"'}>${imgs}</span>`;
}
