---
"@scenesystems/effect-text": patch
---

A measurement lookup is the layer's work, not the reader's. `MeasurementCacheLive`, `BrowserMeasurementCacheLive` and `CanvasTextMeasurerLive` are scoped layers now: a cache miss forks the lookup into the layer's scope and the reader waits on it, so a reader interrupted while a measurement is pending stops waiting and nothing else — the lookup finishes and is the cache's for every other reader — and closing the layer's scope stops every measurement still pending. This replaces the uninterruptible read, which held a cancelled reader for the length of the measurement and could not be cancelled at all with an asynchronous `TextMeasurer`.
