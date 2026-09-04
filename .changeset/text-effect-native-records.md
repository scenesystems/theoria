---
"@scenesystems/effect-text": minor
---

Exported records are `Data.Class` types instead of `Readonly<{ … }>` aliases, `HyphenationSupportManifest` is typed by the new `HyphenationSupportManifestType`, and `BrowserParityResolvedCase` is a `Data.Class` exported from the browser entrypoint. Layout internals model absence with `Option`.
