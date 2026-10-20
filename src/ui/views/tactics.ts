// 전술 화면 (I.16, 디자인 26~29, E.19, 부록 C.32): 기본은 성향 6종만 보이고, 포메이션·내 위치·슬롯 역할·세부 전술은 "자세히" 안에 접는다 (21.3).
// 경기 전 설정과 기본 전술 저장만 (하프타임·중단 때 변경은 E5). 상대 정보 힌트·전술 세트 3개(I.17 7·8번)는 아직 없다

import { BottomSheet, Button, cx, FormationPitch, HeroPanel, Icon, OptionRow, Pitch, SectionTitle, TacticChip, Tabs, esc } from '../components';
import type { HalftimeVM, TacticsVM } from '../viewModels';
import { actionRow, panel, roJosa } from './common';

export function tacticsView(vm: TacticsVM): string {
  const hero = HeroPanel({
    title: '전술', back: { act: 'tac-back' }, right: vm.opp ? `${vm.opp.name}전` : '', eyebrow: '팀 전술 · 내가 정해요', chips: vm.chips,
  });
  const opp = vm.opp
    ? `${SectionTitle({ title: '상대', action: `다음 경기 · ${vm.opp.home ? '홈' : '원정'}` })}
      ${panel(`<div class="kv"><span>상대 전술</span>${vm.opp.tactic ? TacticChip({ size: 'sm', team: vm.opp.name, away: true, ...vm.opp.tactic }) : `<b>${esc(vm.opp.name)}</b>`}</div>`)}`
    : '';
  const tend = `${SectionTitle({ title: '① 전술 성향', action: vm.opp?.tactic ? '적합도 = 우리 선발 능력치' : '' })}
    <div class="tac-grid">${vm.tendencies.map((t) => TacticChip({ tactic: t.style, fit: t.fit, selected: t.on, act: 'tac-tend', data: { v: t.id } })).join('')}</div>
    <p class="small"><b>${esc(vm.tendencyName)}</b> · ${esc(vm.tendencyDesc)}</p>
    <p class="small muted">성향을 고르면 세부 전술과 역할의 기본값이 채워지고, "자세히"에서 그 위에 바꿀 수 있어요.</p>`;

  const toggle = Button({
    variant: 'secondary', block: true, icon: vm.open ? 'chevron-down' : 'chevron-right', act: 'tac-detail',
    children: vm.open ? '자세히 접기' : `자세히 · 포메이션 ${vm.formationName}, 내 위치 ${vm.me.pos}, 세부 전술`,
  });

  const detail = vm.open
    ? `${SectionTitle({ title: '② 포메이션과 역할', action: vm.edit ? '선수를 끌어 옮겨요' : vm.pickMe ? '내 자리를 눌러요' : '슬롯을 탭해 역할 변경' })}
      ${Tabs({ variant: 'segment', items: vm.formations, value: vm.formation, act: 'tac-form', label: '포메이션' })}
      ${vm.custom ? panel(`<div class="kv tac-me"><span><b>${esc(vm.formationName)}</b>
          <span class="small muted">${vm.edit
            ? '선수를 끌어다 놓거나, 선수를 누른 뒤 놓을 곳을 눌러요. 가까운 자리에 붙고 그 자리 포지션(FW·W·CM 등)이 정해져요. 수비 3명 이상, 중원·공격 1명 이상, 공격 줄은 최대 4명(임시 규칙: 공격수를 몰아넣는 대형이 지나치게 강해서 엔진을 고칠 때까지 막아 둬요).'
            : '대형 편집으로 선수 자리를 바꿀 수 있어요. 역할은 자리의 포지션에 맞춰 골라요.'}
            실험 기능: 지금은 공격수를 아주 많이 둔 대형이 실제보다 유리하게 나와요(엔진 수정 예정).</span></span>
          ${Button({ size: 'sm', variant: vm.edit ? 'primary' : 'secondary', icon: vm.edit ? 'check' : 'player', act: 'tac-edit', children: vm.edit ? '편집 끝' : '대형 편집' })}</div>`) : ''}
      ${FormationPitch({ slots: vm.slots, edit: vm.edit, label: `${vm.formationName} 포메이션, 내 위치 ${vm.me.pos}` })}
      ${panel(`<div class="kv tac-me"><span><b>내 위치 <span class="mine">${esc(vm.me.pos)} · ${esc(vm.me.role)}</span></b>
          <span class="small muted">원 위 숫자는 그 슬롯에서의 내 OVR이에요.${vm.me.off ? ` 주 포지션(${esc(vm.me.mainPos)} ${vm.me.mainOvr}) 밖이라 ${vm.me.ovr}로 뛰어요.` : ' 주 포지션 밖이면 낮아져요.'}</span></span>
          ${Button({ size: 'sm', variant: vm.pickMe ? 'primary' : 'secondary', icon: 'player', act: 'tac-pick-me', children: vm.pickMe ? '취소' : '내 위치 지정' })}</div>`)}
      ${SectionTitle({ title: '③ 세부 전술', action: `${vm.tendencyName} 기본값에서 ${vm.changed.details}개 바꿈` })}
      ${vm.details.map((d) => `<div class="tac-detail">
          <div class="kv"><b class="small">${esc(d.label)}</b><span class="small faint">${d.base ? `${esc(vm.tendencyName)} 기본값` : '바꿈'}</span></div>
          ${Tabs({ variant: 'segment', fill: true, items: d.items, value: d.value, act: 'tac-level', data: { k: d.key }, label: d.label })}
        </div>`).join('')}`
    : '';

  const foot = actionRow(
    Button({ variant: 'secondary', size: 'lg', block: true, icon: 'restore', act: 'tac-reset', children: '기본값으로' }),
    Button({ size: 'lg', block: true, icon: 'check', act: 'tac-save', disabled: !vm.dirty, children: vm.dirty ? '저장' : '저장됨' }),
  );

  return `${hero}
    <div class="body">
      ${opp}
      ${tend}
      ${toggle}
      ${detail}
      <p class="small muted">저장한 전술은 바꾸기 전까지 매 경기 써요. 선발 11명은 OVR 순으로 자동, 나는 고른 자리에 들어가요.</p>
      ${foot}
    </div>${vm.sheet ? roleSheet(vm.sheet) : ''}`;
}

function roleSheet(s: NonNullable<TacticsVM['sheet']>): string {
  const rows = [
    OptionRow({
      act: 'tac-role-pick', data: { v: '' }, radio: true, selected: s.auto.on, title: '자동 (성향 추천)', desc: `지금 성향과 선수 능력치로 골라요 → ${s.auto.name}`,
    }),
    ...s.options.map((o) => OptionRow({
      act: 'tac-role-pick', data: { v: o.id }, radio: true, selected: o.on, title: o.name, desc: o.desc, fit: o.fit, ...(o.rec ? { tag: '추천' } : {}),
    })),
  ].join('');
  const pickName = s.pick ? s.options.find((o) => o.id === s.pick)?.name ?? s.pick : '자동';
  const ro = roJosa(pickName);
  return BottomSheet({
    eyebrow: `${s.pos} 슬롯 · ${s.name}${s.me ? ' (나)' : ''}`, title: '역할 고르기',
    subtitle: '그 자리에서 어떻게 움직이고 판단할지 정해요. 적합도는 이 선수 능력치 기준이에요.',
    onClose: { act: 'tac-sheet-close' },
    children: rows,
    footer: actionRow(
      Button({ variant: 'secondary', size: 'lg', block: true, act: 'tac-sheet-close', children: '취소' }),
      Button({ size: 'lg', block: true, act: 'tac-role-ok', children: `${pickName}${ro} 정하기` }),
    ),
  });
}

/**
 * 하프타임 전술 변경 (C.75k, E.19): 직접 모드 경기의 전반이 끝나면 멈추고 이 시트를 띄운다. 전술 세트 3개 · 성향 6종 · 세부 전술 4개.
 * 역할·포메이션 변경은 다음 단계. [변경 없이 후반]은 경기 전 전술 그대로 (자동 경기와 같은 결과)
 * 237 (C.76f): 위 띠(하프타임 · 점수) + 흐린 정지 피치 + 시트. 폰 = 세트 3칸 가로 · 성향 6칸 한 줄 · 세부 2×2 로 한 화면, PC = 피치 옆 오른쪽 패널
 */
export function halftimeView(vm: HalftimeVM): string {
  const team = (i: 0 | 1) => `<span class="${i === vm.side ? 'is-me' : 'is-opp'}">${esc(vm.teams[i])}</span>`;
  const top = `<div class="ht-top">
      <div class="ht-top__t"><b>하프타임</b><span>전반 종료 · 전술을 바꿀 수 있어요</span></div>
      <div class="ht-score">${team(0)}<b class="po-num">${vm.score[0]}<i>:</i>${vm.score[1]}</b>${team(1)}</div>
    </div>`;
  const sets = vm.sets.map((x) => `<button type="button" class="${cx('ht-set', x.on && 'is-on')}" data-act="ht-set" data-v="${x.id}" aria-pressed="${x.on}">
      <span class="ht-set__radio" aria-hidden="true"></span><b>${esc(x.name)}</b><small>${esc(x.desc)}</small></button>`).join('');
  const tends = vm.tendencies.map((t) => TacticChip({ tactic: t.style, selected: t.on, act: 'ht-tend', data: { v: t.id } })).join('');
  const details = vm.details.map((d) => `<div class="ht-detail">
      <div class="ht-detail__l"><b>${esc(d.label)}</b>${d.changed ? '<span class="ht-changed">바뀜</span>' : ''}</div>
      ${Tabs({ variant: 'segment', fill: true, items: d.items, value: d.value, act: 'ht-level', data: { k: d.key }, label: d.label })}
    </div>`).join('');
  return `<div class="moment mo-v3 ht-v3">
      ${top}
      <div class="pitch-wrap mo-stage ht-stage">${Pitch({ canvasId: 'mo-canvas', label: '하프타임 정지 화면' })}</div>
      <p class="ht-pause">${Icon({ name: 'clock', size: 14 })}<span>경기는 멈춰 있어요 · 고른 전술은 후반 시작부터 적용돼요. 경기 중 바꾸기는 하프타임에만 돼요.</span></p>
      <div class="ht-sheet" role="dialog" aria-label="후반 전술">
        <span class="ht-sheet__grip" aria-hidden="true"></span>
        <span class="ht-chip">하프타임</span>
        <b class="ht-sheet__title">후반 전술</b>
        <p class="ht-sheet__sub">성향과 세부 전술을 바꾸거나 세트를 골라요.</p>
        ${SectionTitle({ title: '전술 세트' })}
        <div class="ht-sets">${sets}</div>
        ${SectionTitle({ title: '전술 성향' })}
        <div class="ht-tends">${tends}</div>
        ${SectionTitle({ title: '세부 전술' })}
        <div class="ht-details">${details}</div>
        <div class="ht-actions">
          ${Button({ variant: 'secondary', size: 'lg', block: true, act: 'ht-keep', children: '변경 없이 후반' })}
          ${Button({ size: 'lg', block: true, icon: 'check', act: 'ht-ok', disabled: !vm.changed, children: vm.changed ? '이 전술로 후반' : '바뀐 것 없음' })}
        </div>
      </div>
    </div>`;
}
