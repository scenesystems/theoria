# @scenesystems/effect-dsp

Effect-native typed language-model programs, evaluation, tracing, persistence,
and optimization. Signatures retain Effect schemas, modules retain generic
Effect error and service channels, and optimizers mutate learnable instructions
and demonstrations without owning provider configuration.

## Installation

```sh
npm install @scenesystems/effect-dsp effect @effect/ai
```

Bring any `LanguageModel` layer from `@effect/ai`. Provider setup can come from
`@scenesystems/effect-inference`, but DSP production code does not depend on it.

## Typed programs

```ts typecheck
import { Effect, Schema } from "effect"
import { Module, Signature } from "@scenesystems/effect-dsp"

export const program = Effect.gen(function* () {
  const signature = yield* Signature.make(
    "Answer with a short factual response",
    { question: Signature.describe(Schema.String, "Question to answer") },
    { answer: Signature.describe(Schema.String, "Short answer") }
  )
  const qa = yield* Module.predict("question-answering", signature)
  return yield* qa.forward({ question: "Capital of France?" })
})
```

`Module.predict`, `chainOfThought`, `react`, `bestOfN`, `refine`, and `compose`
preserve schema-decoded input/output types and generic Effect channels. Stable
module names identify parameters in traces, discovery graphs, saved state, and
optimizer candidates.

`ModuleParameters` owns parameter construction, immutable updates, projections,
and scalar dimensions. `ModuleGraph` owns serializable `ModuleGraph`, `Node`, `Edge`,
`Lineage`, and `Projection` values. `Demonstration.Codec` is compiled from a
signature's encoded schemas, so destination validation, trace replay, and
equivalence never rerun domain transformations.

## Evaluation and optimization

```ts typecheck
import { Array as Arr, Effect, Schema } from "effect"
import { BootstrapFewShot, Evaluate, Example, Metric, Module, Signature } from "@scenesystems/effect-dsp"

export const program = Effect.gen(function* () {
  const signature = yield* Signature.make(
    "Answer geography questions",
    { question: Schema.String },
    { answer: Schema.String }
  )
  const qa = yield* Module.predict("qa", signature)
  const examples = Arr.make(
    new Example.Example({ input: { question: "Capital of France?" }, output: { answer: "Paris" } })
  )
  const metric = Metric.exactMatch("answer")

  yield* BootstrapFewShot.run({
    module: qa,
    trainset: examples,
    metric,
    maxRounds: 1,
    maxBootstrappedDemos: 1
  })

  return yield* Evaluate.run({ module: qa, examples, metrics: { exactMatch: metric } })
})
```

Algorithms are independent modules rather than members of an umbrella registry:

- `LabeledFewShot.run`
- `BootstrapFewShot.run`, `runWithEvents`, and `stream`
- `BootstrapRS.run`
- `MIPROv2.run`, `runWithEvents`, and `stream`
- `GEPA.run`, `runWithEvents`, and `stream`
- `Ensemble.make`

`MIPROv2Candidates` owns destination-bound candidate construction and validation;
`MIPROv2Search` owns direct search over those candidates. `EvaluationObjective`
projects evaluation reports into effect-search objectives.

Each event-producing algorithm also owns its event schema, constructors,
formatters, stream taps, and summaries. MIPROv2 preserves effect-search
optimization failures. Candidate validation happens before provider calls or
parameter writes; failed matching checkpoints evict only the failed candidate
and retain historical best state. Bootstrap algorithms restore the complete
initial parameter graph on failure or interruption.

Search primitives are not mirrored. Import optimization, samplers, Pareto
operations, and deterministic seed operations directly from effect-search.
DSP's `Artifact` concern composes generic provenance and envelopes from
effect-study:

```ts typecheck
import { Optimization, Pareto, Sampler } from "@scenesystems/effect-search"

export const sampler = Sampler.tpe({ seed: 17 })
export const frontier = Pareto.nonDominatedIndices
export const optimize = Optimization.run
```

## Traces, payloads, and cache

`Trace.withTracing`, `withCalls`, and `withUsageTracking` create isolated lexical
scopes inherited by child fibers. Calls retain native `Response.Usage`; missing
counters stay unknown and total tokens are never synthesized. Put
`Effect.exit(program)` inside a trace scope when failure evidence must survive.

`Payload.encode` and `Payload.decode` serialize data through its owning schema and
verify encoded-schema equivalence after JSON round trip. Trace inputs/outputs and
demonstration documents therefore retain nested encoded values losslessly.

`Cache.Cache`, `Cache.Key`, `Cache.key`, `Cache.layer`, and `Cache.layerMemory`
provide language-model result memoization over effect-search cache backends.
Provide an effect-search `Cache` layer to `Cache.layer` for filesystem or SQL
storage. Resolutions contain `value` and `resolution`; failed computations are
not cached, and rollout partitions remain isolated.

## Errors and testing

`DspError.DspError` is the schema union of package-owned tagged failures. Native
Schema, provider, platform, effect-search, and user callback failures remain in
their original channels when an operation exposes them separately.

Testing code imports the flat `MockLanguageModel` subpath:

```ts typecheck
import * as LanguageModel from "@effect/ai/LanguageModel"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"

export const layer = MockLanguageModel.layer(
  LanguageModel.LanguageModel,
  MockLanguageModel.succeed({ answer: "Paris" })
)
```

Use `MockLanguageModel.fromFunction` for effectful prompt-dependent behavior,
`sequence` for ordered responses, and `fail` for checked provider failure tests.

## Public modules

Every production concern is available from the package root and from a matching
PascalCase subpath: `Signature`, `Module`, `ModuleParameters`, `ModuleGraph`,
`Demonstration`, `Example`, `Metric`, `Evaluate`, `EvaluationObjective`, `Artifact`, `Trace`, `Cache`, `Payload`,
`DspError`, `OptimizerEvent`, `LabeledFewShot`, `BootstrapFewShot`, `BootstrapRS`,
`MIPROv2`, `MIPROv2Candidates`, `MIPROv2Search`, `GEPA`, and `Ensemble`.
`MockLanguageModel` is available through the root namespace and matching testing
subpath. Private `internal/*` paths are blocked.

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
