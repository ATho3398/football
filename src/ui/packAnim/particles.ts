// 팩 개봉 입자 (C.76o): Canvas 2D 하나, 입자 상한(model.particleCap), DPR 1.5 상한. 입자가 없으면 그리기 루프를 멈춘다

import { particleCap } from './model';

interface P { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; spark: boolean }

export class Particles {
  private ctx: CanvasRenderingContext2D | null;
  private ps: P[] = [];
  private raf = 0;
  private last = 0;
  private w = 0;
  private h = 0;
  private cap: number;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d');
    this.resize();
    this.cap = particleCap(this.w);
  }

  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(1.5, globalThis.devicePixelRatio || 1);
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** 한 점에서 사방으로 폭발 (up > 0 이면 위쪽으로 치우침) */
  burst(x: number, y: number, n: number, colors: string[], o: { speed?: number; up?: number; spread?: number } = {}): void {
    const sp = o.speed ?? 6;
    for (let i = 0; i < n && this.ps.length < this.cap; i++) {
      const a = o.spread !== undefined ? -Math.PI / 2 + (Math.random() - 0.5) * o.spread : Math.random() * Math.PI * 2;
      const v = sp * (0.35 + Math.random() * 0.9);
      const max = 0.7 + Math.random() * 0.9;
      this.ps.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up ?? 0) * Math.random(), life: max, max,
        size: 1.2 + Math.random() * 2.6, color: colors[i % colors.length]!, spark: Math.random() < 0.35,
      });
    }
    this.start();
  }

  /** 화면 아래에서 위로 떠오르는 반짝이 (워크아웃) */
  rise(n: number, colors: string[]): void {
    for (let i = 0; i < n && this.ps.length < this.cap; i++) {
      const max = 1 + Math.random() * 1.2;
      this.ps.push({
        x: Math.random() * this.w, y: this.h + 10, vx: (Math.random() - 0.5) * 0.6, vy: -(3 + Math.random() * 5), life: max, max,
        size: 1 + Math.random() * 2, color: colors[i % colors.length]!, spark: true,
      });
    }
    this.start();
  }

  get count(): number {
    return this.ps.length;
  }

  private start(): void {
    if (this.raf || !this.ctx) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (t: number): void => {
    const ctx = this.ctx!;
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.globalCompositeOperation = 'lighter';
    const k = dt * 60;
    let j = 0;
    for (const p of this.ps) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy += 0.12 * k;
      p.vx *= 1 - 0.015 * k;
      p.x += p.vx * k;
      p.y += p.vy * k;
      const a = p.life / p.max;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.spark) {
        // 진행 방향으로 늘어진 불티
        ctx.fillRect(p.x, p.y, p.size * 0.8, p.size * 3 * a + 1);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      this.ps[j++] = p;
    }
    this.ps.length = j;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.raf = j ? requestAnimationFrame(this.tick) : 0;
    if (!j) ctx.clearRect(0, 0, this.w, this.h);
  };

  stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.ps = [];
    this.ctx?.clearRect(0, 0, this.w, this.h);
  }
}
