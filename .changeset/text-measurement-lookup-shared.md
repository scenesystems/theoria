---
"@scenesystems/effect-text": patch
---

A measurement lookup, once begun, is finished and shared. `MeasurementCacheLive` and `BrowserMeasurementCacheLive` read their caches uninterruptibly: Effect's `Cache` otherwise interrupts a pending entry when the fiber that began its lookup is interrupted, and every other fiber awaiting that key failed with an interrupt that was not its own — a consumer that re-measured the same text while an earlier measurement of it was cancelled lost both. Measurements are bounded, so a fiber interrupted mid-read waits at most one measurement before its interrupt takes effect.
