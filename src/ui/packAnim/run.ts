// 연출 진행 도우미 (C.76o): 기다리기·WAAPI 재생을 모두 skip() 한 번에 끊는다

export class Run {
  done = false;
  private wakes = new Set<() => void>();
  private anims = new Set<Animation>();
  private timers = new Set<ReturnType<typeof setTimeout>>();

  /** ms 기다림 (건너뛰면 바로 풀림) */
  wait(ms: number): Promise<void> {
    if (this.done) return Promise.resolve();
    return new Promise((res) => {
      const t = setTimeout(() => {
        this.timers.delete(t);
        this.wakes.delete(res);
        res();
      }, ms);
      this.timers.add(t);
      this.wakes.add(res);
    });
  }

  /** WAAPI 한 번 재생, 끝나면 풀림. fill 기본 forwards */
  anim(el: Element, kf: Keyframe[] | PropertyIndexedKeyframes, o: KeyframeAnimationOptions): Promise<void> {
    if (this.done || typeof (el as HTMLElement).animate !== 'function') return Promise.resolve();
    const a = el.animate(kf, { fill: 'forwards', ...o });
    this.anims.add(a);
    return new Promise((res) => {
      const fin = () => {
        this.anims.delete(a);
        this.wakes.delete(res);
        res();
      };
      this.wakes.add(res);
      a.finished.then(fin, fin);
    });
  }

  /** 바깥 신호 기다리기 (탭 등): 신호를 부르는 함수를 넘긴다 */
  until(arm: (go: () => void) => void): Promise<void> {
    if (this.done) return Promise.resolve();
    return new Promise((res) => {
      this.wakes.add(res);
      arm(() => {
        this.wakes.delete(res);
        res();
      });
    });
  }

  skip(): void {
    if (this.done) return;
    this.done = true;
    for (const t of this.timers) clearTimeout(t);
    for (const a of this.anims) {
      try {
        a.finish();
      } catch {
        a.cancel();
      }
    }
    const w = [...this.wakes];
    this.wakes.clear();
    this.timers.clear();
    this.anims.clear();
    for (const f of w) f();
  }
}
