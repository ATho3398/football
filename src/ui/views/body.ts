// 선수 화면 "몸·태그" 탭 (부록 C.45 → C.58 디자인 134·135): 신체·약발 +1 구매·태그(TagChip)·전체 태그 시트·내 모습

import { bmiOf, FOOT_KO } from '../../body';
import { BALANCE } from '../../config/balance';
import type { PlayerState } from '../../types';
import { PLAY_DESC, TAGS, tagName } from '../../tags';
import { BottomSheet, Button, Crest, esc, SectionTitle, TagChip } from '../components';
import { panel } from './common';

/** 대표 태그 순서 (C.47): 커리어(스토리·플레이) → 장점 → 단점, 같은 종류는 최근 것 먼저 */
export function featuredTags<T extends { id: keyof typeof TAGS; season: number }>(tags: readonly T[]): T[] {
  const rank = (t: T) => (TAGS[t.id].kind === 'story' || TAGS[t.id].source === 'play' ? 0 : TAGS[t.id].kind === 'pro' ? 1 : 2);
  return [...tags].sort((a, b) => rank(a) - rank(b) || b.season - a.season);
}

export const FEATURED_TAGS = 4;

/** 태그 한 개 → TagChip 종류 (6-apply 0절 5): 스토리 · 플레이(경기 기록으로 얻음) · 생성(커스텀·랜덤 생성), 색 = 장점/단점 */
function chipOf(t: PlayerState['tags'][number], sm = false): string {
  const d = TAGS[t.id];
  const kind = d.kind === 'story' ? 'story' : t.play ? 'play' : 'gen';
  const desc = `${(t.play ? PLAY_DESC[t.id] : undefined) ?? d.desc}${d.hook ? ' · 효과는 다음 업데이트에서 열려요' : ''}`;
  return TagChip({ name: tagName(t), kind, polarity: d.kind === 'con' ? 'con' : 'pro', ...(!t.perm && d.removeDesc ? { release: `${d.removeDesc}이면 사라짐` } : {}), desc, ...(sm ? { size: 'sm' } : {}) });
}

/** 몸·태그 탭의 "내 모습" 줄 (디자인 134): 얼굴 · 경기 아이콘 · 이름표 */
export interface LookVM { faceKey: string; avatar: string; faceNote: string; pixel: string; pixelNote: string; label: string; labelNote: string; nameEditor: string | null }

/** 선수 화면 "몸·태그" 탭 (디자인 134, C.45 신체·양발·장단점 칸): 신체 5칸 · 약발 +1 · 태그 대표 4 + [전체 보기] · 유스 출신 · 내 모습 */
export function bodySection(p: PlayerState, canBuy: boolean, shirt: number, youthName = '', look: LookVM | null = null, youthTeam = ''): string {
  const b = p.body;
  const W = BALANCE.weakFoot;
  const wt = p.weakFootTrain;
  const stars = '●'.repeat(b.weakFoot) + '○'.repeat(5 - b.weakFoot);
  const sorted = featuredTags(p.tags);
  const more = sorted.length - FEATURED_TAGS;
  const buy = b.weakFoot < 5
    ? `<div class="panel pl-wf"><span class="grow"><b>약발 ${b.weakFoot} → ${b.weakFoot + 1}${b.weakFoot + 1 >= 5 ? ' (양발잡이)' : ''}</b><small class="${canBuy ? 'muted' : 'fail'}">${canBuy ? `보유 ${p.unspentPoints}P` : `✕ 포인트 부족 · 보유 ${p.unspentPoints}P / ${W.pointCost}P`}</small></span>${
      Button({ variant: canBuy ? 'primary' : 'secondary', size: 'sm', icon: canBuy ? 'plus' : 'lock', act: 'buy-weakfoot', disabled: !canBuy, children: `+1 · ${W.pointCost}P` })}</div>`
    : '';
  const tags = p.tags.length
    ? `<div class="pl-tags">${sorted.slice(0, FEATURED_TAGS).map((t) => chipOf(t)).join('')}${more > 0 ? `<button type="button" class="pl-more" data-act="tags-all" aria-label="태그 전체 보기">+${more}</button>` : ''}</div>
      <p class="small muted">대표 ${FEATURED_TAGS}개 = 커리어·플레이 → 장점 → 단점, 같은 종류는 최근 순.${more > 0 ? ' 나머지는 [전체 보기].' : ''}</p>`
    : '<p class="small muted">태그 없음 · 플레이하며 커리어·플레이 태그를 얻어요.</p>';
  const lookRows = look
    ? `${SectionTitle({ title: '내 모습', action: '얼굴 · 경기 아이콘 · 이름표' })}
    <div class="panel pl-look">
      <div class="pl-look__row">${look.avatar}<span class="grow"><b>얼굴 (페이스온)</b><small>${esc(look.faceNote)}</small></span>${Button({ variant: 'secondary', size: 'sm', act: 'faceon-open', data: { key: look.faceKey }, children: '바꾸기' })}</div>
      <div class="pl-look__row">${look.pixel}<span class="grow"><b>경기 아이콘</b><small>${esc(look.pixelNote)}</small></span>${Button({ variant: 'secondary', size: 'sm', act: 'px-open-me', children: '바꾸기' })}</div>
      <div class="pl-look__row"><span class="pl-label">${esc(look.label)}</span><span class="grow"><b>경기 화면 이름표</b><small>${esc(look.labelNote)}</small></span>${Button({ variant: 'secondary', size: 'sm', act: 'look-name', children: look.nameEditor ? '접기' : '편집' })}</div>
      ${look.nameEditor ?? ''}
    </div>`
    : '';
  return `${SectionTitle({ title: '신체 · 양발', action: '오른쪽 끝 = 약발' })}
    <div class="body-stats pl-stats">
      <div><small>등번호</small><b class="po-num">${shirt}</b></div>
      <div><small>키</small><b class="po-num">${b.height}<i>cm</i></b></div>
      <div><small>몸무게</small><b class="po-num">${b.weight}<i>kg</i></b><span>BMI ${bmiOf(b).toFixed(1)}</span></div>
      <div><small>주발</small><b>${FOOT_KO[b.foot]}</b></div>
      <div><small>약발</small><b class="po-num">${b.weakFoot}</b><span>${stars}${b.weakFoot >= 5 ? ' 양발' : ''}</span></div>
    </div>
    <p class="small muted">약발 쪽 슛·크로스·긴 패스 정확도 ×${BALANCE.body.weakFootMul[b.weakFoot - 1]} · 약발 훈련 게이지 <b class="ink">${Math.floor(wt?.gauge ?? 0)}/${W.trainingGauge}</b> · 이번 시즌 +${wt?.gained ?? 0}/${W.seasonMax}</p>
    ${buy}
    ${SectionTitle({ title: `태그 ${p.tags.length}`, ...(p.tags.length ? { action: '전체 보기 ›', onAction: { act: 'tags-all' } } : {}) })}
    ${tags}
    ${p.youth ? `<div class="panel pl-youth"><span class="grow small muted">유스 출신</span>${youthTeam ? `<button type="button" class="dt-link" data-act="team-open" data-v="${esc(youthTeam)}">${Crest({ name: youthName, team: youthTeam, size: 16 })} ${esc(youthName)}</button>` : `<b>${esc(youthName)}</b>`}<small class="muted">${p.youth.random ? '랜덤 · ' : ''}기록</small></div>` : ''}
    ${lookRows}`;
}

/** 태그 전체 시트 (디자인 135): 생성 · 커리어 · 플레이 · 스토리 묶음, 줄마다 효과·해제 조건 */
export function tagsSheet(p: PlayerState, name: string, youthName = ''): string {
  const season = (t: { season: number }) => `${t.season}-${String((t.season + 1) % 100).padStart(2, '0')}`;
  const row = (t: PlayerState['tags'][number]) => {
    const d = TAGS[t.id];
    const desc = (t.play ? PLAY_DESC[t.id] : undefined) ?? d.desc;
    const state = t.perm || !d.removeDesc ? '영구' : '해제까지 진행 중';
    return `<div class="pl-trow">${chipOf(t, true)}<span class="grow"><b class="small">${esc(desc)}</b><small class="muted">${!t.perm && d.removeDesc ? `해제 조건 · ${esc(d.removeDesc)}` : '영구'}${d.hook ? ' · 효과는 다음 업데이트에서 열려요' : ''} · ${season(t)}</small></span><span class="small ${state === '영구' ? 'muted' : 'hi'}">${state}</span></div>`;
  };
  const gen = p.tags.filter((t) => TAGS[t.id].kind !== 'story' && !t.play);
  const play = p.tags.filter((t) => TAGS[t.id].kind !== 'story' && t.play);
  const story = p.tags.filter((t) => TAGS[t.id].kind === 'story');
  const group = (title: string, note: string, rows: PlayerState['tags'], empty: string) =>
    `${SectionTitle({ title: `${title} ${rows.length}`, action: note })}<div class="panel pl-tgroup">${rows.length ? rows.map(row).join('') : `<p class="small muted">${esc(empty)}</p>`}</div>`;
  const career = p.youth
    ? `<div class="pl-trow">${TagChip({ name: '유스 출신', kind: 'career', size: 'sm' })}<span class="grow"><b class="small">${esc(youthName)} 유스 출신</b><small class="muted">기록 · 그 구단 소식에 남아요</small></span></div>`
    : '';
  const body = `${group('생성 태그', '커스텀·랜덤 생성 때 붙음', gen, '생성 태그 없음')}
    ${SectionTitle({ title: `커리어 태그 ${p.youth ? 1 : 0}`, action: '그 구단에서만' })}<div class="panel pl-tgroup">${career || '<p class="small muted">아직 없어요. 원클럽맨·영원한 <구단>은 한 구단에서 오래 뛰면 붙어요.</p>'}</div>
    ${group('플레이 태그', '경기 기록으로 얻어요', play, '아직 없어요. 노익장 = 32세 이후 시즌 평점 7.0+, 빅매치 체질 = 빅매치 평점 7.5+ 10경기.')}
    ${group('스토리 태그', '효과 없음 · 소식에만', story, '아직 없어요. 득점 기계·도움 장인 같은 기록이 쌓이면 붙어요.')}`;
  return BottomSheet({ eyebrow: `${name} · 태그 ${p.tags.length + (p.youth ? 1 : 0)}`, title: '전체 태그', subtitle: '생성 · 커리어 · 플레이 · 스토리 순', children: body, onClose: { act: 'tags-all' } });
}

