// 팩 개봉 기본 연출 (C.76o): 코드로 그린 모션 그래픽 — CSS 3D transform + Web Animations API + Canvas 2D 입자.
// 흐름: 팩 등장(떠 있음·포일 반사광 기울기) → 탭/길게 누르기/위로 끌기 → 떨림(최고 희귀도 암시 번쩍) → 윗부분 찢어짐 → 빛 기둥
//       → (전설) 워크아웃 → 카드가 뒷면으로 날아와 줄 섬 → 탭마다/모두 열기로 3D 뒤집기 → [결과 보기]/[고르기].
// 선택권(kind 'pick')은 팩 없이 가운데 빛 → 공개. 결과·확률은 이미 정해진 값을 보여 주기만 한다.

import { RARITY_FX, RARITY_KO, burstCount, rarityRank } from './model';
import { Particles } from './particles';
import { Run } from './run';
import { sfx } from './sound';
import type { AnimCard, PackAnimation, PackAnimOptions } from './types';

const HOVER = () => globalThis.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false;

/** 포일 팩 그림 (200×300). 윗부분(찢겨 나갈 띠)과 몸통을 따로 그린다 */
function packSvg(name: string, part: 'top' | 'body'): string {
  // 찢는 선: 지그재그 (y 44~50)
  const pts: string[] = [];
  for (let x = 0; x <= 200; x += 10) pts.push(`${x} ${x % 20 ? 50 : 44}`);
  const zig = `M${pts.join(' L')}`;
  const defs = `<defs>
    <linearGradient id="pk-foil-${part}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1b1f27"/><stop offset=".45" stop-color="#2c3340"/><stop offset=".55" stop-color="#3a4252"/><stop offset="1" stop-color="#14171d"/>
    </linearGradient>
    <linearGradient id="pk-acc-${part}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="var(--pk-acc)" stop-opacity=".2"/><stop offset=".5" stop-color="var(--pk-acc)"/><stop offset="1" stop-color="var(--pk-acc)" stop-opacity=".2"/>
    </linearGradient>
  </defs>`;
  // 위·아래 톱니(크림프)
  let crimp = '';
  for (let x = 4; x < 200; x += 8) crimp += `M${x} 2v10 `;
  if (part === 'top') {
    return `<svg viewBox="0 0 200 300" aria-hidden="true">${defs}
      <path d="M0 6 Q0 0 6 0 H194 Q200 0 200 6 L${[...pts].reverse().join(' L')} Z" fill="url(#pk-foil-top)"/>
      <path d="${crimp}" stroke="#ffffff" stroke-opacity=".18" stroke-width="2"/>
      <rect x="0" y="22" width="200" height="4" fill="url(#pk-acc-top)"/>
      <text x="100" y="40" text-anchor="middle" font-size="8" font-weight="800" letter-spacing="3" fill="#ffffff" fill-opacity=".5">TEAR HERE</text>
    </svg>`;
  }
  let crimpB = '';
  for (let x = 4; x < 200; x += 8) crimpB += `M${x} 288v10 `;
  return `<svg viewBox="0 0 200 300" aria-hidden="true">${defs}
    <path d="${zig} V294 Q200 300 194 300 H6 Q0 300 0 294 Z" fill="url(#pk-foil-body)"/>
    <path d="M0 290 L120 60 L150 60 L24 300 H0Z M70 300 L200 76 V96 L82 300Z" fill="#ffffff" fill-opacity=".04"/>
    <path d="${crimpB}" stroke="#ffffff" stroke-opacity=".18" stroke-width="2"/>
    <rect x="0" y="270" width="200" height="4" fill="url(#pk-acc-body)"/>
    <circle cx="100" cy="150" r="52" fill="none" stroke="var(--pk-acc)" stroke-width="3"/>
    <circle cx="100" cy="150" r="44" fill="var(--pk-acc)" fill-opacity=".1"/>
    <text x="100" y="166" text-anchor="middle" font-size="46" font-weight="900" font-style="italic" fill="var(--pk-acc)">P1</text>
    <text x="100" y="84" text-anchor="middle" font-size="15" font-weight="900" font-style="italic" letter-spacing="2" fill="#ffffff">PLAYER ONE</text>
    <text x="100" y="232" text-anchor="middle" font-size="14" font-weight="800" fill="#ffffff">${name.replace(/[<&>"]/g, '')}</text>
    <text x="100" y="252" text-anchor="middle" font-size="9" font-weight="700" letter-spacing="2" fill="#ffffff" fill-opacity=".55">CARD PACK</text>
  </svg>`;
}

/** 카드 뒷면 */
const BACK = `<div class="pk-card__back"><span class="pk-card__emb">P1</span></div>`;

/** 카드 크기 배율: 팩 3장 기준 폰 ≈0.4, PC ≈0.72 */
export function cardScale(w: number, h: number, n: number): number {
  const avail = Math.min(w, 1100) - 32 - 10 * (n - 1);
  return Math.max(0.3, Math.min(0.72, avail / (n * 280), (h * 0.5) / 392));
}

/** 카드 공개 단계 (영상·시퀀스 어댑터도 끝난 뒤 이걸 쓴다) */
export async function revealCards(run: Run, scene: HTMLElement, fx: Particles, o: PackAnimOptions, from: { x: number; y: number }): Promise<void> {
  const short = o.mode === 'short';
  const cards = o.cards;
  const W = scene.clientWidth;
  const H = scene.clientHeight;
  const s = cardScale(W, H, cards.length);
  const row = document.createElement('div');
  row.className = 'pk-row';
  row.style.setProperty('--s', String(s));
  row.innerHTML = cards.map((c, i) => `<button type="button" class="pk-card pk-r--${c.rarity}" data-i="${i}" aria-label="카드 ${i + 1} 뒤집기">
      <span class="pk-card__in">${BACK}<span class="pk-card__front">${c.html}${RARITY_FX[c.rarity].holo ? '<span class="pk-holo"></span>' : ''}</span></span>
    </button>`).join('');
  const bar = document.createElement('div');
  bar.className = 'pk-actions';
  bar.innerHTML = `<button type="button" class="pk-btn pk-btn--ghost" data-k="all">모두 열기</button>`;
  scene.append(row);
  const els = [...row.querySelectorAll<HTMLElement>('.pk-card')];
  // 날아와 줄 서기
  sfx('deal');
  await Promise.all(els.map((el, i) => {
    const r = el.getBoundingClientRect();
    const sr = scene.getBoundingClientRect();
    const dx = from.x - (r.left - sr.left + r.width / 2);
    const dy = from.y - (r.top - sr.top + r.height / 2);
    return run.anim(el, [
      { transform: `translate(${dx}px, ${dy}px) scale(.3) rotate(${(i - 1) * 25}deg)`, opacity: 0 },
      { opacity: 1, offset: 0.25 },
      { transform: 'none', opacity: 1 },
    ], { duration: short ? 260 : 560, delay: i * (short ? 50 : 130), easing: 'cubic-bezier(.2,.9,.25,1.15)' });
  }));
  if (run.done) return;
  if (!short) scene.append(bar);
  const flipped = new Set<number>();
  let busy = Promise.resolve();
  const flip = (i: number): Promise<void> => {
    if (flipped.has(i) || run.done) return Promise.resolve();
    flipped.add(i);
    const el = els[i]!;
    const c = cards[i]!;
    const f = RARITY_FX[c.rarity];
    const go = async () => {
      if (f.holo && !short) {
        // 에픽 이상: 뒤집기 전 떨림 + 빛 테두리
        el.classList.add('is-charge');
        sfx('tremble', c.rarity);
        await run.anim(el, [0, 1, 2, 3, 4, 5, 6, 7, 8].map((k) => ({ transform: `translate(${k % 2 ? 2 : -2}px, ${k % 3 ? -1 : 1}px) rotate(${k % 2 ? 1 : -1}deg)` })).concat([{ transform: 'none' }]), { duration: 520, easing: 'linear', fill: 'none' });
      }
      sfx(f.holo ? 'flipRare' : 'flip', c.rarity);
      const inner = el.querySelector<HTMLElement>('.pk-card__in')!;
      const p = run.anim(inner, [{ transform: 'rotateY(0deg) scale(1)' }, { transform: 'rotateY(100deg) scale(1.08)', offset: 0.5 }, { transform: 'rotateY(180deg) scale(1)' }], { duration: short ? 260 : 620, easing: 'cubic-bezier(.3,.7,.3,1.2)' });
      await run.wait(short ? 120 : 300);
      el.classList.add('is-open');
      const r = el.getBoundingClientRect();
      const sr = scene.getBoundingClientRect();
      if (rarityRank(c.rarity) > 0 || !short) fx.burst(r.left - sr.left + r.width / 2, r.top - sr.top + r.height / 2, Math.round(burstCount(c.rarity, W, short) / 3), [f.color, '#ffffff']);
      if (f.shake && !short) void run.anim(scene, shakeKf(f.shake / 2), { duration: 300, fill: 'none' });
      await p;
    };
    // 한 장씩 차례로 (모두 열기도 순서대로)
    busy = busy.then(go);
    return busy;
  };
  if (short) {
    for (let i = 0; i < els.length; i++) void flip(i);
    await busy;
    await run.wait(450);
    return;
  }
  row.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.pk-card');
    if (b) void flip(Number(b.dataset.i));
  });
  await run.until((go) => {
    const allBtn = bar.querySelector<HTMLElement>('[data-k="all"]')!;
    allBtn.addEventListener('click', () => {
      allBtn.remove();
      for (let i = 0; i < els.length; i++) if (!flipped.has(i)) void flip(i);
    });
    // 다 뒤집히면 [결과 보기]/[고르기]
    const check = setInterval(() => {
      if (run.done) return clearInterval(check);
      if (flipped.size < els.length) return;
      clearInterval(check);
      void busy.then(() => {
        if (run.done) return;
        bar.innerHTML = `<button type="button" class="pk-btn" data-k="next">${o.pack.kind === 'pick' ? '고르기' : '결과 보기'}</button>`;
        bar.querySelector('button')!.addEventListener('click', go);
        bar.querySelector<HTMLElement>('button')!.focus();
      });
    }, 120);
  });
}

function shakeKf(a: number): Keyframe[] {
  const k: Keyframe[] = [];
  for (let i = 0; i < 8; i++) {
    const m = a * (1 - i / 8);
    k.push({ transform: `translate(${(i % 2 ? 1 : -1) * m}px, ${(i % 3 ? -1 : 1) * m * 0.6}px)` });
  }
  k.push({ transform: 'none' });
  return k;
}

/** 기울기: 마우스(PC) 위치 따라 팩이 기울고 반사광이 움직인다. 폰은 CSS 자동 흔들림 */
function tilt(scene: HTMLElement, pack: HTMLElement): () => void {
  if (!HOVER()) {
    pack.classList.add('is-sway');
    return () => undefined;
  }
  let raf = 0;
  let nx = 0;
  let ny = 0;
  const move = (e: PointerEvent) => {
    const r = scene.getBoundingClientRect();
    nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (!raf) raf = requestAnimationFrame(() => {
      raf = 0;
      pack.style.setProperty('--ry', `${(nx * 18).toFixed(1)}deg`);
      pack.style.setProperty('--rx', `${(-ny * 12).toFixed(1)}deg`);
      pack.style.setProperty('--gx', `${(50 + nx * 45).toFixed(0)}%`);
      pack.style.setProperty('--gy', `${(50 + ny * 45).toFixed(0)}%`);
    });
  };
  scene.addEventListener('pointermove', move);
  return () => {
    scene.removeEventListener('pointermove', move);
    if (raf) cancelAnimationFrame(raf);
  };
}

/** 탭 · 길게 누르기(0.45초) · 위로 끌기(30px) · Enter/Space — 무엇이든 개봉 */
function armOpen(scene: HTMLElement, go: () => void): void {
  let y0: number | null = null;
  let hold: ReturnType<typeof setTimeout> | null = null;
  let fired = false;
  const fire = () => {
    if (fired) return;
    fired = true;
    if (hold) clearTimeout(hold);
    scene.removeEventListener('pointerdown', down);
    scene.removeEventListener('pointermove', mv);
    scene.removeEventListener('pointerup', up);
    globalThis.removeEventListener('keydown', key);
    go();
  };
  const down = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('.pk-btn')) return;
    y0 = e.clientY;
    hold = setTimeout(fire, 450);
  };
  const mv = (e: PointerEvent) => {
    if (y0 !== null && y0 - e.clientY > 30) fire();
  };
  const up = (e: PointerEvent) => {
    if (hold) clearTimeout(hold);
    if (y0 !== null && !(e.target as HTMLElement).closest('.pk-btn')) fire();
    y0 = null;
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fire();
    }
  };
  scene.addEventListener('pointerdown', down);
  scene.addEventListener('pointermove', mv);
  scene.addEventListener('pointerup', up);
  globalThis.addEventListener('keydown', key);
}

/** 빛 기둥 + 입자 폭발 + 화면 흔들림 (+ 전설 워크아웃). 팩·선택권 공통 */
async function lightShow(run: Run, scene: HTMLElement, fx: Particles, o: PackAnimOptions, at: { x: number; y: number }): Promise<void> {
  const short = o.mode === 'short';
  const best = o.bestRarity;
  const f = RARITY_FX[best];
  const fancy = !!o.pack.fancy;
  const W = scene.clientWidth;
  sfx('beam', best);
  const beam = scene.querySelector<HTMLElement>('.pk-beam')!;
  beam.style.left = `${at.x}px`;
  beam.style.top = `${at.y}px`;
  // 선택권은 가운데에서 위아래로 (팩은 찢긴 입구에서 위로)
  beam.classList.toggle('is-both', o.pack.kind === 'pick');
  const strong = rarityRank(best) >= 2 || fancy;
  void run.anim(beam, [
    { transform: 'translateX(-50%) scaleY(0) scaleX(.4)', opacity: 0 },
    { transform: 'translateX(-50%) scaleY(1) scaleX(1)', opacity: 1, offset: 0.3 },
    { transform: `translateX(-50%) scaleY(1) scaleX(${strong ? 3.2 : 2})`, opacity: 0.85, offset: 0.7 },
    { transform: `translateX(-50%) scaleY(1) scaleX(${strong ? 5 : 3})`, opacity: 0 },
  ], { duration: short ? 520 : strong ? 1500 : 1000, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'none' });
  const mult = fancy ? 1.4 : 1;
  fx.burst(at.x, at.y, Math.round(burstCount(best, W, short) * mult), [f.color, '#ffffff', f.color], { speed: strong ? 9 : 6, up: strong ? 4 : 2 });
  const flash = scene.querySelector<HTMLElement>('.pk-flash')!;
  void run.anim(flash, [{ opacity: 0 }, { opacity: strong ? 0.75 : 0.4, offset: 0.15 }, { opacity: 0 }], { duration: short ? 300 : 700, fill: 'none' });
  const shake = f.shake || (fancy && rarityRank(best) >= 2 ? 5 : 0);
  if (shake && !short) void run.anim(scene, shakeKf(shake), { duration: 520, fill: 'none' });
  await run.wait(short ? 240 : strong ? 700 : 450);
  // 워크아웃: 전설(선택권은 화려한 에픽도) — 큰 희귀도 글자 + 빛줄기 쓸기 + 반짝이 상승
  if (!short && (f.walkout || (fancy && rarityRank(best) >= 2))) {
    sfx('walkout', best);
    const wk = scene.querySelector<HTMLElement>('.pk-walk')!;
    wk.querySelector('b')!.textContent = RARITY_KO[best];
    wk.querySelector('span')!.textContent = best === 'legendary' ? 'LEGENDARY' : 'EPIC';
    wk.hidden = false;
    // 팩은 먼저 빠진다 (글자와 겹치지 않게)
    const pw = scene.querySelector('.pk-packwrap');
    if (pw) void run.anim(pw, [{ opacity: 1 }, { opacity: 0, transform: 'scale(.9)' }], { duration: 220 });
    fx.rise(best === 'legendary' ? 70 : 40, [f.color, '#ffffff']);
    await Promise.all([
      run.anim(wk.querySelector('b')!, [
        { transform: 'scale(2.4)', opacity: 0, letterSpacing: '.6em' },
        { transform: 'scale(1)', opacity: 1, letterSpacing: '.08em', offset: 0.3 },
        { transform: 'scale(1.04)', opacity: 1, offset: 0.8 },
        { transform: 'scale(1.3)', opacity: 0 },
      ], { duration: 1500, easing: 'cubic-bezier(.2,.8,.3,1)' }),
      run.anim(wk.querySelector('span')!, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none', offset: 0.35 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1500 }),
      ...[...wk.querySelectorAll('i')].map((bar, k) => run.anim(bar, [{ transform: 'translateX(-120vw) skewX(-20deg)' }, { transform: 'translateX(120vw) skewX(-20deg)' }], { duration: 900, delay: k * 220, easing: 'cubic-bezier(.5,0,.5,1)' })),
    ]);
    wk.hidden = true;
  }
}

export function createMotionAnimation(): PackAnimation {
  let run: Run | null = null;
  return {
    async play(o) {
      const cur = new Run();
      run = cur;
      const stage = o.stage ?? document.body;
      const short = o.mode === 'short';
      const best = o.bestRarity;
      const f = RARITY_FX[best];
      const scene = document.createElement('div');
      scene.className = `pk-scene pk-r--${best}${o.pack.kind === 'pick' ? ' is-pick' : ''}`;
      scene.tabIndex = -1;
      scene.innerHTML = `<canvas class="pk-fx"></canvas><div class="pk-flash"></div><div class="pk-beam"></div>
        <div class="pk-walk" hidden><i></i><i></i><b></b><span></span></div>`;
      stage.append(scene);
      const fx = new Particles(scene.querySelector('canvas')!);
      const W = scene.clientWidth;
      const H = scene.clientHeight;
      let center = { x: W / 2, y: H * 0.45 };
      let untilt: () => void = () => undefined;
      try {
        if (o.pack.kind === 'pack') {
          // 1. 팩 등장
          const wrap = document.createElement('div');
          wrap.className = 'pk-packwrap';
          wrap.innerHTML = `<div class="pk-float"><div class="pk-aura"></div><div class="pk-pack"><div class="pk-pack__body">${packSvg(o.pack.name, 'body')}</div><div class="pk-pack__top">${packSvg(o.pack.name, 'top')}</div><div class="pk-glare"></div><div class="pk-slit"></div></div></div>`;
          const hint = document.createElement('p');
          hint.className = 'pk-hint';
          hint.textContent = HOVER() ? '클릭해서 열기 · 마우스로 기울여 보세요' : '탭해서 열기 · 위로 밀거나 길게 눌러도 돼요';
          scene.append(wrap, hint);
          const pack = wrap.querySelector<HTMLElement>('.pk-pack')!;
          sfx('appear');
          await cur.anim(wrap, [{ transform: 'translateY(60vh) rotate(-12deg) scale(.6)', opacity: 0 }, { transform: 'translateY(-3%) rotate(2deg) scale(1.03)', opacity: 1, offset: 0.75 }, { transform: 'none', opacity: 1 }], { duration: short ? 300 : 800, easing: 'cubic-bezier(.2,.9,.3,1)' });
          wrap.classList.add('is-float');
          untilt = tilt(scene, pack);
          scene.focus({ preventScroll: true });
          if (short) await cur.wait(200);
          else await cur.until((go) => armOpen(scene, go));
          if (cur.done) return;
          untilt();
          hint.remove();
          const pr = pack.getBoundingClientRect();
          const sr = scene.getBoundingClientRect();
          const tearY = pr.top - sr.top + pr.height * 0.16;
          center = { x: pr.left - sr.left + pr.width / 2, y: pr.top - sr.top + pr.height / 2 };
          // 2. 떨림 — 중간에 최고 희귀도 색으로 한 번 더 번쩍 (암시)
          sfx('tremble', best);
          const aura = wrap.querySelector<HTMLElement>('.pk-aura')!;
          const tr = short ? 200 : f.tremble;
          const kf: Keyframe[] = [];
          for (let i = 0; i <= 14; i++) {
            const a = 1 + (i / 14) * (rarityRank(best) + 2);
            kf.push({ transform: `translate(${(i % 2 ? 1 : -1) * a}px, ${(i % 3 ? 1 : -1) * a * 0.5}px) rotate(${(i % 2 ? 1 : -1) * a * 0.3}deg)` });
          }
          void cur.anim(aura, [{ opacity: 0.2, background: 'radial-gradient(closest-side, #ffffff55, transparent)' }, { opacity: 0.6, offset: 0.5 }, { opacity: 1, background: `radial-gradient(closest-side, ${f.color}aa, transparent)` }], { duration: tr });
          void cur.wait(tr * 0.6).then(() => {
            if (cur.done || short) return;
            void cur.anim(scene.querySelector('.pk-flash')!, [{ opacity: 0, background: f.color }, { opacity: 0.32, background: f.color, offset: 0.3 }, { opacity: 0, background: f.color }], { duration: 260, fill: 'none' });
          });
          await cur.anim(pack, kf, { duration: tr, easing: 'linear', fill: 'none' });
          if (cur.done) return;
          // 3. 윗부분 찢어짐 — 띠가 날아가고 조각이 흩어진다
          sfx('tear');
          pack.classList.add('is-torn');
          const top = pack.querySelector<HTMLElement>('.pk-pack__top')!;
          const slit = pack.querySelector<HTMLElement>('.pk-slit')!;
          void cur.anim(slit, [{ opacity: 0, transform: 'scaleX(.2)' }, { opacity: 1, transform: 'scaleX(1)' }], { duration: 160 });
          void cur.anim(top, [{ transform: 'none' }, { transform: 'translate(-8px,-14px) rotate(-6deg)', offset: 0.2 }, { transform: 'translate(-90px,-220px) rotate(-38deg)', opacity: 0 }], { duration: short ? 300 : 700, easing: 'cubic-bezier(.3,.6,.4,1)' });
          if (!short) {
            for (let k = 0; k < 7; k++) {
              const sh = document.createElement('i');
              sh.className = 'pk-shard';
              sh.style.left = `${pr.left - sr.left + (pr.width * (k + 0.5)) / 7}px`;
              sh.style.top = `${tearY}px`;
              scene.append(sh);
              const ang = -Math.PI / 2 + (k - 3) * 0.32 + (Math.random() - 0.5) * 0.3;
              const d = 140 + Math.random() * 120;
              void cur.anim(sh, [{ transform: 'none', opacity: 1 }, { transform: `translate(${Math.cos(ang) * d}px, ${Math.sin(ang) * d}px) rotate(${(Math.random() - 0.5) * 720}deg) scale(.4)`, opacity: 0 }], { duration: 700 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.4,1)' }).then(() => sh.remove());
            }
          }
          fx.burst(center.x, tearY, Math.round(burstCount('common', W, short) / 2), ['#ffffff', f.color], { spread: 1.6, speed: 5, up: 2 });
          await cur.wait(short ? 120 : 260);
          // 4. 빛 기둥 (최고 희귀도 색·세기)
          await lightShow(cur, scene, fx, o, { x: center.x, y: tearY });
          if (cur.done) return;
          // 팩 몸통은 아래로 빠진다
          void cur.anim(wrap, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(40vh) scale(.8)', opacity: 0 }], { duration: short ? 240 : 500, easing: 'cubic-bezier(.5,0,.8,.4)' });
        } else {
          // 선택권: 가운데 빛 구슬이 떨리다 터진다
          const orb = document.createElement('div');
          orb.className = 'pk-orb';
          scene.append(orb);
          center = { x: W / 2, y: H * 0.42 };
          orb.style.left = `${center.x}px`;
          orb.style.top = `${center.y}px`;
          sfx('tremble', best);
          await cur.anim(orb, [
            { transform: 'translate(-50%,-50%) scale(0)', background: 'radial-gradient(closest-side, #ffffff, #ffffff00)' },
            { transform: 'translate(-50%,-50%) scale(1)', offset: 0.4 },
            { transform: 'translate(-50%,-50%) scale(.85)', background: `radial-gradient(closest-side, #ffffff, ${f.color}, #ffffff00)`, offset: 0.75 },
            { transform: 'translate(-50%,-50%) scale(1.3)', background: `radial-gradient(closest-side, #ffffff, ${f.color}, #ffffff00)` },
          ], { duration: short ? 300 : o.pack.fancy ? 1000 : 700, easing: 'ease-in-out' });
          if (cur.done) return;
          void cur.anim(orb, [{ opacity: 1 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(3)' }], { duration: 400 });
          await lightShow(cur, scene, fx, o, center);
          if (cur.done) return;
        }
        // 5. 카드 공개
        await revealCards(cur, scene, fx, o, center);
      } finally {
        untilt();
        fx.stop();
        scene.remove();
        if (run === cur) run = null;
      }
    },
    skip() {
      run?.skip();
    },
  };
}

export type { AnimCard };
