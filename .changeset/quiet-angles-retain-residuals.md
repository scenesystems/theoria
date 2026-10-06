---
"@scenesystems/effect-math": patch
---

Reduce scalar sine and cosine allocation with split-constant argument reduction and bounded polynomial evaluation through Effect public APIs, retaining exact-decimal reduction for large angles and IEEE exceptional-value behavior.

Preserve logarithm and product residuals for large integer powers, correcting amplified squaring error near unity. Document that power results are deterministic approximations rather than universally correctly rounded host-math replacements.

Prepare fixed polynomials once, avoid repeated coefficient-array copies and matcher construction, and select binary normalization direction outside the bounded fold without changing arithmetic order. Bound binary scaling and specialize scalar square-root bookkeeping while preserving exact midpoint rounding and the general exact-norm path.

Reuse floating-point normalization directly in the scalar logarithm, avoiding an exact BigInt round trip without changing result bits or dyadic consumers.
