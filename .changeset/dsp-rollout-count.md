---
"@scenesystems/effect-dsp": minor
---

`Module.bestOfN` and `Module.refine` take their rollout/attempt count as the new branded `RolloutCount` (a positive integer schema exported from `@scenesystems/effect-dsp/contracts`) instead of a plain `number`. Invalid counts are rejected as a typed `ParseError` at construction (`RolloutCount.make(n)` or `Schema.decode(RolloutCount)`) rather than silently rounded or clamped to one, and neither wrapper can reach an internal defect for "no candidates produced" any more. `refine` always runs its first attempt and keeps that output when every later score is `NaN` or not greater than the current best.
