---
"effect-text": minor
---

Initial release of `effect-text` — Effect-native text preparation and greedy multiline layout, inspired by [pretext](https://github.com/chenglou/pretext).

**Core prepare/layout split:**

- `Text.prepare` — effectful compilation of raw input into an opaque `PreparedText` handle through explicit segmentation, measurement cache, and engine-profile services
- `Text.layout` / `Text.layoutLines` — pure summary and line materialization, safe to call on every resize with zero service dependencies
- `Text.layoutLinesWith` — per-line width resolution for obstacle-aware layout
- `Text.layoutNextLine` / `Text.streamLines` — cursor stepping and `Stream` projection over prepared text
- `Text.prepareUnknown` — schema-validated boundary helper for unknown input

**Services and layers:**

- `Contracts.WordSegmenter`, `Contracts.TextMeasurer`, `Contracts.MeasurementCache`, `Contracts.EngineProfile` — stable runtime seams for segmentation, measurement, caching, and engine quirks
- `Text.TextLayoutLive` — composed deterministic default layer suitable for tests and server contexts
- `Text.CanvasTextMeasurerLive` — additive browser canvas measurement with optional emoji correction probe
- Individual layers (`WordSegmenterLive`, `TextMeasurerLive`, `EngineProfileLive`, `MeasurementCacheLive`) for custom wiring

**Typed errors:**

- `MeasurementFailed` and `TextLayoutDecodeError` with tagged error channels

**Experimental calibration:**

- `Experimental.Calibration.evaluateProfile` — typed calibration corpus evaluation against candidate engine profiles
- `Experimental.Calibration.optimizeProfile` — `effect-search`-driven optimization loop over candidate profiles
- `Experimental.Calibration.makeProfileSearchSpace` — default search space construction for engine-profile tuning
