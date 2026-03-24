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
- **Algebra** — domain scaffold for semigroup/monoid laws (provisional)
- **Calculus** — domain scaffold for differentiation/integration (provisional)
- **Special** — domain scaffold for special functions (provisional)
- **Optimization** — domain scaffold for convergence and Pareto contracts (provisional)

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

- **Strict public decode** — `onExcessProperty: "error"` for all stable boundary entrypoints
- **Schema-validated operations** — every pure kernel has a `*Validated` counterpart using `Schema.decodeUnknown` for external input
- **Typed error taxonomy** — `DomainNotLoadedError`, `BoundaryDecodeError`, `EmptyInputError`, `DimensionMismatchError`, `NegativeValueError`, `DivisionByZeroError` per domain

### Cross-domain contracts

- **Domain ownership matrix** — codified Probability/Statistics ownership boundary preventing duplicate distribution contracts
- **Domain stability tiers** — `stable`, `provisional`, `experimental` with explicit promotion criteria
- **Backend/precision matrix** — fixture-backed compatibility evidence for stable boundary claims

### Governance

- **Tree-shakeable subpath exports** — `effect-math/Numeric`, `effect-math/Probability`, etc. with `internal/*` blocked
- **SciPy fixture parity** — golden numerical fixtures verified against SciPy reference implementations
- **240 LOC cap** — enforced per source file

Built entirely on [Effect](https://effect.website) with Schema-driven type inference, typed error channels, and `Context.Tag` service composition throughout.
