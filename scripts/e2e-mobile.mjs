// Mobile smoke: orientation/size matrix, rendered canvas, responsive dialogs,
// and no overlap between controls or independent HUD layers.
// Usage: BROWSER=chromium node scripts/e2e-mobile.mjs
// BASE_URL overrides http://localhost:3000; PWA=0 skips Chromium's offline reload check.
import { chromium, devices, firefox, webkit } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const BROWSER_TYPES = { chromium, firefox, webkit };
const requestedBrowser = (process.env.BROWSER || '').toLowerCase();
const BROWSER = Object.hasOwn(BROWSER_TYPES, requestedBrowser) ? requestedBrowser : 'chromium';
if (requestedBrowser && requestedBrowser !== BROWSER) {
  if (!/[\\/]/.test(requestedBrowser)) {
    console.error(`Unsupported BROWSER=${process.env.BROWSER}. Use chromium, firefox, or webkit.`);
    process.exit(2);
  }
  console.warn(`Ignoring unrelated BROWSER=${process.env.BROWSER}; using chromium.`);
}

const CHROMIUM_MATRIX = [
  { name: 'Small Android (land)', viewport: { width: 568, height: 320 }, mobile: true },
  { name: 'iPhone SE (land)', viewport: { width: 667, height: 375 }, mobile: true },
  { name: 'iPhone 12 (land)', viewport: { width: 844, height: 390 }, mobile: true },
  { name: 'iPhone 14 Pro Max (land)', viewport: { width: 932, height: 430 }, mobile: true },
  { name: 'iPhone 12 (portrait)', viewport: { width: 390, height: 844 }, mobile: true, portrait: true },
  { name: 'Small Android (portrait)', viewport: { width: 320, height: 568 }, mobile: true, portrait: true },
  { name: 'Desktop 1280', viewport: { width: 1280, height: 720 }, mobile: false },
];
const COMPAT_MATRIX = [
  { name: 'Short landscape', viewport: { width: 844, height: 390 }, mobile: false },
  { name: 'Desktop 1280', viewport: { width: 1280, height: 720 }, mobile: false },
];
const MATRIX = BROWSER === 'chromium' ? CHROMIUM_MATRIX : COMPAT_MATRIX;
const RUN_MATRIX = process.env.MATRIX !== '0';

const rect = async (locator) => (await locator.count()) ? locator.first().boundingBox() : null;
const overlaps = (a, b) => Boolean(a && b
  && a.x < b.x + b.width && b.x < a.x + a.width
  && a.y < b.y + b.height && b.y < a.y + a.height);
const contained = (box, viewport) => Boolean(box && box.x >= -1 && box.y >= -1
  && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1);
const preserveEmulatedViewport = (page) => page.addInitScript(() => {
  // Firefox honors requestFullscreen in headless mode and replaces the emulated viewport
  // with the host screen. Responsive assertions need to retain the requested device size.
  Object.defineProperty(Element.prototype, 'requestFullscreen', {
    configurable: true,
    value: () => Promise.resolve(),
  });
  Object.defineProperty(Element.prototype, 'webkitRequestFullscreen', {
    configurable: true,
    value: () => Promise.resolve(),
  });
});

let failures = 0;
const fail = (message) => { failures++; console.error(`  x ${message}`); };
const ok = (message) => console.log(`  + ${message}`);

console.log(`Browser: ${BROWSER}`);
const browser = await BROWSER_TYPES[BROWSER].launch();
for (const device of RUN_MATRIX ? MATRIX : []) {
  console.log(`\n[${BROWSER} / ${device.name}] ${device.viewport.width}x${device.viewport.height}`);
  const contextOptions = { viewport: device.viewport };
  if (BROWSER === 'chromium' && device.mobile) {
    Object.assign(contextOptions, {
      hasTouch: true,
      isMobile: true,
      userAgent: devices['iPhone 12'].userAgent,
    });
  }
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  await preserveEmulatedViewport(page);
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(String(error)));

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });
    await page.getByRole('button', { name: /daily shift/i }).click({ timeout: 10000, force: true });
    await page.waitForTimeout(600);

    // Focusing the briefing must not scroll short screens past the lesson's heading.
    const tutorialHeading = await rect(page.getByRole('heading', { name: /pre-shift briefing/i }));
    tutorialHeading && tutorialHeading.y >= -1 ? ok('briefing opens at the top') : fail('briefing heading starts off-screen');
    const start = page.getByRole('button', { name: /start patrol/i });
    await start.evaluate((button) => button.scrollIntoView({ block: 'center' }));
    contained(await rect(start), device.viewport) ? ok('Start Patrol is reachable by scrolling') : fail('Start Patrol remains clipped after scrolling');
    await start.evaluate((button) => button.click());

    if (device.portrait) {
      const prompt = page.getByTestId('rotate-prompt');
      await prompt.waitFor({ state: 'visible', timeout: 5000 });
      const promptBox = await rect(prompt);
      contained(promptBox, device.viewport) ? ok('portrait blocker covers the viewport') : fail('portrait blocker is clipped');
      const before = await page.getByTestId('hud-timer').textContent();
      await page.waitForTimeout(1200);
      const after = await page.getByTestId('hud-timer').textContent();
      before === after ? ok('portrait blocker pauses the shift') : fail(`timer changed behind portrait blocker (${before} -> ${after})`);
    } else {
      // Four-second countdown, then enough play for simulation/weather/traffic rendering.
      await page.waitForTimeout(7000);

      const painted = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return false;
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        const distinct = new Set();
        for (let index = 0; index < pixels.length; index += 4096) distinct.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]}`);
        return distinct.size > 3;
      });
      painted ? ok('canvas painted') : fail('canvas appears blank');

      // Pause and nested Controls must remain operable even when their panels need to scroll.
      await page.getByRole('button', { name: /pause game/i }).click({ force: true });
      await page.getByRole('heading', { name: 'Paused' }).waitFor({ state: 'visible' });
      await page.waitForTimeout(600);
      const controlsButton = page.getByRole('button', { name: 'Controls' });
      await controlsButton.evaluate((button) => { button.scrollIntoView({ block: 'center' }); button.click(); });
      const done = page.getByRole('button', { name: 'Done' });
      await page.waitForTimeout(600);
      const challengeAssist = page.getByTestId('guided-patrol-toggle');
      await challengeAssist.focus();
      await page.keyboard.press('Shift+Tab');
      await page.evaluate(() => document.activeElement?.textContent?.trim() === 'Done')
        ? ok('controls dialog traps focus across checkbox and buttons')
        : fail('controls dialog focus escaped on backward Tab');
      await done.evaluate((button) => { button.scrollIntoView({ block: 'center' }); button.click(); });
      const resume = page.getByRole('button', { name: 'Resume' });
      await page.waitForTimeout(600);
      await resume.evaluate((button) => { button.scrollIntoView({ block: 'center' }); button.click(); });
      ok('pause and controls dialogs are reachable');

      const hud = {
        score: await rect(page.getByTestId('hud-score')),
        districts: await rect(page.getByTestId('hud-districts')),
        minimap: await rect(page.getByTestId('hud-minimap')),
        compass: await rect(page.getByTestId('hud-compass')),
        compact: await rect(page.getByTestId('hud-compact')),
        timer: await rect(page.getByTestId('hud-timer')),
        pause: await rect(page.getByTestId('pause-button')),
        mute: await rect(page.getByTestId('mute-toggle')),
        radio: await rect(page.getByTestId('dispatch-radio')),
      };

      hud.districts || hud.compact
        ? ok('district deterrence status remains visible')
        : fail('district deterrence status is hidden');

      let hudFailure = false;
      const viewportMetrics = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        clientWidth: document.documentElement.clientWidth,
        clientHeight: document.documentElement.clientHeight,
      }));
      for (const [name, box] of Object.entries(hud)) {
        if (!box) continue;
        if (!contained(box, device.viewport)) {
          hudFailure = true;
          fail(`${name} extends outside viewport: box=${JSON.stringify(box)} expected=${JSON.stringify(device.viewport)} actual=${JSON.stringify(viewportMetrics)}`);
        }
      }
      const independentPairs = [
        ['mute', 'timer'], ['pause', 'timer'], ['mute', 'pause'],
        ['compass', 'score'], ['compass', 'timer'], ['compass', 'compact'],
        ['compact', 'score'], ['compact', 'timer'], ['score', 'minimap'],
        ['radio', 'score'], ['radio', 'timer'], ['radio', 'minimap'], ['radio', 'compass'],
      ];
      for (const [a, b] of independentPairs) {
        if (overlaps(hud[a], hud[b])) {
          hudFailure = true;
          fail(`${a} overlaps ${b}: ${JSON.stringify(hud[a])} / ${JSON.stringify(hud[b])}`);
        }
      }
      if (!hudFailure) ok('HUD layers fit without overlap');

      if (device.mobile) {
        const joystick = page.locator('[aria-roledescription="joystick"]');
        (await joystick.count()) ? ok('joystick present') : fail('joystick missing');
        const touchControls = {
          joystick: await rect(joystick),
          rids: await rect(page.getByRole('button', { name: /rids/i })),
          boost: await rect(page.getByRole('button', { name: /boost/i })),
          siren: await rect(page.getByRole('button', { name: /siren/i })),
          assist: await rect(page.getByRole('button', { name: /assist|colleague/i })),
        };
        let controlFailure = false;
        for (const [name, box] of Object.entries(touchControls)) {
          if (!box) continue;
          if (!contained(box, device.viewport)) { controlFailure = true; fail(`${name} extends outside viewport`); }
          for (const hudName of ['score', 'minimap', 'timer']) {
            if (overlaps(box, hud[hudName])) { controlFailure = true; fail(`${name} overlaps ${hudName}`); }
          }
        }
        if (!controlFailure) ok('touch controls fit without HUD overlap');
      }

      if (device.name === 'Desktop 1280') {
        await page.getByRole('button', { name: /pause game/i }).click({ force: true });
        await page.getByRole('button', { name: /restart shift/i }).click();
        await page.getByTestId('countdown').waitFor({ state: 'visible', timeout: 7000 });
        (await page.getByTestId('hud-timer').textContent())?.includes('1:30')
          ? ok('pause restart remounts a fresh shift')
          : fail('pause restart did not reset the shift timer');
      }
    }

    const realErrors = errors.filter((error) => !error.includes('favicon') && !error.includes('manifest'));
    realErrors.length === 0 ? ok('zero console errors') : fail(`console errors: ${realErrors.slice(0, 3).join(' | ')}`);
  } catch (error) {
    fail(`flow failed: ${String(error).slice(0, 240)}`);
  }
  await context.close();
}

if (BROWSER === 'chromium' && process.env.FULL_FLOW !== '0') {
  console.log('\n[chromium / complete Daily shift and community lifecycle]');
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(String(error)));
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });
    await page.getByRole('button', { name: /daily shift/i }).click({ force: true });
    const start = page.getByRole('button', { name: /start patrol/i });
    await start.evaluate((button) => { button.scrollIntoView({ block: 'center' }); button.click(); });
    await page.getByRole('heading', { name: /shift over/i }).waitFor({ state: 'visible', timeout: 110000 });
    ok('complete shift reaches the debrief');
    const debriefStories = page.getByTestId('debrief-stories').getByRole('listitem');
    (await debriefStories.count()) >= 3
      ? ok('debrief shows several ripple-effect stories')
      : fail('debrief shows fewer than three ripple-effect stories');

    await page.getByLabel('Your name').fill('E2E Patrol');
    await page.getByLabel(/Station code/).fill('E2E');
    await page.getByRole('button', { name: /submit score/i }).click({ force: true });
    await page.getByText(/score uploaded to the community board/i).waitFor({ state: 'visible', timeout: 10000 });
    ok('completed Daily score uploads');

    await page.getByRole('button', { name: 'E2E', exact: true }).click();
    await page.locator('[title="E2E Patrol"]').waitFor({ state: 'visible', timeout: 10000 });
    ok('station board returns the submitted score');

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /delete my community scores/i }).click({ force: true });
    await page.getByText(/community scores were deleted/i).waitFor({ state: 'visible', timeout: 10000 });
    ok('browser identity can delete its community scores');

    const realErrors = errors.filter((error) => !error.includes('favicon') && !error.includes('manifest'));
    realErrors.length === 0 ? ok('complete flow has zero console errors') : fail(`complete-flow console errors: ${realErrors.slice(0, 3).join(' | ')}`);
  } catch (error) {
    fail(`complete flow failed: ${String(error).slice(0, 240)}`);
  }
  await context.close();
}

if (BROWSER === 'chromium' && process.env.PWA !== '0') {
  console.log('\n[chromium / PWA offline reload]');
  const context = await browser.newContext({ viewport: { width: 844, height: 390 } });
  const page = await context.newPage();
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });
    const supported = await page.evaluate(() => 'serviceWorker' in navigator);
    if (!supported) throw new Error('service workers are unavailable');
    await page.waitForFunction(
      () => navigator.serviceWorker.getRegistration().then((registration) => Boolean(registration?.active)),
      undefined,
      { timeout: 15000 },
    );
    await page.reload({ waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), undefined, { timeout: 10000 });
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.getByRole('button', { name: /daily shift/i }).waitFor({ state: 'visible', timeout: 10000 });
    const offlineShell = await page.evaluate(() => !navigator.onLine && Boolean(document.querySelector('#root')?.textContent?.trim()));
    offlineShell ? ok('app shell reloads offline under service-worker control') : fail('offline reload did not restore the app shell');
  } catch (error) {
    fail(`PWA offline reload failed: ${String(error).slice(0, 240)}`);
  } finally {
    await context.setOffline(false);
    await context.close();
  }
}
await browser.close();

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
