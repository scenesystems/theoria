---
description: Development guidelines for @scenesystems/effect-dsp
globs: "**/*.ts, **/*.mts"
alwaysApply: true
---

# @scenesystems/effect-dsp

Effect-native typed language-model programs, evaluation, tracing, persistence,
and optimization. Production code depends on native `@effect/ai` services and
must remain independent of `@scenesystems/effect-inference`.

## Public architecture

Public modules are PascalCase source-root files and matching package subpaths:
`Signature`, `Module`, `ModuleParameters`, `ModuleGraph`, `Demonstration`,
`Example`, `Metric`, `Evaluate`, `EvaluationObjective`, `Artifact`, `Trace`,
`Cache`, `Payload`, `DspError`, `OptimizerEvent`, `LabeledFewShot`,
`BootstrapFewShot`, `BootstrapRS`, `MIPROv2`, `MIPROv2Candidates`,
`MIPROv2Search`, `GEPA`, `Ensemble`, and `MockLanguageModel`.

Algorithms own their options, lifecycle events, streams, progress formatting,
and summaries. There is no umbrella Optimizer namespace. Optimization results,
samplers, Pareto operations, and deterministic seeds are consumed directly from
`@scenesystems/effect-search`; generic lifecycle, persistence, and artifact
delivery belong to `@scenesystems/effect-study`. DSP's `Artifact` concern composes
DSP-specific provenance and envelopes from the study-owned artifact schemas.

Private mechanics live in camelCase paths below `src/internal/`.
Public MIPROv2 concerns use that exact spelling; private paths use `miprov2`.
Never add forwarding entrypoints,
compatibility aliases, generic contracts buckets, or empty experimental modules.

## Conventions

- Schema owns encoded data. Use Data for generic/function-bearing runtime records.
- Keep module `forward`, metrics, reducers, and optimizer callbacks generic in
  their Effect error and requirement channels.
- Demonstration validation and replay use `Demonstration.Codec` compiled from a
  destination signature's encoded schemas.
- Trace payloads use the lossless `Payload` codec and retain native AI usage.
- Use Effect modules for control flow, collections, equality, ordering, numbers,
  strings, graphs, maps, and randomness. Search randomness uses effect-search
  Sampler primitives directly.
- Public names are concern-local (`Options`, `run`, `runWithEvents`, `stream`);
  do not repeat the module name in symbols.

## Verification

Run `bun run check`, `bun run check:tests`, `bun run check:examples`,
`bun run lint`, `bun run test`, and `bun run build` from this package.
