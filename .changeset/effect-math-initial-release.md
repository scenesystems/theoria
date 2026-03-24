---
"effect-math": minor
---

Initial release of `effect-math` — typed mathematical primitives for Effect.

A domain-first mathematics and statistics library with Schema-driven contracts, branded numeric types, and Effect-native runtime layering. Designed as the mathematical substrate for `effect-search` and `effect-dsp`.

### Domain architecture

Nine mathematical domains with uniform module structure — each domain exposes a typed model, Schema-backed contracts, boundary-validated operations, and a typed error channel:

- **Numeric** — safe division, logarithms, summation, argmax, clamping, and range checks with `NaN`/`Infinity` rejection
- **LinearAlgebra** — dot products, L1/L2/L∞ norms, vector addition and scaling, matrix-vector multiplication, transpose, and Frobenius norm
- **Geometry** — Euclidean, Manhattan, and Chebyshev distance metrics, midpoint computation, and centroid calculation
- **Probability** — normal and uniform PDF/CDF, standard normal distribution, and Shannon entropy
- **Statistics** — mean, variance, standard deviation, and covariance estimators
- **Special** — gamma (Lanczos g=7), log-gamma, beta, erf/erfc (A&S 7.1.26), and digamma (asymptotic + recurrence)
- **Algebra** — domain scaffold for algebraic structures (experimental)
- **Calculus** — domain scaffold for differentiation/integration (experimental)
- **Optimization** — domain scaffold for convergence and Pareto contracts (experimental)

All six implemented domains follow the three-tier operation pattern:

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

- **Six domain fixture generators** — Python generators producing golden reference values from SciPy/NumPy
- **152 fixture cases** across Numeric, LinearAlgebra, Geometry, Probability, Statistics, and Special
- **Fixture-parity tests** — registry-loaded, Schema-decoded, `Match.exhaustive`-dispatched

### Cross-domain contracts

- **Domain ownership matrix** — codified Probability/Statistics ownership boundary preventing duplicate distribution contracts
- **All implemented domains provisional** — no stable tier claims until post-release stabilization
- **Backend/precision matrix** — fixture-backed compatibility evidence for boundary claims

### Governance

- **Tree-shakeable subpath exports** — `effect-math/Numeric`, `effect-math/Special`, etc. with `internal/*` blocked
- **274 tests across 40 suites** — all five gates pass (check, check:tests, lint, test, build)
- **6 runnable examples** — one per implemented domain using `BunRuntime.runMain` and subpath imports

Built entirely on [Effect](https://effect.website) with Schema-driven type inference, typed error channels, and `Context.Tag` service composition throughout.
