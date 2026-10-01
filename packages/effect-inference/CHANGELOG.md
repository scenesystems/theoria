# @scenesystems/effect-inference

## 0.4.0

### Minor Changes

- [#118](https://github.com/scenesystems/theoria/pull/118) [`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Redesign the DSP and inference public APIs around canonical Effect-style concerns. This is a breaking pre-1.0 migration: legacy paths and declarations are removed, without compatibility aliases.

  Each public concern now has one flat PascalCase source module, root namespace, and matching package subpath. Private mechanics live under camelCase `internal/` paths and are inaccessible through package exports. Schema owns encoded data and derived types; Data owns executable generic relationships; Context and Layer own capabilities and implementations.

  For DSP, import `BootstrapFewShot`, `BootstrapRS`, `LabeledFewShot`, `MIPROv2`, `GEPA`, and `Ensemble` directly rather than through `Optimizer`. Use algorithm-local `Options`, `Event`, `EventSink`, `run`, `runWithEvents`, `stream`, and progress operations. Use `Ensemble.make` with `ReduceFn` and `ReduceOptions`. Candidate proposal and direct search belong to `MIPROv2Candidates` and `MIPROv2Search`; evaluation projection belongs to `EvaluationObjective`.

  Replace `contracts` imports with their canonical owners: `Module.Id`, `Module.Node`, `Module.RolloutCount`, `ModuleGraph.ModuleGraph`, `ModuleParameters.ModuleParameters`, `Demonstration.Demonstration`, `Demonstration.Codec`, `Metric.Result`, `Payload.Payload`, `Trace.Usage`, and `OptimizerEvent.Envelope`. Use concern-local operations such as `ModuleParameters.withInstructions`, `ModuleGraph.traversal`, and `Payload.encode`/`decode`. `DspError` owns package failures. `MockLanguageModel` is a root namespace and subpath with `succeed`, `sequence`, `fromFunction`, `map`, `fail`, `make`, and `layer`. Search studies, samplers, Pareto operations, artifact envelopes, and seeds are consumed directly from effect-search, without a DSP bridge.

  For inference, replace descriptor and contracts imports with `Model`, `Route`, `Capabilities`, `RuntimeRequest`, and `RuntimeEvidence`. A request contains `model`, not `artifact`. A `Runtime.Resolution` contains `request`, `route`, and `models`, not `desired`, `resolvedRoute`, and `layers`. Persisted evidence contains `request`, `route`, and `response`, replacing `desired`, `resolvedRoute`, and `resolvedRuntime`; migrate persisted documents explicitly. Model intent, pre-execution provenance, and post-response observations remain separate.

  Use `Runtime.Runtime`, `Runtime.Service`, `Runtime.resolve`, `Runtime.layer`, and `Runtime.layerWith`; `Service` replaces `Implementation`. `TextProvider` owns configured OpenAI, Anthropic, and OpenRouter construction. `HuggingFace` owns configuration, while `HuggingFaceEndpoint` and `HuggingFaceRouted` own their routes, language-model layers, and resolution. `HuggingFaceEmbeddingModel.Options`, `layer`, and `layerFetch` replace the endpoint-owned embedding options and duplicated endpoint/routed embedding constructors. `InferenceError` owns checked package failures. Native client observers are flat `AnthropicUsage`, `GoogleUsage`, `OpenAiUsage`, and `OpenRouterUsage` modules exposing `observe`; `Usage.observe` is the provider-independent constructor hook. `Testing` owns deterministic layers and fixtures.

  Migrate affected examples, application composition, documentation links, and behavioral suites to these APIs. Preserve provider usage evidence, schema-encoded demonstrations, candidate preflight, generic error/service channels, concurrent discovery, and restoration after checked failures or interruption. Eva package adoption and persisted application settlement remain downstream responsibilities after publication.

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

## 0.3.0

### Minor Changes

- [#85](https://github.com/scenesystems/theoria/pull/85) [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Provider, runtime and evidence records are `Data.Class` types instead of `Readonly<{ … }>` aliases; optional provider fields are set only when present rather than assigned `undefined`. Existing object literals remain assignable.

### Patch Changes

- [#85](https://github.com/scenesystems/theoria/pull/85) [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Update `@huggingface/inference` to 4.13.28.

## 0.2.2

### Patch Changes

- [#69](https://github.com/scenesystems/theoria/pull/69) [`002cb72`](https://github.com/scenesystems/theoria/commit/002cb725c94adfde2587526166a1a4ab7632dc87) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Rewrite the package README as a set of consistent documentation guides: overview, getting started, topic guides with typechecked examples, public surface, errors and boundaries, and runnable examples.

## 0.2.1

### Patch Changes

- [#54](https://github.com/scenesystems/theoria/pull/54) [`2c83ef8`](https://github.com/scenesystems/theoria/commit/2c83ef8a50fb3aab7919d5325b75c973e0a9d0f0) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Treat blank provider-specific settings as absent so deployments can safely fall back to generic provider configuration.

## 0.2.0

### Minor Changes

- [#49](https://github.com/scenesystems/theoria/pull/49) [`873731c`](https://github.com/scenesystems/theoria/commit/873731ca75aad31ca46fd93d482eabbc0e8239af) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Raise the public Effect peer and provider dependency contracts to the latest stable Effect 3.22-compatible release train.

The scoped identity continues the release history of the former unscoped `effect-inference` package.

## 0.1.0

### Minor Changes

- [#25](https://github.com/scenesystems/theoria/pull/25) [`6d68855`](https://github.com/scenesystems/theoria/commit/6d6885574fba80385055e8b6c01c0b27ade8a05a) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Adds `effect-inference`, an Effect-native provider-blind inference substrate for text and embeddings runtimes.
  - adds schema-owned runtime descriptors for requested runtime, resolved route, resolved runtime, and replay-safe runtime evidence
  - adds stable route-family support for `OpenAiCompatible`, `OpenAiResponses`, `AnthropicMessages`, and `HuggingFace`
  - adds live runtime helpers for Hugging Face, config-driven hosted-provider helpers, and embeddings-capable resolution
  - adds `effect-inference/Testing` fixtures and helpers for downstream package contract tests
  - documents explicit `v0.1` non-goals around Scene-specific policy, native-root runtime families, and multimodal lanes
