---
"@scenesystems/effect-search": minor
---

Optimizer, scheduler and resume option records are `Data.Class` types instead of `Readonly<{ … }>` aliases; `SelectWeightedIndexOptions` and `SampleWeightedPairOptions` are `Schema.Struct` values exported alongside their types. Existing object literals remain assignable. Internal absence is modelled with `Option`, never `null`.

The default terminal sink writes through Effect's `Console` service. It no longer probes `globalThis.process` for TTY streams or emits ANSI colour sequences, so output is identical in every runtime and fully capturable by `Console` test layers.
