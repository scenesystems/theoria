# @scenesystems/effect-dsp

Build typed language-model programs, evaluate their answers, and optimize
their instructions and demonstrations in Effect. You supply the model; DSP
handles schema-checked inputs and outputs while preserving your program's
error and service requirements.

## Installation

```sh
bun add @scenesystems/effect-dsp effect
```

Requires Effect `^4.0.0` as a peer dependency. Import modules from the package root or matching subpaths, such as `@scenesystems/effect-dsp/Signature`.

Supply a layer for `effect/ai/LanguageModel` to run
the examples. For provider setup, see
[`effect-inference`](../effect-inference/README.md#configured-text-providers);
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

`Module.predict`, `chainOfThought`, `react`, `bestOfN`, `refine`, and `compose`
preserve schema-decoded input/output types and generic Effect channels. Stable
module names identify parameters in traces, discovery graphs, saved state, and
optimizer candidates.

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

  yield* BootstrapFewShot.run(
    new BootstrapFewShot.Options({
      module: qa,
      trainset: examples,
      metric,
      maxRounds: 1,
      maxBootstrappedDemos: 1
    })
  )

  return yield* Evaluate.run(new Evaluate.Options({ module: qa, examples, metrics: { exactMatch: metric } }))
})
```

Start with [`LabeledFewShot`](./src/LabeledFewShot.ts) for supplied examples
or [`BootstrapFewShot`](./src/BootstrapFewShot.ts) for generated demonstrations.
[`BootstrapRS`](./src/BootstrapRS.ts) searches demonstration sets;
[`MIPROv2`](./src/MIPROv2.ts) searches instructions and demonstrations;
[`GEPA`](./src/GEPA.ts) uses reflective feedback.

Optimizers update the module's parameters. Bootstrap algorithms restore the
initial parameter graph on failure or interruption. Use an algorithm's
`runWithEvents` or `stream` when it exposes progress; the linked references
describe budgets, checkpoint behavior, and failure channels.

For custom objectives and samplers, use
[`effect-search`](../effect-search/README.md) directly.
[`EvaluationObjective`](./src/EvaluationObjective.ts) converts evaluation
reports into search objectives.

## Traces, payloads, and cache

`Trace.withTracing`, `withCalls`, and `withUsageTracking` create isolated lexical
scopes inherited by child fibers. Calls retain native `Response.Usage`; missing
counters stay unknown and total tokens are never synthesized. Put
`Effect.exit(program)` inside a trace scope when failure evidence must survive.

[`Payload`](./src/Payload.ts) encodes trace and demonstration data through
their schemas. Use the owning codec so domain transformations and encoded
values survive persistence correctly.

[`Cache`](./src/Cache.ts) memoizes successful language-model results.
Use `Cache.layerMemory` for local memoization, or supply an effect-search cache
backend to `Cache.layer`. Request identity comes from the input and parameter
codecs' encoded values plus module/runtime fingerprints; change the fingerprints
when their meaning changes. Failed computations are not cached.

## Errors

`DspError.DspError` is the schema union of package-owned tagged failures. Native
Schema, provider, platform, effect-search, and user callback failures remain in
their original channels when an operation exposes them separately.

## Testing

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

## Examples

See the [API reference](./src/index.ts) for all modules and the [examples directory](./examples/) for runnable programs:

- [Live classification](./examples/03-basic-classify-live-openai.ts): requires provider credentials.
- [Search integration](./examples/06-effect-search-interop.ts): runs locally without a provider.
- [ReAct optimization](./examples/08-react-tool-use-optimized.ts): requires provider credentials.

## Status

See Theoria's [versioning policy](../../README.md#documentation-and-examples) and the package [changelog](./CHANGELOG.md) when upgrading.

## Contributing and support

See Theoria's [contribution and support information](../../README.md#contributing-and-support).

## Attribution

The programming model draws on [DSPy](https://github.com/stanfordnlp/dspy) and
[Khattab et al., 2023](https://arxiv.org/abs/2310.03714). MIPROv2 follows
[Opsahl-Ong et al., 2024](https://arxiv.org/abs/2406.11695); GEPA follows
[Agrawal et al., 2025](https://arxiv.org/abs/2507.19457).

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
