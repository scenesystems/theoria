---
"@scenesystems/effect-text": minor
---

Exported records are `Data.Class` types instead of `Readonly<{ … }>` aliases, `HyphenationSupportManifest` is typed by the new `HyphenationSupportManifestType`, and `BrowserParityResolvedCase` is a `Data.Class` exported from the browser entrypoint. Layout internals model absence with `Option`.

Grapheme segmentation uses `Intl.Segmenter` unconditionally; the code-point fallback for runtimes without it is removed (every supported runtime — Bun, Node 22, Workers, evergreen browsers — ships it).
