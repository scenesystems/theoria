---
"@scenesystems/effect-search": minor
---

Optimizer, scheduler and resume option records are `Data.Class` types instead of `Readonly<{ … }>` aliases; `SelectWeightedIndexOptions` and `SampleWeightedPairOptions` are `Schema.Struct` values exported alongside their types. Existing object literals remain assignable. Internal absence is modelled with `Option`, never `null`.
