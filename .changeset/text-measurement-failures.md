---
"@scenesystems/effect-text": patch
---

A canvas context whose `measureText` raises now fails `CanvasTextMeasurerLive` with a `MeasurementFailed` in the typed error channel, carrying the raised value in `reason`; previously the raised value escaped as a defect. The context's `font`, `direction` and `textBaseline` are restored either way.

Measurement caches keep only successes. `MeasurementCacheLive`, `BrowserMeasurementCacheLive` and the emoji-probe cache evict a key whose lookup failed, so a measurement that failed once (a font that was not yet ready, a context that raised) fails that read and is measured again on the next request instead of replaying the failure for the cache's time to live.
