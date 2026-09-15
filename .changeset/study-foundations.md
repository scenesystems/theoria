---
"@scenesystems/effect-study": minor
"@scenesystems/effect-search": patch
"@scenesystems/effect-dsp": patch
"@scenesystems/effect-text": patch
---

Extract reusable evaluation, trial history, stop controls, scoped event streams, and schema-driven artifact persistence into `@scenesystems/effect-study`. Search retains optimization policies and existing entrypoints; DSP streams and fixed-profile text calibration consume the shared package directly.

Preserve buffered completion events and release interrupted search-state mutations without blocking subsequent work. Replacing a trial now replaces its recorded cost instead of counting it twice.

Derive recursive custom artifact payloads from Schema without changing their public types. Preserve all string keys, including `__proto__`, when encoding and decoding nested payload records.
