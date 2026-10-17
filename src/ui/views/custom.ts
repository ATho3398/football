// 커스텀 생성 화면 (pending 47 2·49 1, 부록 C.45 → C.58 디자인 124~129 6단계). 새 게임의 세 번째 시작 방식.
// 단계: 기본(이름·나이·포지션) → 몸(키·몸무게·주발·약발) → 외모(국적·외모군·도트 머리) → 태그 → 능력치 배분 → 시작(소속·옵션)

import { Banner, Button, esc, PointBar, SectionTitle, Stepper, TagChip, TextField } from '../components';
import type { CustomVM } from '../customVM';
import { attrGrid } from './attrGrid';
import { BALANCE } from '../../config/balance';

const sgn = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

function chips(k: string, items: { id: string; label: string; on: boolean; sub?: string; disabled?: boolean }[]): string {
  return `<div class="cu-chips">${items.map((it) => `<button type="button" class="cu-chip${it.on ? ' is-on' : ''}" data-act="cu" data-k="${k}" data-v="${esc(it.id)}"${it.disabled ? ' disabled' : ''}>${esc(it.label)}${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</button>`).join('')}</div>`;
}

export const CUSTOM_STEPS = ['기본', '몸', '외모', '태그', '능력치', '시작'] as const;

/** 위 단계 점 6개 (디자인 124): 지난 단계 ✓, 지금 단계 라임, 누르면 이동 */
function stepDots(step: number): string {
  return `<ol class="cu-dots" aria-label="커스텀 단계">${CUSTOM_STEPS.map((l, k) => {
    const n = k + 1;
    const st = n < step ? 'is-done' : n === step ? 'is-on' : '';
    return `<li><button type="button" class="cu-dot ${st}" data-act="cu-step" data-v="${n}" aria-current="${n === step ? 'step' : 'false'}"><span class="cu-dot__n po-num">${n < step ? '✓' : n}</span><small>${l}</small></button></li>`;
  }).join('')}</ol>`;
}

/** 커스텀 6단계 (C.58 디자인 124~129): 기본 · 몸 · 외모 · 태그 · 능력치 · 시작. 모드 탭은 1단계에만, PointBar sticky, 아래 고정 [이전][다음 · 단계명] */
export function customBody(vm: CustomVM, step: number, modeTabs: string, options: string): string {
  const b = vm.body;
  const st = Math.max(1, Math.min(CUSTOM_STEPS.length, step));
  const tagPts = vm.budget - 100 - vm.agePts - b.weakPts;
  const bar = PointBar({ left: vm.left, total: vm.budget, sticky: true, items: [{ label: '기본', value: 100, base: true }, { label: '나이', value: vm.agePts }, { label: '약발', value: b.weakPts }, { label: '태그', value: tagPts }],
    ...(vm.left > 0 && st === CUSTOM_STEPS.length ? { message: `남은 ${vm.left}P는 시작 뒤 포인트로` } : {}) });
  const cuAct = (k: string, v: number) => ({ act: 'cu', data: { k, v: String(v) } });
  let body = '';
  if (st === 1) {
    body = `${TextField({ label: '이름', value: vm.name, placeholder: '예: 김민준', hint: '비우면 랜덤 이름이에요.', input: { id: 'f-name', maxLength: 12 }, clearable: false })}
    ${Stepper({ label: '나이', value: vm.age, unit: '세', min: vm.ageMin, max: vm.ageMax, sub: `배분 포인트 ${sgn(vm.agePts)}`, subTone: vm.agePts >= 0 ? 'gain' : 'cost', onMinus: cuAct('age', -1), onPlus: cuAct('age', 1) })}
    <p class="small muted">나이가 많을수록 포인트가 많지만 성장할 시간이 짧아요. 15~18세는 유스 구단 1군 테스트, 19~23세는 소속팀에서 시작해요. 랜덤 생성은 17세예요.</p>
    ${SectionTitle({ title: '포지션', action: `${vm.positionKo} · 시작 OVR ${vm.ovr}` })}
    <div class="cu-pos">${vm.positions.map((p) => `<button type="button" class="cu-posbtn${p.on ? ' is-on' : ''}" data-act="cu" data-k="pos" data-v="${p.id}" aria-pressed="${p.on}"><b>${p.id}</b><span class="po-num">${p.ovr}</span></button>`).join('')}</div>`;
  } else if (st === 2) {
    body = `${SectionTitle({ title: '신체', action: `BMI ${b.bmi}` })}
    ${Stepper({ label: '키', value: b.height, unit: 'cm', min: b.hMin, max: b.hMax, sub: `속도 상한 ${Math.round(b.speedCap / 5)} · 공중 상한 ${Math.round(b.aerialCap / 5)}`, subTone: 'warn', onMinus: cuAct('height', -1), onPlus: cuAct('height', 1) })}
    ${Stepper({ label: '몸무게', value: b.weight, unit: 'kg', min: b.wRange[0], max: b.wRange[1], sub: `키에 맞는 범위 ${b.wRange[0]}~${b.wRange[1]} kg`, onMinus: cuAct('weight', -1), onPlus: cuAct('weight', 1) })}
    <p class="small muted">키가 크면 공중볼·헤더에 유리하고 속도·가속·민첩 상한이 내려가요. 몸무게가 많으면 몸싸움 +, 가속·민첩 조금 −.</p>
    ${SectionTitle({ title: '주발' })}${chips('foot', [{ id: 'right', label: '오른발', on: b.foot === 'right' }, { id: 'left', label: '왼발', on: b.foot === 'left' }])}
    ${SectionTitle({ title: '약발', action: '5 = 양발잡이' })}${chips('wf', vm.weakOptions.map((o) => ({ id: String(o.v), label: String(o.v), sub: `${sgn(o.pts)}P`, on: o.on })))}
    <p class="small muted">약발 쪽으로 차야 하는 슛·크로스·긴 패스의 정확도가 약발 1이면 ×0.75, 5면 그대로예요. 경기 뒤 약발 훈련·포인트로 올릴 수 있어요.</p>`;
  } else if (st === 3) {
    body = `${SectionTitle({ title: '국적' })}
    <label class="field"><select id="cu-nat" class="cu-select">${vm.nationalities.map((n) => `<option value="${esc(n.id)}"${n.id === vm.nationality ? ' selected' : ''}>${esc(n.ko)}</option>`).join('')}</select></label>
    ${SectionTitle({ title: '외모군', action: '얼굴 그림 · 경기 아이콘 피부' })}${chips('app', vm.appearances.map((a) => ({ id: a.id, label: a.ko, on: a.id === vm.appearance })))}
    ${SectionTitle({ title: '경기 화면 도트 머리' })}${chips('hair', [{ id: '', label: '자동', on: !vm.hair }, ...vm.hairs.map((h) => ({ id: h.id, label: h.ko, on: h.id === vm.hair }))])}
    <p class="small muted">겉모습만 바뀌고 경기 결과에는 영향이 없어요. 시작한 뒤에도 설정 → 페이스온·경기 아이콘에서 바꿀 수 있어요.</p>`;
  } else if (st === 4) {
    const tc = vm.traitCount;
    const traitRow = (t: CustomVM['traits'][number]) => `<div class="po-option opt cu-trait ${t.kind}${t.on ? ' is-on' : ''}${t.can ? '' : ' is-off'}">
      <span class="grow">${TagChip({ name: t.ko, kind: 'gen', polarity: t.kind, ...(t.on && !t.perm && t.removeDesc ? { release: t.removeDesc } : {}), size: 'sm' })}<small>${esc(t.desc)}${t.hook ? ' · 효과는 다음 업데이트에서 열려요' : ''}${t.removeDesc ? ` · 해제형은 "${esc(t.removeDesc)}"이면 사라짐` : ''}</small></span>
      <span class="cu-tagbtns">
        <button type="button" class="cu-chip${t.on && t.perm ? ' is-on' : ''}" data-act="cu" data-k="trait" data-v="${t.id}"${t.can ? '' : ' disabled'}>${t.ptsRemovable !== null ? '영구 ' : ''}${sgn(t.pts)}P</button>
        ${t.ptsRemovable !== null ? `<button type="button" class="cu-chip${t.on && !t.perm ? ' is-on' : ''}" data-act="cu" data-k="traitR" data-v="${t.id}"${t.can ? '' : ' disabled'}>해제형 ${sgn(t.ptsRemovable)}P</button>` : ''}
      </span></div>`;
    body = `<p class="small muted">영구 태그는 효과가 계속 가는 대신 포인트가 크고, 해제형은 조건을 채우면 사라지는 대신 포인트가 작아요. 노익장·빅매치 체질·원클럽맨 같은 태그는 플레이하며 얻어요.</p>
    ${SectionTitle({ title: '장점', action: `${tc.pro}/${tc.maxPro} · 포인트 −` })}
    <div class="opts">${vm.traits.filter((t) => t.kind === 'pro').map(traitRow).join('')}</div>
    ${SectionTitle({ title: '단점', action: `${tc.con}/${tc.maxCon} · 포인트 +` })}
    <div class="opts">${vm.traits.filter((t) => t.kind === 'con').map(traitRow).join('')}</div>`;
  } else if (st === 5) {
    body = `${SectionTitle({ title: '능력치 배분', action: `테두리 = ${vm.position} 핵심` })}
    <p class="small muted">모든 능력치 8에서 시작해요. 박스를 누르고 [+]로 한 칸씩 올려요. 칸당 1P(~11) · 2P(~13) · 3P(14~), 최대 15. 숨은 적성·잠재력은 시작해야 알 수 있어요.</p>
    ${attrGrid(vm.attrs, vm.sel, { sel: 'cu-sel', raise: 'cu-raise', lower: 'cu-lower' }, { cols: 4, keyLabel: `${vm.position} 핵심` })}
    <div class="btn-row even">${Button({ variant: 'ghost', block: true, icon: 'target', act: 'cu-auto', disabled: vm.left <= 0, children: '자동 배분 (OVR 우선)' })}${Button({ variant: 'ghost', block: true, icon: 'restore', act: 'cu', data: { k: 'reset' }, children: '초기화' })}</div>`;
  } else {
    const s2 = vm.start;
    const kinds = s2.trialAge
      ? [{ id: 'youth', label: '유스 구단 (1군 테스트)', on: s2.kind === 'youth' }, { id: 'none', label: '소속팀 없음 (영입 제안)', on: s2.kind === 'none' }]
      : [{ id: 'club', label: '소속팀 선택', on: s2.kind === 'club' }, { id: 'none', label: '소속팀 없음 (영입 제안)', on: s2.kind === 'none' }];
    const S = BALANCE.startClub;
    const kindNote = s2.kind === 'youth'
      ? `그 구단 1군에 콜업돼요. 시즌 첫 리그 ${S.trialGames}경기에 반드시 출전하고, 결과로 계약(합격·다른 팀 제안도 와요) / 연장(최대 ${S.trialMaxGames}경기) / 방출(영입 제안)이 정해져요. 실력과 상관없이 어느 구단이든 고를 수 있어요.`
      : s2.kind === 'club'
        ? '스탯에 맞는 팀이에요. 고른 팀과 바로 계약하고, 그 팀 유스 출신으로 기록돼요.'
        : '유스 출신 구단은 기록(서사)만 남아요. 시작하자마자 스탯에 맞는 팀들의 영입 제안 중에서 골라요.';
    const teamList = s2.kind === 'none'
      ? `<span class="label">유스 출신 구단 (기록만)</span>${chips('youthClub', [{ id: 'random', label: '랜덤', on: s2.youthClub === 'random' }, ...s2.allTeams.map((t) => ({ id: t.id, label: t.ko, on: s2.youthClub === t.id }))])}`
      : chips('startClub', s2.teams.map((t) => ({ id: t.id, label: t.ko, sub: `전력 ${Math.round(t.rating)}`, on: s2.club === t.id })));
    body = `${SectionTitle({ title: '시작 소속', action: s2.trialAge ? '15~18세 · 유스' : '19~23세 · 소속팀' })}
    ${chips('startKind', kinds)}
    <p class="small muted">${esc(kindNote)}</p>
    ${teamList}
    ${options}
    ${vm.over ? Banner({ tone: 'warning', title: `포인트 ${-vm.left}P 초과`, children: '능력치를 내리거나 단점·나이로 포인트를 늘려요.' }) : ''}
    ${vm.left > 0 ? `<p class="small muted">남은 ${vm.left}P는 시작한 뒤 성장 포인트로 넘어가요 (선수 화면에서 찍어요).</p>` : ''}`;
  }
  const last = st === CUSTOM_STEPS.length;
  const prev = st > 1
    ? Button({ variant: 'secondary', size: 'lg', act: 'cu-step', data: { v: String(st - 1) }, children: '이전', className: 'cu-prev' })
    : '';
  const next = last
    ? Button({ size: 'lg', block: true, iconRight: 'chevron-right', act: 'start', disabled: vm.over || !vm.start.ready, children: vm.over ? `${-vm.left}P 넘쳤어요` : !vm.start.ready ? '시작할 구단을 골라요' : `${vm.age}세 ${vm.position} · OVR ${vm.ovr}로 시작` })
    : Button({ size: 'lg', block: true, iconRight: 'chevron-right', act: 'cu-step', data: { v: String(st + 1) }, children: `다음 · ${CUSTOM_STEPS[st]}` });
  return `${modeTabs}${stepDots(st)}${bar}<div class="cu-step-body">${body}</div>
    <div class="dock cu-nav">${prev}${next}</div>`;
}
