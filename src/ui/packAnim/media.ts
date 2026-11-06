// 대체 연출 어댑터 (C.76o): 사용자가 public/anim/pack/ 에 넣은 영상(webm/mp4) 또는 PNG 시퀀스를 재생한다.
// 파일 이름 = model.videoFile / sequenceFrame (희귀도별). 다 보면 카드 공개(revealCards)를 이어서 하고(reveal 기본 켬),
// 파일을 못 읽으면 코드 모션 그래픽으로 돌아간다.

import { PACK_ANIM_DIR, sequenceFrame, videoFile } from './model';
import { createMotionAnimation, revealCards } from './motion';
import { Particles } from './particles';
import { Run } from './run';
import type { PackAnimation, PackAnimOptions } from './types';

const BASE = (): string => (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';

/** 영상·시퀀스 공통 틀: 무대에 media 를 깔고 재생 → 카드 공개. 실패하면 모션으로 */
function mediaAnimation(mount: (run: Run, box: HTMLElement, o: PackAnimOptions) => Promise<boolean>, reveal: boolean): PackAnimation {
  let run: Run | null = null;
  let fallback: PackAnimation | null = null;
  return {
    async play(o) {
      const cur = new Run();
      run = cur;
      const stage = o.stage ?? document.body;
      const scene = document.createElement('div');
      scene.className = `pk-scene pk-r--${o.bestRarity} is-media`;
      scene.innerHTML = '<div class="pk-media"></div><canvas class="pk-fx"></canvas>';
      stage.append(scene);
      const fx = new Particles(scene.querySelector('canvas')!);
      try {
        const ok = await mount(cur, scene.querySelector<HTMLElement>('.pk-media')!, o);
        if (cur.done) return;
        if (!ok) {
          scene.remove();
          fallback = createMotionAnimation();
          await fallback.play(o);
          return;
        }
        scene.querySelector('.pk-media')!.remove();
        if (reveal) await revealCards(cur, scene, fx, o, { x: scene.clientWidth / 2, y: scene.clientHeight * 0.45 });
      } finally {
        fx.stop();
        scene.remove();
        if (run === cur) run = null;
      }
    },
    skip() {
      run?.skip();
      fallback?.skip();
    },
  };
}

export function createVideoAnimation(c: { dir?: string; ext?: 'webm' | 'mp4'; sound?: boolean; reveal?: boolean }): PackAnimation {
  return mediaAnimation(async (run, box, o) => {
    const v = document.createElement('video');
    v.className = 'pk-video';
    v.playsInline = true;
    v.muted = !c.sound;
    v.preload = 'auto';
    v.src = `${BASE()}${videoFile(o.bestRarity, c.ext ?? 'webm', c.dir ?? PACK_ANIM_DIR)}`;
    box.append(v);
    let ok = true;
    await run.until((go) => {
      v.addEventListener('ended', go, { once: true });
      v.addEventListener('error', () => {
        ok = false;
        go();
      }, { once: true });
      v.play().catch(() => {
        // 소리 때문에 자동 재생이 막히면 음소거로 다시
        v.muted = true;
        v.play().catch(() => {
          ok = false;
          go();
        });
      });
    });
    v.pause();
    return ok;
  }, c.reveal ?? true);
}

export function createSequenceAnimation(c: { dir?: string; frames: number; fps?: number; reveal?: boolean }): PackAnimation {
  return mediaAnimation(async (run, box, o) => {
    const n = Math.max(1, c.frames);
    const imgs = Array.from({ length: n }, (_, i) => {
      const im = new Image();
      im.src = `${BASE()}${sequenceFrame(o.bestRarity, i, c.dir ?? PACK_ANIM_DIR)}`;
      return im;
    });
    // 첫 프레임을 못 읽으면 실패 → 모션
    const first = await new Promise<boolean>((res) => {
      imgs[0]!.onload = () => res(true);
      imgs[0]!.onerror = () => res(false);
    });
    if (!first || run.done) return first;
    await Promise.all(imgs.slice(1).map((im) => (im.complete ? null : new Promise((r) => { im.onload = r; im.onerror = r; }))));
    const cv = document.createElement('canvas');
    cv.className = 'pk-seq';
    cv.width = imgs[0]!.naturalWidth;
    cv.height = imgs[0]!.naturalHeight;
    box.append(cv);
    const ctx = cv.getContext('2d');
    const dt = 1000 / (c.fps ?? 30);
    for (let i = 0; i < n && !run.done; i++) {
      ctx?.clearRect(0, 0, cv.width, cv.height);
      if (imgs[i]!.naturalWidth) ctx?.drawImage(imgs[i]!, 0, 0);
      await run.wait(dt);
    }
    return true;
  }, c.reveal ?? true);
}
