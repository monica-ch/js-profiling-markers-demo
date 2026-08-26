# Your JavaScript profiler can now see the engine

*Profiling the work your code causes but never shows up in a JS stack.*

The [JS Self-Profiling API](https://wicg.github.io/js-self-profiling/) has been
around for a while: it lets a web page sample its own JavaScript call stacks,
from script, with no DevTools and no native profiler attached. Great for real
user monitoring — you can ship a profiler to the field and learn where real
users actually spend time.

But it had a blind spot. A sampling profiler that only sees JS stacks tells you
what *your functions* were doing. It says nothing about the work your functions
*trigger* inside the engine — the style recalcs, the layouts, the paints, the
garbage collection. That work is often the real cost of a slow interaction, and
it was invisible.

The **markers extension**, now in **Origin Trial** in Chromium (Microsoft Edge
and Google Chrome, M153–M161), closes that gap.

## What changed

Every sample the profiler returns now carries an optional `marker` telling you
what the engine was doing at that instant:

| Marker   | The engine was…            |
| -------- | -------------------------- |
| `script` | running your JavaScript    |
| `gc`     | collecting garbage         |
| `style`  | resolving style            |
| `layout` | doing layout / reflow      |
| `paint`  | painting                   |

Now a flat stack sampler becomes an attribution tool. A sample taken mid-layout
that your `element.offsetHeight` read forced? You can see it — and you can see
how much of the interaction went there, versus GC, versus your own compute.

```js
const profiler = new Profiler({ sampleInterval: 4, maxBufferSize: 10000 });
// … run the interaction you care about …
const trace = await profiler.stop();

const byMarker = {};
for (const s of trace.samples) {
  const m = s.marker ?? 'script-or-idle';
  byMarker[m] = (byMarker[m] || 0) + 1;
}
console.table(byMarker); // { script: 44, style: 14, layout: 6, gc: 3, paint: 1 }
```

## The security story: cross-origin isolation gates the markers

Timing-based markers on engine internals are exactly the sort of signal that
warrants care about cross-origin side-channels. The design answers that head-on
by **gating the richer markers on cross-origin isolation**:

- In an **ordinary** document, only `style` and `layout` are exposed.
- In a **cross-origin-isolated** document (COOP + COEP), you also get `script`,
  `gc`, and `paint`.

The extra markers aren't coarsened or fuzzed — they're simply **not present**
unless the document has already opted into the stronger isolation guarantee that
Spectre-class defenses require. If you can already run high-resolution timers and
`SharedArrayBuffer` in that context, these markers don't hand you a new class of
attack. (See the provenance discussion in
[WICG/js-self-profiling#61](https://github.com/WICG/js-self-profiling/issues/61).)

## What about the CPU cost of profiling?

Two things keep it cheap. The API is **opt-in per document** — nothing runs
unless a page constructs a `Profiler`. And a new **lazy profiling mode**
([WICG/js-self-profiling#87](https://github.com/WICG/js-self-profiling/pull/87),
merged) lets the engine defer the expensive JIT code-map enumeration until a
trace is actually collected, via the `js-profiling-mode` document policy.

## See it live

I built a small dashboard that runs five workloads — each designed to make the
engine spend time in one phase — profiles them, and colors every sample by its
marker. It serves the same page at two routes so you can watch the gating
happen: the isolated route lights up with all five markers; the non-isolated one
shows only style and layout.

It runs identically in Edge and Chrome — same Blink/V8 engine underneath.

👉 **Repo:** <https://github.com/monica-ch/js-profiling-markers-demo>

On localhost during the trial you don't even need a token or a flag — the only
header the API needs is `Document-Policy: js-profiling`. To deploy on a real
origin, grab an [Origin Trial token](https://developer.chrome.com/origintrials/).

Give it a try, and tell me what engine work your JavaScript has been hiding.
