---
"@scenesystems/effect-math": patch
---

Pure Ridder derivative operations (`derivativeLimit`, `secondDerivativeLimit`, and the multivariate kernels built on them) no longer re-decode their typed `RidderMethodInput` config with a synchronous schema decoder. The pure API keeps its documented contract of never throwing for typed input; untrusted config is still rejected with `CalculusDecodeError` by the `*Validated` operations at the boundary.
