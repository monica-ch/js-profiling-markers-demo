# JS Self-Profiling Markers — Live Demo

A small, self-contained demo of the **markers extension** to the
[JS Self-Profiling API](https://wicg.github.io/js-self-profiling/), which is now
in **Origin Trial** in Chromium (Microsoft Edge and Google Chrome, **M153–M161**).

The API lets a page sample its own JavaScript call stacks from script. The
markers extension adds a `marker` field to each sample that tells you **what the
engine was doing** when the sample was taken — running your script, or busy in
one of the engine's own phases: **style, layout, paint, or garbage collection**.
That turns a flat stack sampler into something you can use to attribute time to
engine work your JS triggered but never appears in a JS stack.

> Works identically in **Edge** and **Chrome** — they share the same Blink/V8
> engine. This demo is engine-level, not browser-specific.

![demo](media/demo-msedge-coi.webm)

*(Recording: Edge, cross-origin-isolated route. The timeline colors each sample
by its marker; the breakdown shows how the same workload splits across engine
phases.)*

---

## The five markers

| Marker   | Meaning                                              |
| -------- | ---------------------------------------------------- |
| `script` | Executing page JavaScript                            |
| `gc`     | V8 garbage collection                                |
| `style`  | Style resolution                                     |
| `layout` | Layout / reflow                                      |
| `paint`  | Paint                                                |

A sample with no marker is ordinary JS execution with no active engine phase.

## Cross-origin isolation gates the markers

This is the security-relevant part, and the demo shows it directly by serving
the **same app at two routes**:

| Route      | Context                    | Markers exposed                          |
| ---------- | -------------------------- | ---------------------------------------- |
| `/no-coi`  | not cross-origin isolated  | `style`, `layout` only                   |
| `/coi`     | cross-origin isolated (COOP+COEP) | all five: `script`, `gc`, `style`, `layout`, `paint` |

In a non-isolated document the engine returns **only** `style` and `layout`;
`script`, `gc`, and `paint` markers are **dropped entirely** (not coarsened).
The richer markers require the stronger isolation guarantee that
cross-origin isolation provides. You can see this live: run the demo on both
routes and compare the breakdown.

The captured runs in [`media/report.json`](media/report.json) show exactly this
contrast — the `/coi` run reports all marker types, the `/no-coi` run reports
only `style` and `layout`.

## Run it

```bash
npm install          # only needed if you want to re-record (Playwright)
npm start            # static server on http://localhost:8123
```

Then open, in **Edge or Chrome**:

- <http://localhost:8123/coi> — cross-origin isolated, all five markers
- <http://localhost:8123/no-coi> — not isolated, only style + layout

Click **Run profile** and watch the timeline fill in.

### Do I need a flag or a token?

- **On a browser in the trial window (M153–M161), served from localhost:** no.
  `localhost` is exempt from Origin-Trial tokens, and the only response header
  the API needs is `Document-Policy: js-profiling` (the server sets it for you).
- **On a deployed origin:** register for the
  [Origin Trial](https://developer.chrome.com/origintrials/) and add the token
  via a `<meta http-equiv="origin-trial">` tag or an `Origin-Trial` header. No
  browser flag is needed for real users.
- **For local capture on a pre-trial stable build** (e.g. an older stable Edge
  below M153), the recorder passes
  `--enable-blink-features=ExperimentalJSProfilerMarkers` so the markers are
  exercised. This is a capture convenience only — production usage uses the OT
  token, never a flag. Pass `NO_FLAG=1` to omit it when driving a browser that
  already has the trial feature.

## Re-record the video

```bash
npm install
npx playwright install msedge ffmpeg
BROWSER=msedge ROUTE=/coi    npm run record   # all five markers
BROWSER=msedge ROUTE=/no-coi npm run record   # style + layout only
```

Outputs a `.webm` and a `report.json` with the real marker counts into
`media/`. Set `BROWSER=chrome` to record in Chrome instead.

## How it works

- [`public/workloads.js`](public/workloads.js) — five small workloads, each
  designed to make the engine spend time in one phase (forced reflow for
  `layout`, restyle for `style`, canvas/rAF for `paint`, tight compute for
  `script`, allocation churn for `gc`).
- [`public/demo.js`](public/demo.js) — constructs a `Profiler`, runs the
  workloads, reads back `trace.samples`, and buckets them by `marker` to draw
  the timeline and breakdown.
- [`scripts/server.cjs`](scripts/server.cjs) — sets `Document-Policy:
  js-profiling` on every response and adds COOP+COEP on `/coi`.
- [`scripts/record.mjs`](scripts/record.mjs) — drives the page with Playwright,
  captures a video, and extracts the real marker counts.

## Background & specs

- Explainer & spec: <https://github.com/WICG/js-self-profiling>
- Markers extension discussion (COI gating provenance):
  [WICG/js-self-profiling#61](https://github.com/WICG/js-self-profiling/issues/61)
- Lazy profiling mode (`js-profiling-mode`):
  [WICG/js-self-profiling#87](https://github.com/WICG/js-self-profiling/pull/87)
- Prior art this builds on: Victor Huang's
  [js-profiler-markers-demo](https://github.com/victorhuangwq/js-profiler-markers-demo)
  (a pass/fail test harness — this repo is the visual, shareable version).

## License

[MIT](LICENSE)
