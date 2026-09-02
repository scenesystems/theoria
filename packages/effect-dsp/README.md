# @scenesystems/effect-dsp

`@scenesystems/effect-dsp` builds language-model applications as typed programs rather than hand-tuned prompts, following the DSPy model in [Effect](https://effect.website). Use it when a model call needs a schema-checked contract, when several calls compose into a pipeline, or when you want to measure a pipeline against examples and let an optimizer improve its instructions and demonstrations.

A `Signature` declares the input and output fields of one model call as Effect schemas. A `Module` executes a signature through a strategy such as prediction, chain of thought, or tool-using ReAct, and holds learnable parameters: the instruction text and few-shot demonstrations. Because a module's `forward` is an Effect, tracing, evaluation, and optimization wrap it without changing how it is called.

Modules run against any `LanguageModel` layer from `@effect/ai`. [`@scenesystems/effect-inference`](../effect-inference/README.md) builds those layers from provider configuration, and the optimizers run their searches on [`@scenesystems/effect-search`](../effect-search/README.md).

## Installation

```sh
npm install @scenesystems/effect-dsp effect @effect/ai
```

Effect `^3.22.1` and `@effect/ai >=0.37.0` are required peer dependencies. Install `@scenesystems/effect-inference` as well if you want the provider layers shown below, or bring your own `LanguageModel` layer from an `@effect/ai` provider package.

## Basic use

The program below declares a question-answering signature, builds a predictor for it, and calls the predictor. The `LanguageModel` requirement stays in the Effect's context type until a layer provides it.

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

  const { answer } = yield* qa.forward({ question: "Which city is the capital of France?" })
  return answer
})
```

`Signature.make` accepts an instruction and two `Schema.Struct.Fields` records. `Signature.describe` attaches a field description that the module includes in the prompt. Inputs and outputs are typed from the schemas, and the model's response is decoded against the output schema before `forward` returns.

## Signatures and modules

A signature is a contract, not a prompt template. The module derives the prompt from the instruction, the field descriptions, and any demonstrations it holds, and it decodes the response into the output schema. Rich schemas such as literals, arrays, and nested structs are decoded the same way as strings.

Modules differ in how they reach an output:

| Constructor             | Strategy                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `Module.predict`        | One call that produces the output fields                                            |
| `Module.chainOfThought` | Adds a reasoning field before the declared outputs                                  |
| `Module.react`          | Interleaves reasoning with calls to `@effect/ai` tools until it can answer          |
| `Module.bestOfN`        | Samples several candidates and keeps the one a scoring function prefers             |
| `Module.refine`         | Runs a module, then re-runs it with feedback until a threshold is met               |
| `Module.compose`        | Names a pipeline built from other modules so it can be traced, saved, and optimized |

Each constructor takes a name. Names identify a module's parameters in traces, saved state, and optimizer reports, so keep them stable across releases of your application. `Module.save` serializes the instructions and demonstrations of a module and everything it composes; `Module.load` restores them into a freshly constructed module of the same shape.

## Providing a language model

`Module.forward` requires the `LanguageModel` service from `@effect/ai`. Any provider layer that supplies it works. `@scenesystems/effect-inference` resolves one from environment configuration so the same program runs against OpenAI, Anthropic, or OpenRouter without code changes:

```ts typecheck
import { Effect, Schema } from "effect"
import { Module, Signature } from "@scenesystems/effect-dsp"
import { Runtime } from "@scenesystems/effect-inference"

const program = Effect.gen(function* () {
  const signature = yield* Signature.make(
    "Classify a short sentence as positive or negative",
    { text: Signature.describe(Schema.String, "Sentence to classify") },
    { label: Signature.describe(Schema.Literal("positive", "negative"), "Sentiment label") }
  )
  const classifier = yield* Module.predict("sentiment-classifier", signature)
  return yield* classifier.forward({ text: "I love Effect." })
})

export const main = program.pipe(Effect.provide(Runtime.liveTextProviderLayer({ provider: "openai" })))
```

`Runtime.liveTextProviderLayer` reads the model and API key from environment variables, so credentials stay out of source. See the effect-inference guide for the configuration keys.

For tests, `@scenesystems/effect-dsp/test` exports `MockLanguageModel`, a deterministic `LanguageModel` that returns values you choose. `fixed` returns the same output for every call, `sequence` replays a list, and `map` derives the output from the prompt text.

```ts typecheck
import * as LanguageModel from "@effect/ai/LanguageModel"
import { Effect, Schema } from "effect"
import { Module, Signature } from "@scenesystems/effect-dsp"
import { MockLanguageModel } from "@scenesystems/effect-dsp/test"

export const test = Effect.gen(function* () {
  const signature = yield* Signature.make(
    "Classify a short sentence as positive or negative",
    { text: Signature.describe(Schema.String, "Sentence to classify") },
    { label: Signature.describe(Schema.String, "Sentiment label") }
  )
  const classifier = yield* Module.predict("sentiment-classifier", signature)
  return yield* classifier.forward({ text: "I love Effect." })
}).pipe(
  Effect.provide(MockLanguageModel.layer(LanguageModel.LanguageModel, MockLanguageModel.fixed({ label: "positive" })))
)
```

## Evaluation and optimization

An `Example` pairs an input record with an expected output record. A `Metric` scores a prediction against the expected output as a number in `[0, 1]`; `Metric.exactMatch(field)` compares one field, and `Metric.make` wraps any pure scoring function. `Evaluate.run` applies named metrics to every example, with optional concurrency, and returns a report with per-example results, `overallScores` by metric name, and success and failure counts.

Optimizers take a module, a training set, and a metric and update the module's parameters in place:

- `Optimizer.labeledFewShot` selects demonstrations from the training set.
- `Optimizer.bootstrapFewShot` runs the module on the training set and keeps the traces the metric accepts as demonstrations. `Optimizer.bootstrapRS` repeats this with random search over candidate sets.
- `Optimizer.miprov2` proposes instructions and demonstrations and searches over their combinations.
- `Optimizer.gepa` evolves instructions through reflective rewriting; `Optimizer.gepaStream` reports progress as it runs.
- `Optimizer.ensemble` combines several optimized modules.

```ts typecheck
import { Effect, Schema } from "effect"
import { Evaluate, Example, Metric, Module, Optimizer, Signature } from "@scenesystems/effect-dsp"

export const program = Effect.gen(function* () {
  const signature = yield* Signature.make(
    "Answer with a short factual response",
    { question: Signature.describe(Schema.String, "Question to answer") },
    { answer: Signature.describe(Schema.String, "Short answer") }
  )
  const qa = yield* Module.predict("question-answering", signature)

  const trainset = [
    new Example.Example({ input: { question: "Capital of France?" }, output: { answer: "Paris" } }),
    new Example.Example({ input: { question: "Capital of Japan?" }, output: { answer: "Tokyo" } })
  ]
  const exactMatch = Metric.exactMatch("answer")

  yield* Optimizer.bootstrapFewShot({ module: qa, trainset, metric: exactMatch, maxRounds: 1, maxBootstrappedDemos: 2 })

  const report = yield* Evaluate.run({ module: qa, examples: trainset, metrics: { exactMatch }, concurrency: 2 })
  return report.overallScores.exactMatch
})
```

Optimization issues many model calls. Give it an explicit dataset, a bounded budget, and a seed where the optimizer accepts one, and evaluate the result on examples the optimizer did not see. The `Cache` module memoizes model calls across evaluation runs; `Cache.DspCacheMemory`, `Cache.DspCacheFileSystem`, and `Cache.DspCacheSql` provide the backing store.

## Tracing and usage

Tracing is opt-in and fiber-local. `Trace.withTracing(effect)` runs an effect and returns its result together with the ordered trace entries recorded during it; each entry captures a module call, its inputs, and its outputs. `Trace.withUsageTracking(effect)` returns the result together with aggregated token usage. Because the state lives in fiber refs, concurrent evaluations and optimizer trials do not observe each other's traces.

```ts typecheck
import { Effect, Schema } from "effect"
import { Module, Signature, Trace } from "@scenesystems/effect-dsp"

export const program = Effect.gen(function* () {
  const signature = yield* Signature.make(
    "Summarize the text in one sentence",
    { text: Signature.describe(Schema.String, "Text to summarize") },
    { summary: Signature.describe(Schema.String, "One-sentence summary") }
  )
  const summarize = yield* Module.predict("summarize", signature)

  const [[result, entries], usage] = yield* Trace.withUsageTracking(
    Trace.withTracing(summarize.forward({ text: "Effect is a TypeScript library for building robust programs." }))
  )
  return { summary: result.summary, calls: entries.length, usage }
})
```

Traces are also how `Optimizer.bootstrapFewShot` turns successful runs into demonstrations, so the same entries you inspect during development are the material the optimizers learn from.

## Public surface

Every module is available as a namespace from the package root and as a subpath such as `@scenesystems/effect-dsp/Module`.

| Module                                        | Scope                                                                             |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| [`Signature`](./src/Signature/index.ts)       | Schema-backed signatures, field descriptions, and derived instructions            |
| [`Module`](./src/Module/index.ts)             | Module constructors, composition, parameter discovery, save, and load             |
| [`Trace`](./src/Trace/index.ts)               | Fiber-scoped traces and token-usage accounting                                    |
| [`Example`](./src/Example/index.ts)           | Labeled examples and demonstrations                                               |
| [`Metric`](./src/Metric/index.ts)             | Scoring functions and built-in metrics                                            |
| [`Evaluate`](./src/Evaluate/index.ts)         | Batch evaluation reports and evaluation event streams                             |
| [`Optimizer`](./src/Optimizer/index.ts)       | Few-shot, bootstrap, ensemble, MIPROv2, GEPA, progress, and effect-search interop |
| [`Cache`](./src/Cache/index.ts)               | Model-call memoization with memory, file-system, and SQL layers                   |
| [`Contracts`](./src/contracts/index.ts)       | Shared schemas for parameters, saved state, and objective projection              |
| [`Errors`](./src/Errors/index.ts)             | Typed errors and the `DspError` union                                             |
| [`Experimental`](./src/experimental/index.ts) | Unstable APIs that may change outside semver guarantees                           |

`@scenesystems/effect-dsp/test` exports `MockLanguageModel`. Paths under `internal` and `optimizers` are not exported.

## Errors and boundaries

Failures surface in the Effect error channel as `Schema.TaggedError` values. `SignatureError` rejects an invalid signature definition, `ParseOutputError` reports a model response that does not decode into the output schema, and `CompositionError` reports an invalid module graph. `MetricError`, `EvaluationFailed`, and `TraceError` cover scoring and observation. `BootstrapFailed`, `InstructionProposalFailed`, `AllTrialsFailed`, and `MergeRejected` come from the optimizers, and `SaveLoadError` from persistence. The `DspError` union names all of them.

Transport, authentication, and rate-limit failures belong to the `LanguageModel` layer you provide and surface as that provider's errors. The package does not manage credentials, provider quotas, or the cost of the calls an optimizer makes.

## Examples

The [examples directory](./examples/) contains runnable programs that use a live provider through `@scenesystems/effect-inference`. Start with [classification](./examples/03-basic-classify-live-openai.ts), then follow the topic you need: [ReAct tool use](./examples/09-react-tool-use-live-openai.ts) and [optimizing a ReAct module](./examples/08-react-tool-use-optimized.ts); [MIPROv2](./examples/10-miprov2-social-science-panel.ts) and [GEPA](./examples/11-gepa-teacher-student-debate.ts) on multi-stage programs; [resuming an optimization study from storage](./examples/07-study-resume-from-storage-live.ts); and [direct effect-search interop](./examples/06-effect-search-interop.ts) for ask/tell orchestration.

## Status

This package is pre-1.0. Minor releases may change public APIs; pin a compatible version and review the [changelog](./CHANGELOG.md) when upgrading. The `Experimental` module may change or be removed with less migration support than the other modules.

## Contributing and support

Read the repository [contributing guide](../../CONTRIBUTING.md) before opening a pull request. Report defects and request changes through [GitHub issues](https://github.com/scenesystems/theoria/issues). For security concerns, follow the [security policy](../../SECURITY.md).

## Attribution

This implementation draws on [DSPy](https://dspy.ai/) and the work of Omar Khattab and collaborators, including [DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines](https://arxiv.org/abs/2310.03714). MIPROv2 follows [Optimizing Instructions and Demonstrations for Multi-Stage Language Model Programs](https://arxiv.org/abs/2406.11695), and GEPA follows [Reflective Prompt Evolution Can Outperform Reinforcement Learning](https://arxiv.org/abs/2507.19457).

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
