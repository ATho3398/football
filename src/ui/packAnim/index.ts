// 팩 개봉 연출 진입점 (C.76o): config 로 고른 구현을 덮개(overlay) 위에서 재생하고 [건너뛰기]·결과 목록을 붙인다.
// 연출 설정 '끔'이면 아무것도 띄우지 않고 false 를 돌려준다 (부르는 쪽이 예전 토스트를 쓴다)

import './packAnim.css';
import { PACK_ANIM } from './config';
import { createVideoAnimation, createSequenceAnimation } from './media';
import { RARITY_FX, RARITY_KO, bestRarity, loadPackAnimPref, resolveMode } from './model';
import { createMotionAnimation } from './motion';
import type { AnimCard, PackAnimation, PackAnimConfig, PackInfo } from './types';

export type { AnimCard, PackInfo } from './types';
export { setPackSfx } from './sound';
export * from './model';

export function createPackAnimation(c: PackAnimConfig = PACK_ANIM): PackAnimation {
  if (c.kind === 'video') return createVideoAnimation(c);
  if (c.kind === 'sequence') return createSequenceAnimation(c);
  return createMotionAnimation();
}

const reduced = (): boolean => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

let open = false;

/** 결과 목록: NEW · 중복(한 장 더) 표시. [확인]을 누르면 풀린다. 줄을 누르면 그 카드 id 로 풀린다 (C.77q: 부르는 쪽이 카드 상세를 연다) */
function results(ov: HTMLElement, pack: PackInfo, cards: AnimCard[]): Promise<string | null> {
  const rows = cards.map((c) => `<li class="pk-res__row pk-r--${c.rarity}" data-card="${esc(c.id)}" role="button" tabindex="0" aria-label="${esc(c.name)} 상세">
      <span class="pk-res__dot"></span>
      <span class="pk-res__name"><b>${esc(c.name)}</b><small>${RARITY_KO[c.rarity]}${c.sub ? ` · ${esc(c.sub)}` : ''}</small></span>
      ${c.isNew ? '<span class="pk-tag pk-tag--new">NEW</span>' : c.dup ? '<span class="pk-tag">중복 · 한 장 더</span>' : ''}
    </li>`).join('');
  const panel = document.createElement('div');
  panel.className = 'pk-res';
  panel.innerHTML = `<p class="pk-res__eyebrow">${esc(pack.name)} · ${cards.length}장</p><h2>카드팩 결과</h2><ul>${rows}</ul>
    <p class="pk-res__hint">가진 카드로 들어갔어요 · 카드를 누르면 상세 · 덱 편집에서 넣어요</p><button type="button" class="pk-btn">확인</button>`;
  ov.append(panel);
  const btn = panel.querySelector('button')!;
  btn.focus();
  return new Promise((res) => {
    btn.addEventListener('click', () => res(null), { once: true });
    for (const li of panel.querySelectorAll<HTMLElement>('[data-card]')) {
      li.addEventListener('click', () => res(li.dataset.card ?? null), { once: true });
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') res(li.dataset.card ?? null); });
    }
  });
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
}

/**
 * 팩 개봉/선택권 공개. 결과는 이미 정해진 cards 를 보여 주기만 한다.
 * 연출이 꺼져 있거나 이미 하나가 떠 있으면 false (아무것도 안 함). 끝까지(또는 건너뛰기 뒤 결과 확인까지) 기다린 뒤 true
 */
export async function playPackReveal(o: { pack: PackInfo; cards: AnimCard[]; results?: boolean; force?: 'full' | 'short'; onPick?: (id: string) => void }): Promise<boolean> {
  const mode = o.force ?? resolveMode(loadPackAnimPref(), reduced());
  if (mode === 'off' || open || !o.cards.length || typeof document === 'undefined') return false;
  open = true;
  let picked: string | null = null;
  const best = bestRarity(o.cards.map((c) => c.rarity));
  const ov = document.createElement('div');
  ov.className = `pk-ov pk-r--${best}`;
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-label', o.pack.kind === 'pick' ? '카드 선택권 공개' : '카드팩 개봉');
  ov.style.setProperty('--pk-c', RARITY_FX[best].color);
  ov.innerHTML = `<div class="pk-stage"></div><button type="button" class="pk-skip">건너뛰기 ›</button>`;
  document.body.append(ov);
  const anim = createPackAnimation();
  const skipBtn = ov.querySelector<HTMLElement>('.pk-skip')!;
  const skip = () => anim.skip();
  const esc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') skip();
  };
  skipBtn.addEventListener('click', skip);
  globalThis.addEventListener('keydown', esc);
  // 덮개 안 클릭이 게임 화면의 data-act 처리로 새지 않게
  ov.addEventListener('click', (e) => e.stopPropagation());
  try {
    await anim.play({ pack: o.pack, cards: o.cards, bestRarity: best, mode, stage: ov.querySelector<HTMLElement>('.pk-stage')! });
    skipBtn.remove();
    if (o.results ?? o.pack.kind === 'pack') picked = await results(ov, o.pack, o.cards);
  } finally {
    globalThis.removeEventListener('keydown', esc);
    ov.remove();
    open = false;
  }
  if (picked) o.onPick?.(picked);
  return true;
}

export function packRevealOpen(): boolean {
  return open;
}
