---
"@scenesystems/effect-math": minor
"@scenesystems/effect-search": patch
---

Redesign effect-math around canonical flat concern modules, matching root namespaces and package subpaths. This is a breaking pre-1.0 API migration: remove domain discovery descriptors and the `contracts` and `experimental` entrypoints; move runtime configuration to `Policy` and planning to `Scalar`, `Backend`, `Precision`, `Autodiff`, `Uncertainty`, and `Computation`.

Require Effect v4. Validated operations return Effects with typed failures, while policy-aware operations retain their `Context.Service` requirements until callers provide the corresponding v4 Layers. Base operations remain synchronous for already-trusted values.

`Distribution` now owns all normal and uniform evaluation, including the standard-normal transform. `Probability.entropy` replaces `shannonEntropy`. Complex construction uses `Complex.make`, vector operations use `Complex.dot`, `norm`, and `scale`, and complex-step differentiation belongs to `Calculus.complexStep`. `LinearAlgebra.add` replaces `vectorAdd`; `scale(vector, scalar)` replaces `vectorScale(scalar, vector)`. Public schemas and errors have concise concern-qualified names; established error wire tags remain unchanged.

Migrate search samplers to the canonical distribution operations without changing deterministic numerical accumulation or seeded replay.
