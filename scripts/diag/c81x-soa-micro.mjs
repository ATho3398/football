// C.81x 마이크로 실험: moveAgentMV 와 같은 식을 "선수 객체 실수 필드(AoS)" 와 "Float64Array 구조체 배열(SoA)" 로 각각 돌려 시간을 비교한다.
// 결론: 같은 값(chk true)에 시간 차 0~4% — V8 이 실수 필드를 이미 제자리 상자(Double 표현)로 두어 상자 읽기가 병목이 아니다.
// 실행: node scripts/diag/c81x-soa-micro.mjs [반복=60000] (22명 × 반복 = 호출 수)
const P = { arriveDist: 0.3, walkDist: 2, jogDist: 8, runDist: 20, walk: 1.5, jog: 3.1, run: 5.5, farPace: 0.9, fatigueIntensity: 0.4, staminaLowFrom: 70, feed: 1, feedGain: 1.2, turnModel: 1, faceSpeed: 1.2, reverseBrake: 2, sprintRatio: 0.85, staminaRecover: 0.01, staminaDrain: 0.02, tiredMaxFloor: 0.85 };
const B = { on: 1, runCap: 0.8, lowFrom: 20, capFloor: 0.5, judgeLo: 20, judgeHi: 60, refillFloor: 0.5, refillSec: 20, walkMul: 1.5, jogMul: 1, runMul: 0.5, outUntil: 40 };
const L = 105, W = 68;
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
const N = 22;
// ---- AoS ----
function mkA(i) { return { idx: i, line: i % 11 === 0 ? 0 : 2, x: 10 + i * 4, y: 30 + (i % 3) * 5, vx: 0, vy: 0, tx: 50, ty: 34, tvx: 0, tvy: 0, hx: 1, hy: 0, hMx: NaN, hMy: NaN, hA: 0, urgent: false, maxSpeed: 8, accel: 4, turnKeep: 0.6, pivotT: 0.6, burstSec: 5, drainAttr: 1, stamina: 95, burst: 100, burstOut: false, paceCap: 0, minRun: false, sprinting: false, drainMul: 1, distance: 0, sprints: 0, f1: 0.5, f2: 0.5, f3: 0.5, f4: 0.5, s1: 'x', o1: null }; }
const MV = { dt: 0.1, speedScale: 1, drainScale: 1, recoverScale: 1, lookX: 52, lookY: 34, fatigueExtra: 0, fatigueExp: 1, ux: 0, uy: 0 };
function effMax(a) { let v = a.stamina >= P.staminaLowFrom ? a.maxSpeed : a.maxSpeed * (P.tiredMaxFloor + ((1 - P.tiredMaxFloor) * a.stamina) / P.staminaLowFrom); if (B.on > 0 && (a.burstOut || a.burst < B.lowFrom)) { const lim = a.maxSpeed * B.runCap; if (v > lim) v = a.burstOut ? lim : lim + ((v - lim) * Math.max(0, a.burst)) / B.lowFrom; } return v; }
function effAcc(a) { if (B.on <= 0 || a.stamina >= P.staminaLowFrom) return a.accel; return a.accel * (0.6 + 0.4 * Math.max(0, a.stamina) / P.staminaLowFrom); }
function desired(a, d, cap, fe, fx, accel) { if (d < P.arriveDist) return 0; let v; if (a.urgent) v = d < P.walkDist ? P.jog : cap; else if (d < P.walkDist) v = P.walk; else if (d < P.jogDist) v = P.jog; else if (d < P.runDist) v = P.run; else v = Math.max(P.run, cap * P.farPace); if (!a.urgent && a.paceCap > 0) v = Math.min(v, a.paceCap); if (a.minRun && d >= P.walkDist) v = Math.max(v, P.run); if (v > P.walk && a.stamina < P.staminaLowFrom) { const r = (P.staminaLowFrom - a.stamina) / P.staminaLowFrom; v *= 1 - P.fatigueIntensity * r; } v = Math.min(v, Math.sqrt(2 * accel * d), cap); return v; }
function turnHead(a) { const ux = MV.ux, uy = MV.uy, dt = MV.dt; const step = (Math.PI / a.pivotT) * dt; if (a.hx !== a.hMx || a.hy !== a.hMy) { a.hMx = a.hx; a.hMy = a.hy; a.hA = Math.atan2(a.hy, a.hx); } const cur = a.hA; let diff = Math.atan2(uy, ux) - cur; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI; const ang = cur + Math.sign(diff || 1) * Math.min(Math.abs(diff), step); a.hx = Math.cos(ang); a.hy = Math.sin(ang); }
function move(a) {
  const dt = MV.dt, speedScale = MV.speedScale, drainScale = MV.drainScale, recoverScale = MV.recoverScale, lookX = MV.lookX, lookY = MV.lookY;
  const cap = effMax(a) * speedScale; const accel = effAcc(a);
  const fx = a.tvx * P.feed, fy = a.tvy * P.feed; const feeding = fx !== 0 || fy !== 0;
  const dx = a.tx - a.x, dy = a.ty - a.y; const d = Math.sqrt(dx * dx + dy * dy);
  let corr = desired(a, d, cap, 0, 1, accel);
  if (feeding && d >= P.arriveDist) corr = Math.max(corr, Math.min(P.feedGain * d, Math.sqrt(2 * accel * d), cap));
  let wx = 0, wy = 0; if (corr > 0 && d > 1e-6) { wx = (dx / d) * corr; wy = (dy / d) * corr; }
  let want = corr; if (feeding) { wx += fx; wy += fy; want = Math.sqrt(wx * wx + wy * wy); if (want > cap) { wx *= cap / want; wy *= cap / want; want = cap; } }
  const sp = Math.sqrt(a.vx * a.vx + a.vy * a.vy); let reversing = false;
  let ux = 0, uy = 0; if (want > 0) { ux = wx / want; uy = wy / want; reversing = sp > P.faceSpeed && a.vx * ux + a.vy * uy < 0; }
  if (reversing) { MV.ux = ux; MV.uy = uy; turnHead(a); } else if (sp > P.faceSpeed) { a.hx = a.vx / sp; a.hy = a.vy / sp; } else if (want > P.walk + 1e-9 && a.hx * ux + a.hy * uy < 0 && a.line !== 0) { MV.ux = ux; MV.uy = uy; turnHead(a); wx = 0; wy = 0; want = 0; } else if (want > P.walk + 1e-9) { MV.ux = ux; MV.uy = uy; turnHead(a); } else if (Number.isFinite(lookX)) { const lx = lookX - a.x, ly = lookY - a.y; const ld = Math.sqrt(lx * lx + ly * ly); if (ld > 1) { MV.ux = lx / ld; MV.uy = ly / ld; turnHead(a); } }
  let ax = wx - a.vx, ay = wy - a.vy; const am = Math.sqrt(ax * ax + ay * ay); const brake = P.reverseBrake * a.turnKeep; const maxDv = (reversing || want < sp ? accel * brake : accel) * dt;
  if (am > maxDv) { ax = (ax / am) * maxDv; ay = (ay / am) * maxDv; }
  a.vx += ax; a.vy += ay; a.x = clamp(a.x + a.vx * dt, -2, L + 2); a.y = clamp(a.y + a.vy * dt, -2, W + 2);
  if (feeding) { a.tx = clamp(a.tx + fx * dt, 0.3, L - 0.3); a.ty = clamp(a.ty + fy * dt, 0.3, W - 0.3); }
  const v = Math.sqrt(a.vx * a.vx + a.vy * a.vy); a.distance += v * dt; const sprinting = v > a.maxSpeed * P.sprintRatio; if (sprinting && !a.sprinting) a.sprints++; a.sprinting = sprinting;
  const lim = a.maxSpeed * B.runCap, hi = a.maxSpeed * P.sprintRatio;
  if (v > lim + 1e-9) { a.burst = Math.max(0, a.burst - (100 / a.burstSec) * (sprinting ? 1 : (v - lim) / (hi - lim)) * dt); if (a.burst <= 0) a.burstOut = true; }
  else { const top = 100 * (B.capFloor + ((1 - B.capFloor) * Math.max(0, Math.min(100, a.stamina))) / 100); if (a.burst < top) { const mul = v < P.walk * 1.1 ? B.walkMul : v < P.jog * 1.1 ? B.jogMul : B.runMul; const st = B.refillFloor + ((1 - B.refillFloor) * Math.max(0, Math.min(100, a.stamina))) / 100; a.burst = Math.min(top, a.burst + (100 / B.refillSec) * mul * st * recoverScale * dt); } else a.burst = top; if (a.burstOut && a.burst >= Math.min(B.outUntil, top)) a.burstOut = false; }
  const ratio = v / a.maxSpeed; if (v < P.walk * 1.1) a.stamina = Math.min(100, a.stamina + P.staminaRecover * recoverScale * dt * 10); else a.stamina = Math.max(0, a.stamina - ratio * ratio * P.staminaDrain * a.drainMul * drainScale * a.drainAttr * dt * 10);
}
// ---- SoA ----
const X=0,Y=1,VX=2,VY=3,TX=4,TY=5,TVX=6,TVY=7,HX=8,HY=9,HMX=10,HMY=11,HA=12,MAXS=13,ACC=14,TK=15,PIV=16,BSEC=17,DATTR=18,STA=19,BUR=20,PCAP=21,DMUL=22,DIST=23,STRIDE=24;
const F = new Float64Array(STRIDE * N);
function mkS(i) { const o = i * STRIDE; F[o+X]=10+i*4; F[o+Y]=30+(i%3)*5; F[o+TX]=50; F[o+TY]=34; F[o+HX]=1; F[o+HMX]=NaN; F[o+HMY]=NaN; F[o+MAXS]=8; F[o+ACC]=4; F[o+TK]=0.6; F[o+PIV]=0.6; F[o+BSEC]=5; F[o+DATTR]=1; F[o+STA]=95; F[o+BUR]=100; F[o+DMUL]=1; return { idx: i, o, line: i % 11 === 0 ? 0 : 2, urgent: false, burstOut: false, minRun: false, sprinting: false, sprints: 0, s1: 'x', o1: null }; }
function effMaxS(a, o) { const sta = F[o+STA], ms = F[o+MAXS]; let v = sta >= P.staminaLowFrom ? ms : ms * (P.tiredMaxFloor + ((1 - P.tiredMaxFloor) * sta) / P.staminaLowFrom); const bu = F[o+BUR]; if (B.on > 0 && (a.burstOut || bu < B.lowFrom)) { const lim = ms * B.runCap; if (v > lim) v = a.burstOut ? lim : lim + ((v - lim) * Math.max(0, bu)) / B.lowFrom; } return v; }
function effAccS(a, o) { const sta = F[o+STA]; if (B.on <= 0 || sta >= P.staminaLowFrom) return F[o+ACC]; return F[o+ACC] * (0.6 + 0.4 * Math.max(0, sta) / P.staminaLowFrom); }
function desiredS(a, o, d, cap, accel) { if (d < P.arriveDist) return 0; let v; if (a.urgent) v = d < P.walkDist ? P.jog : cap; else if (d < P.walkDist) v = P.walk; else if (d < P.jogDist) v = P.jog; else if (d < P.runDist) v = P.run; else v = Math.max(P.run, cap * P.farPace); const pc = F[o+PCAP]; if (!a.urgent && pc > 0) v = Math.min(v, pc); if (a.minRun && d >= P.walkDist) v = Math.max(v, P.run); const sta = F[o+STA]; if (v > P.walk && sta < P.staminaLowFrom) { const r = (P.staminaLowFrom - sta) / P.staminaLowFrom; v *= 1 - P.fatigueIntensity * r; } v = Math.min(v, Math.sqrt(2 * accel * d), cap); return v; }
function turnHeadS(a, o) { const ux = MV.ux, uy = MV.uy, dt = MV.dt; const step = (Math.PI / F[o+PIV]) * dt; const hx = F[o+HX], hy = F[o+HY]; if (hx !== F[o+HMX] || hy !== F[o+HMY]) { F[o+HMX] = hx; F[o+HMY] = hy; F[o+HA] = Math.atan2(hy, hx); } const cur = F[o+HA]; let diff = Math.atan2(uy, ux) - cur; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI; const ang = cur + Math.sign(diff || 1) * Math.min(Math.abs(diff), step); F[o+HX] = Math.cos(ang); F[o+HY] = Math.sin(ang); }
function moveS(a) {
  const o = a.o; const dt = MV.dt, speedScale = MV.speedScale, drainScale = MV.drainScale, recoverScale = MV.recoverScale, lookX = MV.lookX, lookY = MV.lookY;
  const cap = effMaxS(a, o) * speedScale; const accel = effAccS(a, o);
  const fx = F[o+TVX] * P.feed, fy = F[o+TVY] * P.feed; const feeding = fx !== 0 || fy !== 0;
  let x = F[o+X], y = F[o+Y], vx = F[o+VX], vy = F[o+VY];
  const dx = F[o+TX] - x, dy = F[o+TY] - y; const d = Math.sqrt(dx * dx + dy * dy);
  let corr = desiredS(a, o, d, cap, accel);
  if (feeding && d >= P.arriveDist) corr = Math.max(corr, Math.min(P.feedGain * d, Math.sqrt(2 * accel * d), cap));
  let wx = 0, wy = 0; if (corr > 0 && d > 1e-6) { wx = (dx / d) * corr; wy = (dy / d) * corr; }
  let want = corr; if (feeding) { wx += fx; wy += fy; want = Math.sqrt(wx * wx + wy * wy); if (want > cap) { wx *= cap / want; wy *= cap / want; want = cap; } }
  const sp = Math.sqrt(vx * vx + vy * vy); let reversing = false;
  let ux = 0, uy = 0; if (want > 0) { ux = wx / want; uy = wy / want; reversing = sp > P.faceSpeed && vx * ux + vy * uy < 0; }
  if (reversing) { MV.ux = ux; MV.uy = uy; turnHeadS(a, o); } else if (sp > P.faceSpeed) { F[o+HX] = vx / sp; F[o+HY] = vy / sp; } else if (want > P.walk + 1e-9 && F[o+HX] * ux + F[o+HY] * uy < 0 && a.line !== 0) { MV.ux = ux; MV.uy = uy; turnHeadS(a, o); wx = 0; wy = 0; want = 0; } else if (want > P.walk + 1e-9) { MV.ux = ux; MV.uy = uy; turnHeadS(a, o); } else if (Number.isFinite(lookX)) { const lx = lookX - x, ly = lookY - y; const ld = Math.sqrt(lx * lx + ly * ly); if (ld > 1) { MV.ux = lx / ld; MV.uy = ly / ld; turnHeadS(a, o); } }
  let ax = wx - vx, ay = wy - vy; const am = Math.sqrt(ax * ax + ay * ay); const brake = P.reverseBrake * F[o+TK]; const maxDv = (reversing || want < sp ? accel * brake : accel) * dt;
  if (am > maxDv) { ax = (ax / am) * maxDv; ay = (ay / am) * maxDv; }
  vx += ax; vy += ay; F[o+VX] = vx; F[o+VY] = vy; F[o+X] = clamp(x + vx * dt, -2, L + 2); F[o+Y] = clamp(y + vy * dt, -2, W + 2);
  if (feeding) { F[o+TX] = clamp(F[o+TX] + fx * dt, 0.3, L - 0.3); F[o+TY] = clamp(F[o+TY] + fy * dt, 0.3, W - 0.3); }
  const v = Math.sqrt(vx * vx + vy * vy); F[o+DIST] += v * dt; const ms = F[o+MAXS]; const sprinting = v > ms * P.sprintRatio; if (sprinting && !a.sprinting) a.sprints++; a.sprinting = sprinting;
  const lim = ms * B.runCap, hi = ms * P.sprintRatio; const sta = F[o+STA];
  if (v > lim + 1e-9) { const bu = Math.max(0, F[o+BUR] - (100 / F[o+BSEC]) * (sprinting ? 1 : (v - lim) / (hi - lim)) * dt); F[o+BUR] = bu; if (bu <= 0) a.burstOut = true; }
  else { const top = 100 * (B.capFloor + ((1 - B.capFloor) * Math.max(0, Math.min(100, sta))) / 100); let bu = F[o+BUR]; if (bu < top) { const mul = v < P.walk * 1.1 ? B.walkMul : v < P.jog * 1.1 ? B.jogMul : B.runMul; const st = B.refillFloor + ((1 - B.refillFloor) * Math.max(0, Math.min(100, sta))) / 100; bu = Math.min(top, bu + (100 / B.refillSec) * mul * st * recoverScale * dt); } else bu = top; F[o+BUR] = bu; if (a.burstOut && bu >= Math.min(B.outUntil, top)) a.burstOut = false; }
  const ratio = v / ms; if (v < P.walk * 1.1) F[o+STA] = Math.min(100, sta + P.staminaRecover * recoverScale * dt * 10); else F[o+STA] = Math.max(0, sta - ratio * ratio * P.staminaDrain * F[o+DMUL] * drainScale * F[o+DATTR] * dt * 10);
}
// ---- 실행: 목표를 가끔 바꿔 가며 (같은 난수열)
let seed = 12345; function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
const ITER = Number(process.argv[2] ?? 60000);
function runA() { const as = Array.from({ length: N }, (_, i) => mkA(i)); seed = 1; let chk = 0; const t = performance.now(); for (let k = 0; k < ITER; k++) { for (let i = 0; i < N; i++) { const a = as[i]; if (k % 25 === i) { a.tx = rnd() * L; a.ty = rnd() * W; a.urgent = rnd() < 0.3; a.tvx = rnd() < 0.5 ? 0 : rnd() - 0.5; a.tvy = a.tvx ? rnd() - 0.5 : 0; } move(a); } } for (const a of as) chk += a.x + a.y + a.stamina + a.burst + a.distance; return [performance.now() - t, chk]; }
function runS() { F.fill(0); const as = Array.from({ length: N }, (_, i) => mkS(i)); seed = 1; let chk = 0; const t = performance.now(); for (let k = 0; k < ITER; k++) { for (let i = 0; i < N; i++) { const a = as[i]; const o = a.o; if (k % 25 === i) { F[o+TX] = rnd() * L; F[o+TY] = rnd() * W; a.urgent = rnd() < 0.3; F[o+TVX] = rnd() < 0.5 ? 0 : rnd() - 0.5; F[o+TVY] = F[o+TVX] ? rnd() - 0.5 : 0; } moveS(a); } } for (const a of as) { const o = a.o; chk += F[o+X] + F[o+Y] + F[o+STA] + F[o+BUR] + F[o+DIST]; } return [performance.now() - t, chk]; }
for (let r = 0; r < 4; r++) { const a = runA(); const s = runS(); console.log(`AoS ${a[0].toFixed(0)}ms  SoA ${s[0].toFixed(0)}ms  (${(100 * (1 - s[0] / a[0])).toFixed(0)}%)  chk ${a[1] === s[1]}`); }
