---
"@scenesystems/effect-inference": minor
"@scenesystems/effect-dsp": minor
---

Remove format-version fields from resolved route provenance, module saved state, and example reports. `Route.Resolved.schemaVersion`, `Route.provenanceVersion`, `Route.ProvenanceVersion`, and `Module.SavedState.version` are removed. Saved state retains optional caller metadata. These contracts describe the current shape only; no compatibility decoders or migration APIs are provided.
