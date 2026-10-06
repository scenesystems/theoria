---
"@scenesystems/effect-math": patch
---

Reduce scalar sine and cosine allocation with split-constant argument reduction and bounded polynomial evaluation through Effect public APIs, retaining exact-decimal reduction for large angles and IEEE exceptional-value behavior.

Preserve logarithm and product residuals for large integer powers, correcting amplified squaring error near unity. Document that power results are deterministic approximations rather than universally correctly rounded host-math replacements.
