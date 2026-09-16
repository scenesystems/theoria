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

In text mode, each marker contains its field's encoded wire value. Fields whose encoded schema accepts a string retain that literal text, even when it resembles JSON. Other fields decode JSON through their encoded schema before the original output schema applies domain transformations once. For example, `result: Schema.Struct({ count: Schema.NumberFromString })` accepts `[[ ## result ## ]]` followed by `{"count":"7"}` and returns `{ result: { count: 7 } }`. This also applies to ReAct and default `auto` after adding demonstrations.

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

`Module.load` validates every demonstration against its destination's encoded schemas before writing any parameter ref. Invalid or excess fields fail with `SaveLoadError` and leave the entire tree unchanged. Destination trace replay also rejects excess fields rather than silently dropping them.

Composition rejects root collisions, inconsistent child identities, and cycles before mutation. Shared-child diamonds are supported: projections of one live parameter owner must preserve its child declarations, metadata, and original signature's demonstration contract. Different projections cannot silently hide parameter refs from save/load or optimization.

`discoverModules`, `discoverModuleGraph`, and `withDiscoveryScope` share one synchronized collector across child fibers in each scope. Concurrent ensemble branches retain their executed descendants, and conflicting owners fail atomically with `CompositionError`. Nested scopes remain isolated and restore the outer collector after success, failure, or interruption. Snapshots include registrations completed before the awaited program finishes; discovery does not wait for detached work. `ModuleRegistryRef` now contains `Option<SynchronizedRef<HashMap<ModuleId, ModuleRegistration>>>`; prefer the discovery combinators over direct ref access.

`bestOfN` and `refine` reward callbacks, and `ensemble` reducers, may require services and return their own checked errors. Their requirements and errors compose with the wrapped modules' channels. Refinement restores its instruction snapshot after callback failure or interruption.

`bestOfN` and `refine` include their live inner module and its descendants in the owned graph. Their constructors can fail with `CompositionError`; choose a wrapper name distinct from every descendant. Saved wrapper states now include those live parameters. Older incomplete wrapper snapshots cannot restore parameters they never captured; regenerate them from the intended program state before loading the complete graph.

Direct `Optimizer.runPhase3Search` calls validate candidate-set identities and every demonstration against its destination before the baseline evaluation or parameter writes, including candidates that are not selected initially. Invalid sets fail with `AllTrialsFailed` without changing the parameter tree. Ensemble sizes are rounded down and then clamped to at least one available member; a positive fractional size cannot produce an empty ensemble.

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

An `Example` pairs an input record with an expected output record. `Metric<E, R, A>` compares decoded output values of type `A`, preserving the scorer's checked errors and required services. `Evaluate` and optimizers decode imported expected outputs through the module's output schema before scoring; predictions already have that schema's decoded type. `Metric.exactMatch(field)` compares a normalized scalar field on ordinary records or class instances. `Metric.make` wraps a pure scorer; `Metric.fromEffect` retains effectful scoring. Scores are numbers, not automatically restricted to `[0, 1]`.

Infer custom scorer arguments from the actual output schema, including nested values and transformations:

```ts typecheck
import { Number, Schema } from "effect"
import { Metric } from "@scenesystems/effect-dsp"

export const Output = Schema.Struct({ result: Schema.Struct({ count: Schema.NumberFromString }) })
export const difference = Metric.make(
  "difference",
  (prediction: typeof Output.Type, expected) =>
    new Metric.Result({ score: Number.subtract(prediction.result.count, expected.result.count) })
)
```

Use `Output.fields` when constructing the module signature. Both counts above are numbers, even when the imported expected count is encoded as a string. `Evaluate.run` applies named metrics to every example, with optional concurrency, and returns per-example results, `overallScores` by metric name, and success and failure counts. Malformed labels and checked scorer failures become failed report entries, not defects.

Expected labels are decoded before model execution, so malformed labels do not incur model calls. Text prompts, output templates, and parse diagnostics use encoded field names, including `Schema.fromKey` mappings; the original output Schema still owns defaults and domain decoding.

Optimizers take a module, a training set, and a metric and update the module's parameters in place:

- `Optimizer.labeledFewShot` selects demonstrations from the training set.
- `Optimizer.bootstrapFewShot` runs the module on the training set and keeps the traces the metric accepts as demonstrations. `Optimizer.bootstrapRS` repeats this with random search over candidate sets.
- `Optimizer.miprov2` proposes instructions and demonstrations and searches over their combinations.
- `Optimizer.gepa` evolves instructions through reflective rewriting; `Optimizer.gepaStream` reports progress as it runs.
- `Optimizer.ensemble` combines several optimized modules.

Demonstrations belong to the predictor that executes them. `labeledFewShot` validates its selected examples against every destination's encoded signature before changing any parameter ref; incompatible stages fail with a checked `ParseError`. `bootstrapFewShot` learns each child's demonstrations from that child's completed traces, scores acceptance against the root result, and compares nested wire values with the owning schema's structural equivalence. It never copies root labels into a differently shaped child. Caps apply per destination; full destinations skip deduplication, and unequal inputs skip output comparison.

MIPROv2 Phase 1 makes no teacher calls. It builds each stage's labeled candidates from compatible labels and bootstrap candidates from existing destination demos plus compatible labels. Run `bootstrapFewShot` first to supply stage-specific trace evidence; without compatible evidence, a stage stays zero-shot. All-failed evaluation reports are failures, not zero-valued objectives, so failed candidates cannot beat valid negative scores. BootstrapFewShot and BootstrapRS restore the entire initial parameter tree on failure or interruption and retain their learned or selected parameters on success. These restoration guarantees are specific to those optimizers, not a blanket guarantee for every optimization API.

MIPROv2 validates and serializes every predictor's Phase 2 demonstrations before the first proposal call. Nested values, arrays, nulls, and encoded strings such as `"007"` remain intact without rerunning domain transformations. BootstrapRS constructs its automatic labeled baseline independently per destination; incompatible labels leave that stage zero-shot instead of blocking the subsequent bootstrap candidates.

GEPA evolves instructions across all owned predictors. Its first acceptance gate evaluates at most three validation rows; a rejected mutation skips the remaining rows, while an accepted mutation reuses that prefix and evaluates only the remainder. Candidate evaluation restores all parameter snapshots on success, checked failure, and interruption; final selection writes the winning instructions across the graph. Reflection separates actual predictor execution evidence from program-level expected outputs and metric feedback.

```ts typecheck
import { Array as Arr, Effect, Schema } from "effect"
import { Evaluate, Example, Metric, Module, Optimizer, Signature } from "@scenesystems/effect-dsp"

export const program = Effect.gen(function* () {
  const signature = yield* Signature.make(
    "Answer with a short factual response",
    { question: Signature.describe(Schema.String, "Question to answer") },
    { answer: Signature.describe(Schema.String, "Short answer") }
  )
  const qa = yield* Module.predict("question-answering", signature)

  const trainset = Arr.make(
    new Example.Example({ input: { question: "Capital of France?" }, output: { answer: "Paris" } }),
    new Example.Example({ input: { question: "Capital of Japan?" }, output: { answer: "Tokyo" } })
  )
  const exactMatch = Metric.exactMatch("answer")

  yield* Optimizer.bootstrapFewShot({ module: qa, trainset, metric: exactMatch, maxRounds: 1, maxBootstrappedDemos: 2 })

  const report = yield* Evaluate.run({ module: qa, examples: trainset, metrics: { exactMatch }, concurrency: 2 })
  return report.overallScores.exactMatch
})
```

Optimization issues many model calls. Give it an explicit dataset, a bounded budget, and a seed where the optimizer accepts one, and evaluate the result on examples the optimizer did not see. The `Cache` module provides memoization stores; provider prompt-cache token reports do not establish whether a DSP result-cache hit occurred.

## Tracing and usage

Observation is opt-in. `Trace.withTracing(effect)` returns the result and module trace entries. `Trace.withCalls(effect)` returns the result and individual model-call records, independently of parsing and trace projection. `Trace.withUsageTracking(effect)` returns the result and `{ tokens, callCount }`, aggregated from those calls. Each scope owns a shared Effect `Ref` inherited by child fibers. Nested scopes forward records once to their lexical ancestors, without including concurrent siblings in their own snapshots. Join child work before reading a completed scope; these combinators do not wait for detached fibers.

`Entry.usage` contains the final successful invocation's selected native `Response.Usage`, shared with its `Call` and evaluation projection. ReAct uses each iteration's selected usage. `Call.usage` is an `Option<Response.Usage>` and survives typed failure, defects, and interruption when usage was observed. All five native counters are retained: input, output, total, reasoning, and cached-input tokens. Total is independent; DSP never calculates it from input plus output. An empty aggregate has five known zeros. If any call omits a counter, that aggregate counter stays unknown; individual known observations remain in the call records. `callCount` counts DSP-visible invocations, not physical HTTP attempts or settled charges.

```ts typecheck
import { Array as Arr, Data, Effect, Schema } from "effect"
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
  return Data.struct({ summary: result.summary, entries: Arr.length(entries), usage })
})
```

To retain failure evidence, put `Effect.exit(program)` **inside** `Trace.withCalls` or `Trace.withUsageTracking`. The scope returns the original `Exit` alongside its records; it does not turn failure into a successful model result. `Trace.get`, `Trace.getCalls`, and `Trace.getUsage` are also available to finalizers installed inside the corresponding scope. Outside a scope they return empty observations.

Successful native responses supply usage automatically. To capture provider usage **before** native structured decoding or tool processing fails, decorate the native provider client with `@scenesystems/effect-inference/Usage` and pass `Trace.observeUsage`. OpenAI Responses, Anthropic Messages, Google AI, and OpenRouter chat-completion clients are supported. Each has an independent `Usage/<Provider>` subpath; these integrations are not DSP core dependencies:

```ts typecheck
import * as LanguageModel from "@effect/ai/LanguageModel"
import * as OpenRouterClient from "@effect/ai-openrouter/OpenRouterClient"
import * as OpenRouterLanguageModel from "@effect/ai-openrouter/OpenRouterLanguageModel"
import { Effect, Layer } from "effect"
import { Trace } from "@scenesystems/effect-dsp"
import { Usage } from "@scenesystems/effect-inference"

export const observedModel = Layer.effect(
  LanguageModel.LanguageModel,
  Effect.gen(function* () {
    const client = yield* OpenRouterClient.OpenRouterClient
    return yield* OpenRouterLanguageModel.make({ model: "openai/gpt-4o-mini" }).pipe(
      Effect.provideService(OpenRouterClient.OpenRouterClient, Usage.observeOpenRouter(client, Trace.observeUsage))
    )
  })
)
```

Supply that layer with your existing native client layer, including Gateway configuration. No Theoria routing runtime is required. For Google use `Usage.observeGoogle` with `GoogleClient` and `GoogleLanguageModel`. For caller-owned providers, pass `Usage.observeConstructor(params, Trace.observeUsage)` to native `LanguageModel.make`. This instruments canonical finish-part usage before Effect handles tools or decodes objects; it does not replace those operations.

DSP selects usage once per invocation. Early observations take precedence wholesale over the successful-response fallback, including missing counters, and never add a second call. The native response object is unchanged. Provider adapters retain reported counters rather than synthesizing totals. For OpenAI, Google, and OpenRouter, the second callback argument is an `Option` of the complete native usage report; a non-streaming response without a report emits unknown canonical counters and `None`, preventing fallback to synthesized zeros. Anthropic supplies a tagged `AnthropicUsageObservation` containing cumulative `usage` and the unchanged response/start/delta `raw` report; connect it with `(observation) => Trace.observeUsage(observation.usage)`. Constructor observation supplies the original finish part, including provider metadata. DSP collects the canonical counters only. Anthropic reports no overall total or separate reasoning count, so those observations remain unknown even if its native model later derives a total. Streaming adapters retain every received usage snapshot; events without usage do not erase previous observations. They cannot recover unreceived usage. An opaque prebuilt `LanguageModel` supports normal execution and returned-response usage, not the stronger pre-interpretation guarantee.

`Schema.parseJson(Trace.Call)` and `Schema.parseJson(Trace.Entry)` provide native JSON round trips, including unknown usage versus actual zero and optional scores. Call records omit prompts and error contents; entries retain inputs, outputs, prompts, and raw responses without redaction. Applications own durable attempt IDs, reservations, prices, persistence, reconciliation, and settlement.

**Migration from 0.3:** replace flattened entry token fields with `entry.usage`, and aggregate token fields with `usage.tokens`. `UsageSample`, `usageDelta`, `appendUsage`, `appendExecution`, the mutable public fiber refs, and fabricated cache-hit counters are removed. Record successful entries separately from `Call` evidence; callers must not also account for a call already recorded by a DSP module.

**Payload format migration:** `Entry.input`, `Entry.output`, trace objective projections, GEPA reflection payloads, and `OptimizerEventEnvelope.payload` now hold branded JSON document strings, not recursive field records. `FieldValue`, `FieldRecord`, `MetricPayload`, `projectFieldRecord`, and `encodeAndProjectFieldRecord` are removed. Encode with `Contracts.encodePayload(schema, value)` and recover domain values with `Contracts.decodePayload(schema, document)`; use `Schema.encodedSchema(schema)` to inspect or replay wire values. Existing persisted record payloads require migration through their owning schema before decoding the new envelopes. Optimizer event envelope constructors now retain checked `ParseError` failures.

```ts typecheck
import { Data, Effect, Schema } from "effect"
import * as Contracts from "@scenesystems/effect-dsp/contracts"

const Output = Schema.Struct({ answer: Schema.String, count: Schema.NumberFromString })
export const roundTrip = Effect.gen(function* () {
  const document = yield* Contracts.encodePayload(Output, { answer: "Paris", count: 17 })
  const decoded = yield* Contracts.decodePayload(Output, document) // count: 17
  const encoded = yield* Contracts.decodePayload(Schema.encodedSchema(Output), document) // count: "17"
  return Data.struct({ decoded, encoded })
})
```

Serialization checks JSON round-trip equivalence on the encoded schema, without running domain transformation decoders. Use explicit JSON wire schemas with suitable native equivalence: `Unknown`, `Object`, empty structs, and opaque declarations do not supply general structural JSON equality. Supply an appropriate schema/equivalence annotation for such contracts; failed or unavailable equivalence remains a checked parse failure rather than silently losing information. `Payload` itself validates JSON syntax, not a domain contract. Completed ReAct answers use the signature output schema; intermediate tool or parse-failure documents use `Trace.UnparsedOutput`, whose `parseError` is an `Option<string>`. New trace entries and projections distinguish these with `outcome: "completed" | "intermediate"`; older entries default to `"completed"` when decoded. Bootstrap consumes only completed entries from its current run.

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

Failures surface in the Effect error channel as `Schema.TaggedError` values. `SignatureError` rejects an invalid signature definition, `ParseOutputError` reports a model response that does not decode into the output schema, and `CompositionError` reports an invalid module graph. `MetricError`, `EvaluationFailed`, and `TraceError` cover scoring and observation. `BootstrapFailed`, `InstructionProposalFailed`, `AllTrialsFailed`, and `MergeRejected` come from the optimizers, and `SaveLoadError` from persistence. MIPROv2 also preserves effect-search study failures such as `ArtifactStorageError` rather than replacing them with `AllTrialsFailed`. The `DspError` union names package-owned DSP failures.

Transport, authentication, and rate-limit failures belong to the `LanguageModel` layer you provide and surface as that provider's errors. The package does not manage credentials, provider quotas, or the cost of the calls an optimizer makes.

## Examples

The [examples directory](./examples/) contains runnable programs that use a live provider through `@scenesystems/effect-inference`. Start with [classification](./examples/03-basic-classify-live-openai.ts), then follow the topic you need: [ReAct tool use](./examples/09-react-tool-use-live-openai.ts) and [optimizing a ReAct module](./examples/08-react-tool-use-optimized.ts); [MIPROv2](./examples/10-miprov2-social-science-panel.ts) and [GEPA](./examples/11-gepa-teacher-student-debate.ts) on multi-stage programs; [resuming an optimization study from storage](./examples/07-study-resume-from-storage-live.ts); and [direct effect-search interop](./examples/06-effect-search-interop.ts) for ask/tell orchestration.

Examples 12 and 14 retain two-decimal feedback strings, including trailing zeros. Formatting uses Effect's `Number.round`, which can differ from JavaScript `toFixed` at binary rounding ties. This changes reflective prompt text at those boundaries, not objective arithmetic; it is not merely a log-format change.

## Status

This package is pre-1.0. Minor releases may change public APIs; pin a compatible version and review the [changelog](./CHANGELOG.md) when upgrading. The `Experimental` module may change or be removed with less migration support than the other modules.

## Contributing and support

Read the repository [contributing guide](../../CONTRIBUTING.md) before opening a pull request. Report defects and request changes through [GitHub issues](https://github.com/scenesystems/theoria/issues). For security concerns, follow the [security policy](../../SECURITY.md).

## Attribution

This implementation draws on [DSPy](https://dspy.ai/) and the work of Omar Khattab and collaborators, including [DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines](https://arxiv.org/abs/2310.03714). MIPROv2 follows [Optimizing Instructions and Demonstrations for Multi-Stage Language Model Programs](https://arxiv.org/abs/2406.11695), and GEPA follows [Reflective Prompt Evolution Can Outperform Reinforcement Learning](https://arxiv.org/abs/2507.19457).

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
