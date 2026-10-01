---
"@scenesystems/effect-study": minor
"@scenesystems/effect-search": minor
"@scenesystems/effect-dsp": minor
"@scenesystems/effect-text": minor
---

Extract reusable evaluation, trial history, stop controls, scoped event streams, and schema-driven artifact persistence into `@scenesystems/effect-study`. Search retains optimization policies; DSP streams and fixed-profile text calibration consume the shared package directly.

Redesign study and search around canonical public concern modules with matching root namespaces and package subpaths. This is a breaking pre-1.0 API migration: replace the previous contracts, error barrels, nested public modules, and forwarding declarations rather than retaining compatibility aliases. Migrate DSP and text consumers to the redesigned APIs.

Preserve buffered completion events and release interrupted search-state mutations without blocking subsequent work. Replacing a trial now replaces its recorded cost instead of counting it twice.

Derive recursive custom artifact payloads from Schema without changing their public types. Preserve all string keys, including `__proto__`, when encoding and decoding nested payload records.
