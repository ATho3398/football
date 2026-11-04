// C.81e 브라우저 워커 엔진 시간: Chromium Web Worker 에서 다른 팀 경기 N회. 먼저 esbuild scripts/diag/c81e-bench-worker.ts --bundle --platform=browser --format=iife --minify --outfile=<worker.js>
// 사용: node scripts/diag/c81e-worker-bench.mjs <worker.js> N
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const src = fs.readFileSync(process.argv[2], 'utf8');
const N = Number(process.argv[3] ?? 20);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('about:blank');
const res = await page.evaluate(async ({ src, N }) => {
  const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
  const w = new Worker(url);
  return await new Promise((r) => { w.onmessage = (e) => r(e.data); w.postMessage(N); });
}, { src, N });
const warm = res.times.slice(1);
const avg = warm.reduce((a, b) => a + b, 0) / warm.length;
const med = [...warm].sort((a, b) => a - b)[Math.floor(warm.length / 2)];
console.log(JSON.stringify({ n: N, cold: Math.round(res.times[0]), warmAvg: +avg.toFixed(1), warmMed: +med.toFixed(1), goals: res.goals }));
await browser.close();
