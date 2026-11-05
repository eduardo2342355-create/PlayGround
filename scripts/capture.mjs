import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const startedAt = Date.now();
const timing = (label) => console.log(`[timing] ${((Date.now() - startedAt) / 1000).toFixed(2)}s ${label}`);

const url = process.env.CAPTURE_URL;
const output = process.env.CAPTURE_DIR;
const projectDir = resolve(process.env.PROJECT_DIR || process.cwd());

if (!url || !output) {
  console.error('CAPTURE_URL and CAPTURE_DIR are required.');
  process.exit(1);
}

const captureDir = resolve(output);
if (captureDir === projectDir || captureDir.startsWith(projectDir + '/')) {
  console.error(`CAPTURE_DIR must be outside the project source: ${captureDir}`);
  process.exit(1);
}

try {
  mkdirSync(captureDir, { recursive: true });
} catch (error) {
  console.error(`Cannot create CAPTURE_DIR: ${error.message}`);
  process.exit(1);
}

const transient = (error) => {
  error.exitCode = 75;
  return error;
};

const isTransientStatus = (status) => !status || [408, 425, 429, 500, 502, 503, 504].includes(status);

let browser;
let exitCode = 0;

try {
  const runtime = join(process.env.HOME, '.local/share/omgithub-playwright');
  const require = createRequire(join(runtime, 'package.json'));
  let chromium;
  let config;
  try {
    ({ chromium } = require('playwright'));
    config = JSON.parse(readFileSync(join(runtime, process.platform === 'darwin' ? 'metal.json' : 'linux.json'), 'utf8'));
  } catch (error) {
    throw transient(new Error(`Playwright runtime is unavailable: ${error.message}`));
  }

  if (process.platform === 'linux' && !process.env.DISPLAY) {
    try {
      const display = readFileSync(join(runtime, 'display'), 'utf8').trim();
      if (display) process.env.DISPLAY = ':' + display;
    } catch {}
  }

  timing('launching Chromium');
  try {
    browser = await chromium.launch({ ...config.browser.launchOptions, timeout: 30000 });
  } catch (error) {
    throw transient(error);
  }
  timing('Chromium ready');

  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    let page;
    try {
      page = await browser.newPage({ viewport: { width, height } });
    } catch (error) {
      throw transient(error);
    }
    page.setDefaultTimeout(30000);

    const failures = [];
    page.on('pageerror', (error) => {
      console.error(`[${name}] page error: ${error.message}`);
      failures.push(error.message);
    });
    page.on('response', (response) => {
      try {
        if (response.status() >= 400 && new URL(response.url()).origin === new URL(url).origin) {
          failures.push(`HTTP ${response.status()}: ${response.url()}`);
        }
      } catch {}
    });

    timing(`${name}: navigating to ${url}`);
    let response;
    try {
      response = await page.goto(url, { waitUntil: 'load', timeout: 45000 });
    } catch (error) {
      throw transient(error);
    }
    if (!response) throw transient(new Error(`No navigation response from ${url}`));
    if (!response.ok()) {
      const error = new Error(`HTTP ${response.status()} loading ${url}`);
      if (isTransientStatus(response.status())) throw transient(error);
      throw error;
    }
    timing(`${name}: HTML loaded (HTTP ${response.status()})`);

    // The game's boot sequence reveals #menu once Three.js is compiled and the
    // loading overlay is gone. Poll instead of relying on frame-stability
    // heuristics, which are unreliable under software rendering.
    const deadline = Date.now() + 60000;
    let rendered = false;
    while (Date.now() < deadline) {
      try {
        rendered = await page.evaluate(() => {
          const canvas = document.querySelector('#scene');
          const menu = document.querySelector('#menu');
          const loading = document.querySelector('#loading');
          return Boolean(
            canvas &&
            menu &&
            menu.classList.contains('visible') &&
            (!loading || !loading.classList.contains('visible'))
          );
        });
      } catch {}
      if (rendered) break;
      await page.waitForTimeout(250);
    }
    if (!rendered) {
      if (failures.length) throw new Error(`The page did not render: ${failures.join('; ')}`);
      throw transient(new Error('Timed out waiting for the app to render'));
    }
    timing(`${name}: app rendered`);

    try {
      await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 15000 });
    } catch {}
    timing(`${name}: fonts ready`);

    // Enter gameplay with a DOM click. This avoids Playwright's element
    // stability checks, which time out on the animated menu under SwiftShader.
    const clicked = await page.evaluate(() => {
      const button = document.querySelector('#btn-start');
      if (!button || button.offsetParent === null) return false;
      button.click();
      return true;
    }).catch(() => false);

    if (clicked) {
      timing(`${name}: start clicked`);
      const playingDeadline = Date.now() + 25000;
      let playing = false;
      while (Date.now() < playingDeadline) {
        try {
          playing = await page.evaluate(() => {
            const hollow = window.__hollow;
            return Boolean(hollow && hollow.state && hollow.state.mode === 'playing');
          });
        } catch {}
        if (playing) break;
        await page.waitForTimeout(250);
      }
      // If pointer-lock churn paused the synthetic start, resume once.
      if (!playing) {
        const resumed = await page.evaluate(() => {
          const pause = document.querySelector('#pause');
          const resume = document.querySelector('#btn-resume');
          if (pause && pause.classList.contains('visible') && resume) {
            resume.click();
            return true;
          }
          return false;
        }).catch(() => false);
        if (resumed) {
          timing(`${name}: resumed from pause`);
          const resumeDeadline = Date.now() + 10000;
          while (Date.now() < resumeDeadline) {
            try {
              playing = await page.evaluate(() => window.__hollow?.state?.mode === 'playing');
            } catch {}
            if (playing) break;
            await page.waitForTimeout(250);
          }
        }
      }
      timing(`${name}: gameplay ready=${playing}`);
      await page.waitForTimeout(playing ? 900 : 1200);
    } else {
      timing(`${name}: no start control; capturing the rendered page`);
      await page.waitForTimeout(800);
    }

    const screenshotPath = join(captureDir, `final-${name}.png`);
    timing(`${name}: screenshot ${screenshotPath}`);
    try {
      await page.screenshot({ path: screenshotPath, timeout: 30000 });
    } catch (error) {
      if (error.name === 'TimeoutError' || !browser.isConnected()) throw transient(error);
      throw error;
    }

    let size = 0;
    try { size = statSync(screenshotPath).size; } catch {}
    if (size < 10000) throw new Error(`Screenshot looks blank: ${screenshotPath} (${size} bytes)`);
    timing(`${name}: screenshot saved (${size} bytes)`);

    if (failures.length) throw new Error(`Rendered page reported failures: ${failures.join('; ')}`);
    await page.close().catch(() => {});
  }

  timing('capture complete');
} catch (error) {
  console.error(error && error.stack ? error.stack : error);
  exitCode = error.exitCode || 1;
} finally {
  if (browser) {
    timing('closing Chromium');
    await browser.close().catch((error) => {
      console.error(error);
      exitCode ||= 75;
    });
  }
  process.exitCode = exitCode;
}
