# effect-text

## 0.5.2

### Patch Changes

- [#132](https://github.com/scenesystems/theoria/pull/132) [`bc25d00`](https://github.com/scenesystems/theoria/commit/bc25d0048fe229800781f35dd965ea8d867bdd5e) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Update published dependency minimums to consume the exact binary scaling improvements in effect-math 0.5.2.
- Updated dependencies [[`bc25d00`](https://github.com/scenesystems/theoria/commit/bc25d0048fe229800781f35dd965ea8d867bdd5e)]:
  - @scenesystems/effect-search@0.8.1

## 0.5.1

### Patch Changes

- Updated dependencies [[`6685af5`](https://github.com/scenesystems/theoria/commit/6685af5203e4e9522ad8dd4d73b1a2ac4797d2cd), [`ef4797f`](https://github.com/scenesystems/theoria/commit/ef4797f66bee0670d5ebb1cd8261805c0c89f035), [`e0bfd10`](https://github.com/scenesystems/theoria/commit/e0bfd10de9d82cb1015b677179d41a312e63f691)]:
  - @scenesystems/effect-search@0.8.0
  - @scenesystems/effect-study@0.2.0
  - @scenesystems/effect-math@0.5.1

## 0.5.0

### Minor Changes

- [#118](https://github.com/scenesystems/theoria/pull/118) [`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Extract reusable evaluation, trial history, stop controls, scoped event streams, and schema-driven artifact persistence into `@scenesystems/effect-study`. Search retains optimization policies; DSP streams and fixed-profile text calibration consume the shared package directly.

  Require Effect v4 across study, search, DSP, and text. Preserve evaluator, objective, callback, stream, and codec failure and service channels rather than materializing them synchronously. Filesystem study and optimization storage requires Effect's `FileSystem` and `Path` services; schema reads and writes retain their independent decoding and encoding requirements. Stateful layers use `Layer.fresh`, so each acquisition allocates independent state; provide one acquired layer around operations that must share a run.

  `History.trials` is an Effect `HashMap`; use `History.values` for trial-number order. `StudyStorage.makeMemory` is an Effect: yield it or use `StudyStorage.layerMemory`. Instantiate exported option classes with `new`, including `new ArtifactContext.Options(...)` and `new StudyStorage.FileSystemOptions(...)`.

  Redesign study and search around canonical public concern modules with matching root namespaces and package subpaths. This is a breaking pre-1.0 API migration: replace the previous contracts, error barrels, nested public modules, and forwarding declarations rather than retaining compatibility aliases. Migrate DSP and text consumers to the redesigned APIs.

  Preserve buffered completion events and release interrupted search-state mutations without blocking subsequent work. Replacing a trial now replaces its recorded cost instead of counting it twice.

  Derive recursive custom artifact payloads from Schema without changing their public types. Preserve all string keys, including `__proto__`, when encoding and decoding nested payload records.

- [#118](https://github.com/scenesystems/theoria/pull/118) [`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Redesign the public API around Text, TextMeasurer, MeasurementCache, Hyphenation,
  CanvasTextMeasurer, CanvasProfile, PreparationKey, and Calibration. Each concern
  has matching root namespace and PascalCase subpath imports. Remove the previous
  Browser, React, contracts, and experimental entrypoints rather than retaining
  compatibility aliases.

  Require Effect v4. Preparation now exposes its `Text.Segmenter`,
  `Text.CurrentProfile`, and `MeasurementCache.MeasurementCache` service requirements;
  construct the cache Layer with `TextMeasurer.TextMeasurer`. Hyphenation remains an
  optional service. `Calibration.evaluate` requires `Text.Segmenter` and
  `MeasurementCache.MeasurementCache`, with the profile supplied directly.
  Optimization receives those services as a Layer through `OptimizeOptions.services`
  and accepts its sampler and optional storage through the same options.

  Use Text.summary for aggregate geometry, Text.lines for materialized lines,
  Text.layout for both, and Text.nextLine, Text.stream, and Text.ranges for incremental
  projections. Supply native Context services and Layers for measurement and
  hyphenation. PreparationKey owns structural preparation identity and font revision
  invalidation. Calibration owns profile evaluation and resumable optimization.

  Keep prepared measurement tables and cursor hints private to the handle's
  operations. Construct structural preparation identities directly with
  `new PreparationKey.PreparationKey(...)`; no separate normalization factory is required.

  Preserve scoped measurement caching and cancellation semantics, Unicode grapheme
  boundaries, and dictionary hyphenation. Correct canvas emoji compensation for
  graphemes containing combining marks. Migrate examples and the Theoria application
  to the canonical APIs.

### Patch Changes

- Updated dependencies [[`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc), [`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc), [`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc), [`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc), [`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc)]:
  - @scenesystems/effect-math@0.5.0
  - @scenesystems/effect-search@0.7.0
  - @scenesystems/effect-study@0.1.0

## 0.4.2

### Patch Changes

- Updated dependencies [[`44a540d`](https://github.com/scenesystems/theoria/commit/44a540df4745f7de0c3cea2528a24010fe0e1f0a)]:
  - @scenesystems/effect-search@0.6.0

## 0.4.1

### Patch Changes

- [#93](https://github.com/scenesystems/theoria/pull/93) [`73ae5f4`](https://github.com/scenesystems/theoria/commit/73ae5f43d59984c6f9ebcf6913d3611e877081db) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - A measurement lookup is the layer's work, not the reader's. `MeasurementCacheLive`, `BrowserMeasurementCacheLive` and `CanvasTextMeasurerLive` are scoped layers now: a cache miss forks the lookup into the layer's scope and the reader waits on it, so a reader interrupted while a measurement is pending stops waiting and nothing else — the lookup finishes and is the cache's for every other reader — and closing the layer's scope stops every measurement still pending. This replaces the uninterruptible read, which held a cancelled reader for the length of the measurement and could not be cancelled at all with an asynchronous `TextMeasurer`.

## 0.4.0

### Minor Changes

- [#85](https://github.com/scenesystems/theoria/pull/85) [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - `Experimental.Calibration.optimizeProfile` fails in the typed error channel when supplied study storage does not hold the calibration study. Storage that holds no snapshot after the study ran fails with the new `CalibrationSnapshotMissing`, carrying the retained trial-log length, and storage that resolves to a multi-objective study fails with the new `CalibrationStudyNotSingleObjective`. Previously both were defects.

- [#85](https://github.com/scenesystems/theoria/pull/85) [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Exported records are `Data.Class` types instead of `Readonly<{ … }>` aliases, `HyphenationSupportManifest` is typed by the new `HyphenationSupportManifestType`, and `BrowserParityResolvedCase` is a `Data.Class` exported from the browser entrypoint. Layout internals model absence with `Option`.

  Grapheme segmentation uses `Intl.Segmenter` unconditionally; the code-point fallback for runtimes without it is removed (every supported runtime — Bun, Node 22, Workers, evergreen browsers — ships it).

  `React.PrepareIdentity` is a structural `Data.Class` (with `PrepareIdentityFont` and `PrepareIdentityEngineProfile`, absence as `Option`) that keys caches directly; the class replaces the `PrepareIdentityType` alias. The string codec (`PrepareIdentityKey`, `PrepareIdentityKeyType`, `prepareIdentityKey`, `prepareIdentityFromKey`, `engineProfileIdentity`) and its defaulting decode are removed, and `React.prepareInputFromIdentity` recovers the preparation input from an identity.

  The measurement, browser-measurement, emoji-probe, and hyphenation caches key on structural records instead of `encodeURIComponent` strings, so text or font families containing unpaired surrogates measure instead of raising `URIError`.

  Compatibility aliases are removed: `EngineProfileSchema` (use `EngineProfile`), `CalibrationSearchSpaceSpec`/`CalibrationSearchSpaceSpecType` (use `CalibrationSearchDescriptor`), and the `optimizeProfile` `searchSpaceSpec` option (use `searchDescriptor`).

- [#85](https://github.com/scenesystems/theoria/pull/85) [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - `renderBrowserParityArtifact` fails in the typed error channel. A profile that does not declare every released synthetic scenario fails with the new `BrowserParityCasesMissing`, naming the profile and the scenarios it omits, and a scenario whose text cannot be measured fails with that measurement's `MeasurementFailed`. Previously both were defects.

### Patch Changes

- [#85](https://github.com/scenesystems/theoria/pull/85) [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - A canvas context whose `measureText` raises now fails `CanvasTextMeasurerLive` with a `MeasurementFailed` in the typed error channel, carrying the raised value in `reason`; previously the raised value escaped as a defect. The context's `font`, `direction` and `textBaseline` are restored either way.

  Measurement caches keep only successes. `MeasurementCacheLive`, `BrowserMeasurementCacheLive` and the emoji-probe cache evict a key whose lookup failed, so a measurement that failed once (a font that was not yet ready, a context that raised) fails that read and is measured again on the next request instead of replaying the failure for the cache's time to live.

- Updated dependencies [[`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0), [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0), [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0), [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0)]:
  - @scenesystems/effect-math@0.4.0
  - @scenesystems/effect-search@0.5.0

## 0.3.2

### Patch Changes

- [#69](https://github.com/scenesystems/theoria/pull/69) [`002cb72`](https://github.com/scenesystems/theoria/commit/002cb725c94adfde2587526166a1a4ab7632dc87) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Rewrite the package README as a set of consistent documentation guides: overview, getting started, topic guides with typechecked examples, public surface, errors and boundaries, and runnable examples.

- [#69](https://github.com/scenesystems/theoria/pull/69) [`002cb72`](https://github.com/scenesystems/theoria/commit/002cb725c94adfde2587526166a1a4ab7632dc87) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - - Line layout stops when the cursor reaches the end of the prepared segments instead of asking the line walker for a record past the input.
  - `Calibration` report totals sum the per-case losses directly instead of multiplying the mean by the count.
  - The browser support manifest caveats describe the synthetic regression context instead of claiming browser parity; the live harness is now `examples/live/syntheticRegressionHarness.ts` (`verify:synthetic-regression`).
- Updated dependencies [[`002cb72`](https://github.com/scenesystems/theoria/commit/002cb725c94adfde2587526166a1a4ab7632dc87), [`002cb72`](https://github.com/scenesystems/theoria/commit/002cb725c94adfde2587526166a1a4ab7632dc87), [`002cb72`](https://github.com/scenesystems/theoria/commit/002cb725c94adfde2587526166a1a4ab7632dc87)]:
  - @scenesystems/effect-math@0.3.2
  - @scenesystems/effect-search@0.4.3

## 0.3.1

### Patch Changes

- [#68](https://github.com/scenesystems/theoria/pull/68) [`91f48e4`](https://github.com/scenesystems/theoria/commit/91f48e4b571442f9370c3dc15cb46095465a52a1) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Publish the rewritten package README with a clearer account of the package's purpose, use, and place in Theoria.

- Updated dependencies [[`91f48e4`](https://github.com/scenesystems/theoria/commit/91f48e4b571442f9370c3dc15cb46095465a52a1)]:
  - @scenesystems/effect-math@0.3.1
  - @scenesystems/effect-search@0.4.2

## 0.3.0

### Minor Changes

- [#49](https://github.com/scenesystems/theoria/pull/49) [`873731c`](https://github.com/scenesystems/theoria/commit/873731ca75aad31ca46fd93d482eabbc0e8239af) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Raise the public Effect peer and provider dependency contracts to the latest stable Effect 3.22-compatible release train.

### Patch Changes

- Updated dependencies [[`873731c`](https://github.com/scenesystems/theoria/commit/873731ca75aad31ca46fd93d482eabbc0e8239af)]:
  - @scenesystems/effect-math@0.3.0
  - @scenesystems/effect-search@0.4.0

## 0.2.2

### Patch Changes

- Move numerical and inference dependencies to the scoped `@scenesystems/effect-math` and `@scenesystems/effect-inference` package identities.

- Updated dependencies []:
  - @scenesystems/effect-search@0.3.1

## 0.2.1

### Patch Changes

- Updated dependencies [[`5956e18`](https://github.com/scenesystems/theoria/commit/5956e18f32182df8f10dcd8f44d4458e664acd82)]:
  - effect-search@0.3.0
  - effect-math@0.2.1

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
