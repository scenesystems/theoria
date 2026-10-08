# @scenesystems/effect-dsp

DSP uses schemas to define the inputs and outputs of language-model programs
in Effect. Once a program works, you can evaluate it against examples and
optimize its instructions or demonstrations. You supply the model layer;
provider failures and service requirements remain part of the program's type.

Behavioral comparisons target DSPy 3.4.0, GEPA 0.1.4 and Optuna 4.9.0.
They cover specific algorithms and recorded cases, not the full DSPy API or
identical prompts. See [compatibility and evidence](./PARITY.md) for the scope.

## Installation

```sh
bun add @scenesystems/effect-dsp effect
```

Requires Effect `^4.0.0` as a peer dependency. Import modules from the package root
or matching subpaths, such as `@scenesystems/effect-dsp/Signature`.

Supply a layer for `effect/ai/LanguageModel` to run the examples. For provider
setup, see [`effect-inference`](../effect-inference/README.md#configured-text-providers);
for local tests, use the mock layer below.

## Basic use

Define a typed question-answering program with `Signature.make` and `Module.predict`.

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

The schemas determine the types accepted and returned by `qa.forward`.
Keep module names stable: DSP uses predictor paths to identify parameters when
tracing, optimizing or restoring saved state. See [`Module`](./src/Module.ts)
for tool-using programs and composition with `react`, `bestOfN` and other modules.

## Evaluation and optimization

An `Example` holds input fields and optional raw labels. Labels are not decoded
through the output signature; the metric decides whether an input-only example
can be scored. Omit `labels` for those rows, or supply `Option.some` as below.

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

Every optimizer returns an immutable `Optimized.Result`: an executable bound
`program`, its `parameters` snapshot and an algorithm-specific serializable
`report`. The original module stays unchanged on success, failure and
interruption. Run the returned program directly, or explicitly mutate the
original with `yield* Module.install(qa, optimized.parameters)`.
`Module.bound` also binds a program to a snapshot without installing it;
`Module.load` writes validated saved state.

Start with [`LabeledFewShot`](./src/LabeledFewShot.ts) for supplied examples
or [`BootstrapFewShot`](./src/BootstrapFewShot.ts) for generated demonstrations.
[`BootstrapRS`](./src/BootstrapRS.ts) searches demonstration sets;
[`MIPROv2`](./src/MIPROv2.ts) searches instructions and demonstrations;
[`GEPA`](./src/GEPA.ts) uses reflective feedback. Use an algorithm's
`runWithEvents` or `stream` when it exposes progress.

Evaluation retains failed examples in its ordered outcomes and denominator.
`Report.average` is a fraction and includes `failureScore` (default zero) for
failed rows. `maxErrors` stops evaluation when the expected-failure count reaches
the limit; defects and interruption propagate. Evaluate defaults to no error
limit. BootstrapFewShot, BootstrapRS and MIPROv2 resolve an absent or none
`maxErrors` to 10 for their bootstrap and evaluation passes.

BootstrapRS ranks and stops on unrounded fractions. DSPy's rounded percentages
can choose a different winner or stop near a rounding boundary. MIPROv2 counts
sampled trials, not baseline or inserted full-evaluation rows, and returns its
best full-evaluation result rather than its minibatch peak.

GEPA requires exactly one of `auto`, `maxMetricCalls` or `maxFullEvals`.
It reflects on training examples and returns the highest aggregate validation
score, not the first member of its coverage front. Metric-budget checks occur
at iteration boundaries and can overshoot. `report.feedbackMetricCalls` counts
targeted feedback calls separately from that budget.

Save a GEPA checkpoint to continue an optimization later. Resuming reproduces an
uninterrupted Theoria run when the module, datasets, metric, options and model
responses are the same. `maxIterations` is an absolute boundary, so raise or
remove it when continuing.

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

For custom objectives and samplers, use
[`effect-search`](../effect-search/README.md) directly.
[`EvaluationObjective`](./src/EvaluationObjective.ts) converts evaluation
reports into search objectives.

## Model roles and settings

Model roles and settings come from `@scenesystems/effect-lm`. Optimizers use
`teacher`, `proposer` and `critic` roles with `teacherSettings`, `proposerSettings`
and `reflectionSettings`. Install a `ModelBinder.Binder` with
`ModelBinder.withBinder` to route roles to models and resolve their settings.
[`effect-inference`](../effect-inference/README.md) provides `ModelBinder.layer`
for hosted providers. Without a critic binder, GEPA reflection falls back to
the task model with a warning.

## Traces, payloads and cache

Wrap a program in `Trace.withTracing`, `withCalls` or `withUsageTracking` to
collect its calls, including calls in child fibers. Each scope has its own
records. Usage comes from the provider's `Response.Usage`; missing counters
remain unknown, and DSP does not calculate a total when the provider omits it.
To retain traces when a program fails, put `Effect.exit(program)` inside the scope.
`Module.call` returns decoded output, selected traces, parse-attempt evidence
and usage; `forward` returns the output directly.

Use the codecs in [`Payload`](./src/Payload.ts) to store traces and
demonstrations while preserving their schemas' encoded values.

Provide [`Cache.layerMemory`](./src/Cache.ts) for local memoization, or an
effect-search backend to `Cache.layer`. Predictors cache successful model results
at every temperature unless `cache: "never"` is selected. Toolkit execution and
failed computations are not cached. Cached results are specific to the model
and invocation, including their settings and encoded inputs. See the cache
reference for the full identity contract.

Declared model identities allow durable reuse. Anonymous model and binder
identities last only for the Cache layer's scope; a Cache service installed
without that layer memoizes only declared identities. Change module/runtime
fingerprints when identity semantics change. Automatic cache failures warn and
continue; explicit cache operations retain typed failures.

## Errors

`DspError.DspError` is the schema union of package-owned tagged failures. Native
Schema, provider, platform, effect-search and user callback failures remain in
their original channels when an operation exposes them separately.

## Testing

Provide `MockLanguageModel` to test a program without calling a provider:

```ts typecheck
import * as LanguageModel from "effect/ai/LanguageModel"
import * as MockLanguageModel from "@scenesystems/effect-dsp/MockLanguageModel"

export const layer = MockLanguageModel.layer(
  LanguageModel.LanguageModel,
  MockLanguageModel.succeed({ answer: "Paris" })
)
```

Use `MockLanguageModel.fromFunction` for effectful prompt-dependent behavior,
`sequence` for ordered responses and `fail` for checked provider failure tests.

## Examples

See the [API reference](./src/index.ts) and [examples directory](./examples/):

- [Live classification](./examples/03-basic-classify-live-openai.ts): requires provider credentials.
- [Search integration](./examples/06-effect-search-interop.ts): runs locally without a provider.
- [ReAct optimization](./examples/08-react-tool-use-optimized.ts): requires provider credentials.

## Status

See Theoria's [versioning policy](../../README.md#documentation-and-examples) and
the package [changelog](./CHANGELOG.md) when upgrading.

## Contributing and support

See Theoria's [contribution and support information](../../README.md#contributing-and-support).

## Attribution

The programming model draws on [DSPy](https://github.com/stanfordnlp/dspy) and
[Khattab et al., 2023](https://arxiv.org/abs/2310.03714). MIPROv2 follows
[Opsahl-Ong et al., 2024](https://arxiv.org/abs/2406.11695); GEPA follows
[Agrawal et al., 2025](https://arxiv.org/abs/2507.19457).

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
