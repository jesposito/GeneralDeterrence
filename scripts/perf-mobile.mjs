// Frame-time measurement on emulated mid-tier mobile: iPhone-12-class viewport,
// 4x CPU throttle, driving through a fixed Holiday Peak worst case.
// Usage: node scripts/perf-mobile.mjs
// BASE_URL, THROTTLE, SECONDS, DPR, and P95_BUDGET_MS are configurable.
import { chromium, devices } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const THROTTLE = Number(process.env.THROTTLE || 4);
const SECONDS = Number(process.env.SECONDS || 12);
const DPR = Number(process.env.DPR || 2);
const P95_BUDGET_MS = Number(process.env.P95_BUDGET_MS || 33.6);

for (const [name, value] of Object.entries({ THROTTLE, SECONDS, DPR, P95_BUDGET_MS })) {
  if (!Number.isFinite(value) || value <= 0) {
    console.error(`${name} must be a positive number (received ${value}).`);
    process.exit(2);
  }
}

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: DPR,
    hasTouch: true,
    isMobile: true,
    userAgent: devices['iPhone 12'].userAgent,
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

  // Seed 1 on this day deterministically selects Holiday Peak (80 initial cars).
  // Intercept only the run grant so the performance gate cannot change with the calendar.
  await page.route('**/api/runs', (route) => route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({
      token: 'p'.repeat(43),
      mode: 'daily',
      day: '2026-07-15',
      seed: 1,
      attempt: 1,
    }),
  }));

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
      const tick = (time) => {
        deltas.push(time - last);
        last = time;
        if (deltas.length >= seconds * 60) return resolve(null);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      setTimeout(resolve, seconds * 1000 + 2000); // hard stop even below 60fps
    });
    deltas.shift();
    if (!deltas.length) throw new Error('No animation frames were sampled');
    const sorted = [...deltas].sort((a, b) => a - b);
    const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
    const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    return {
      frames: deltas.length,
      avg: +avg.toFixed(2),
      p50: +pct(0.5).toFixed(2),
      p95: +pct(0.95).toFixed(2),
      p99: +pct(0.99).toFixed(2),
      over16: +(deltas.filter((delta) => delta > 16.8).length / deltas.length * 100).toFixed(1),
      over33: +(deltas.filter((delta) => delta > 33.6).length / deltas.length * 100).toFixed(1),
    };
  }, SECONDS);

  await page.keyboard.up('w');
  console.log(`Holiday Peak worst case, CPU throttle ${THROTTLE}x, viewport 844x390, DPR ${DPR}, ${SECONDS}s driving:`);
  console.log(JSON.stringify(stats, null, 1));
  console.log(stats.p95 <= 16.8 ? 'VERDICT: 60fps at p95' : stats.p95 <= 33.6 ? 'VERDICT: 30-60fps at p95' : 'VERDICT: below 30fps at p95');
  if (stats.p95 > P95_BUDGET_MS) {
    console.error(`PERF BUDGET FAILED: p95 ${stats.p95}ms > ${P95_BUDGET_MS}ms`);
    process.exitCode = 1;
  } else {
    console.log(`PERF BUDGET PASS: p95 ${stats.p95}ms <= ${P95_BUDGET_MS}ms`);
  }
} finally {
  await browser.close();
}
