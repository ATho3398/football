// 커스텀 생성 화면 (pending 47 2·49 1, 부록 C.45 → C.58 디자인 124~129 6단계). 새 게임의 기본 시작 방식 (C.74d: 랜덤은 [전체 랜덤]·[이 단계 랜덤]으로 합침).
// 단계: 기본(이름·나이·포지션) → 몸(키·몸무게·주발·약발) → 외모(국적·인종·기본 사진·도트 머리, C.73c) → 태그 → 능력치 배분 → 시작(소속·옵션)

import { Avatar, Banner, Button, esc, Icon, PointBar, SectionTitle, Stepper, TagChip, TextField } from '../components';
import { ALL_KITS, personOf } from '../../pixel';
import { defaultPhotoSrc, pixelLayerUrls } from '../faces';
import type { FacePhoto } from '../../identity';
import { peopleTable, pixelIconHtml } from '../pixelIcons';
import type { CustomVM } from '../customVM';
import { attrGrid } from './attrGrid';
import { BALANCE } from '../../config/balance';
import { isWide } from '../skin';

const sgn = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

function chips(k: string, items: { id: string; label: string; on: boolean; sub?: string; disabled?: boolean }[]): string {
  return `<div class="cu-chips">${items.map((it) => `<button type="button" class="cu-chip${it.on ? ' is-on' : ''}" data-act="cu" data-k="${k}" data-v="${esc(it.id)}"${it.disabled ? ' disabled' : ''}>${esc(it.label)}${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</button>`).join('')}</div>`;
}

/** 기본 사진 줄 (C.73c): 4장 썸네일, 고른 장 라임 테두리. act·k 는 커스텀(cu, photo) / 랜덤(form, photo) */
export function photoRow(act: string, k: string, photos: readonly { id: FacePhoto; ko: string }[], on: FacePhoto): string {
  return `<div class="ng-photos" role="radiogroup" aria-label="기본 사진">${photos.map((p) =>
    `<button type="button" class="ng-photo${p.id === on ? ' is-on' : ''}" role="radio" aria-checked="${p.id === on}" data-act="${act}" data-k="${k}" data-v="${p.id}"><img src="${esc(defaultPhotoSrc(p.id))}" alt="" loading="lazy" decoding="async"><small>${esc(p.ko)}</small></button>`).join('')}</div>`;
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
export function customBody(vm: CustomVM, step: number, modeTabs: string, options: string, hooksOpen: readonly ('pro' | 'con')[] = []): string {
  const b = vm.body;
  const st = Math.max(1, Math.min(CUSTOM_STEPS.length, step));
  // 기본 = BALANCE.custom.points (C.49 에서 100 → 58, 표시만 100 으로 남아 태그가 −42 로 보이던 것 C.74d 에서 고침)
  const basePts = BALANCE.custom.points;
  const tagPts = vm.budget - basePts - vm.agePts - b.weakPts;
  const bar = PointBar({ left: vm.left, total: vm.budget, sticky: true, items: [{ label: '기본', value: basePts, base: true }, { label: '나이', value: vm.agePts }, { label: '약발', value: b.weakPts }, { label: '태그', value: tagPts }],
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
    ${SectionTitle({ title: '인종', action: '기본 사진 · 경기 아이콘 피부' })}${chips('app', vm.appearances.map((a) => ({ id: a.id, label: a.ko, on: a.id === vm.appearance })))}
    ${SectionTitle({ title: '기본 사진', action: '인종을 고르면 자동 · 따로 바꿔도 돼요' })}${photoRow('cu', 'photo', vm.photos, vm.facePhoto)}
    ${SectionTitle({ title: '경기 화면 도트 머리' })}${chips('hair', [{ id: '', label: '자동', on: !vm.hair }, ...vm.hairs.map((h) => ({ id: h.id, label: h.ko, on: h.id === vm.hair }))])}
    <p class="small muted">겉모습만 바뀌고 경기 결과에는 영향이 없어요. 시작한 뒤에도 설정 → 페이스온·경기 아이콘에서 바꿀 수 있어요.</p>`;
  } else if (st === 4) {
    // PC (C.61 디자인 151): 장점 | 단점 두 열
    const pro = traitSection(vm, 'pro', hooksOpen.includes('pro'));
    const con = traitSection(vm, 'con', hooksOpen.includes('con'));
    body = `<p class="small muted">영구 태그는 효과가 계속 가는 대신 포인트가 크고, 해제형은 조건을 채우면 사라지는 대신 포인트가 작아요.${isWide() ? '' : ' 노익장·빅매치 체질·원클럽맨 같은 태그는 플레이하며 얻어요.'} 고른 칸을 한 번 더 누르면 빠져요.</p>
    ${isWide() ? `<div class="cu-tags2"><div>${pro}</div><div>${con}</div></div>` : `${pro}
    ${con}`}`;
  } else if (st === 5) {
    body = `${SectionTitle({ title: '능력치 배분', action: `테두리 = ${vm.position} 핵심` })}
    <p class="small muted">모든 능력치 8에서 시작해요. 박스를 누르고 [+]로 한 칸씩 올려요. 칸당 1P(~11) · 2P(~13) · 3P(14~), 최대 15. 숨은 적성·잠재력은 시작해야 알 수 있어요.</p>
    ${attrGrid(vm.attrs, vm.sel, { sel: 'cu-sel', raise: 'cu-raise', lower: 'cu-lower' }, { cols: 4, keyLabel: `${vm.position} 핵심` })}
    ${vm.over ? `<div class="btn-col">${Button({ variant: 'secondary', block: true, icon: 'target', act: 'cu-fit', children: `포인트에 맞추기 · ${-vm.left}P 줄이기` })}</div>` : ''}
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
  // 이 단계 랜덤 (C.74d): 그 단계 값만 랜덤 유망주 기준으로 다시 뽑는다
  body = `<div class="cu-randstep">${Button({ variant: 'ghost', size: 'sm', icon: 'swap', act: 'cu-rand', data: { v: String(st) }, children: '이 단계 랜덤' })}</div>${body}`;
  if (isWide()) return customWide(vm, st, modeTabs, bar, body, prev, next);
  return `${modeTabs}${stepDots(st)}${bar}<div class="cu-step-body">${body}</div>
    <div class="dock cu-nav">${prev}${next}</div>`;
}

type Trait = CustomVM['traits'][number];

/** 고른 태그 큰 카드 (C.71b 디자인 183): 칩 + 영구/해제형 두 칸(고를 수 없으면 "고정" 한 칸) · 효과 · 해제 조건 */
function traitCard(t: Trait): string {
  const tile = (k: 'trait' | 'traitR', label: string, pts: number, on: boolean) =>
    `<button type="button" class="cu-tagtile${on ? ' is-on' : ''}" data-act="cu" data-k="${k}" data-v="${t.id}" aria-pressed="${on}"><small>${label}</small><b class="po-num">${sgn(pts)}P</b></button>`;
  const tiles = t.ptsRemovable !== null
    ? `${tile('trait', '영구', t.pts, t.perm)}${tile('traitR', '해제형', t.ptsRemovable, !t.perm)}`
    : tile('trait', '고정', t.pts, true);
  const note = t.hook ? '효과는 다음 업데이트에서 열려요' : t.removeDesc ? `해제형은 "${t.removeDesc}"이면 사라져요` : '';
  return `<div class="cu-tagcard ${t.kind}"><div class="cu-tagcard__top">${TagChip({ name: t.ko, kind: 'gen', polarity: t.kind, ...(!t.perm && t.removeDesc ? { release: t.removeDesc } : {}), size: 'sm' })}<span class="cu-tagtiles">${tiles}</span></div>
    <b class="cu-tagcard__fx">${esc(t.desc)}</b>${note ? `<small class="muted">${esc(note)}</small>` : ''}</div>`;
}

/** 안 고른 태그 한 줄: 칩 · 효과 · 영구/해제형 포인트. 더 못 고르면 흐리게 */
function traitLine(t: Trait): string {
  const pts = t.ptsRemovable !== null ? `${sgn(t.pts)}P / ${sgn(t.ptsRemovable)}P` : `${sgn(t.pts)}P`;
  return `<button type="button" class="cu-tagrow ${t.kind}" data-act="cu" data-k="trait" data-v="${t.id}"${t.can ? '' : ' disabled'}>${TagChip({ name: t.ko, kind: 'gen', polarity: t.kind, size: 'sm' })}<span class="cu-tagrow__fx">${esc(t.desc)}</span><b class="po-num">${pts}</b></button>`;
}

/** 태그 단계 장점·단점 한 묶음 (디자인 183·185): 고른 태그만 큰 카드, 나머지는 한 줄, 효과가 아직 없는 태그는 한 줄로 접는다 */
function traitSection(vm: CustomVM, kind: 'pro' | 'con', hooksOpen: boolean): string {
  const tc = vm.traitCount;
  const all = vm.traits.filter((t) => t.kind === kind);
  const on = all.filter((t) => t.on);
  const off = all.filter((t) => !t.on);
  const n = kind === 'pro' ? tc.pro : tc.con;
  const max = kind === 'pro' ? tc.maxPro : tc.maxCon;
  const sum = on.reduce((a, t) => a + (t.perm || t.ptsRemovable === null ? t.pts : t.ptsRemovable), 0);
  const hooks = off.filter((t) => t.hook);
  const ko = kind === 'pro' ? '장점' : '단점';
  const fold = hooks.length
    ? `<button type="button" class="cu-tagfold" data-act="ng-hooks" data-v="${kind}" aria-expanded="${hooksOpen}"><span class="grow">효과가 다음 업데이트에서 열리는 ${ko} ${hooks.length}개 · ${esc(hooks.map((t) => t.ko).join(' · '))}</span><span class="cu-tagfold__btn">${hooksOpen ? '접기' : '펼치기'}${Icon({ name: 'chevron-down', size: 14, style: hooksOpen ? 'transform:rotate(180deg)' : '' })}</span></button>${
      hooksOpen ? `<div class="cu-tagrows">${hooks.map(traitLine).join('')}</div>` : ''}`
    : '';
  return `${SectionTitle({ title: ko, action: `${n}/${max} · ${sgn(sum)}P` })}
    <div class="cu-tagset">${on.map(traitCard).join('')}
    ${n >= max && off.length ? `<p class="small muted cu-tagfull">다 골랐어요 · 하나를 빼면 아래에서 고를 수 있어요</p>` : ''}
    <div class="cu-tagrows">${off.filter((t) => !t.hook).map(traitLine).join('')}</div>${fold}</div>`;
}

/** 단계 요약 한 줄 (PC 왼쪽 단계 목록) */
function stepSummary(vm: CustomVM, n: number): string {
  const b = vm.body;
  const tc = vm.traitCount;
  const s2 = vm.start;
  switch (n) {
    case 1: return `${vm.name || '이름 랜덤'} · ${vm.age}세 · ${vm.position}`;
    case 2: return `${b.height}cm · ${b.weight}kg · ${b.footKo} · 약발 ${b.weakFoot}`;
    case 3: return [vm.nationalities.find((x) => x.id === vm.nationality)?.ko, vm.appearances.find((x) => x.id === vm.appearance)?.ko].filter(Boolean).join(' · ');
    case 4: {
      const pts = vm.traits.filter((t) => t.on).reduce((a, t) => a + (t.perm || t.ptsRemovable === null ? t.pts : t.ptsRemovable), 0);
      return `장점 ${tc.pro} · 단점 ${tc.con}${pts ? ` · ${sgn(pts)}P` : ''}`;
    }
    case 5: return vm.over ? `${-vm.left}P 넘침` : `남은 ${vm.left}P`;
    default: {
      const club = (s2.kind === 'youth' || s2.kind === 'club') ? s2.teams.find((t) => t.id === s2.club)?.ko : '';
      return s2.kind === 'none' ? '소속팀 없음 · 영입 제안' : club ? `${club} ${s2.kind === 'youth' ? '1군 테스트' : '계약'}` : '구단을 골라요';
    }
  }
}

/**
 * PC 3열 (C.61 디자인 151): 왼쪽 = 시작 방식 탭 + 6단계 목록(늘 보임, 누르면 이동, 요약 한 줄) ·
 * 가운데 = 배분 포인트 + 단계 본문 · 오른쪽 = 미리보기 카드 + [이전][다음]
 */
function customWide(vm: CustomVM, st: number, modeTabs: string, bar: string, body: string, prev: string, next: string): string {
  const steps = `<ol class="cu-steps" aria-label="커스텀 단계">${CUSTOM_STEPS.map((l, k) => {
    const n = k + 1;
    const cls = n < st ? 'is-done' : n === st ? 'is-on' : '';
    return `<li><button type="button" class="cu-steprow ${cls}" data-act="cu-step" data-v="${n}" aria-current="${n === st ? 'step' : 'false'}"><span class="cu-dot__n po-num">${n < st ? '✓' : n}</span><span class="grow"><b>${l}</b><small>${esc(stepSummary(vm, n))}</small></span></button></li>`;
  }).join('')}</ol>`;
  const tags = vm.traits.filter((t) => t.on).map((t) => TagChip({ name: t.ko, kind: 'gen', polarity: t.kind, ...(!t.perm && t.removeDesc ? { release: t.removeDesc } : {}), size: 'sm' })).join('');
  // 미리보기 얼굴 · 도트 (C.71b 디자인 185): 외모군 기본 얼굴(시작 뒤 페이스온에서 바꿈) · 경기 화면 도트(외모 단계 머리·피부)
  const person = personOf('custom-preview', vm.appearance, { ...(vm.hair ? { hair: vm.hair } : {}), skin: vm.skin, people: peopleTable() });
  const looks = `<div class="cu-preview__looks">
      <div><span class="cu-preview__pic">${Avatar({ size: 104, face: { id: 'custom-preview', age: vm.age, appearance: vm.appearance, photo: vm.facePhoto }, name: vm.name || '커스텀 선수', shape: 'square' })}</span><b class="small">얼굴</b><small class="muted">기본 사진 · 페이스온에서 내 사진으로 바꿔요</small></div>
      <div><span class="cu-preview__pic is-dot">${pixelIconHtml(pixelLayerUrls(person, ALL_KITS[0] ?? ''), 4, '도트')}</span><b class="small">도트</b><small class="muted">경기 화면 · 외모 단계 머리·피부</small></div></div>`;
  const preview = `<div class="panel cu-preview">
      <div class="cu-preview__head"><span class="grow"><b>${esc(vm.name || '이름 랜덤')}</b><small>${vm.age}세 · ${vm.position} · ${esc(vm.nationalities.find((x) => x.id === vm.nationality)?.ko ?? '')}</small></span><span class="cu-preview__ovr"><b class="po-num">${vm.ovr}</b><small>${vm.position} OVR</small></span></div>
      ${looks}
      <p class="small cu-preview__body">${vm.body.height}cm · ${vm.body.weight}kg · ${esc(vm.body.footKo)} · 약발 ${vm.body.weakFoot}</p>
      ${tags ? `<div class="cu-preview__tags">${tags}</div>` : '<small class="muted">태그 없음</small>'}
    </div>`;
  return `<div class="cu-pc"><div class="cu-pc__steps">${modeTabs}${steps}</div><div class="cu-pc__main">${bar}<div class="cu-step-body">${body}</div></div>
    <div class="cu-pc__side">${preview}<div class="cu-pc__btns">${prev}${next}</div></div></div>`;
}
