// 커스텀 생성 화면 (pending 47 2·49 1, 부록 C.45) — 디자인 없는 새 화면. 새 게임의 세 번째 시작 방식.
// 순서: 기본(이름·나이·포지션) → 신체(키·몸무게·주발·약발) → 외모(국적·외모군·도트 머리) → 장단점 → 능력치 배분 → 시작

import { Banner, Button, esc, SectionTitle } from '../components';
import type { CustomVM } from '../customVM';
import { attrGrid } from './attrGrid';
import { panel } from './common';
import { BALANCE } from '../../config/balance';

const sgn = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

function stepper(k: string, value: string, sub: string, canDown: boolean, canUp: boolean, step = 1): string {
  return `<div class="cu-step"><button type="button" class="cu-sbtn" data-act="cu" data-k="${k}" data-v="${-step}"${canDown ? '' : ' disabled'} aria-label="줄이기">−</button>
    <span class="cu-sval"><b class="po-num">${esc(value)}</b><small>${esc(sub)}</small></span>
    <button type="button" class="cu-sbtn" data-act="cu" data-k="${k}" data-v="${step}"${canUp ? '' : ' disabled'} aria-label="늘리기">+</button></div>`;
}

function chips(k: string, items: { id: string; label: string; on: boolean; sub?: string; disabled?: boolean }[]): string {
  return `<div class="cu-chips">${items.map((it) => `<button type="button" class="cu-chip${it.on ? ' is-on' : ''}" data-act="cu" data-k="${k}" data-v="${esc(it.id)}"${it.disabled ? ' disabled' : ''}>${esc(it.label)}${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</button>`).join('')}</div>`;
}

export function customBody(vm: CustomVM, diff: string, seed: string): string {
  const b = vm.body;
  const left = `<div class="cu-budget${vm.over ? ' over' : ''}"><span>배분 포인트</span><b class="po-num">${vm.left}</b><small>/ ${vm.budget}P · 기본 100 ${sgn(vm.agePts)}(나이) · 약발 ${sgn(b.weakPts)} · 태그 ${sgn(vm.budget - 100 - vm.agePts - b.weakPts)}</small></div>`;
  const basic = `
    ${SectionTitle({ title: '이름', action: '비우면 랜덤' })}
    <label class="field"><input type="text" id="f-name" maxlength="12" value="${esc(vm.name)}" placeholder="예: 김민준"></label>
    ${SectionTitle({ title: '나이', action: `${vm.ageMin}~${vm.ageMax}세` })}
    ${stepper('age', `${vm.age}세`, `배분 포인트 ${sgn(vm.agePts)}`, vm.age > vm.ageMin, vm.age < vm.ageMax)}
    <p class="small muted">나이가 많을수록 포인트가 많지만 성장할 시간이 짧아요. 랜덤 생성은 17세예요.</p>
    ${SectionTitle({ title: '포지션', action: `${vm.positionKo} OVR ${vm.ovr}` })}
    <div class="pos-pick">${vm.positions.map((p) => `<button type="button" class="pos-btn${p.on ? ' is-on' : ''}" data-act="cu" data-k="pos" data-v="${p.id}"><b>${p.id}</b><small>${esc(p.ko)} · ${p.ovr}</small></button>`).join('')}</div>`;
  const body = `
    ${SectionTitle({ title: '신체', action: `BMI ${b.bmi}` })}
    <div class="cu-row2">
      <div><span class="label">키</span>${stepper('height', `${b.height} cm`, `속도 상한 ${Math.round(b.speedCap / 5)} · 공중 상한 ${Math.round(b.aerialCap / 5)}`, b.height > b.hMin, b.height < b.hMax)}</div>
      <div><span class="label">몸무게</span>${stepper('weight', `${b.weight} kg`, `${b.wRange[0]}~${b.wRange[1]} kg`, b.weight > b.wRange[0], b.weight < b.wRange[1])}</div>
    </div>
    <p class="small muted">키가 크면 공중볼·헤더에 유리하고 속도·가속·민첩 상한이 내려가요. 몸무게가 많으면 몸싸움 +, 가속·민첩 조금 −.</p>
    <span class="label">주발</span>${chips('foot', [{ id: 'right', label: '오른발', on: b.foot === 'right' }, { id: 'left', label: '왼발', on: b.foot === 'left' }])}
    <span class="label">약발 (5 = 양발잡이)</span>${chips('wf', vm.weakOptions.map((o) => ({ id: String(o.v), label: String(o.v), sub: `${sgn(o.pts)}P`, on: o.on })))}
    <p class="small muted">약발 쪽으로 차야 하는 슛·크로스·긴 패스의 정확도가 약발 1이면 ×0.75, 5면 그대로예요. 경기 뒤 약발 훈련·포인트로 올릴 수 있어요.</p>`;
  const look = `
    ${SectionTitle({ title: '국적·외모' })}
    <label class="field"><select id="cu-nat" class="cu-select">${vm.nationalities.map((n) => `<option value="${esc(n.id)}"${n.id === vm.nationality ? ' selected' : ''}>${esc(n.ko)}</option>`).join('')}</select></label>
    <span class="label">외모군</span>${chips('app', vm.appearances.map((a) => ({ id: a.id, label: a.ko, on: a.id === vm.appearance })))}
    <span class="label">경기 화면 도트 머리</span>${chips('hair', [{ id: '', label: '자동', on: !vm.hair }, ...vm.hairs.map((h) => ({ id: h.id, label: h.ko, on: h.id === vm.hair }))])}`;
  const tc = vm.traitCount;
  const traitRow = (t: CustomVM['traits'][number]) => `<div class="po-option opt cu-trait ${t.kind}${t.on ? ' is-on' : ''}${t.can ? '' : ' is-off'}">
      <span class="grow"><b>${esc(t.ko)}${t.hook ? ' <span class="rec wild">나중에 연결</span>' : ''}</b><small>${esc(t.desc)}${t.hook ? ` · ${esc(t.hook)} 단계에서 효과` : ''}${t.removeDesc ? ` · 해제형은 "${esc(t.removeDesc)}"이면 사라짐` : ''}</small></span>
      <span class="cu-tagbtns">
        <button type="button" class="cu-chip${t.on && t.perm ? ' is-on' : ''}" data-act="cu" data-k="trait" data-v="${t.id}"${t.can ? '' : ' disabled'}>${t.ptsRemovable !== null ? '영구 ' : ''}${sgn(t.pts)}P</button>
        ${t.ptsRemovable !== null ? `<button type="button" class="cu-chip${t.on && !t.perm ? ' is-on' : ''}" data-act="cu" data-k="traitR" data-v="${t.id}"${t.can ? '' : ' disabled'}>해제형 ${sgn(t.ptsRemovable)}P</button>` : ''}
      </span></div>`;
  const traits = `
    ${SectionTitle({ title: '태그 · 장점', action: `${tc.pro}/${tc.maxPro} · 포인트 −` })}
    <p class="small muted">영구 태그는 효과가 계속 가는 대신 포인트가 크고, 해제형은 조건을 채우면 사라지는 대신 포인트가 작아요. 노익장·빅매치 체질·유스 출신·원클럽맨 같은 태그는 플레이하며 얻어요.</p>
    <div class="opts">${vm.traits.filter((t) => t.kind === 'pro').map(traitRow).join('')}</div>
    ${SectionTitle({ title: '태그 · 단점', action: `${tc.con}/${tc.maxCon} · 포인트 +` })}
    <div class="opts">${vm.traits.filter((t) => t.kind === 'con').map(traitRow).join('')}</div>`;
  const attrs = `
    ${SectionTitle({ title: '능력치 배분', action: `테두리 = ${vm.position} 핵심` })}
    <p class="small muted">모든 능력치 8(내부 40)에서 시작해요. 박스를 누르고 [+]로 한 칸씩 올려요. 칸당 1P(~11) · 2P(~13) · 3P(14~), 최대 15. 숨은 적성·잠재력은 시작해야 알 수 있어요.</p>
    ${panel(attrGrid(vm.attrs, vm.sel, { sel: 'cu-sel', raise: 'cu-raise', lower: 'cu-lower' }))}
    <div class="btn-row even">${Button({ variant: 'ghost', block: true, icon: 'target', act: 'cu-auto', disabled: vm.left <= 0, children: '자동 배분 (OVR 우선)' })}${Button({ variant: 'ghost', block: true, icon: 'restore', act: 'cu', data: { k: 'reset' }, children: '초기화' })}</div>`;
  const st = vm.start;
  const kinds = st.trialAge
    ? [{ id: 'youth', label: '유스 구단 (1군 테스트)', on: st.kind === 'youth' }, { id: 'none', label: '소속팀 없음 (영입 제안)', on: st.kind === 'none' }]
    : [{ id: 'club', label: '소속팀 선택', on: st.kind === 'club' }, { id: 'none', label: '소속팀 없음 (영입 제안)', on: st.kind === 'none' }];
  const S = BALANCE.startClub;
  const kindNote = st.kind === 'youth'
    ? `그 구단 1군에 콜업돼요. 시즌 첫 리그 ${S.trialGames}경기에 반드시 출전하고, 결과로 계약(합격·다른 팀 제안도 와요) / 연장(최대 ${S.trialMaxGames}경기) / 방출(영입 제안)이 정해져요. 실력과 상관없이 어느 구단이든 고를 수 있어요.`
    : st.kind === 'club'
      ? '스탯에 맞는 팀이에요. 고른 팀과 바로 계약하고, 그 팀 유스 출신으로 기록돼요.'
      : '유스 출신 구단은 기록(서사)만 남아요. 시작하자마자 스탯에 맞는 팀들의 영입 제안 중에서 골라요.';
  const teamList = st.kind === 'none'
    ? `<span class="label">유스 출신 구단 (기록만)</span>${chips('youthClub', [{ id: 'random', label: '랜덤', on: st.youthClub === 'random' }, ...st.allTeams.map((t) => ({ id: t.id, label: t.ko, on: st.youthClub === t.id }))])}`
    : chips('startClub', st.teams.map((t) => ({ id: t.id, label: t.ko, sub: `전력 ${Math.round(t.rating)}`, on: st.club === t.id })));
  const start = `
    ${SectionTitle({ title: '시작 소속', action: st.trialAge ? '15~18세' : '19~23세' })}
    ${chips('startKind', kinds)}
    <p class="small muted">${esc(kindNote)}</p>
    ${teamList}`;
  return `${left}${basic}${body}${look}${traits}${attrs}${start}
    ${vm.over ? Banner({ tone: 'warning', title: `포인트 ${-vm.left}P 초과`, children: '능력치를 내리거나 단점·나이로 포인트를 늘려요.' }) : ''}
    ${diff}${seed}
    <div class="btn-col">${Button({ size: 'lg', block: true, iconRight: 'chevron-right', act: 'start', disabled: vm.over || !st.ready, children: !st.ready ? '시작할 구단을 골라요' : `${vm.age}세 ${vm.position} · OVR ${vm.ovr}로 시작` })}</div>`;
}
