// Workloads that deliberately exercise each JS Self-Profiling marker type.
// Each returns roughly how long it ran (ms) so the UI can report it.
// Kept intentionally heavy + synchronous so the sampling profiler lands
// samples inside each phase.

(function (global) {
  'use strict';

  const DURATION_MS = 320;

  function scratch() {
    let el = document.getElementById('scratch');
    if (!el) {
      el = document.createElement('div');
      el.id = 'scratch';
      el.style.cssText = 'position:absolute;left:-9999px;top:0;width:400px;';
      document.body.appendChild(el);
    }
    return el;
  }

  // "script": pure CPU-bound JS.
  function runScript() {
    const start = performance.now();
    let sum = 0;
    while (performance.now() - start < DURATION_MS) {
      for (let i = 0; i < 200000; i++) {
        sum += Math.sqrt(i) * Math.sin(i) - Math.cos(i / 3);
      }
    }
    global.__sink = sum;
    return performance.now() - start;
  }

  // "gc": churn short-lived allocations to provoke garbage collection.
  function runGc() {
    const start = performance.now();
    while (performance.now() - start < DURATION_MS) {
      let arr = [];
      for (let i = 0; i < 60000; i++) {
        arr.push({ i, data: new Array(80).fill(i), s: ('x' + i).repeat(2) });
      }
      arr = null;
    }
    return performance.now() - start;
  }

  // "style": mutate classes and read computed style to force recalc.
  function runStyle() {
    const host = scratch();
    host.innerHTML = '';
    const style = document.createElement('style');
    style.textContent =
      '.a{color:#f00;font-size:14px;line-height:1.5;letter-spacing:.3px}' +
      '.b{color:#00f;font-size:16px;line-height:1.8;letter-spacing:1px}' +
      '.a>i{font-weight:700}.b>i{font-weight:400}';
    document.head.appendChild(style);
    const els = [];
    for (let i = 0; i < 400; i++) {
      const d = document.createElement('div');
      d.className = 'a';
      d.appendChild(document.createElement('i')).textContent = 'x' + i;
      host.appendChild(d);
      els.push(d);
    }
    const start = performance.now();
    while (performance.now() - start < DURATION_MS) {
      for (let i = 0; i < els.length; i++) {
        els[i].className = (i + (performance.now() | 0)) % 2 ? 'a' : 'b';
        void getComputedStyle(els[i]).color;
        void getComputedStyle(els[i]).fontSize;
      }
    }
    host.innerHTML = '';
    style.remove();
    return performance.now() - start;
  }

  // "layout": mutate geometry and read layout properties (forced reflow).
  function runLayout() {
    const host = scratch();
    host.innerHTML = '';
    const els = [];
    for (let i = 0; i < 400; i++) {
      const d = document.createElement('div');
      d.style.cssText = 'padding:1px;margin:1px;border:1px solid #333;';
      d.textContent = 'row ' + i;
      host.appendChild(d);
      els.push(d);
    }
    const start = performance.now();
    while (performance.now() - start < DURATION_MS) {
      for (let i = 0; i < els.length; i++) {
        els[i].style.width = ((i % 200) + 40) + 'px';
        els[i].style.paddingLeft = (i % 6) + 'px';
        void els[i].getBoundingClientRect();
        void els[i].offsetHeight;
      }
    }
    host.innerHTML = '';
    return performance.now() - start;
  }

  // "paint": animate visible pixels across frames via requestAnimationFrame.
  function runPaint() {
    const host = scratch();
    host.style.cssText = 'position:fixed;right:12px;bottom:12px;width:220px;height:120px;overflow:hidden;opacity:.9;pointer-events:none;';
    host.innerHTML = '';
    const boxes = [];
    for (let i = 0; i < 120; i++) {
      const b = document.createElement('div');
      b.style.cssText = 'position:absolute;width:14px;height:14px;border-radius:3px;';
      host.appendChild(b);
      boxes.push(b);
    }
    return new Promise((resolve) => {
      const start = performance.now();
      let f = 0;
      function frame() {
        for (let i = 0; i < boxes.length; i++) {
          const x = 100 + Math.sin(f / 10 + i) * 90;
          const y = 55 + Math.cos(f / 12 + i) * 45;
          boxes[i].style.transform = 'translate(' + x + 'px,' + y + 'px)';
          boxes[i].style.background = 'hsl(' + ((f * 6 + i * 3) % 360) + ',85%,55%)';
        }
        f++;
        if (performance.now() - start < DURATION_MS) {
          requestAnimationFrame(frame);
        } else {
          host.innerHTML = '';
          host.style.cssText = 'position:absolute;left:-9999px;top:0;';
          resolve(performance.now() - start);
        }
      }
      requestAnimationFrame(frame);
    });
  }

  // Ordered so the video reads well: rendering first, then engine internals.
  global.Workloads = [
    { marker: 'layout', label: 'Forced reflow (400 nodes)', run: runLayout, async: false },
    { marker: 'style',  label: 'Style recalc (class churn)', run: runStyle,  async: false },
    { marker: 'paint',  label: 'Animated paint (rAF)',       run: runPaint,  async: true  },
    { marker: 'script', label: 'CPU-bound JS',               run: runScript, async: false },
    { marker: 'gc',     label: 'Allocation churn (GC)',      run: runGc,     async: false },
  ];
})(window);
