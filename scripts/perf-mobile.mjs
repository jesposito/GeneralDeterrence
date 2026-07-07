// Frame-time measurement on emulated mid-tier mobile: iPhone-12-class viewport,
// 4x CPU throttle, driving through traffic. Honest numbers, before/after fixes.
// Usage: node scripts/perf-mobile.mjs   (BASE_URL, THROTTLE, SECONDS env overrides)
import { chromium, devices } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const THROTTLE = Number(process.env.THROTTLE || 4);
const SECONDS = Number(process.env.SECONDS || 12);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 844, height: 390 },
  hasTouch: true,
  isMobile: true,
  userAgent: devices['iPhone 12'].userAgent,
});
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

await page.goto(BASE_URL, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /daily shift/i }).click({ force: true });
await page.getByRole('button', { name: /start patrol/i }).click({ force: true });
await page.waitForTimeout(5000); // countdown + settle

// Drive forward the whole window so the camera moves through traffic (worst case).
await page.keyboard.down('w');

const stats = await page.evaluate(async (seconds) => {
  const deltas = [];
  let last = performance.now();
  await new Promise((resolve) => {
    const tick = (t) => {
      deltas.push(t - last);
      last = t;
      if (deltas.length >= seconds * 60) return resolve(null);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    setTimeout(resolve, seconds * 1000 + 2000); // hard stop even if throttled below 60fps
  });
  deltas.shift();
  const sorted = [...deltas].sort((a, b) => a - b);
  const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  return {
    frames: deltas.length,
    avg: +avg.toFixed(2),
    p50: +pct(0.5).toFixed(2),
    p95: +pct(0.95).toFixed(2),
    p99: +pct(0.99).toFixed(2),
    over16: +(deltas.filter((d) => d > 16.8).length / deltas.length * 100).toFixed(1),
    over33: +(deltas.filter((d) => d > 33.6).length / deltas.length * 100).toFixed(1),
  };
}, SECONDS);

await page.keyboard.up('w');
console.log(`CPU throttle ${THROTTLE}x, viewport 844x390, ${SECONDS}s driving:`);
console.log(JSON.stringify(stats, null, 1));
console.log(stats.p95 <= 16.8 ? 'VERDICT: 60fps at p95' : stats.p95 <= 33.6 ? 'VERDICT: 30-60fps at p95' : 'VERDICT: below 30fps at p95');
await browser.close();
