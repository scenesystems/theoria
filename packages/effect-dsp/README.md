# @scenesystems/effect-dsp

Effect-native typed language-model programs, evaluation, tracing, persistence,
and optimization. Signatures retain Effect schemas, modules retain generic
Effect error and service channels, and optimizers return immutable bound programs
without mutating caller parameters or owning provider configuration.

Core algorithm parity: Evaluate, LabeledFewShot, BootstrapFewShot, BootstrapRS,
MIPROv2, and GEPA against DSPy 3.4.0 (GEPA 0.1.4, Optuna 4.9.0).
This is a bounded behavioral claim, not full DSPy API or prompt-byte parity.
[PARITY.md](./PARITY.md) lists the executable fixtures, exact seeded-prefix
boundaries, numerical limits, and deliberate language-native differences.

## Installation

```sh
bun add @scenesystems/effect-dsp effect
```

Bring any `LanguageModel` layer for Effect v4's `effect/ai/LanguageModel`. Provider setup can come from
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

`ModuleParameters` owns one predictor's parameter construction, immutable updates, projections,
and scalar dimensions. `ModuleGraph` owns serializable `ModuleGraph`, `Node`, `Edge`,
`Lineage`, and `Projection` values. `Demonstration.Codec` is compiled from a
signature's encoded schemas, so destination validation, trace replay, and
equivalence never rerun domain transformations.

## Predictors, parameter sets, and results

Optimization works on predictors, not on module objects:

- `Predictor` describes each parameter-bearing leaf: its stable dotted `path`,
  alternate `aliases` for shared predictors, `frozen` flag, signature text and
  parameter reference. `ModuleGraph.predictors(program)` lists them in stable path
  order.
- `ParameterSet` is an immutable `ModuleParameters` record keyed by predictor path.
  `ParameterSet.snapshot` reads a program once (optionally trainable predictors
  only); `restrict` and `diff` select and compare snapshots.
- `Module.bound(program, parameters)` returns an executable copy bound to a
  snapshot, and `Module.withParameters` runs an effect under a fiber-local
  overlay. Only `Module.install`, and `Module.load` for validated saved state,
  write caller parameters.
- `Optimized.Result` is what every optimizer returns: a bound `program`, its
  `parameters` snapshot, and the algorithm's serializable `report`.
- `TeacherTrace` is the shared teacher-execution concern behind BootstrapFewShot,
  BootstrapRS and MIPROv2. `collect` and `stream` run a teacher under leave-one-out
  overlays and the teacher role, retain every accepted and rejected trace, and
  never mutate the student or teacher. `firstPerPredictor` is the deterministic
  one-demo-per-predictor selection BootstrapFewShot uses.

Model roles and settings come from `@scenesystems/effect-lm`. Optimizer calls carry
`teacher`, `proposer`, or `critic` roles and their `teacherSettings`,
`proposerSettings`, or `reflectionSettings`; a `ModelBinder.Binder` installed with
`ModelBinder.withBinder` routes each role to a model and resolves its settings.
`@scenesystems/effect-inference`'s `ModelBinder.layer` provides a binder for hosted
providers.

```ts typecheck
import { Array as Arr, Chunk, Effect, Option, Schema } from "effect"
import { ModelBinder, ModelSettings } from "@scenesystems/effect-lm"
import {
  Example,
  LabeledFewShot,
  Metric,
  Module,
  ModuleGraph,
  ParameterSet,
  type Predictor,
  Signature,
  TeacherTrace
} from "@scenesystems/effect-dsp"

// Applies each request's settings; a real binder also selects a model per role.
const binder = new ModelBinder.Binder({
  bind: (request) => (effect) =>
    Effect.provideService(effect, ModelSettings.Current, ModelSettings.merge(ModelSettings.empty, request.settings))
})

export const program = Effect.gen(function* () {
  const signature = yield* Signature.make(
    "Answer geography questions",
    { question: Schema.String },
    { answer: Schema.String }
  )
  const qa = yield* Module.predict("qa", signature)
  const examples = Arr.make(
    new Example.Example({ input: { question: "Capital of France?" }, labels: Option.some({ answer: "Paris" }) })
  )

  const paths: ReadonlyArray<Predictor.Path> = Arr.map(
    Arr.fromIterable(ModuleGraph.predictors(qa)),
    (predictor) => predictor.path
  )
  const before = yield* ParameterSet.snapshot(qa)

  const evidence = yield* TeacherTrace.collect(
    new TeacherTrace.Options({
      student: qa,
      trainset: Chunk.fromIterable(examples),
      metric: Metric.exactMatch("answer"),
      teacherSettings: new ModelSettings.ModelSettings({ temperature: 0 })
    })
  )

  const result = yield* LabeledFewShot.run(new LabeledFewShot.Options({ module: qa, trainset: examples, k: 1 }))
  const changed = ParameterSet.diff(before, result.parameters)
  yield* Module.install(qa, result.parameters)
  return { paths, accepted: evidence.accepted, changed, report: result.report }
}).pipe(ModelBinder.withBinder(binder))
```

## Evaluation and optimization

```ts typecheck
import { Array as Arr, Effect, Option, Schema } from "effect"
import { BootstrapFewShot, Evaluate, Example, Metric, Module, Signature } from "@scenesystems/effect-dsp"

export const program = Effect.gen(function* () {
  const signature = yield* Signature.make(
    "Answer geography questions",
    { question: Schema.String },
    { answer: Schema.String }
  )
  const qa = yield* Module.predict("qa", signature)
  const examples = Arr.make(
    new Example.Example({ input: { question: "Capital of France?" }, labels: Option.some({ answer: "Paris" }) })
  )
  const metric = Metric.exactMatch("answer")

  const optimized = yield* BootstrapFewShot.run(
    new BootstrapFewShot.Options({
      module: qa,
      trainset: examples,
      metric,
      maxRounds: 1,
      maxBootstrappedDemos: 1
    })
  )

  return yield* Evaluate.run(
    new Evaluate.Options({ module: optimized.program, examples, metrics: { exactMatch: metric } })
  )
})
```

Algorithms are independent modules rather than members of an umbrella registry:

- `LabeledFewShot.run`
- `TeacherTrace.collect` and `stream` (teacher evidence, not an optimizer)
- `BootstrapFewShot.run`, `runWithEvents`, and `stream`
- `BootstrapRS.run`
- `MIPROv2.run`, `runWithEvents`, and `stream`
- `GEPA.run`, `runWithEvents`, `stream`, and `resume`
- `Ensemble.make`

`MIPROv2Candidates` owns destination-bound candidate construction and validation;
`MIPROv2Search` owns direct search over those candidates. `EvaluationObjective`
projects evaluation reports into effect-search objectives.

Each event-producing algorithm also owns its event schema, constructors,
formatters, stream taps, and summaries. MIPROv2 preserves effect-search
optimization failures. Candidate validation happens before provider calls;
failed matching checkpoints evict only the failed candidate and retain historical
best state. Optimizers return a bound `program`, a `ParameterSet`, and an
algorithm-specific serializable `report`. Caller parameters remain unchanged on
success, failure, and interruption; `Module.install` explicitly installs a result.

Evaluation retains failed examples in its ordered outcomes and denominator.
`Report.average` uses fraction units and includes `failureScore` for failed rows;
`maxErrors` limits expected failures without swallowing defects or interruption.
Evaluate's own `maxErrors` defaults to unlimited. BootstrapFewShot, BootstrapRS,
and MIPROv2 instead resolve an absent or none `maxErrors` to DSPy's settings
default of 10. BootstrapRS ranks and stops on unrounded fractions; DSPy's
two-decimal percentages can tie or stop differently for averages less than one
hundredth of a percent apart (see PARITY.md). MIPROv2's `provideTraceback` logs
each expected Phase 3 example failure, attaching its Cause when true.

GEPA requires exactly one of `auto`, `maxMetricCalls`, or `maxFullEvals`. It
reflects on training examples and returns the highest aggregate validation score,
not the first member of its coverage front. Its metric budget stops at iteration
boundaries and can overshoot; `report.feedbackMetricCalls` separately counts
targeted feedback invocations.

`GEPA.State` carries both RNG streams, epoch-shuffled batch state, component
cursors, merge scheduler counters and deduplication records. Resuming from this
state reproduces the uninterrupted run exactly with the same module, datasets,
metric, options and model responses. Upstream gepa 0.1.4 pickles only `GEPAState`:
its batch sampler and merge proposer rebuild their `random.Random(0)` streams
and counters on restart (`batch_sampler.py:43`, `merge.py:240`), so an upstream
resumed run does not reproduce its uninterrupted run.

`maxIterations` is an absolute checkpoint boundary; raise or remove it when
continuing. This example pauses after two iterations and continues to ten using
the same evaluation budget and model services:

```ts typecheck
import { Effect, Schema } from "effect"
import { GEPA } from "@scenesystems/effect-dsp"

export const optimizeInStages = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields>(
  options: GEPA.Options<I, O>
) =>
  Effect.gen(function* () {
    const partial = yield* GEPA.run(new GEPA.Options({ ...options, maxIterations: 2 }))
    const state = yield* Effect.fromOption(partial.report.state)
    const codec = Schema.fromJsonString(Schema.toCodecJson(GEPA.State))
    const checkpoint = yield* Schema.encodeEffect(codec)(state)
    const restored = yield* Schema.decodeEffect(codec)(checkpoint)
    return yield* GEPA.resume(new GEPA.Options({ ...options, maxIterations: 10 }), restored)
  })
```

`resume` rejects a checkpoint that cannot belong to the supplied module and datasets with a typed
`GEPAError` before restoring either stream. Custom `instructionProposer`s and
`componentSelector`s receive public GEPA models: `ProgramCandidate`,
`PredictorInstruction`, `ReflectiveExample`, and `State` with its `ParetoSnapshot`
and `BatchState`. A selector that returns an unknown or frozen predictor path
fails with `GEPAError`. Bind a `critic` model through ModelBinder to configure
reflection independently of task calls.

Search primitives are not mirrored. Import optimization, samplers, Pareto
operations, and deterministic seed operations directly from effect-search.
DSP's `Artifact` concern composes generic provenance and envelopes from
effect-study:

```ts typecheck
import { Optimization, Pareto, Sampler } from "@scenesystems/effect-search"

export const sampler = Sampler.tpe(new Sampler.TpeOptions({ seed: 17 }))
export const frontier = Pareto.nonDominatedIndices
export const optimize = Optimization.run
```

## Traces, payloads, and cache

`Trace.withTracing`, `withCalls`, and `withUsageTracking` create isolated lexical
scopes inherited by child fibers. Calls retain native `Response.Usage`; missing
counters stay unknown and total tokens are never synthesized. Put
`Effect.exit(program)` inside a trace scope when failure evidence must survive.

`Module.call` returns decoded output, selected trace entries, parse-attempt
evidence, and usage. `Module.forward` remains the raw invocation. Signature field
prefixes and descriptions live in predictor parameter snapshots alongside
instructions and demos; overlays, save, and load use the same state.

`Payload.encode` and `Payload.decode` serialize data through its owning schema and
verify encoded-schema equivalence after JSON round trip. Trace inputs/outputs and
demonstration documents therefore retain nested encoded values losslessly.

`Cache.Cache`, `Cache.Key`, `Cache.key`, `Cache.layer`, and `Cache.layerMemory`
provide language-model result memoization over effect-search cache backends.
Provide an effect-search `Cache` layer to `Cache.layer` for filesystem or SQL
storage. Resolutions contain `value` and `resolution`; failed computations are
not cached, and rollout partitions remain isolated.

Predictors automatically cache at every temperature when a Cache layer is present,
unless `cache: "never"` is selected. Toolkit execution is not memoized. Keys include
model identity, resolved settings, role, rollout, predictor path, effective
signature, parameters, and input. Declared model identities permit durable reuse.
Anonymous native runtimes are identified by language-model and binder object
identity only while the `Cache.layer` (or `Cache.layerMemory`) scope is open;
closing it releases those identities. A Cache service installed without that
layer memoizes only declared identities. Automatic cache failures warn and
continue; explicit cache requests retain typed failures.

`Cache.Request` and `Cache.KeyRequest` require `inputSchema` and `parametersSchema`.
Use the module signature's input codec and the parameter codec (for
example, `ModuleParameters`). Cache identity follows their encoded wire values,
not incidental runtime fields. Codecs are service-free, like the existing cache
key/output codecs. Preserve the encoded preimage to preserve existing keys;
change the module/runtime fingerprint when changing identity semantics. Do not
use `Schema.Unknown` to bypass representation selection.

## Errors and testing

`DspError.DspError` is the schema union of package-owned tagged failures. Native
Schema, provider, platform, effect-search, and user callback failures remain in
their original channels when an operation exposes them separately.

Testing code imports the flat `MockLanguageModel` subpath:

```ts typecheck
import * as LanguageModel from "effect/ai/LanguageModel"
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
`Predictor`, `ParameterSet`, `Optimized`, `Prediction`,
`Demonstration`, `Example`, `Metric`, `Evaluate`, `EvaluationObjective`, `Artifact`, `Trace`, `Cache`, `Payload`,
`DspError`, `OptimizerEvent`, `TeacherTrace`, `LabeledFewShot`, `BootstrapFewShot`,
`BootstrapRS`, `MIPROv2`, `MIPROv2Candidates`, `MIPROv2Search`, `GEPA`, and `Ensemble`.
Model settings, roles, identity, and binders are imported from `@scenesystems/effect-lm`.
`MockLanguageModel` is available through the root namespace and matching testing
subpath. Private `internal/*` paths are blocked.

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
