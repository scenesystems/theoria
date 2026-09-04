---
"@scenesystems/effect-dsp": minor
---

Every exported record is a `Data.Class` (or a `Schema.Struct` where it is pure data) instead of a `Readonly<{ … }>` alias, and absence is `Option` instead of `undefined`. Existing object literals remain assignable to the class instance types. `projectSingleObjective(report, metricName)` now takes `Option.Option<string>` for the metric instead of an optional string; pass `Option.none()` to project the report's first metric (or `score`).
