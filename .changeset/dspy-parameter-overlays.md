---
"@scenesystems/effect-dsp": minor
---

Add stable predictor paths, shared predictors, trainable and frozen parameters, immutable parameter snapshots, scoped execution overlays, bound programs, and explicit parameter installation. Introduce the generic Optimized.Result contract for algorithm-specific reports.

Modules and predictors expose their parameter references as `parameters`; bound program defaults use `boundParameters`. Cache requests use `parameters` and cache keys use `parametersHash`.
