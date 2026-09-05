---
"@scenesystems/effect-math": minor
---

Decoded `AutodiffResolution.mode` and `ComputationDispatchPlan.autodiffMode` values now use `Option<AutodiffMode>` instead of optional properties. Their encoded JSON forms continue to omit the fields when no autodiff mode is selected.
