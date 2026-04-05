# effect-text

## 0.2.0

### Minor Changes

- [#23](https://github.com/scenesystems/theoria/pull/23) [`ee3ebec`](https://github.com/scenesystems/theoria/commit/ee3ebeccaaddf56f56b86ab154fa50bdda3f99c9) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Adds prepared text handles, richer layout APIs, browser helpers, and experimental calibration tools.
  - adds prepared text handles and expands the pure layout API with cursor stepping, streaming line projection, variable-width layout, fit-vs-paint handling, and width-only reprojection
  - improves Unicode and line breaking with deterministic segmentation fallback, bidi visual ordering, mirrored punctuation, and overflow precedence of `hard-break -> soft-hyphen -> dictionary-hyphen -> explicit-break -> grapheme-fallback`
  - adds dictionary hyphenation for `en-us`, `en-gb`, `de`, `fr`, and `es`, including locale fallback and explicit soft-hyphen precedence
  - adds `effect-text/browser` with canvas measurement layers, font-readiness helpers, support-manifest data, parity utilities, and checked-in parity artifacts for `canvas-monospace` and `canvas-system-ui`
  - adds `effect-text/react` helpers for prepare identity and pure prepared-layout projection
  - expands `Experimental.Calibration` with seeded `effect-search` studies, `StudySnapshot` artifacts, ordered `StudyEvent` logs, canonical calibration fixtures, and `effect-math`-backed scoring
  - refreshes the README, examples, and generated docs to match the new browser, React, hyphenation, and calibration features

### Patch Changes

- Updated dependencies [[`ee3ebec`](https://github.com/scenesystems/theoria/commit/ee3ebeccaaddf56f56b86ab154fa50bdda3f99c9)]:
  - effect-math@0.2.1
  - effect-search@0.2.1

## 0.1.0

### Minor Changes

- [#18](https://github.com/scenesystems/theoria/pull/18) [`78aa684`](https://github.com/scenesystems/theoria/commit/78aa684157632fc3c3e23dad0c20d919ceb60929) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Initial release of `effect-text` — Effect-native text preparation and greedy multiline layout, inspired by [pretext](https://github.com/chenglou/pretext).

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

### Patch Changes

- Updated dependencies [[`020ea82`](https://github.com/scenesystems/theoria/commit/020ea82e94b23380fcd871737087504cd2e439f2), [`020ea82`](https://github.com/scenesystems/theoria/commit/020ea82e94b23380fcd871737087504cd2e439f2), [`020ea82`](https://github.com/scenesystems/theoria/commit/020ea82e94b23380fcd871737087504cd2e439f2)]:
  - effect-search@0.2.0
