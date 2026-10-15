// 첫 플레이 안내 (21.4 개정안, 부록 C.23): 화면 첫 방문 말풍선, 첫 경기 3줄 오버레이, 첫 시즌 체크리스트.
// 기존 컴포넌트(Button, Icon, OptionRow, SectionTitle)와 토큰만 쓴다

import { Button, esc, Icon, OptionRow, SectionTitle } from '../components';

/** 한 줄 말풍선. 누르면 닫히고, [안내 끄기]는 모든 말풍선을 끈다 */
export function tipBubble(id: string, text: string): string {
  return `<div class="tip" role="note">
    <button class="tip__body" data-act="tip-close" data-v="${esc(id)}">${Icon({ name: 'info', size: 16 })}<span>${esc(text)}</span></button>
    <button class="tip__off" data-act="tips-off">안내 끄기</button>
  </div>`;
}

/** 첫 경기 오버레이: 재생을 멈추고 3줄 설명. 탭하면 닫히고 재생이 이어진다 */
export function firstMatchOverlay(lines: readonly string[]): string {
  return `<div class="po-overlay fm-overlay" data-overlay="1" data-act="fm-close">
    <div class="po-modal fm-card" role="dialog" aria-label="경기 화면 안내">
      <b class="po-modal__title">경기 화면 보는 법</b>
      <ol class="fm-lines">${lines.map((l, i) => `<li><span class="fm-n po-num">${i + 1}</span>${esc(l)}</li>`).join('')}</ol>
      ${Button({ block: true, act: 'fm-close', children: '알겠어요 · 재생 이어서' })}
    </div>
  </div>`;
}

/** 첫 시즌 체크리스트 (공개 순서, 열린 항목만) */
export function checklistPanel(items: { id: string; label: string; done: boolean }[]): string {
  const n = items.filter((i) => i.done).length;
  return `${SectionTitle({ title: '첫 시즌 가이드', action: `${n}/${items.length}` })}
    <div class="opts">${items.map((i) => OptionRow({
      icon: i.done ? 'check' : 'dot', title: i.label, desc: i.done ? '완료' : '아직 안 했어요',
      right: `<b class="po-num small${i.done ? ' hi' : ' muted'}">${i.done ? '완료' : '할 일'}</b>`, disabled: i.done,
    })).join('')}</div>`;
}

/** "안내 다시 보기" (설정이 없어 홈 맨 아래 버전 표시 옆에 둔다) */
export function guideResetLink(): string {
  return `<p class="ver"><button class="link-btn" data-act="tips-reset">안내 다시 보기</button></p>`;
}
