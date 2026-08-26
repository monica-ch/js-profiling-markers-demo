# Social copy

## X / Twitter (thread)

**1/**
Your JS profiler has always had a blind spot: it sees your call stacks, but not
the engine work your code *triggers* — style, layout, paint, GC.

The JS Self-Profiling **markers** extension fixes that. Now in Origin Trial in
Edge + Chrome (M153–M161). 🧵

**2/**
Every sample now carries a `marker`:
• script — running your JS
• gc — garbage collection
• style — style resolution
• layout — reflow
• paint — painting

A flat stack sampler becomes an attribution tool.

**3/**
The security question (cross-origin side channels) is answered by design:
richer markers are **gated on cross-origin isolation**.

Ordinary doc → style + layout only.
COOP+COEP isolated doc → all five.

Not coarsened. Simply not present unless you've opted into isolation.

**4/**
Cheap, too: opt-in per document, plus a new lazy mode that defers the expensive
JIT enumeration until you actually collect a trace.

**5/**
I built a live demo dashboard — runs 5 workloads, colors every sample by its
marker, and shows the gating happen across two routes. Works in Edge AND Chrome.

Repo + video 👇
https://github.com/monica-ch/js-profiling-markers-demo

## LinkedIn

The JS Self-Profiling API lets a web page profile its own JavaScript in
production — no DevTools attached. But it only ever saw *your* call stacks, never
the engine work your code triggers underneath: style, layout, paint, garbage
collection. That's often the real cost of a slow interaction, and it was
invisible.

The markers extension — now in Origin Trial in Microsoft Edge and Google Chrome
(M153–M161) — adds a `marker` to every sample, so you can finally attribute time
to those engine phases directly from a field profiler.

It's built carefully: the richer markers (script, gc, paint) are gated on
cross-origin isolation, so they don't open a new side-channel in contexts that
haven't already opted into Spectre-class defenses. And a new lazy profiling mode
keeps the overhead low.

I put together a small live demo that runs five workloads, profiles them, and
colors every sample by its marker — and shows the cross-origin-isolation gating
happen in real time. It runs identically in Edge and Chrome (same Blink/V8
engine).

Repo, video, and a write-up here:
https://github.com/monica-ch/js-profiling-markers-demo

#webperf #javascript #chromium #edge #webdev
