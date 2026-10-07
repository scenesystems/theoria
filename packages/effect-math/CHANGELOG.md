# @scenesystems/effect-math

## 0.5.2

### Patch Changes

- [#130](https://github.com/scenesystems/theoria/pull/130) [`bc05e4b`](https://github.com/scenesystems/theoria/commit/bc05e4bee5f0326d5a13e1bd0f6b2e4ee0927df2) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Reuse exact binary scaling factors and skip redundant normalization work in scalar exponential, logarithm, and square-root operations while preserving numerical behavior.

## 0.5.1

### Patch Changes

- [#128](https://github.com/scenesystems/theoria/pull/128) [`e0bfd10`](https://github.com/scenesystems/theoria/commit/e0bfd10de9d82cb1015b677179d41a312e63f691) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Reduce scalar sine and cosine allocation with split-constant argument reduction and bounded polynomial evaluation through Effect public APIs, retaining exact-decimal reduction for large angles and IEEE exceptional-value behavior.

  Preserve logarithm and product residuals for large integer powers, correcting amplified squaring error near unity. Document that power results are deterministic approximations rather than universally correctly rounded host-math replacements.

  Prepare fixed polynomials once, avoid repeated coefficient-array copies and matcher construction, and select binary normalization direction outside the bounded fold without changing arithmetic order. Bound binary scaling and specialize scalar square-root bookkeeping while preserving exact midpoint rounding and the general exact-norm path.

  Reuse floating-point normalization directly in the scalar logarithm, avoiding an exact BigInt round trip without changing result bits or dyadic consumers.

## 0.5.0

### Minor Changes

- [#118](https://github.com/scenesystems/theoria/pull/118) [`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Redesign effect-math around canonical flat concern modules, matching root namespaces and package subpaths. This is a breaking pre-1.0 API migration: remove domain discovery descriptors and the `contracts` and `experimental` entrypoints; move runtime configuration to `Policy` and planning to `Scalar`, `Backend`, `Precision`, `Autodiff`, `Uncertainty`, and `Computation`.

  Require Effect v4. Validated operations return Effects with typed failures, while policy-aware operations retain their `Context.Service` requirements until callers provide the corresponding v4 Layers. Base operations remain synchronous for already-trusted values.

  `Distribution` now owns all normal and uniform evaluation, including the standard-normal transform. `Probability.entropy` replaces `shannonEntropy`. Complex construction uses `Complex.make`, vector operations use `Complex.dot`, `norm`, and `scale`, and complex-step differentiation belongs to `Calculus.complexStep`. `LinearAlgebra.add` replaces `vectorAdd`; `scale(vector, scalar)` replaces `vectorScale(scalar, vector)`. Public schemas and errors have concise concern-qualified names; established error wire tags remain unchanged.

  Migrate search samplers to the canonical distribution operations without changing deterministic numerical accumulation or seeded replay.

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

## 0.4.0

### Minor Changes

- [#85](https://github.com/scenesystems/theoria/pull/85) [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Decoded `AutodiffResolution.mode` and `ComputationDispatchPlan.autodiffMode` values now use `Option<AutodiffMode>` instead of optional properties. Their encoded JSON forms continue to omit the fields when no autodiff mode is selected.

### Patch Changes

- [#85](https://github.com/scenesystems/theoria/pull/85) [`2d3993a`](https://github.com/scenesystems/theoria/commit/2d3993aa36a8c6b89e076376fbfcd80a96e3fef0) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Pure Ridder derivative operations (`derivativeLimit`, `secondDerivativeLimit`, and the multivariate kernels built on them) no longer re-decode their typed `RidderMethodInput` config with a synchronous schema decoder. The pure API keeps its documented contract of never throwing for typed input; untrusted config is still rejected with `CalculusDecodeError` by the `*Validated` operations at the boundary.

## 0.3.2

### Patch Changes

- [#69](https://github.com/scenesystems/theoria/pull/69) [`002cb72`](https://github.com/scenesystems/theoria/commit/002cb725c94adfde2587526166a1a4ab7632dc87) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Add scalar helpers to `Numeric`: `isFinite`, `min`, `max`, `abs`, `sqrt`, `pi`, `sin`, `cos`, `log10`, `pow`, `round`, `floor`, `ceil`, and `truncate`. `floor`, `ceil`, and `truncate` compute through `BigDecimal` for finite inputs and return non-finite inputs unchanged.

- [#69](https://github.com/scenesystems/theoria/pull/69) [`002cb72`](https://github.com/scenesystems/theoria/commit/002cb725c94adfde2587526166a1a4ab7632dc87) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Rewrite the package README as a set of consistent documentation guides: overview, getting started, topic guides with typechecked examples, public surface, errors and boundaries, and runnable examples.

## 0.3.1

### Patch Changes

- [#68](https://github.com/scenesystems/theoria/pull/68) [`91f48e4`](https://github.com/scenesystems/theoria/commit/91f48e4b571442f9370c3dc15cb46095465a52a1) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Publish the rewritten package README with a clearer account of the package's purpose, use, and place in Theoria.

## 0.3.0

### Minor Changes

- [#49](https://github.com/scenesystems/theoria/pull/49) [`873731c`](https://github.com/scenesystems/theoria/commit/873731ca75aad31ca46fd93d482eabbc0e8239af) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Raise the public Effect peer and provider dependency contracts to the latest stable Effect 3.22-compatible release train.

The scoped identity continues the release history of the former unscoped `effect-math` package.

## 0.2.1

### Patch Changes

- [#23](https://github.com/scenesystems/theoria/pull/23) [`ee3ebec`](https://github.com/scenesystems/theoria/commit/ee3ebeccaaddf56f56b86ab154fa50bdda3f99c9) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Adds `Statistics.summaryStatistics(values)` for non-empty chunks.
  - returns the existing `SummaryStatistics` tagged class in one pass
  - treats singleton chunks deterministically with zero variance and standard deviation
  - includes tests to keep its results aligned with the validated and runtime-policy variants

## 0.2.0

### Minor Changes

- [#17](https://github.com/scenesystems/theoria/pull/17) [`020ea82`](https://github.com/scenesystems/theoria/commit/020ea82e94b23380fcd871737087504cd2e439f2) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Expand `effect-math/Calculus` with limit-accurate differential operators and adaptive quadrature.
  - add Ridder-based derivative estimates with convergence metadata for first and second derivatives
  - add multivariate operators including gradient, Jacobian, Hessian, directional derivative, divergence, and Laplacian, with validated and policy-aware counterparts
  - add adaptive Simpson integration and extend fixture-backed calculus parity coverage to distinguish SciPy-backed quadrature expectations from analytic reference operators

### Patch Changes

- [#17](https://github.com/scenesystems/theoria/pull/17) [`020ea82`](https://github.com/scenesystems/theoria/commit/020ea82e94b23380fcd871737087504cd2e439f2) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Harden numerical and maintenance correctness around advanced sampler math migration.
  - `effect-math`: enforce SPD symmetry preconditions in linear solver kernels and add regression tests so non-symmetric matrices are rejected by Cholesky/SPD solve paths.
  - `effect-math`: improve public API docstrings for solver and probability transform operations with clearer preconditions, failure semantics, and runnable examples.
  - `effect-math`: normalize Numeric log-sum-exp naming to camelCase (`logSumExp`) across the public API, schema contracts, fixtures, and generated docs.

## 0.1.2

### Patch Changes

- [#9](https://github.com/scenesystems/theoria/pull/9) [`575eee5`](https://github.com/scenesystems/theoria/commit/575eee520879202d8b3c314a1e4bc63a545c08a7) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - fix: replace workspace:\* with workspace:^ so changesets resolves real version ranges on publish

## 0.1.1

### Patch Changes

- [#4](https://github.com/scenesystems/theoria/pull/4) [`2025cab`](https://github.com/scenesystems/theoria/commit/2025cab1ebda57eb22a0637df96cc3b2e9a52dae) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Add THIRD_PARTY_NOTICES with full license texts for Boost.Math (BSL-1.0) and Cephes (BSD-2-Clause) coefficients. Fix Fornberg → Squire & Trapp (1998) attribution for complex-step differentiation. Replace Numerical Recipes citations with original algorithm authors (Godfrey/GSL, Lentz, Gautschi). Remove phantom pareto/kde keywords from package.json.

## 0.1.0

### Minor Changes

- [#1](https://github.com/scenesystems/theoria/pull/1) [`39bfeb7`](https://github.com/scenesystems/theoria/commit/39bfeb72577a0d40da554055e461ca2bf9ab375e) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Initial release of `effect-math` — typed mathematical primitives for Effect.

  A domain-first mathematics and statistics library with Schema-driven contracts, branded numeric types, and Effect-native runtime layering. Designed as the mathematical substrate for `effect-search` and `effect-dsp`.

  ### Domain architecture

  Eleven mathematical domains with uniform module structure — each domain exposes a typed model, Schema-backed contracts, boundary-validated operations, and a typed error channel:
  - **Numeric** — safe division, logarithms, summation, argmax, clamping, and range checks with `NaN`/`Infinity` rejection
  - **LinearAlgebra** — dot products, L1/L2/L∞ norms, vector addition and scaling, matrix-vector multiplication, transpose, and Frobenius norm
  - **Geometry** — Euclidean, Manhattan, and Chebyshev distance metrics, midpoint computation, and centroid calculation
  - **Probability** — normal and uniform PDF/CDF, standard normal distribution, and Shannon entropy
  - **Statistics** — mean, variance, standard deviation, and covariance estimators
  - **Special** — gamma (Lanczos g=7), log-gamma, beta, erf/erfc (A&S 7.1.26), and digamma (asymptotic + recurrence)
  - **Algebra** — polynomial evaluation and derivative, GCD, LCM, and factorial
  - **Calculus** — numerical derivative, trapezoidal rule, and Simpson's rule
  - **Optimization** — bisection root-finding and golden section minimization
  - **Distribution** — full algebra of 10 distribution families (Normal, LogNormal, Exponential, Uniform, Beta, Gamma, Student-t, Categorical, Binomial, Poisson) with PDF/CDF, log-PDF/PMF, quantile (inverse CDF), mean, variance, and differential entropy kernels; 502 SciPy fixture cases across 13 fixture files
  - **Complex** — complex arithmetic, trigonometric and hyperbolic functions, polar form, `Chunk`-based vector carriers, and machine-precision complex-step differentiation

  All domains follow the three-tier operation pattern:
  1. **Pure kernels** — synchronous functions with no Effect overhead
  2. **`*Validated` boundary operations** — Schema decode with `onExcessProperty: "error"` and typed errors
  3. **`*WithPolicies` context-aware operations** — read `PrecisionPolicyService`/`DiagnosticsPolicyService` via `Context.Tag`

  ### Branded scalar vocabulary

  Eight nominal numeric types enforcing semantic constraints at the type level:
  - **`Dimension`** — positive integer ≥ 1
  - **`Axis`** — non-negative integer index
  - **`AbsoluteTolerance`** / **`RelativeTolerance`** — strictly positive convergence thresholds
  - **`ConditioningThreshold`** — strictly positive conditioning bound
  - **`IterationBudget`** — positive integer iteration cap
  - **`StepSize`** — strictly positive step size
  - **`Seed`** — non-negative integer for deterministic reproducibility

  ### Runtime policies
  - **`RuntimePolicies`** service — Effect `Context.Tag` service for composing backend, precision, diagnostics, and RNG policy via typed layers
  - **Deterministic vs nondeterministic** — seed/reproducibility semantics encoded as service seams, not ad hoc branching
  - **Policy-aware operations** — every domain exposes `*WithPolicies` variants that read from the `RuntimePolicies` service

  ### Boundary contracts
  - **Strict public decode** — `onExcessProperty: "error"` for all boundary entrypoints
  - **Schema-validated operations** — every pure kernel has a `*Validated` counterpart using `Schema.decodeUnknown` for external input
  - **Typed error taxonomy** — per-domain `DecodeError`, `DomainViolationError`, `ShapeError`, `ParameterError` with `Schema.TaggedError`

  ### SciPy fixture parity
  - **Golden-reference fixture generators** — Python generators producing reference values from SciPy/NumPy
  - **Fixture-parity tests** — registry-loaded, Schema-decoded, `Match.exhaustive`-dispatched

  ### Governance
  - **Tree-shakeable subpath exports** — `effect-math/Numeric`, `effect-math/Complex`, etc. with `internal/*` blocked
  - **72 test suites, 641 tests** — all seven gates pass (check, check:tests, lint, test, build, fixtures:check, docgen)
  - **10 runnable examples** — one per implemented domain using `BunRuntime.runMain` and subpath imports

  Built entirely on [Effect](https://effect.website) with Schema-driven type inference, typed error channels, and `Context.Tag` service composition throughout.
