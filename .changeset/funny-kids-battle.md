---
"effect-search": minor
---

Add advanced continuous samplers to `effect-search` with new `Sampler.cmaEs()` and `Sampler.gpBo()` constructors.

This release expands sampler taxonomy/checkpoint schemas (`CmaEs` and `GpBo`), adds typed sampler compatibility errors (`SamplerSearchSpaceUnsupported`, `SamplerObjectiveUnsupported`), supports snapshot/resume validation for the new samplers, and ships deterministic fixture-backed + integration coverage for advanced sampler execution.

Documentation and examples now include advanced-sampler guidance and continuous-space comparison coverage.
