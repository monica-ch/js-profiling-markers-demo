// JS Self-Profiling Markers — live demo controller.
'use strict';

const MARKERS = ['script', 'gc', 'style', 'layout', 'paint'];
const SAFE_MARKERS = ['style', 'layout'];           // exposed everywhere
const ISOLATED_ONLY = ['script', 'gc', 'paint'];    // require cross-origin isolation

const $ = (id) => document.getElementById(id);
const isCOI = self.crossOriginIsolated === true;
const hasProfiler = typeof Profiler !== 'undefined';

function initContext() {
  const iso = $('ctxIsolation');
  iso.textContent = isCOI ? 'Cross-origin isolated' : 'Not isolated';
  iso.classList.add(isCOI ? 'ok' : 'no');

  const api = $('ctxApi');
  api.textContent = hasProfiler ? 'Profiler API: available' : 'Profiler API: unavailable';
  api.classList.add(hasProfiler ? 'ok' : 'no');

  $('links').innerHTML =
    '<a href="https://wicg.github.io/js-self-profiling/" target="_blank" rel="noopener">Spec</a>' +
    '<a href="https://github.com/WICG/js-self-profiling" target="_blank" rel="noopener">Repo</a>';

  renderLegend();
  renderBars({});
  if (!hasProfiler) {
    $('runState').textContent =
      'Profiler API not found — open in Edge/Chrome with Document-Policy: js-profiling.';
    $('runBtn').disabled = true;
  }
}

function renderLegend() {
  const legend = $('legend');
  legend.innerHTML = '';
  const items = MARKERS.map((m) => ({ m, avail: isCOI || SAFE_MARKERS.includes(m) }));
  items.push({ m: 'none', avail: true });
  for (const { m, avail } of items) {
    const li = document.createElement('span');
    li.className = 'li';
    const label = m === 'none' ? 'no marker' : m + (avail ? '' : ' (needs isolation)');
    li.innerHTML = '<span class="sw s-' + m + '"></span>' + label;
    if (!avail) li.style.opacity = '0.5';
    legend.appendChild(li);
  }
}

function markerClass(marker) {
  return 's-' + (marker && MARKERS.includes(marker) ? marker : 'none');
}

function renderTimeline(samples) {
  const tl = $('timeline');
  tl.innerHTML = '';
  const N = samples.length;
  if (!N) return;
  // Cap DOM nodes for very long traces; bucket down to ~240 bars.
  const maxBars = 240;
  const step = Math.ceil(N / maxBars);
  const bars = [];
  for (let i = 0; i < N; i += step) {
    // pick the dominant marker in this bucket
    const counts = {};
    let best = null, bestC = 0;
    for (let j = i; j < Math.min(i + step, N); j++) {
      const mk = samples[j].marker || 'none';
      counts[mk] = (counts[mk] || 0) + 1;
      if (counts[mk] > bestC) { bestC = counts[mk]; best = mk; }
    }
    const bar = document.createElement('div');
    bar.className = 'samp ' + markerClass(best === 'none' ? null : best);
    bar.style.height = '18%';
    bar.title = best;
    tl.appendChild(bar);
    bars.push(bar);
  }
  // animate in with varied heights for a lively "profile" look
  bars.forEach((b, i) => {
    setTimeout(() => {
      b.classList.add('show');
      b.style.height = (25 + Math.round(60 * Math.abs(Math.sin(i / 6)))) + '%';
    }, i * 4);
  });
}

function renderBars(counts) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const wrap = $('bars');
  wrap.innerHTML = '';
  for (const m of MARKERS) {
    const c = counts[m] || 0;
    const avail = isCOI || SAFE_MARKERS.includes(m);
    const row = document.createElement('div');
    row.className = 'bar-row' + (!avail && c === 0 ? ' absent' : '');
    row.innerHTML =
      '<span class="name">' + m + '</span>' +
      '<span class="bar-track"><span class="bar-fill s-' + m + '"></span></span>' +
      '<span class="val">' + c + '</span>';
    wrap.appendChild(row);
    requestAnimationFrame(() => {
      row.querySelector('.bar-fill').style.width = Math.round((c / total) * 100) + '%';
    });
  }
}

function renderMeta(trace, elapsed) {
  const withMarker = trace.samples.filter((s) => s.marker).length;
  const meta = $('meta');
  meta.innerHTML =
    row('Samples', trace.samples.length) +
    row('With marker', withMarker) +
    row('Frames', trace.frames.length) +
    row('Stacks', trace.stacks.length) +
    row('Wall time', Math.round(elapsed) + ' ms');
  function row(k, v) { return '<dt>' + k + '</dt><dd>' + v + '</dd>'; }
}

function logWorkload(label, marker, dur, done) {
  const ul = $('workloadLog');
  let li = document.getElementById('wl-' + marker);
  if (!li) {
    li = document.createElement('li');
    li.id = 'wl-' + marker;
    ul.appendChild(li);
  }
  const tag = '<span class="tag t-' + marker + '">' + marker + '</span>';
  li.innerHTML =
    '<span>' + tag + ' ' + label + '</span>' +
    '<span class="' + (done ? 'done' : '') + '">' +
    (done ? Math.round(dur) + ' ms ✓' : 'running…') + '</span>';
}

async function run() {
  const btn = $('runBtn');
  btn.disabled = true;
  $('workloadLog').innerHTML = '';
  $('runState').textContent = 'Starting profiler…';

  const sampleInterval = parseInt($('interval').value, 10);
  let profiler;
  try {
    profiler = new Profiler({ sampleInterval, maxBufferSize: 100000 });
  } catch (e) {
    $('runState').textContent = 'Could not start Profiler: ' + e.message;
    btn.disabled = false;
    return;
  }

  const t0 = performance.now();
  for (const w of window.Workloads) {
    logWorkload(w.label, w.marker, 0, false);
    $('runState').textContent = 'Running: ' + w.label;
    // Yield so the UI paints the "running…" state before the blocking workload.
    await new Promise((r) => setTimeout(r, 30));
    const dur = w.async ? await w.run() : w.run();
    logWorkload(w.label, w.marker, dur, true);
    await new Promise((r) => setTimeout(r, 40));
  }

  $('runState').textContent = 'Stopping profiler…';
  const trace = await profiler.stop();
  const elapsed = performance.now() - t0;

  const counts = {};
  for (const s of trace.samples) {
    if (s.marker) counts[s.marker] = (counts[s.marker] || 0) + 1;
  }

  renderTimeline(trace.samples);
  renderBars(counts);
  renderMeta(trace, elapsed);

  const seen = MARKERS.filter((m) => counts[m]);
  const hiddenExpected = isCOI ? [] : ISOLATED_ONLY.filter((m) => !counts[m]);
  let msg = 'Done — ' + trace.samples.length + ' samples. Markers seen: ' + (seen.join(', ') || 'none') + '.';
  if (!isCOI && hiddenExpected.length) {
    msg += ' ' + hiddenExpected.join(', ') + ' correctly withheld (not cross-origin isolated).';
  }
  $('runState').textContent = msg;
  btn.disabled = false;
  window.__demoDone = true; // signal for automated capture
}

$('runBtn').addEventListener('click', run);
initContext();
