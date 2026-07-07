// Mobile smoke: device matrix, zero console errors, canvas actually renders,
// and no overlap between touch controls and HUD blocks.
// Usage: node scripts/e2e-mobile.mjs   (BASE_URL env overrides http://localhost:3000)
import { chromium, devices } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Landscape phone matrix (the game locks to landscape) + one desktop control.
const MATRIX = [
  { name: 'iPhone SE (land)', viewport: { width: 667, height: 375 }, mobile: true },
  { name: 'iPhone 8 Plus (land)', viewport: { width: 736, height: 414 }, mobile: true },
  { name: 'iPhone 12 (land)', viewport: { width: 844, height: 390 }, mobile: true },
  { name: 'iPhone 14 Pro Max (land)', viewport: { width: 932, height: 430 }, mobile: true },
  { name: 'Desktop 1280', viewport: { width: 1280, height: 720 }, mobile: false },
];

const rect = async (loc) => (await loc.count()) ? loc.first().boundingBox() : null;
const overlaps = (a, b) =>
  !!a && !!b &&
  a.x < b.x + b.width && b.x < a.x + a.width &&
  a.y < b.y + b.height && b.y < a.y + a.height;

let failures = 0;
const fail = (msg) => { failures++; console.error(`  ✗ ${msg}`); };
const ok = (msg) => console.log(`  ✓ ${msg}`);

const browser = await chromium.launch();
for (const dev of MATRIX) {
  console.log(`\n[${dev.name}] ${dev.viewport.width}x${dev.viewport.height}`);
  const ctx = await browser.newContext({
    viewport: dev.viewport,
    hasTouch: dev.mobile,
    isMobile: dev.mobile,
    userAgent: dev.mobile ? devices['iPhone 12'].userAgent : undefined,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });
    // force: the buttons carry infinite pulse animations, so Playwright's stability
    // check never settles; the elements are genuinely clickable.
    await page.getByRole('button', { name: /daily shift/i }).click({ timeout: 10000, force: true });
    await page.getByRole('button', { name: /start patrol/i }).click({ timeout: 10000, force: true });
    // Countdown (4s) then a few seconds of play so the sim + weather + traffic all run.
    await page.waitForTimeout(7000);

    // Canvas renders something non-background.
    const painted = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      if (!c) return false;
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let distinct = new Set();
      for (let i = 0; i < d.length; i += 4096) distinct.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
      return distinct.size > 3;
    });
    painted ? ok('canvas painted') : fail('canvas appears blank');

    if (dev.mobile) {
      // Touch controls present?
      // roledescription only: the canvas aria-label also mentions "joystick".
      const joystick = page.locator('[aria-roledescription="joystick"]');
      (await joystick.count()) ? ok('joystick present') : fail('joystick missing');

      // Overlap matrix: action buttons + joystick vs HUD blocks (minimap, score box, compact bar).
      const controls = {
        joystick: await rect(joystick),
        rids: await rect(page.getByRole('button', { name: /rids/i })),
        boost: await rect(page.getByRole('button', { name: /boost/i })),
        siren: await rect(page.getByRole('button', { name: /siren/i })),
        assist: await rect(page.getByRole('button', { name: /assist|colleague/i })),
      };
      const scoreBox = await rect(page.getByTestId('hud-score'));
      const minimapBox = await rect(page.getByTestId('hud-minimap'));
      if (!scoreBox) fail('hud-score box missing');
      if (!minimapBox) fail('hud-minimap box missing');

      let overlapFound = false;
      for (const [name, box] of Object.entries(controls)) {
        if (!box) continue;
        if (overlaps(box, scoreBox)) { overlapFound = true; fail(`${name} overlaps score box`); }
        if (overlaps(box, minimapBox)) { overlapFound = true; fail(`${name} overlaps minimap`); }
      }
      if (!overlapFound) ok('no control/HUD overlaps');
    }

    const realErrors = errors.filter((e) => !e.includes('favicon') && !e.includes('manifest'));
    realErrors.length === 0 ? ok('zero console errors') : fail(`console errors: ${realErrors.slice(0, 3).join(' | ')}`);
  } catch (e) {
    fail(`flow failed: ${String(e).slice(0, 200)}`);
  }
  await ctx.close();
}
await browser.close();

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
