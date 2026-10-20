// 포토카드 도감 (C.75t, pending 130): 완성률, 정렬(8가지 · 오름/내림), 카드 격자. 안 모은 번호 = 실루엣 + "No.042 ???".
// 테두리 = OVR 등급 (카드 희귀도 색 po-rarity--*). 카드를 누르면 뒷면 "처음 만났을 때"

import { Avatar, Button, esc, HeroPanel, Icon, SectionTitle, Tabs } from '../components';
import { PHOTO_SORTS, PHOTO_SORT_KO } from '../../photocards';
import type { PhotoCellVM, PhotoDexVM } from '../photoVM';

const GRADE_KO = { common: '일반', rare: '희귀', epic: '에픽', legend: '전설' } as const;

const SILHOUETTE = `<svg class="pc-sil" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="22" r="12"/><path d="M10 62c2-16 11-24 22-24s20 8 22 24z"/></svg>`;

function cellHtml(c: PhotoCellVM, flipped: string | null): string {
  const k = c.card;
  if (!k) return `<div class="pc-card is-empty" aria-label="${esc(c.no)} 아직 못 모음">${SILHOUETTE}<span class="pc-no po-num">${esc(c.no)}</span><b class="pc-name">???</b></div>`;
  const label = `${c.no} ${k.name}, ${GRADE_KO[k.grade]} 카드`;
  if (flipped === k.id) {
    return `<button type="button" class="pc-card is-back po-rarity--${k.grade}" data-act="pc-flip" data-v="${esc(k.id)}" aria-label="${esc(label)} 뒷면, 누르면 앞면">
      <span class="pc-no po-num">${esc(c.no)}</span><b class="pc-name">${esc(k.name)}</b>
      <small class="pc-back__k">처음 만났을 때</small>
      <span class="pc-back__v">${esc(k.back.date)}</span><span class="pc-back__v">${esc(k.back.match)}</span><span class="pc-back__v">${esc(k.back.first)}</span>
      ${k.jersey ? '<small class="pc-back__k">유니폼 교환</small>' : ''}</button>`;
  }
  return `<button type="button" class="pc-card po-rarity--${k.grade}${k.retired ? ' is-retired' : ''}" data-act="pc-flip" data-v="${esc(k.id)}" aria-label="${esc(label)}, 누르면 뒷면">
    <span class="pc-top"><span class="pc-no po-num">${esc(c.no)}</span><b class="pc-ovr po-num">${k.ovr}</b></span>
    <span class="pc-face">${Avatar({ size: 56, face: k.face, name: k.name, shape: 'square' })}${k.jersey ? `<span class="pc-jersey" title="유니폼">${Icon({ name: 'player', size: 12 })}</span>` : ''}${k.retired ? '<span class="pc-ret">은퇴</span>' : ''}</span>
    <b class="pc-name">${esc(k.name)}</b>
    <small class="pc-meta">${esc(k.pos)}${k.shirt ? ` · ${k.shirt}번` : ''}${k.age ? ` · ${k.age}세` : ''}</small>
    <small class="pc-meta">${esc(k.team)}</small>
    <small class="pc-meta muted">${esc(k.league)}${k.key ? ` · ${esc(k.key)}` : ''}</small></button>`;
}

export function photoDexView(vm: PhotoDexVM): string {
  const hero = HeroPanel({
    title: '포토카드 도감', back: { act: 'go', data: { to: 'home' } }, eyebrow: `완성률 · 전체 ${vm.total}장`, value: vm.have, pad: false, progress: false, compact: true,
    chips: [`${vm.have} / ${vm.total} · ${vm.pct}%`, { label: '같은 경기에 뛴 실제 선수', soft: true }],
  });
  const bar = `<div class="pc-meter" role="progressbar" aria-valuemin="0" aria-valuemax="${vm.total}" aria-valuenow="${vm.have}" aria-label="도감 완성률"><i style="width:${vm.total ? (vm.have / vm.total) * 100 : 0}%"></i></div>`;
  const sorts = Tabs({ items: PHOTO_SORTS.map((id) => ({ id, label: PHOTO_SORT_KO[id] })), value: vm.sort, act: 'pc-sort', scroll: true, label: '정렬' });
  const dir = Button({ variant: 'ghost', size: 'sm', icon: vm.desc ? 'chevron-down' : 'chevron-up', act: 'pc-dir', children: vm.desc ? '내림차순' : '오름차순' });
  const note = vm.sort === 'no'
    ? `<p class="small muted">안 모은 번호는 실루엣이에요. 내 선수와 같은 경기에 뛴 실제 선수(레전드 포함)를 경기가 끝날 때 자동으로 모아요.</p>`
    : vm.have ? '' : '<p class="small muted">아직 모은 카드가 없어요. 경기에 나가 실제 선수와 같이 뛰어 보세요.</p>';
  const grids = vm.sections.map((s) => `${s.title ? `<div class="pc-divider"><span>${esc(s.title)}</span><small class="po-num">${s.cells.length}</small></div>` : ''}<div class="pc-grid">${s.cells.map((c) => cellHtml(c, vm.flipped)).join('')}</div>`).join('');
  return `${hero}<div class="body pc-body">${bar}${SectionTitle({ title: '정렬', action: '카드를 누르면 뒷면' })}<div class="pc-sortrow">${sorts}${dir}</div>${note}${grids}</div>`;
}
