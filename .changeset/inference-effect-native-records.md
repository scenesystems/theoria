---
"@scenesystems/effect-inference": minor
---

Provider, runtime and evidence records are `Data.Class` types instead of `Readonly<{ … }>` aliases; optional provider fields are set only when present rather than assigned `undefined`. Existing object literals remain assignable.
