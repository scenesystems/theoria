# effect-dsp

## 0.6.0

### Minor Changes

- [#125](https://github.com/scenesystems/theoria/pull/125) [`6685af5`](https://github.com/scenesystems/theoria/commit/6685af5203e4e9522ad8dd4d73b1a2ac4797d2cd) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Reduce canonicalization overhead using Effect's Unicode search, compiled matchers,
  mutable cursors, reference-keyed memoization, and one UTF-8 stream per incremental
  digest. Emit validated JSON-safe string content directly through Effect string
  operations, spell finite numeric and boolean scalars through Effect String, and
  retain Schema encoding for escaping. Amortize escaped-string encoding over
  bounded 32 Ki-code-unit slices without splitting surrogate pairs. Keep bounded
  long-string processing, byte-limit admission, cooperative yields, and reference-only
  cycle detection. Add independent full-digest Unicode vectors, escaping boundary
  checks, and hostile equality coverage without changing canonical bytes for unchanged
  wire representations.

  Reduce cold traversal allocation by retaining collection cursors in Effect mutable
  lists and caching at most 128 validated short keys per invocation. Use direct public
  Effect imports, string reducers, and a Schema boolean compiler operation for view
  classification, without dynamic code generation or changing caller codecs.

  Separate bounded traversal yields from output flushing, consume encoded batches
  through Effect's chunk consumer, and align ASCII-only output before UTF-8 encoding.
  Reuse identical own-key ordering, close exhausted cursors without another frame,
  and count validated UTF-8 widths with Effect string operations. Preserve exact
  inclusive limits, final output tails, and malformed-Unicode diagnostics.

  Breaking pre-1.0 change: remove ContentDigest.fromUnknown. Structured identities
  require an owner-selected codec through fromSchema or fromSchemaWithByteLimit;
  fromBytes remains the explicit byte-identity boundary. DSP cache Request and
  KeyRequest require inputSchema and paramsSchema. Search caches use their existing
  key codecs. Do not substitute Schema.Unknown during migration: choose identity
  fields and transformations explicitly, and version changed domain representations.

  Reject all typed-array views and DataView, including empty views, rather than
  canonicalizing non-Uint8Array views as records. Use an owner-approved intrinsic
  view predicate through Schema because Effect 4.0.0 has no public equivalent.

  Reject sparse arrays even when a numeric property is inherited. Check own-index
  presence through Effect before reading an element, so inherited getters cannot
  contribute canonical content.

  Add independent numeric/scalar digest vectors, seeded numeric and forced-escape
  equivalence properties, and a cold/warm-fresh throughput matrix with an explicit
  1.0 ratio budget against an independent sorted whole-JSON/Noble pipeline.

  Serialize bounded runs of admitted plain values through one Schema JSON encoding
  instead of one emission per scalar. Runs copy at most 8,192 consecutive values
  within 32 Ki text units into fresh data after each own-index check, allocate
  nothing per scalar, and halt with everything already read so the frame machine
  resumes at the exact position and reproduces the exact rejection without reading
  any field twice. Link traversal frames to their parents and detect cycles by
  ancestor reference above a bounded depth, removing per-container hash-set
  registration and the Bun garbage-collection pathology on large record arrays.
  Cache one sorted key layout across consecutive records. Add read-once and
  resume-order coverage for rejected siblings and cyclic getters.

  Charge serialized text before each copied read so one run emits at most 32 Ki
  text units including keys, number spellings, and escape expansion, and so a
  bounded digest copies no value beyond its remaining byte allowance. Keep the
  first failure when a copied prefix crosses the byte limit before a later hole
  or rejected value, and emit the copied prefix before reporting it. Compile
  caller codecs through Effect's public Schema JIT compiler on first use, keyed
  by encoding AST, with interpreted parsing as the fallback. Compose refusal
  predicates and copied-entry counts through Effect predicates and array search.
  Replace bare numeric operators with Effect compositions outside four
  owner-accepted hot functions. Widen timer-cooperation test inputs so traversal
  yields many times while host timers become due. Document the independent
  whole-preimage oracle ratio as a diagnostic and the matched published-release
  comparison as the throughput acceptance criterion.

- [#123](https://github.com/scenesystems/theoria/pull/123) [`ef4797f`](https://github.com/scenesystems/theoria/commit/ef4797f66bee0670d5ebb1cd8261805c0c89f035) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Add evaluation recording and reconstruction to `effect-study`, with corresponding persistence integration in `effect-search` and `effect-dsp`. Callers can retain individual outcomes as an evaluation runs, reopen its recording, and distinguish finished work from unresolved or unstarted inputs without executing it again.

  ### Evaluate inputs without losing expected failures
  - `Evaluation.runSettled` returns completed values and expected typed failures in input order. `Evaluation.run` retains its fail-fast behavior.
  - `Evaluation.runWithEvents` adds serialized, awaited observations. A trial starts only after its start observation is acknowledged, and its outcome is recorded only after terminal acknowledgment. Observer failure stops new admission and interrupts active local evaluations; previously acknowledged evidence remains available to the observer.
  - Defects and interruption remain native Effect causes, not ordinary failed trials. Compound fatal causes can retain evaluator errors in the Effect error channel. Completed values do not imply correct answers: grading remains caller-owned.
  - `Emitter<A, E, R>` preserves observer error and service requirements.

  ### Record events and reconstruct progress

  `StudyStorage.open` binds a run identity, definition digest, and caller-provided event/checkpoint codecs to a recording. Memory and filesystem implementations support append, cursor-based reads, and checkpoint-bound replay. Repeating an identical record ID returns its original receipt; conflicting content or a stale expected cursor fails explicitly. Checkpoints identify the committed cursor through which their state was reduced.

  `Evaluation.RecordedEvent`, `View`, `empty`, `reduce`, and `coverage` reconstruct planned inputs and retained outcomes, including unresolved starts and inputs that never started. Replay performs no external work. An unresolved start is not proof of failure or confirmed cancellation and does not authorize a retry.

  Filesystem recordings require one owning writer. They reject malformed records and incomplete tails without repair or truncation. Append acknowledgment does not promise fsync or survival of power loss.

  Event and checkpoint payload decoding failures include the filesystem path and physical line, including cached records. After a failed or interrupted append, retry revalidates the file: a committed identity returns its receipt, an absent record can be appended, and an incomplete tail fails without repair.

  Artifact journals retain the destination path for schema encoding failures and the path plus physical line for JSON or artifact-schema decoding failures, counting blank lines. Encoding and decoding retain their independent codec service requirements.

  For transactional custom backends, append receipts are provisional until the caller's outer commit. Observers must await short per-observation transactions, not hold a transaction around an evaluation. Construct long-lived artifact contexts outside short-lived transactions so captured services do not retain a released transaction connection.

  Retry identity compares the exact schema-produced JSON string, not semantic object equality or database-normalized JSON. The latest checkpoint is the latest written, including a lower-boundary checkpoint. Callers coordinate checkpoint writers and own state correctness; custom backends must provide coherent checkpoint/tail reads and retain event and identity history. No compaction protocol is supplied. Memory and filesystem stores share test-only protocol conformance coverage.

  ### Allocate artifact identities and inspect cost completeness

  `ArtifactContext` accepts a restored `nextSequence` or a caller-owned allocator. Durable, unique reservations belong to the caller; the built-in memory allocator is not durable. Allocation does not store a payload. Delivery retries reuse the artifact's identity, and unused sequence gaps are valid. Sink fanout is sequential and awaited, but a later sink failure does not undo earlier delivery.

  `History.costs` reports `reportedTotal`, `reportedCount`, `missingCount`, and `invalidCount` for current trial records. Known zero differs from missing cost; negative and non-finite costs are invalid. Replacing a trial replaces its contribution. `cumulativeCost` remains the sum of valid reported costs, not total billed spend.

  `reportedTotal` is a finite nonnegative number or `"Overflow"` when valid reported costs exceed finite number range in floating-point summation. Counts remain intact; no valid cost is reclassified or total clamped. Replacing a large cost can restore a finite summary because the projection recomputes from current records.

  ### API changes for consumers
  - `StudyStorage` exposes run-bound recordings. Its generic trial/snapshot methods are replaced by recording operations; filesystem storage uses the run-recording format. Requests use `new OpenOptions(...)`, `new Append(...)`, and `new CheckpointWrite(...)`; `read` accepts plain options.
  - Journal, storage, and artifact delivery use `PersistenceError.Failure` instead of `Journal.Failure`. Callers can distinguish codec, backend, record-identity, cursor, and incompatible-recording failures.
  - `ArtifactContext.make`, `layer`, and `nextId` expose typed allocation failures. Custom allocators can require services, which are captured when the context is constructed.
  - Search's `OptimizationStorage` uses recording handles while retaining optimization-specific checkpoint and replay policy. Search/DSP consumers propagate persistence failures as infrastructure errors rather than retrying or scoring them as objective failures.

  Includes runnable examples for settled evaluation, caller grading, artifact delivery, and reopening incomplete recordings.

### Patch Changes

- Updated dependencies [[`6685af5`](https://github.com/scenesystems/theoria/commit/6685af5203e4e9522ad8dd4d73b1a2ac4797d2cd), [`ef4797f`](https://github.com/scenesystems/theoria/commit/ef4797f66bee0670d5ebb1cd8261805c0c89f035), [`e0bfd10`](https://github.com/scenesystems/theoria/commit/e0bfd10de9d82cb1015b677179d41a312e63f691)]:
  - @scenesystems/digest@0.8.0
  - @scenesystems/effect-search@0.8.0
  - @scenesystems/effect-study@0.2.0
  - @scenesystems/effect-math@0.5.1

## 0.5.0

### Minor Changes

- [#118](https://github.com/scenesystems/theoria/pull/118) [`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Redesign the DSP and inference public APIs around canonical Effect-style concerns. This is a breaking pre-1.0 migration: legacy paths and declarations are removed, without compatibility aliases.

  Each public concern now has one flat PascalCase source module, root namespace, and matching package subpath. Private mechanics live under camelCase `internal/` paths and are inaccessible through package exports. Schema owns encoded data and derived types; Data owns executable generic relationships; Context and Layer own capabilities and implementations.

  Require Effect v4 and migrate public Effect, Schema, AI, service, and Layer contracts without erasing typed failures or service requirements. DSP modules, metrics, reward callbacks, reducers, discovery programs, and schema-backed payload operations retain their generic error and requirement channels; callers must provide the services declared by their composed program.

  For DSP, import `BootstrapFewShot`, `BootstrapRS`, `LabeledFewShot`, `MIPROv2`, `GEPA`, and `Ensemble` directly rather than through `Optimizer`. Use algorithm-local `Options`, `Event`, `EventSink`, `run`, `runWithEvents`, `stream`, and progress operations. Use `Ensemble.make` with `ReduceFn` and `ReduceOptions`. Candidate proposal and direct search belong to `MIPROv2Candidates` and `MIPROv2Search`; evaluation projection belongs to `EvaluationObjective`.

  Replace `contracts` imports with their canonical owners: `Module.Id`, `Module.Node`, `Module.RolloutCount`, `ModuleGraph.ModuleGraph`, `ModuleParameters.ModuleParameters`, `Demonstration.Demonstration`, `Demonstration.Codec`, `Metric.Result`, `Payload.Payload`, `Trace.Usage`, and `OptimizerEvent.Envelope`. Use concern-local operations such as `ModuleParameters.withInstructions`, `ModuleGraph.traversal`, and `Payload.encode`/`decode`. `DspError` owns package failures. `MockLanguageModel` is a root namespace and subpath with `succeed`, `sequence`, `fromFunction`, `map`, `fail`, `make`, and `layer`. Search studies, samplers, Pareto operations, artifact envelopes, and seeds are consumed directly from effect-search, without a DSP bridge.

  For inference, replace descriptor and contracts imports with `Model`, `Route`, `Capabilities`, `RuntimeRequest`, and `RuntimeEvidence`. A request contains `model`, not `artifact`. A `Runtime.Resolution` contains `request`, `route`, and `models`, not `desired`, `resolvedRoute`, and `layers`. Persisted evidence contains `request`, `route`, and `response`, replacing `desired`, `resolvedRoute`, and `resolvedRuntime`; migrate persisted documents explicitly. Model intent, pre-execution provenance, and post-response observations remain separate.

  Use `Runtime.Runtime`, `Runtime.Service`, `Runtime.resolve`, `Runtime.layer`, and `Runtime.layerWith`; `Service` replaces `Implementation`. `TextProvider` owns configured OpenAI, Anthropic, and OpenRouter construction. `HuggingFace` owns configuration, while `HuggingFaceEndpoint` and `HuggingFaceRouted` own their routes, language-model layers, and resolution. `HuggingFaceEmbeddingModel.Options`, `layer`, and `layerFetch` replace the endpoint-owned embedding options and duplicated endpoint/routed embedding constructors. `layer` requires `HttpClient.HttpClient`; `layerFetch` provides Effect v4's fetch client. `InferenceError` owns checked package failures. Native client observers are flat `AnthropicUsage`, `OpenAiUsage`, and `OpenRouterUsage` modules exposing `observe`; `Usage.observe` is the provider-independent constructor hook. Native Google support and `GoogleUsage` are removed; use OpenRouter or an OpenAI-compatible route for Gemini and the matching observer. `Testing` owns deterministic layers and fixtures.

  Migrate affected examples, application composition, documentation links, and behavioral suites to these APIs. Preserve provider usage evidence, schema-encoded demonstrations, candidate preflight, generic error/service channels, concurrent discovery, and restoration after checked failures or interruption. Eva package adoption and persisted application settlement remain downstream responsibilities after publication.

- [#118](https://github.com/scenesystems/theoria/pull/118) [`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Preserve native Effect AI usage through DSP execution and provider failure boundaries.

  DSP trace entries and optimizer projections now retain `Response.Usage`, including independently reported input, output, total, reasoning, and cached-input tokens. Aggregates expose `{ tokens, callCount }`; an omitted counter remains unknown rather than becoming zero. Each DSP-visible model invocation records one terminal `Trace.Call`, including failed or interrupted invocations, independently of output parsing and successful trace projection. Lexical collectors isolate nested and concurrent scopes while forwarding records once to ancestors. Native Schema JSON codecs preserve optional usage and scores.

  DSP selects authoritative usage once at the invocation boundary and carries it beside the unchanged native response. Calls, successful prediction entries, ReAct iterations, and evaluation projections use that same value. Observations take precedence wholesale, including unknown counters; only unobserved successful calls fall back to native response usage. OpenAI and OpenRouter observers provide `Option<Report>` as their raw-report argument. A non-streaming response with no report emits unknown canonical counters and `None`; stream events without usage do not erase earlier snapshots.

  The new inference `OpenAiUsage`, `AnthropicUsage`, and `OpenRouterUsage` modules decorate native provider clients to observe usage before native structured-output decoding and tool processing. Each module is a root namespace and matching flat subpath exposing `observe`. `Usage.observe` instruments caller-owned native `LanguageModel.ConstructorParams` without replacing `LanguageModel.make`. Pass `Trace.observeUsage` to retain this evidence in DSP calls. Callbacks also receive the original native usage report or encoded finish part so additional provider details remain available. Narrow, lossless Schema transformations retain raw reports alongside canonical counters. Stream observations update a call's latest cumulative usage, not its call count. No provider totals or unreceived counters are fabricated. An opaque prebuilt model cannot provide this stronger pre-interpretation guarantee. Native Google support and its usage observer are removed; route Gemini through OpenRouter or an OpenAI-compatible service and use that route's observer.

  Migration from DSP 0.3: replace flattened entry token fields with `entry.usage` and aggregate token fields with `usage.tokens`. `UsageSample`, `usageDelta`, `appendUsage`, `appendExecution`, mutable public trace fiber refs, and fabricated cache-hit counters are removed. Use `Trace.withCalls(Effect.exit(program))` to collect failure evidence. Provider errors retain their original types and are not retried by text parse policy. Durable attempt identity, pricing, persistence, and settlement remain application responsibilities.

  Prediction policies, marker parsing, retry feedback, and ReAct feedback use native Effect data, collection, and string operations. Capability-free `SearchPrimitiveOwnership` and `EffectSearchInteropOwnership` schemas and their constants are removed; use the actual `effect-search` operations directly. Optimizer parameter, dimension, graph, and objective projections remain available.

  ReAct retains native `Tool.HandlerError` and `Tool.Requirements` through `Module<I, O, E, R>`, module wrappers, evaluation, and optimizer composition. Expected per-example evaluation failures remain report entries; required services are not erased. Input prompts encode through the signature schema, and ReAct continues with native `Prompt.fromResponseParts`, preserving encoded structured tool successes and return-mode failures. Unsupported mock text responses and streaming now fail explicitly instead of producing placeholder or empty success. Mock object responses also reject unsupported nested values and JSON coercion of non-finite numbers rather than manufacturing valid output.

  Anthropic's observer callback now takes one `AnthropicUsage.Observation`, tagged `Response`, `MessageStart`, or `MessageDelta`. Its `usage` contains cumulative canonical token counters; its `raw` retains the unchanged native report, including delta server-tool evidence. Use `(observation) => Trace.observeUsage(observation.usage)` for DSP accounting, and retain tagged raw observations separately when needed for settlement. Do not treat delta reports as complete `BetaUsage` values.

  Replace recursive `FieldValue`, `FieldRecord`, and `MetricPayload` carriers with the actual signature output type in `Metric.Metric<E, R, A>` and schema-encoded JSON documents at heterogeneous persistence boundaries. `Entry.input`, `Entry.output`, trace projections, GEPA reflection, and optimizer event envelope payloads now contain `Payload.Payload` strings. Persisted record payloads require migration through their owning schema. Use `Payload.encode(schema, value)` and `Payload.decode(schema, document)`; the encoded schema must describe JSON data with suitable native equivalence. Encoding does not rerun domain transformation decoders, and failed equivalence or lossy encoding remains a checked `Schema.SchemaError`. Intermediate ReAct output uses public `Trace.UnparsedOutput` with native optional parse errors. Evaluation and optimizers decode imported expected outputs before scoring, and bootstrap demonstrations retain their replayable schema-encoded form.

  Hugging Face feature extraction now uses Effect v4's public `EmbeddingModel.make`, platform `HttpClient`, `Schema`, per-layer single-flight `Cache`, and interruptible `Schedule` composition rather than SDK transport. `HuggingFaceEmbeddingModel.layer` requires a caller-provided `HttpClient.HttpClient`; `HuggingFaceEmbeddingModel.layerFetch` supplies the default fetch transport. Both consume `HuggingFaceEmbeddingModel.Options`, whose route determines direct execution or provider discovery. Dedicated URLs are used exactly, routed discovery supports the four feature-extraction providers, and chat-only selection policies fail explicitly. HTTP 503 retries are bounded to three attempts with 100/200 ms backoff. Responses require complete, finite, equal-width vectors and valid indices; credential headers remain redacted in typed HTTP failures.

  Text marker fields now decode through their owning encoded schemas before the original output Struct applies domain transformations once. Literal strings are preserved, including JSON-looking strings; nested structs, arrays, primitive JSON, defaults, Option fields, and renamed encoded keys replay in automatic text mode and ReAct without erasing schema services.

  Destination-bound demonstration contracts retain schema knowledge across heterogeneous module graphs. LabeledFewShot validates all selected demos before any mutation. BootstrapFewShot derives child demos from completed stage traces, applies per-destination caps and native structural equivalence, and restores the initial parameter tree on failure or interruption. `Trace.Entry.outcome` and trace projections distinguish `completed` from `intermediate` ReAct evidence; older entries default to completed. MIPROv2 uses only destination-valid labels and existing stage demos and excludes all-failed reports from objectives and successful checkpoint statistics. BootstrapRS also restores the full initial tree on failure or interruption and keeps the winner only on success.

  Composition, discovery, parameter traversal, and persistence use native Graph operations with consistent identity checks at every depth. Root collisions, mismatched child identities, distinct owners sharing an identity, and cycles fail explicitly; legitimate shared-node diamonds retain complete persisted parameter coverage. GEPA failures remain checked rather than becoming fallback instructions or schema defects. Example 12/14 reflective feedback again retains two decimal places; rounding follows Effect Number.round, which can differ from the former JavaScript toFixed at binary ties. This is prompt-text behavior, not only log presentation.

  Reward callbacks in `bestOfN` and `refine`, and reducers in `ensemble`, now retain their own checked errors and service requirements through the composed module. Refinement restores its snapshot after callback failure or interruption. Prompts and parse diagnostics use encoded field names and retain field descriptions across property transformations. Invalid expected labels fail evaluation before any model call.

  MIPROv2 preflights every destination's demonstrations before the first Phase 2 model call and renders lossless schema-encoded JSON rather than scalar placeholders. BootstrapRS builds its labeled baseline per destination, omitting incompatible labels without blocking heterogeneous programs. `Demonstration.Codec.toTrace` serializes validated wire demonstrations without rerunning domain transformations. `fromTrace` rejects excess fields. `Module.load` validates all destination demos before writing any parameter ref and leaves the full tree unchanged on validation failure. `Payload.decode` accepts native Schema parse options.

  GEPA initializes, evaluates, restores, and commits instructions across the complete owned predictor graph. Reflection distinguishes predictor execution evidence from program-level labels and feedback. Mutation acceptance evaluates its first-three-row gate before the remaining validation rows, skips the remainder on rejection, and reuses successful prefix scores without duplicate evaluation. Candidate evaluation restores the full parameter graph on checked failure and interruption.

  Weighted search sampling now consumes Effect v4's seeded `Random.Random` service through `Random.withSeed` and scales unit draws to cumulative relative weights. Effect v3 RNG snapshots and traces are not replay-compatible after the upgrade. Fractional and normalized weights no longer collapse onto the first candidate; finite weights are rescaled before summation to prevent overflow, and non-finite weights are excluded. Weighted seeded sequences intentionally change, including GEPA parent selection. Zero-weight fallback policies retain their documented behavior. Search sampler, Pareto, optimizer progress, and model helpers consume native Effect operations and schema-derived data relationships.

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

- [#118](https://github.com/scenesystems/theoria/pull/118) [`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Extract reusable evaluation, trial history, stop controls, scoped event streams, and schema-driven artifact persistence into `@scenesystems/effect-study`. Search retains optimization policies; DSP streams and fixed-profile text calibration consume the shared package directly.

  Require Effect v4 across study, search, DSP, and text. Preserve evaluator, objective, callback, stream, and codec failure and service channels rather than materializing them synchronously. Filesystem study and optimization storage requires Effect's `FileSystem` and `Path` services; schema reads and writes retain their independent decoding and encoding requirements. Stateful layers use `Layer.fresh`, so each acquisition allocates independent state; provide one acquired layer around operations that must share a run.

  `History.trials` is an Effect `HashMap`; use `History.values` for trial-number order. `StudyStorage.makeMemory` is an Effect: yield it or use `StudyStorage.layerMemory`. Instantiate exported option classes with `new`, including `new ArtifactContext.Options(...)` and `new StudyStorage.FileSystemOptions(...)`.

  Redesign study and search around canonical public concern modules with matching root namespaces and package subpaths. This is a breaking pre-1.0 API migration: replace the previous contracts, error barrels, nested public modules, and forwarding declarations rather than retaining compatibility aliases. Migrate DSP and text consumers to the redesigned APIs.

  Preserve buffered completion events and release interrupted search-state mutations without blocking subsequent work. Replacing a trial now replaces its recorded cost instead of counting it twice.

  Derive recursive custom artifact payloads from Schema without changing their public types. Preserve all string keys, including `__proto__`, when encoding and decoding nested payload records.

### Patch Changes

- Updated dependencies [[`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc), [`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc), [`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc), [`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc), [`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc)]:
  - @scenesystems/effect-math@0.5.0
  - @scenesystems/effect-search@0.7.0
  - @scenesystems/digest@0.7.0
  - @scenesystems/effect-study@0.1.0

## 0.4.0

### Minor Changes

- [#104](https://github.com/scenesystems/theoria/pull/104) [`44a540d`](https://github.com/scenesystems/theoria/commit/44a540df4745f7de0c3cea2528a24010fe0e1f0a) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Expose `DspCacheKeyRequest` and `DspCacheRequest` as native Effect data models, preserving input, parameter, encoded-output, failure, and service relationships. Cache resolution returns the shared Schema-derived `SchemaCacheResult` tuple with its value and hit/miss status.

  **Breaking (0.x):** `DspCache.resolve` type parameters change from `<Output, Error, R>` to `<Input, Params, Output, Failure, Requirement, EncodedOutput?>`. Prefer inference by removing explicit type arguments, or update them to the new order.

  Use the updated schema-cache Layers so concurrent reads and mutations cannot restore stale values within one cache instance. Caller-facing Layer requirements remain unchanged.

### Patch Changes

- Updated dependencies [[`44a540d`](https://github.com/scenesystems/theoria/commit/44a540df4745f7de0c3cea2528a24010fe0e1f0a), [`44a540d`](https://github.com/scenesystems/theoria/commit/44a540df4745f7de0c3cea2528a24010fe0e1f0a), [`44a540d`](https://github.com/scenesystems/theoria/commit/44a540df4745f7de0c3cea2528a24010fe0e1f0a)]:
  - @scenesystems/digest@0.6.0
  - @scenesystems/effect-search@0.6.0

## 0.3.0

### Minor Changes

- [#85](https://github.com/scenesystems/theoria/pull/85) [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Every exported record is a `Data.Class` (or a `Schema.Struct` where it is pure data) instead of a `Readonly<{ … }>` alias, and absence is `Option` instead of `undefined`. Existing object literals remain assignable to the class instance types. `projectSingleObjective(report, metricName)` now takes `Option.Option<string>` for the metric instead of an optional string; pass `Option.none()` to project the report's first metric (or `score`).

  The compatibility-only `contracts/CacheKey` schema is removed; the active cache service keys on `DspCacheKey` from `@scenesystems/effect-dsp/Cache`.

- [#85](https://github.com/scenesystems/theoria/pull/85) [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - `Module.bestOfN` and `Module.refine` take their rollout/attempt count as the new branded `RolloutCount` (a positive integer schema exported from `@scenesystems/effect-dsp/contracts`) instead of a plain `number`. Invalid counts are rejected as a typed `ParseError` at construction (`RolloutCount.make(n)` or `Schema.decode(RolloutCount)`) rather than silently rounded or clamped to one, and neither wrapper can reach an internal defect for "no candidates produced" any more. `refine` always runs its first attempt and keeps that output when every later score is `NaN` or not greater than the current best.

- [#85](https://github.com/scenesystems/theoria/pull/85) [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Optimizer failures are typed and carry their cause instead of being replaced or discarded.

  - `EffectSearchInterop.cancel` carries `ArtifactStorageError` in its error channel, following `Study.cancel` in `@scenesystems/effect-search`: publishing the completion event to a persistent artifact sink can fail, and that failure is now typed.
  - GEPA propagates the language-model error when the reflective mutation call fails, and the decoding errors of the reflection response are in its error channel. Previously the failure was swallowed and the parent instruction was re-proposed as if the model had returned it.
  - GEPA candidate scores are the metric's own values. The `candidateBoost` that added a small increment per mutation step so that later candidates outranked equal earlier ones is removed; a candidate that does not improve the metric now fails the strict-improvement gate instead of being recorded as progress.
  - BootstrapRS propagates a failure in bootstrap candidate generation instead of returning no candidates, and keeps a candidate out of the search only when it fails with `AllTrialsFailed` (zero successful evaluations); any other evaluation failure propagates. The final selection no longer replaces a study failure with a fabricated `AllTrialsFailed`.
  - MIPROv2 preserves the effect-search study's own failure, such as `ArtifactStorageError`, instead of replacing it with `AllTrialsFailed`.

  These widen public error types, which is a breaking change under 0.x semver, hence a minor release.

### Patch Changes

- Updated dependencies [[`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0), [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0), [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0), [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0), [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0)]:
  - @scenesystems/effect-math@0.4.0
  - @scenesystems/digest@0.5.3
  - @scenesystems/effect-search@0.5.0

## 0.2.3

### Patch Changes

- [#69](https://github.com/scenesystems/theoria/pull/69) [`002cb72`](https://github.com/scenesystems/theoria/commit/002cb725c94adfde2587526166a1a4ab7632dc87) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - - `Module.load` validates every saved entry before writing and applies the ref updates uninterruptibly, so a failure or interruption during validation leaves the module tree unchanged.
  - `Module.refine` serializes concurrent `forward` calls and restores the inner module parameters through `acquireUseRelease`, so an interrupted refinement no longer leaves accumulated feedback in the inner module.
  - Count options (`bestOfN.N`, `refine.N`, `react.maxIterations`, parse `maxRetries`, few-shot `k`/`maxBootstrappedDemos`, GEPA `maxIterations`/`maxMergeInvocations`, Ensemble `size`, MIPROv2 budgets and cadence) floor fractional values and fall back to their minimum for non-finite input instead of iterating a fractional or `NaN` count.
  - `Signature.Input` and `Signature.Output` accept any carrier with an `inputSchema` or `outputSchema` field, so they derive types from `Signature` subclasses and structural stand-ins.

- [#69](https://github.com/scenesystems/theoria/pull/69) [`002cb72`](https://github.com/scenesystems/theoria/commit/002cb725c94adfde2587526166a1a4ab7632dc87) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Rewrite the package README as a set of consistent documentation guides: overview, getting started, topic guides with typechecked examples, public surface, errors and boundaries, and runnable examples.

- Updated dependencies [[`002cb72`](https://github.com/scenesystems/theoria/commit/002cb725c94adfde2587526166a1a4ab7632dc87), [`002cb72`](https://github.com/scenesystems/theoria/commit/002cb725c94adfde2587526166a1a4ab7632dc87), [`002cb72`](https://github.com/scenesystems/theoria/commit/002cb725c94adfde2587526166a1a4ab7632dc87)]:
  - @scenesystems/effect-math@0.3.2
  - @scenesystems/digest@0.5.2
  - @scenesystems/effect-search@0.4.3

## 0.2.2

### Patch Changes

- [#68](https://github.com/scenesystems/theoria/pull/68) [`91f48e4`](https://github.com/scenesystems/theoria/commit/91f48e4b571442f9370c3dc15cb46095465a52a1) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Publish the rewritten package README with a clearer account of the package's purpose, use, and place in Theoria.

- Updated dependencies [[`58fbcc0`](https://github.com/scenesystems/theoria/commit/58fbcc02378bddc0f4bfd7da84574f76c273996a), [`91f48e4`](https://github.com/scenesystems/theoria/commit/91f48e4b571442f9370c3dc15cb46095465a52a1)]:
  - @scenesystems/digest@0.5.1
  - @scenesystems/effect-math@0.3.1
  - @scenesystems/effect-search@0.4.2

## 0.2.1

### Patch Changes

- Updated dependencies [[`e403ba2`](https://github.com/scenesystems/theoria/commit/e403ba20186d4d58be5e619a5e7f253b511c9164)]:
  - @scenesystems/digest@0.5.0
  - @scenesystems/effect-math@0.3.0
  - @scenesystems/effect-search@0.4.1

## 0.2.0

### Minor Changes

- [#49](https://github.com/scenesystems/theoria/pull/49) [`873731c`](https://github.com/scenesystems/theoria/commit/873731ca75aad31ca46fd93d482eabbc0e8239af) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Raise the public Effect peer and provider dependency contracts to the latest stable Effect 3.22-compatible release train.

### Patch Changes

- Updated dependencies [[`873731c`](https://github.com/scenesystems/theoria/commit/873731ca75aad31ca46fd93d482eabbc0e8239af)]:
  - @scenesystems/digest@0.4.0
  - @scenesystems/effect-math@0.3.0
  - @scenesystems/effect-search@0.4.0

## 0.1.6

### Patch Changes

- Move numerical and inference dependencies to the scoped `@scenesystems/effect-math` and `@scenesystems/effect-inference` package identities.

- Updated dependencies []:
  - @scenesystems/effect-search@0.3.1

## 0.1.5

### Patch Changes

- [#29](https://github.com/scenesystems/theoria/pull/29) [`3ee66ed`](https://github.com/scenesystems/theoria/commit/3ee66ed7f37d3a846971dde35acd608fd1bf7def) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Keep cache fingerprint failures bounded while adopting digest's closed canonicalization error contract.

- Updated dependencies [[`cfc5080`](https://github.com/scenesystems/theoria/commit/cfc508039f05eb96dd8004e75ae485f232c848f1), [`5956e18`](https://github.com/scenesystems/theoria/commit/5956e18f32182df8f10dcd8f44d4458e664acd82)]:
  - @scenesystems/digest@0.3.0
  - effect-search@0.3.0
  - effect-math@0.2.1

## 0.1.4

### Patch Changes

- [#17](https://github.com/scenesystems/theoria/pull/17) [`020ea82`](https://github.com/scenesystems/theoria/commit/020ea82e94b23380fcd871737087504cd2e439f2) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Align `effect-dsp` cache SQL wiring with the current shared cache surface from `effect-search`.
  - rename the exported SQL cache layer from `DspCacheSqlite` to `DspCacheSql`
  - delegate SQL-backed cache storage through `SchemaCacheSql`, which now accepts a caller-provided SQLite-compatible `SqlClient` layer instead of a SQLite directory helper

- Updated dependencies [[`020ea82`](https://github.com/scenesystems/theoria/commit/020ea82e94b23380fcd871737087504cd2e439f2), [`774c14c`](https://github.com/scenesystems/theoria/commit/774c14c0a27d05c01109ac496fd15b9efeb8d922), [`020ea82`](https://github.com/scenesystems/theoria/commit/020ea82e94b23380fcd871737087504cd2e439f2), [`020ea82`](https://github.com/scenesystems/theoria/commit/020ea82e94b23380fcd871737087504cd2e439f2), [`020ea82`](https://github.com/scenesystems/theoria/commit/020ea82e94b23380fcd871737087504cd2e439f2), [`020ea82`](https://github.com/scenesystems/theoria/commit/020ea82e94b23380fcd871737087504cd2e439f2), [`4651634`](https://github.com/scenesystems/theoria/commit/46516347d9c73308cfb7ea65ab98eae77537f3be), [`3c3e316`](https://github.com/scenesystems/theoria/commit/3c3e316dd563bb684338e521e9e0e953b872c329)]:
  - effect-search@0.2.0
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

- Updated dependencies [[`7de6c02`](https://github.com/scenesystems/theoria/commit/7de6c02e0d65cd66b5d4c2ed1c01a8c7bee6ee01)]:
  - effect-search@0.1.3

## 0.1.2

### Patch Changes

- [#9](https://github.com/scenesystems/theoria/pull/9) [`575eee5`](https://github.com/scenesystems/theoria/commit/575eee520879202d8b3c314a1e4bc63a545c08a7) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - fix: replace workspace:\* with workspace:^ so changesets resolves real version ranges on publish

- Updated dependencies [[`575eee5`](https://github.com/scenesystems/theoria/commit/575eee520879202d8b3c314a1e4bc63a545c08a7)]:
  - effect-search@0.1.2
  - effect-math@0.1.2

## 0.1.1

### Patch Changes

- [#7](https://github.com/scenesystems/theoria/pull/7) [`879632d`](https://github.com/scenesystems/theoria/commit/879632dbc69face1471bf9f8e78c68e756dc854c) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Replace relative ../effect-search links in README with absolute GitHub monorepo URLs so they resolve correctly on npm.

- Updated dependencies [[`2025cab`](https://github.com/scenesystems/theoria/commit/2025cab1ebda57eb22a0637df96cc3b2e9a52dae), [`879632d`](https://github.com/scenesystems/theoria/commit/879632dbc69face1471bf9f8e78c68e756dc854c)]:
  - effect-math@0.1.1
  - effect-search@0.1.1

## 0.1.0

### Minor Changes

- [#1](https://github.com/scenesystems/theoria/pull/1) [`39bfeb7`](https://github.com/scenesystems/theoria/commit/39bfeb72577a0d40da554055e461ca2bf9ab375e) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Initial release of `effect-dsp` — programming, not prompting, language models, with Effect.

  A ground-up Effect-native implementation of the DSPy paradigm for TypeScript. Define typed signatures, compose learnable modules, and optimize prompts with fiber-scoped traces — without leaving the Effect ecosystem.

  ### Signatures
  - **Schema-first I/O contracts** — `Signature.make` defines input and output fields with `Schema.Struct` and description annotations. No string parsing, no parallel type system.
  - **Field metadata derivation** — instructions, field info, and prompt templates derived from schema annotations.

  ### Modules
  - **Predict** — core predictor module with dual output strategy resolution (`text` / `structured` / `auto`) and DSPy-compatible `[[ ## field ## ]]` delimiters.
  - **ChainOfThought** — prepends `reasoning` field to output signature for step-by-step reasoning.
  - **BestOfN** — run module N times with different rollout IDs, return best by reward function.
  - **Refine** — `BestOfN` + automatic feedback generation between attempts.
  - **ReAct** — reasoning + acting agent with tool use via `@effect/ai` toolkits.
  - **Compose** — graph-based sub-module wiring with typed `forward` callbacks and DAG cycle detection.
  - **Discovery** — module registry for collecting sub-module references and learnable parameter surfaces.
  - **Save/Load** — serialize and restore module state for checkpointing.

  ### Optimizers
  - **LabeledFewShot** — attach random labeled demos without model calls.
  - **BootstrapFewShot** — teacher-bootstrapped demonstration generation with threshold filtering and configurable concurrency.
  - **BootstrapRS** — random search over bootstrapped demo candidates via `effect-search` Study orchestration.
  - **Ensemble** — run N programs, aggregate via `majorityVote` or custom reduce function.
  - **MIPROv2** — instruction + demo co-optimization via Bayesian search with `effect-search` TPE. Three-phase pipeline: grounded proposer, Bayesian candidate selection, full evaluation.
  - **GEPA** — reflective prompt evolution via natural-language feedback. Multi-objective Pareto frontier management, merge/subsample operations, and streaming progress events.
  - **effectSearchInterop** — canonical bridge between `effect-dsp` module parameters and `effect-search` black-box optimization. Ask/tell orchestration, typed acquisition selection, Pareto helpers, and progress composition.

  ### Evaluation
  - **Batch evaluation** — `Evaluate.run` for batch scoring against labeled examples with metric composition.
  - **Streaming evaluation** — `Evaluate.stream` for real-time progress events during evaluation.
  - **Report generation** — structured `Report` with per-example results, aggregate scores, and metadata.

  ### Metrics
  - **Built-in scorers** — `exactMatch`, `f1`, `contains`, and custom `fromEffect` metric constructors.
  - **Metric composition** — combine multiple metrics with weighted averaging.

  ### Tracing
  - **Fiber-scoped collection** — `FiberRef`-based trace collection with zero cross-fiber contention.
  - **Token usage accounting** — track input/output/total token counts across LM calls.
  - **Scoped tracing** — `Trace.withTracing` for isolated trace collection within effect scopes.

  ### Caching
  - **Module-level memoization** — `DspCache` service for deterministic LM call replay with composite cache keys.
  - **Rollout partitioning** — fiber-local rollout identity for cache key diversity during `bestOfN` evaluation.
  - **Backend flexibility** — in-memory, file-system, and SQLite backends via `effect-search/Cache` shared authority.

  ### Infrastructure
  - **Typed error hierarchy** — `Schema.TaggedError` classes for every failure domain: `SignatureError`, `ParseOutputError`, `BootstrapFailed`, `EvaluateError`, `GepaError`, and more.
  - **Deterministic seeds** — reproducible optimization runs delegated to `effect-search` deterministic seed contracts.
  - **Artifact provenance** — `ArtifactEnvelope` system for typed provenance wrappers on every optimization artifact, re-exported from `effect-search/Contracts`.
  - **Provider isolation** — sole `@effect/ai` runtime import site in `src/internal/lm.ts` for single-point-of-change LM adapter evolution.

  Built on [Effect](https://effect.website) with `@effect/ai` for language model integration and `effect-search` for optimizer search orchestration. Depends on `@scenesystems/digest` (via `effect-search`) for content-addressed caching.

### Patch Changes

- Updated dependencies [[`39bfeb7`](https://github.com/scenesystems/theoria/commit/39bfeb72577a0d40da554055e461ca2bf9ab375e), [`39bfeb7`](https://github.com/scenesystems/theoria/commit/39bfeb72577a0d40da554055e461ca2bf9ab375e), [`39bfeb7`](https://github.com/scenesystems/theoria/commit/39bfeb72577a0d40da554055e461ca2bf9ab375e)]:
  - @scenesystems/digest@0.1.0
  - effect-math@0.1.0
  - effect-search@0.1.0
