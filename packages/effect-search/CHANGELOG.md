# effect-search

## 0.7.0

### Minor Changes

- [#118](https://github.com/scenesystems/theoria/pull/118) [`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Redesign digest as Effect-native concern modules with root namespaces and matching
  `Blake3`, `CanonicalJson`, `ContentDigest`, `Digest`, `Hkdf`, `Hmac`, and `Utf8`
  subpaths. This is a breaking pre-1.0 API release; the old flat exports are removed.

  Raw hashes and HMACs are pure. Strict text and keyed primitives return `Either`
  for expected validation failures, including invalid derivation lengths. Streams
  and cooperative canonical/Schema hashing retain Effect failures, requirements,
  and interruption. Compose wire encodings with Effect's `Encoding` module.

  Structured hashing now returns the canonical `ContentDigest.ContentDigest` model;
  use `ContentDigest.toString` for the unchanged tagged string representation.
  Digest values reject noncanonical base64url pad bits. Migrate consumers to the
  owning concern modules; there are no compatibility aliases. Effect-search imports
  the canonical identity model and preserves its cache fingerprint wire format.

- [#118](https://github.com/scenesystems/theoria/pull/118) [`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Extract reusable evaluation, trial history, stop controls, scoped event streams, and schema-driven artifact persistence into `@scenesystems/effect-study`. Search retains optimization policies; DSP streams and fixed-profile text calibration consume the shared package directly.

  Redesign study and search around canonical public concern modules with matching root namespaces and package subpaths. This is a breaking pre-1.0 API migration: replace the previous contracts, error barrels, nested public modules, and forwarding declarations rather than retaining compatibility aliases. Migrate DSP and text consumers to the redesigned APIs.

  Preserve buffered completion events and release interrupted search-state mutations without blocking subsequent work. Replacing a trial now replaces its recorded cost instead of counting it twice.

  Derive recursive custom artifact payloads from Schema without changing their public types. Preserve all string keys, including `__proto__`, when encoding and decoding nested payload records.

### Patch Changes

- [#118](https://github.com/scenesystems/theoria/pull/118) [`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Redesign effect-math around canonical flat concern modules, matching root namespaces and package subpaths. This is a breaking pre-1.0 API migration: remove domain discovery descriptors and the `contracts` and `experimental` entrypoints; move runtime configuration to `Policy` and planning to `Scalar`, `Backend`, `Precision`, `Autodiff`, `Uncertainty`, and `Computation`.

  `Distribution` now owns all normal and uniform evaluation, including the standard-normal transform. `Probability.entropy` replaces `shannonEntropy`. Complex construction uses `Complex.make`, vector operations use `Complex.dot`, `norm`, and `scale`, and complex-step differentiation belongs to `Calculus.complexStep`. `LinearAlgebra.add` replaces `vectorAdd`; `scale(vector, scalar)` replaces `vectorScale(scalar, vector)`. Public schemas and errors have concise concern-qualified names; established error wire tags remain unchanged.

  Migrate search samplers to the canonical distribution operations without changing deterministic numerical accumulation or seeded replay.

- [#118](https://github.com/scenesystems/theoria/pull/118) [`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Preserve native Effect AI usage through DSP execution and provider failure boundaries.

  DSP trace entries and optimizer projections now retain `Response.Usage`, including independently reported input, output, total, reasoning, and cached-input tokens. Aggregates expose `{ tokens, callCount }`; an omitted counter remains unknown rather than becoming zero. Each DSP-visible model invocation records one terminal `Trace.Call`, including failed or interrupted invocations, independently of output parsing and successful trace projection. Lexical collectors isolate nested and concurrent scopes while forwarding records once to ancestors. Native Schema JSON codecs preserve optional usage and scores.

  DSP selects authoritative usage once at the invocation boundary and carries it beside the unchanged native response. Calls, successful prediction entries, ReAct iterations, and evaluation projections use that same value. Observations take precedence wholesale, including unknown counters; only unobserved successful calls fall back to native response usage. OpenAI, Google, and OpenRouter observers provide `Option<Report>` as their raw-report argument. A non-streaming response with no report emits unknown canonical counters and `None`; stream events without usage do not erase earlier snapshots.

  The new inference `OpenAiUsage`, `AnthropicUsage`, `GoogleUsage`, and `OpenRouterUsage` modules decorate native provider clients to observe usage before native structured-output decoding and tool processing. Each module is a root namespace and matching flat subpath exposing `observe`. `Usage.observe` instruments caller-owned native `LanguageModel.ConstructorParams` without replacing `LanguageModel.make`. Pass `Trace.observeUsage` to retain this evidence in DSP calls. Callbacks also receive the original native usage report or encoded finish part so additional provider details remain available. Narrow, lossless Schema transformations retain raw reports alongside canonical counters. Stream observations update a call's latest cumulative usage, not its call count. No provider totals or unreceived counters are fabricated. An opaque prebuilt model cannot provide this stronger pre-interpretation guarantee.

  Migration from DSP 0.3: replace flattened entry token fields with `entry.usage` and aggregate token fields with `usage.tokens`. `UsageSample`, `usageDelta`, `appendUsage`, `appendExecution`, mutable public trace fiber refs, and fabricated cache-hit counters are removed. Use `Trace.withCalls(Effect.exit(program))` to collect failure evidence. Provider errors retain their original types and are not retried by text parse policy. Durable attempt identity, pricing, persistence, and settlement remain application responsibilities.

  Prediction policies, marker parsing, retry feedback, and ReAct feedback use native Effect data, collection, and string operations. Capability-free `SearchPrimitiveOwnership` and `EffectSearchInteropOwnership` schemas and their constants are removed; use the actual `effect-search` operations directly. Optimizer parameter, dimension, graph, and objective projections remain available.

  ReAct retains native `Tool.HandlerError` and `Tool.Requirements` through `Module<I, O, E, R>`, module wrappers, evaluation, and optimizer composition. Expected per-example evaluation failures remain report entries; required services are not erased. Input prompts encode through the signature schema, and ReAct continues with native `Prompt.fromResponseParts`, preserving encoded structured tool successes and return-mode failures. Unsupported mock text responses and streaming now fail explicitly instead of producing placeholder or empty success. Mock object responses also reject unsupported nested values and JSON coercion of non-finite numbers rather than manufacturing valid output.

  Anthropic's observer callback now takes one `AnthropicUsage.Observation`, tagged `Response`, `MessageStart`, or `MessageDelta`. Its `usage` contains cumulative canonical token counters; its `raw` retains the unchanged native report, including delta server-tool evidence. Use `(observation) => Trace.observeUsage(observation.usage)` for DSP accounting, and retain tagged raw observations separately when needed for settlement. Do not treat delta reports as complete `BetaUsage` values.

  Replace recursive `FieldValue`, `FieldRecord`, and `MetricPayload` carriers with the actual signature output type in `Metric.Metric<E, R, A>` and schema-encoded JSON documents at heterogeneous persistence boundaries. `Entry.input`, `Entry.output`, trace projections, GEPA reflection, and optimizer event envelope payloads now contain `Payload.Payload` strings. Persisted record payloads require migration through their owning schema. Use `Payload.encode(schema, value)` and `Payload.decode(schema, document)`; the encoded schema must describe JSON data with suitable native equivalence. Encoding does not rerun domain transformation decoders, and failed equivalence or lossy encoding remains a checked `ParseError`. Intermediate ReAct output uses public `Trace.UnparsedOutput` with native optional parse errors. Evaluation and optimizers decode imported expected outputs before scoring, and bootstrap demonstrations retain their replayable schema-encoded form.

  Hugging Face feature extraction now uses public `EmbeddingModel.make`, platform `HttpClient`, `Schema`, per-layer single-flight `Cache`, and interruptible `Schedule` composition rather than SDK transport. `HuggingFaceEmbeddingModel.layer` accepts caller HTTP clients; `HuggingFaceEmbeddingModel.layerFetch` supplies the default fetch transport. Both consume `HuggingFaceEmbeddingModel.Options`, whose route determines direct execution or provider discovery. Dedicated URLs are used exactly, routed discovery supports the four feature-extraction providers, and chat-only selection policies fail explicitly. HTTP 503 retries are bounded to three attempts with 100/200 ms backoff. Responses require complete, finite, equal-width vectors and valid indices; credential headers remain redacted in typed HTTP failures. The later native-API corrections do not change dependencies or Effect sources; the full PR includes earlier Google dependency additions and an effect-text workspace-version adjustment in `bun.lock`.

  Text marker fields now decode through their owning encoded schemas before the original output Struct applies domain transformations once. Literal strings are preserved, including JSON-looking strings; nested structs, arrays, primitive JSON, defaults, Option fields, and renamed encoded keys replay in automatic text mode and ReAct without erasing schema services.

  Destination-bound demonstration contracts retain schema knowledge across heterogeneous module graphs. LabeledFewShot validates all selected demos before any mutation. BootstrapFewShot derives child demos from completed stage traces, applies per-destination caps and native structural equivalence, and restores the initial parameter tree on failure or interruption. `Trace.Entry.outcome` and trace projections distinguish `completed` from `intermediate` ReAct evidence; older entries default to completed. MIPROv2 uses only destination-valid labels and existing stage demos and excludes all-failed reports from objectives and successful checkpoint statistics. BootstrapRS also restores the full initial tree on failure or interruption and keeps the winner only on success.

  Composition, discovery, parameter traversal, and persistence use native Graph operations with consistent identity checks at every depth. Root collisions, mismatched child identities, distinct owners sharing an identity, and cycles fail explicitly; legitimate shared-node diamonds retain complete persisted parameter coverage. GEPA failures remain checked rather than becoming fallback instructions or schema defects. Example 12/14 reflective feedback again retains two decimal places; rounding follows Effect Number.round, which can differ from the former JavaScript toFixed at binary ties. This is prompt-text behavior, not only log presentation.

  Reward callbacks in `bestOfN` and `refine`, and reducers in `ensemble`, now retain their own checked errors and service requirements through the composed module. Refinement restores its snapshot after callback failure or interruption. Prompts and parse diagnostics use encoded field names and retain field descriptions across property transformations. Invalid expected labels fail evaluation before any model call.

  MIPROv2 preflights every destination's demonstrations before the first Phase 2 model call and renders lossless schema-encoded JSON rather than scalar placeholders. BootstrapRS builds its labeled baseline per destination, omitting incompatible labels without blocking heterogeneous programs. `Demonstration.Codec.toTrace` serializes validated wire demonstrations without rerunning domain transformations. `fromTrace` rejects excess fields. `Module.load` validates all destination demos before writing any parameter ref and leaves the full tree unchanged on validation failure. `Payload.decode` accepts native Schema parse options.

  GEPA initializes, evaluates, restores, and commits instructions across the complete owned predictor graph. Reflection distinguishes predictor execution evidence from program-level labels and feedback. Mutation acceptance evaluates its first-three-row gate before the remaining validation rows, skips the remainder on rejection, and reuses successful prefix scores without duplicate evaluation. Candidate evaluation restores the full parameter graph on checked failure and interruption.

  Weighted search sampling now consumes Effect v3's public `PCGRandom` and scales unit draws to cumulative relative weights. Fractional and normalized weights no longer collapse onto the first candidate; finite weights are rescaled before summation to prevent overflow, and non-finite weights are excluded. Weighted seeded sequences intentionally change, including GEPA parent selection. Zero-weight fallback policies retain their documented behavior. Search sampler, Pareto, optimizer progress, and model helpers consume native Effect operations and schema-derived data relationships.

  `bestOfN` and `refine` retain the complete live inner-module graph for save/load and optimization; constructors now return checked `CompositionError` for identity collisions. Wrapper names must differ from descendants. Old incomplete wrapper snapshots must be regenerated from the intended program state because missing inner parameters cannot be recovered. Direct `MIPROv2Search.run` preflights all candidate identities and destination demonstrations before baseline evaluation or mutation. Fractional positive ensemble sizes select at least one available member.

  TPE startup traversal, categorical density estimation, and acquisition scoring use native Effect collections, arithmetic, and schema-owned data. Unencodable categorical strings now fail with checked `InvalidSamplerConfig` rather than a URI defect.

  `Numeric.argmaxIndex`, `Numeric.sumWithPolicies`, and `Numeric.logSumExpWithPolicies` now accept `Chunk<number>` rather than arrays. Use `Chunk.fromIterable` at existing collection boundaries. The legacy `"typed-array"` backend policy retains Kahan-compensated summation but uses a chunk carrier. `Numeric.abs` consumes native Effect operations while preserving positive-zero magnitude, infinities, and NaN.

  Log-space addition and log-sum-exp propagate NaN and otherwise preserve positive infinity instead of producing an indeterminate shifted result. Strict `log1p` and `expm1` preserve negative zero. Their series arithmetic and traversal use native Effect operations. Documentation search uses native Effect strings, collections, models, and lazy selection while retaining normalization, typo matching, and ranking order.

  Wrappers register through the canonical composition runtime, so discovery records their full executed lineage as well as persistence ownership. GEPA mutation and merge decisions reject unordered NaN scores without running deferred validation. Pareto holdings and expected-improvement selection no longer promote NaN over an ordered incumbent. `Numeric.argmaxIndex` prefers ordered values to NaN, retains the first ordered maximum, and returns the first index for an all-NaN nonempty chunk.

  Model-driven joint categorical TPE rejects products exceeding 65,536 tuples with checked `InvalidSamplerConfig` before allocation. Candidate draw count does not bound domain size; random startup remains unchanged. Cumulative categorical probabilities use native linear-time `Array.scan`. Conditional, mixed, continuous, grouped, and multivariate TPE helper paths use native Effect data and operations while preserving the seeded numerical fixtures.

  Discovery scopes now share an atomic `SynchronizedRef` collector across forked fibers. Concurrent ensemble registrations no longer overwrite sibling branches, and conflicting registrations fail without changing the winning entry. Nested scopes remain isolated and restore their parent collector on failure or interruption. The collector is private; use `Module.discoverModules` and `Module.discoverModuleGraph` for concurrent collection. Snapshots observe completed registrations without waiting for detached fibers.

  The error-function kernels reached by continuous TPE use `Chunk` coefficients and native Effect traversal, arithmetic, predicates, and lazy region selection. Their Cephes approximation and exceptional-value behavior remain unchanged, with SciPy fixture and region-boundary coverage. Host exponential evaluation is unchanged.

  MIPROv2 Phase 2 now rejects duplicate or unknown candidate sets and candidates naming a different predictor before any proposal-model call. Destination wire validation remains checked and parameter refs remain unchanged on rejection. `InstructionProposalFailed.predictorIndex` is `-1` for an unknown target and otherwise identifies its proposal position.

  Refinement continues after an initial NaN reward, carries feedback into subsequent attempts, and lets any later ordered score replace that initial result. NaN never meets a threshold or displaces an ordered score; all-NaN runs exhaust the attempt budget and retain the first output. Infinite scores remain ordered and a NaN threshold is unreachable. Default feedback reports the score and threshold without claiming an unordered score is below the threshold.

  Pareto helpers, BootstrapFewShot progress, and inference capability defaults and validation consume native Effect APIs and schema-derived models. Capability requirements preserve their existing admission policy: true requires support, false adds no constraint, and structured-output requirements specify a minimum grade. Remaining weighted, continuous, and multivariate TPE prefix sums use linear-time `Array.scan` without changing seeded numerical behavior.

- [#118](https://github.com/scenesystems/theoria/pull/118) [`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Use Effect predicates, optional values, tuples, and Schema-derived trial logs in
  the study-storage provider while preserving snapshot selection, log order, replay
  boundaries, and typed storage failures.
- Updated dependencies [[`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc), [`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc), [`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc), [`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc)]:
  - @scenesystems/effect-math@0.5.0
  - @scenesystems/digest@0.7.0
  - @scenesystems/effect-study@0.1.0

## 0.6.0

### Minor Changes

- [#104](https://github.com/scenesystems/theoria/pull/104) [`44a540d`](https://github.com/scenesystems/theoria/commit/44a540df4745f7de0c3cea2528a24010fe0e1f0a) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Fix cache publication races: serialize reads, writes, removals, and miss computations per key within one service instance, including simultaneous acquisition of a previously unused key. Different keys progress independently. Failed lookups are immediately retryable; failed or interrupted mutations invalidate uncertain local state without hiding failures. Cancelled waiters do not encode values or mutate the backend.

  **Breaking (0.x):**

  - Direct `makeSchemaCache()` callers must provide `Scope` for reference-counted per-key locks. `SchemaCacheLive` owns that scope when used as a Layer.
  - Pass the configuration Schema to `StudyObjectiveCache`: use `resolve(new StudyObjectiveCacheRequest({ schema, config, compute }))` and `invalidate(schema, config)`. Each operation encodes the configuration once and fingerprints its encoded form; existing identity-Schema fingerprints remain unchanged.

  Expose `SchemaCacheRequest` and Schema-derived `SchemaCacheResult` tuples. Keep key encoding lazy and validate SQL result rows through `SqlSchema`.

  Use native Effect models, traversal, and arithmetic for objective aggregation and result selection, preserving coordinate-wise means, population variance, reported costs, and typed rejection.

### Patch Changes

- Updated dependencies [[`44a540d`](https://github.com/scenesystems/theoria/commit/44a540df4745f7de0c3cea2528a24010fe0e1f0a), [`44a540d`](https://github.com/scenesystems/theoria/commit/44a540df4745f7de0c3cea2528a24010fe0e1f0a)]:
  - @scenesystems/digest@0.6.0

## 0.5.0

### Minor Changes

- [#85](https://github.com/scenesystems/theoria/pull/85) [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Artifact persistence fails loud. `ArtifactSink.emit`, `StudyStorage`, `EventPublisher.publish`, `readEnvelopeLog`, `ObjectiveTrialRuntime.report` and `requestStop`, `InterruptionSnapshotSink`, and the study runtime that calls them carry `ArtifactStorageError` (`operation: "write" | "read"`, `path`, `detail`) in the typed error channel instead of discarding filesystem and encoding failures. A study whose envelope log cannot be written now fails with that error; previously it completed with a silently truncated log. `ArtifactStorageError` is a member of `StudyErrorSchema` and `SearchErrorSchema`. `ObjectiveTrialRuntime.report` is typed `InvalidObjectiveReport | ArtifactStorageError` instead of `unknown`.

  `readEnvelopeLog` is strict: every non-blank line must decode as an artifact envelope, and any that does not, including a torn final line left by a crash mid-append, fails the read with an `ArtifactStorageError` naming the line and the decoding issues. Previously invalid lines were skipped without notice. A log that does not exist yet still reads as empty. A study resumed from a torn or corrupt log therefore fails with `ArtifactStorageError` rather than silently continuing from a partial history.

  An `ArtifactStorageError` raised while an objective reports through `ObjectiveTrialRuntime.report` or `requestStop` is the study's failure, not the trial's: it is not wrapped in `TrialError`, not retried by the trial retry schedule, and fails the study with the write error intact.

  The trial retry loop decides on the whole cause of an attempt, not its first typed failure. An attempt is retried only when its cause is nothing but trial failures; a cause that also carries a storage error, a defect, or an interruption passes through intact and unretried, and an exhausted schedule fails with the last attempt's complete cause. A failed trial whose cause holds more than a single trial failure, such as an objective failure followed by a finalizer defect, or alongside an interruption, records a `TrialError` whose `cause` is that whole cause rather than the first failure alone.

  A trial whose objective exceeds `trialTimeout` is `Cancelled` only when its interrupted fiber exits with nothing but that interruption. Anything else the objective died from on its way out, such as a rejected report a cleanup finalizer escalated with `orDie`, now finalizes the trial as `Failed` with that cause instead of being discarded as a timeout.

  `Study` exports `EventPublisher`, whose type already appeared in `ExecuteRequest`.

  The checkpoint written when a study fails or is interrupted runs uninterruptibly with a typed error channel: a checkpoint that cannot be written is sequenced after the study's own cause in the `Exit`, so typed handlers see the study's failure and the lost recovery point is not hidden.

  `TerminalSink.supportsAnsi` is `Effect<boolean>`: a capability probe that can fail is resolved by the caller, and the reporter no longer falls back to plain text on an unobserved failure.

  These widen public error types, which is a breaking change under 0.x semver, hence a minor release.

  `Pareto.objectiveHoldingWeights` is removed. It was an exact alias of `objectiveFrontierWeights`, which remains the single frontier-weight entrypoint; callers rename the import.

  `SearchSpace.unsafeMake` and `SearchSpace.unsafeMakeConditional` are removed. `SearchSpace.make` and `SearchSpace.makeConditional` are the only constructors; an invalid declaration is an `InvalidSearchSpace` in the error channel, never a defect raised through a synchronous runtime. The experimental scenario fixtures follow: `makeSlotSpace`, `makePromptCategoricalSpace`, `makeMixedOptimizerSpace`, `makeRandomTrainingSpace`, `makeLogLearningRateSpace`, and `makeLinearTreeConditionalSpace` return that Effect, and their config decoders (`decodeSlotConfig`, `decodePromptCategoricalConfig`, `decodeMixedOptimizerConfig`, `decodeRandomTrainingConfig`, `decodeLogLearningRateConfig`, `decodeLinearTreeConditionalConfig`) are `Schema.decodeUnknown` Effects; the throwing variants and the `*Effect`-suffixed duplicates are gone.

  A persisted `Completed` trial state requires `retryCount`, matching the in-memory `Trial.Completed` state. `decodeStudySnapshot` fails with a `ParseError` for a record that omits it instead of restoring zero retries, and `evaluationCount` is restored exactly as persisted: a warm-start trial that never carried one no longer acquires `evaluationCount: 1` on resume.

- [#85](https://github.com/scenesystems/theoria/pull/85) [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Optimizer, scheduler and resume option records are `Data.Class` types instead of `Readonly<{ … }>` aliases; `SelectWeightedIndexOptions` and `SampleWeightedPairOptions` are `Schema.Struct` values exported alongside their types. Existing object literals remain assignable. Internal absence is modelled with `Option`, never `null`.

  The default terminal sink writes through Effect's `Console` service. It no longer probes `globalThis.process` for TTY streams or emits ANSI colour sequences, so output is identical in every runtime and fully capturable by `Console` test layers.

### Patch Changes

- Updated dependencies [[`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0), [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0), [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0)]:
  - @scenesystems/effect-math@0.4.0
  - @scenesystems/digest@0.5.3

## 0.4.3

### Patch Changes

- [#69](https://github.com/scenesystems/theoria/pull/69) [`002cb72`](https://github.com/scenesystems/theoria/commit/002cb725c94adfde2587526166a1a4ab7632dc87) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Rewrite the package README as a set of consistent documentation guides: overview, getting started, topic guides with typechecked examples, public surface, errors and boundaries, and runnable examples.

- [#69](https://github.com/scenesystems/theoria/pull/69) [`002cb72`](https://github.com/scenesystems/theoria/commit/002cb725c94adfde2587526166a1a4ab7632dc87) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Reject configurations that previously passed validation:
  - `Study.optimize` requires `trials` and `concurrency` to be integers, rejects a non-zero `epsilon` for single-objective studies, and rejects `targetValue` and `noImprovementWindow` for multi-objective studies.
  - Single-objective `tell` fails with `InvalidObjectiveValue` for non-finite numbers.
  - `Scheduler.hyperband` and `Scheduler.bohb` reject non-finite `maxResource`, `reductionFactor`, and `explorationRatio`.
  - The TPE sampler requires `nStartupTrials` and `nEiCandidates` to be finite integers.
  - The experimental scenario schemas declare `maxDepth`, `minSamplesLeaf`, `depth`, and `batchSize` as `Schema.Int`.

- Updated dependencies [[`002cb72`](https://github.com/scenesystems/theoria/commit/002cb725c94adfde2587526166a1a4ab7632dc87), [`002cb72`](https://github.com/scenesystems/theoria/commit/002cb725c94adfde2587526166a1a4ab7632dc87)]:
  - @scenesystems/effect-math@0.3.2
  - @scenesystems/digest@0.5.2

## 0.4.2

### Patch Changes

- [#68](https://github.com/scenesystems/theoria/pull/68) [`91f48e4`](https://github.com/scenesystems/theoria/commit/91f48e4b571442f9370c3dc15cb46095465a52a1) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Publish the rewritten package README with a clearer account of the package's purpose, use, and place in Theoria.

- Updated dependencies [[`58fbcc0`](https://github.com/scenesystems/theoria/commit/58fbcc02378bddc0f4bfd7da84574f76c273996a), [`91f48e4`](https://github.com/scenesystems/theoria/commit/91f48e4b571442f9370c3dc15cb46095465a52a1)]:
  - @scenesystems/digest@0.5.1
  - @scenesystems/effect-math@0.3.1

## 0.4.1

### Patch Changes

- Updated dependencies [[`e403ba2`](https://github.com/scenesystems/theoria/commit/e403ba20186d4d58be5e619a5e7f253b511c9164)]:
  - @scenesystems/digest@0.5.0
  - @scenesystems/effect-math@0.3.0

## 0.4.0

### Minor Changes

- [#49](https://github.com/scenesystems/theoria/pull/49) [`873731c`](https://github.com/scenesystems/theoria/commit/873731ca75aad31ca46fd93d482eabbc0e8239af) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Raise the public Effect peer and provider dependency contracts to the latest stable Effect 3.22-compatible release train.

### Patch Changes

- Updated dependencies [[`873731c`](https://github.com/scenesystems/theoria/commit/873731ca75aad31ca46fd93d482eabbc0e8239af)]:
  - @scenesystems/digest@0.4.0
  - @scenesystems/effect-math@0.3.0

## 0.3.1

### Patch Changes

- Move numerical and inference dependencies to the scoped `@scenesystems/effect-math` and `@scenesystems/effect-inference` package identities.

## 0.3.0

### Minor Changes

- [#29](https://github.com/scenesystems/theoria/pull/29) [`5956e18`](https://github.com/scenesystems/theoria/commit/5956e18f32182df8f10dcd8f44d4458e664acd82) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Adopt the strict digest 0.3 text and error contracts for cache fingerprinting.
  - Replace the re-exported `FingerprintUnsupportedValue` with the closed, package-owned `RuntimeFingerprintError` for runtime-only value rejection.
  - Propagate digest's `InvalidUnicode` directly from runtime fingerprint text encoding instead of replacement-encoding malformed UTF-16.
  - Continue exposing digest's `CanonicalizationError` directly from durable JCS fingerprint operations.
  - Fingerprint study objective cache observations from the Schema-encoded key wire and propagate encoding or Unicode failures through `CacheError` instead of recording the shared `"unknown"` label.

### Patch Changes

- Updated dependencies [[`cfc5080`](https://github.com/scenesystems/theoria/commit/cfc508039f05eb96dd8004e75ae485f232c848f1)]:
  - @scenesystems/digest@0.3.0
  - effect-math@0.2.1

## 0.2.1

### Patch Changes

- [#21](https://github.com/scenesystems/theoria/pull/21) [`1f68ecc`](https://github.com/scenesystems/theoria/commit/1f68ecc48ba1fc2b272b69a7bfcdefa3d93cf4e5) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Fix stream bridge completion delivery for merged consumers and preserve tail events emitted at stream shutdown boundaries.

## 0.2.0

### Minor Changes

- [#17](https://github.com/scenesystems/theoria/pull/17) [`020ea82`](https://github.com/scenesystems/theoria/commit/020ea82e94b23380fcd871737087504cd2e439f2) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Add advanced continuous samplers to `effect-search` with new `Sampler.cmaEs()` and `Sampler.gpBo()` constructors.

  This release expands sampler taxonomy/checkpoint schemas (`CmaEs` and `GpBo`), adds typed sampler compatibility errors (`SamplerSearchSpaceUnsupported`, `SamplerObjectiveUnsupported`), supports snapshot/resume validation for the new samplers, and ships deterministic fixture-backed + integration coverage for advanced sampler execution.

  Documentation and examples now include advanced-sampler guidance and continuous-space comparison coverage.

### Patch Changes

- [#17](https://github.com/scenesystems/theoria/pull/17) [`020ea82`](https://github.com/scenesystems/theoria/commit/020ea82e94b23380fcd871737087504cd2e439f2) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Harden advanced sampler determinism and shared SQL cache integration in `effect-search`.
  - preserve GP-BO deterministic replay by consuming seeded RNG draws only for Thompson sampling and by reusing a single Cholesky factor during posterior construction
  - replace the SQLite-runtime-specific `SchemaCacheSqlite` helper with `SchemaCacheSql`, which accepts a caller-provided SQLite-compatible `SqlClient` layer for shared cache storage
  - keep advanced sampler fixture verification wired into the committed Optuna parity suite so cache and sampler regressions are caught together

- [#17](https://github.com/scenesystems/theoria/pull/17) [`020ea82`](https://github.com/scenesystems/theoria/commit/020ea82e94b23380fcd871737087504cd2e439f2) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Reduce hot-path TPE overhead in `effect-search` so deterministic optimization stays within local test budgets.
  - remove per-candidate Effect wrapper overhead from the univariate float and int TPE trace builders
  - reduce continuous Parzen sampling and density overhead by reusing kernel parameter objects in the hot path
  - route continuous Parzen and multivariate Gaussian log-density aggregation through the shared `effect-math` `logSumExp` authority so the sampler stays aligned to the math source of truth

- Updated dependencies [[`774c14c`](https://github.com/scenesystems/theoria/commit/774c14c0a27d05c01109ac496fd15b9efeb8d922), [`020ea82`](https://github.com/scenesystems/theoria/commit/020ea82e94b23380fcd871737087504cd2e439f2), [`020ea82`](https://github.com/scenesystems/theoria/commit/020ea82e94b23380fcd871737087504cd2e439f2), [`4651634`](https://github.com/scenesystems/theoria/commit/46516347d9c73308cfb7ea65ab98eae77537f3be), [`3c3e316`](https://github.com/scenesystems/theoria/commit/3c3e316dd563bb684338e521e9e0e953b872c329)]:
  - @scenesystems/digest@0.2.0
  - effect-math@0.2.0

## 0.1.3

### Patch Changes

- [#11](https://github.com/scenesystems/theoria/pull/11) [`7de6c02`](https://github.com/scenesystems/theoria/commit/7de6c02e0d65cd66b5d4c2ed1c01a8c7bee6ee01) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - fix: resolve workspace: protocol deps to real semver in dist/package.json at build time

  `build-utils pack-v3` copies `workspace:^` dependencies verbatim into `dist/package.json`,
  and `changeset publish` (which calls `npm publish` internally) does not rewrite them. This
  made published packages uninstallable outside the monorepo.

  Adds `scripts/resolve-workspace-deps.ts` which runs after all per-package builds, reads each
  workspace package's actual version, and rewrites `workspace:^` → `^{version}` (and `~`, `*`
  variants) in every `dist/package.json`. Also supports `--check` mode for CI verification.

## 0.1.2

### Patch Changes

- [#9](https://github.com/scenesystems/theoria/pull/9) [`575eee5`](https://github.com/scenesystems/theoria/commit/575eee520879202d8b3c314a1e4bc63a545c08a7) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - fix: replace workspace:\* with workspace:^ so changesets resolves real version ranges on publish

- Updated dependencies [[`575eee5`](https://github.com/scenesystems/theoria/commit/575eee520879202d8b3c314a1e4bc63a545c08a7)]:
  - effect-math@0.1.2

## 0.1.1

### Patch Changes

- [#7](https://github.com/scenesystems/theoria/pull/7) [`879632d`](https://github.com/scenesystems/theoria/commit/879632dbc69face1471bf9f8e78c68e756dc854c) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Fix LCG attribution (Knuth, not Numerical Recipes), correct broken standalone effect-dsp links to monorepo paths, remove stale monorepo migration TODO, and update publish-readiness script constants to match packages/effect-search layout.

- Updated dependencies [[`2025cab`](https://github.com/scenesystems/theoria/commit/2025cab1ebda57eb22a0637df96cc3b2e9a52dae)]:
  - effect-math@0.1.1

## 0.1.0

### Minor Changes

- [#1](https://github.com/scenesystems/theoria/pull/1) [`39bfeb7`](https://github.com/scenesystems/theoria/commit/39bfeb72577a0d40da554055e461ca2bf9ab375e) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Initial release of `effect-search` — Bayesian optimization for TypeScript, built on Effect.

  ### Search spaces
  - **Typed parameter definitions** — `float`, `int`, `categorical`, `boolean`, and tree-structured conditionals with full type inference
  - **Composable spaces** — build complex hierarchical search spaces with `SearchSpace.unsafeMake` and conditional branching

  ### Samplers
  - **Random** — uniform baseline with deterministic seed control
  - **Grid** — exhaustive search with finite dimension enumeration
  - **TPE** — Tree-structured Parzen Estimator with Expected Improvement, Probability of Improvement, and Thompson sampling acquisition functions
  - **Multivariate TPE** — joint density estimation for correlated parameter spaces via continuous Parzen windows
  - **Constrained TPE** — constraint-aware optimization with feasibility-weighted acquisition
  - **MOTPE** — multi-objective TPE for Pareto-optimal trade-offs with non-dominated sorting

  ### Study orchestration
  - **`Study.optimize`** — single entry point for complete optimization runs with budget, direction, and concurrency control
  - **`Study.optimizeStream`** — streaming variant emitting real-time `StudyEvent` lifecycle events
  - **Snapshot/resume** — serialize study state for persistence and resume optimization across process boundaries
  - **Ask/tell protocol** — manual orchestration for external objective evaluation loops
  - **Warm-starting** — inject trials from prior studies to skip the cold-start phase

  ### Multi-fidelity scheduling
  - **HyperBand** — successive halving with automatic bracket selection for early stopping of unpromising configurations
  - **BOHB** — Bayesian Optimization and HyperBand combining TPE-guided sampling with multi-fidelity evaluation

  ### Pareto utilities
  - **Non-dominated sorting** — epsilon-dominance Pareto front extraction
  - **Hypervolume indicator** — exact hypervolume computation for multi-objective quality assessment
  - **Objective normalization** — direction-aware vector normalization for mixed minimize/maximize objectives

  ### Pruning
  - **Constant-liar imputation** — pending trial handling for parallel optimization with configurable imputation policies
  - **Percentile pruning** — early stopping based on intermediate result comparison against configurable percentile thresholds

  ### Infrastructure
  - **Deterministic seeds** — reproducible optimization runs with xoshiro256++ PRNG
  - **Content-addressed caching** — durable fingerprinting via `@scenesystems/digest` for objective result deduplication
  - **Typed error hierarchy** — `SpaceError`, `SamplerError`, `StudyError`, and `SearchError` union types with `Schema.TaggedError` members in the Effect error channel

  Built entirely on [Effect](https://effect.website) with typed error channels, fiber-safe concurrency, and Schema-driven type inference throughout. Depends on `@scenesystems/digest` for content-addressed caching and `effect-math` for numerical primitives.

### Patch Changes

- Updated dependencies [[`39bfeb7`](https://github.com/scenesystems/theoria/commit/39bfeb72577a0d40da554055e461ca2bf9ab375e), [`39bfeb7`](https://github.com/scenesystems/theoria/commit/39bfeb72577a0d40da554055e461ca2bf9ab375e)]:
  - @scenesystems/digest@0.1.0
  - effect-math@0.1.0
