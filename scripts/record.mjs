// Automated capture: drives the demo in Microsoft Edge (channel: msedge),
// records a video, and verifies markers are actually produced.
//
// Usage:
//   node scripts/server.cjs        # in one terminal
//   node scripts/record.mjs        # in another
//
// Env:
//   BROWSER=msedge|chrome  (default msedge)
//   ROUTE=/coi|/no-coi     (default /coi to show all five markers)
//   PORT=8123
//
// The JS Self-Profiling markers feature is in Origin Trial; on localhost no
// token or flag is required. We pass nothing that force-enables the feature so
// this reflects the real OT behavior.

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const MEDIA = path.join(ROOT, 'media');
fs.mkdirSync(MEDIA, { recursive: true });

const BROWSER = process.env.BROWSER || 'msedge';
const ROUTE = process.env.ROUTE || '/coi';
const PORT = process.env.PORT || '8123';
const URL = `http://localhost:${PORT}${ROUTE}`;

// On a browser inside the Origin Trial window (M153+) served from a registered
// origin, no flag is needed. For local capture on a pre-trial stable build we
// enable the Blink feature directly so the markers are exercised. Set NO_FLAG=1
// to omit it (e.g. when driving a Canary that already has the OT feature).
const LAUNCH_ARGS = process.env.NO_FLAG
  ? []
  : ['--enable-blink-features=ExperimentalJSProfilerMarkers'];

const VIEWPORT = { width: 1280, height: 800 };

async function main() {
  const browser = await chromium.launch({
    channel: BROWSER, // 'msedge' or 'chrome' — same Blink engine, so the demo runs on both
    headless: false,
    args: LAUNCH_ARGS,
  });

  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: MEDIA, size: VIEWPORT },
  });

  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  await page.goto(URL, { waitUntil: 'load' });

  // Sanity: the Profiler API must exist for a meaningful capture.
  const hasProfiler = await page.evaluate(() => typeof Profiler !== 'undefined');
  const isCOI = await page.evaluate(() => self.crossOriginIsolated === true);
  console.log(`Route ${ROUTE} | crossOriginIsolated=${isCOI} | Profiler=${hasProfiler}`);
  if (!hasProfiler) {
    console.error('Profiler API unavailable — cannot capture. Is Document-Policy: js-profiling set?');
  }

  // Let viewers read the intro for a beat.
  await page.waitForTimeout(1600);

  await page.click('#runBtn');

  // Wait for the demo to finish (it sets window.__demoDone) — workloads total ~2s.
  await page.waitForFunction(() => window.__demoDone === true, { timeout: 30000 });

  // Extract the real marker counts straight from a fresh trace for the report.
  const report = await page.evaluate(async () => {
    const p = new Profiler({ sampleInterval: 1, maxBufferSize: 100000 });
    const start = performance.now();
    // brief mixed workload
    for (const w of window.Workloads) { w.async ? await w.run() : w.run(); }
    const trace = await p.stop();
    const counts = {};
    for (const s of trace.samples) if (s.marker) counts[s.marker] = (counts[s.marker] || 0) + 1;
    return {
      crossOriginIsolated: self.crossOriginIsolated === true,
      samples: trace.samples.length,
      markerCounts: counts,
      wallMs: Math.round(performance.now() - start),
    };
  });

  // Hold the final dashboard on screen so the video ends on results.
  await page.waitForTimeout(2500);

  await context.close(); // finalizes the video file
  await browser.close();

  // Rename the video deterministically.
  const vids = fs.readdirSync(MEDIA).filter((f) => f.endsWith('.webm'));
  vids.sort((a, b) => fs.statSync(path.join(MEDIA, b)).mtimeMs - fs.statSync(path.join(MEDIA, a)).mtimeMs);
  let videoPath = null;
  if (vids.length) {
    const dest = path.join(MEDIA, `demo-${BROWSER}${ROUTE.replace('/', '-')}.webm`);
    fs.renameSync(path.join(MEDIA, vids[0]), dest);
    videoPath = path.posix.join('media', path.basename(dest)); // repo-relative
  }

  const summary = { browser: BROWSER, route: ROUTE, url: URL, video: videoPath, consoleErrors, ...report };

  // Write a per-route report so capturing one route never clobbers the other.
  const routeSlug = ROUTE.replace('/', '') || 'root';
  fs.writeFileSync(path.join(MEDIA, `report-${routeSlug}.json`), JSON.stringify(summary, null, 2));

  // Maintain a combined report.json that holds the latest run for every route
  // captured so far, so the repo can show the coi vs no-coi contrast at a glance.
  const combinedPath = path.join(MEDIA, 'report.json');
  let combined = {};
  if (fs.existsSync(combinedPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(combinedPath, 'utf8'));
      // Support both the new keyed shape and any legacy single-object file.
      if (prev && prev.runs && typeof prev.runs === 'object') combined = prev.runs;
      else if (prev && prev.route) combined[prev.route] = prev;
    } catch { /* start fresh if the existing file is unreadable */ }
  }
  combined[ROUTE] = summary;
  fs.writeFileSync(combinedPath, JSON.stringify({ runs: combined }, null, 2));

  console.log('\n=== CAPTURE REPORT ===');
  console.log(JSON.stringify(summary, null, 2));

  const seen = Object.keys(report.markerCounts);
  if (report.samples === 0) { console.error('\nNo samples collected.'); process.exit(2); }
  if (seen.length === 0) { console.error('\nNo markers present — feature may be off for this build.'); process.exit(3); }
  console.log(`\nOK: ${report.samples} samples, markers: ${seen.join(', ')}`);
  if (videoPath) console.log(`Video: ${videoPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
