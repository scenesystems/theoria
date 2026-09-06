---
"@scenesystems/effect-text": minor
---

Exported records are `Data.Class` types instead of `Readonly<{ … }>` aliases, `HyphenationSupportManifest` is typed by the new `HyphenationSupportManifestType`, and `BrowserParityResolvedCase` is a `Data.Class` exported from the browser entrypoint. Layout internals model absence with `Option`.

Grapheme segmentation uses `Intl.Segmenter` unconditionally; the code-point fallback for runtimes without it is removed (every supported runtime — Bun, Node 22, Workers, evergreen browsers — ships it).

`React.PrepareIdentity` is a structural `Data.Class` (with `PrepareIdentityFont` and `PrepareIdentityEngineProfile`, absence as `Option`) that keys caches directly; the string codec (`PrepareIdentityKey`, `prepareIdentityKey`, `prepareIdentityFromKey`, `engineProfileIdentity`) and its defaulting decode are removed, and `React.prepareInputFromIdentity` recovers the preparation input from an identity.
