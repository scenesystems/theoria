# `@scenesystems/effect-dsp`

`@scenesystems/effect-dsp` represents a language-model application as a typed model program. A signature defines its input and output schemas. Modules execute those signatures and hold learnable instructions and demonstrations. Fiber-scoped traces record calls and usage, evaluation scores the program against examples, and optimizers update its parameters from those results.

The package follows the DSPy model of programming language-model pipelines. [`@scenesystems/effect-search`](../effect-search/README.md) supplies black-box search primitives used by optimizer surfaces. [`@scenesystems/effect-inference`](../effect-inference/README.md) is a separate public package for describing and resolving model runtimes; its layers can satisfy the `@effect/ai` services consumed by a DSP module.

## Installation

```sh
npm install @scenesystems/effect-dsp effect @effect/ai
```

The required peer ranges are `effect ^3.22.1` and `@effect/ai >=0.37.0`.

## Minimal example

The program below defines a schema, creates a predictor, and leaves the `LanguageModel` requirement visible for the application to provide.

```ts typecheck
import { Effect, Schema } from "effect"
import { Module, Signature, Trace } from "@scenesystems/effect-dsp"

export const program = Effect.gen(function* () {
  const signature = yield* Signature.make(
    "Answer with a short factual response",
    { question: Signature.describe(Schema.String, "Question to answer") },
    { answer: Signature.describe(Schema.String, "Short answer") }
  )
  const qa = yield* Module.predict("question-answering", signature)

  return yield* Trace.withTracing(qa.forward({ question: "Which city is the capital of France?" }))
})
```

Signatures use `Schema.Struct.Fields`, so module input and output types follow the schemas. `Module.predict`, `Module.chainOfThought`, `Module.react`, `Module.bestOfN`, `Module.refine`, and `Module.compose` build executable units. Their parameter refs make instructions and demonstrations available to save/load and optimization workflows.

Tracing is opt-in through `Trace.withTracing` and usage tracking helpers. Trace state is fiber-local, which keeps concurrent evaluations isolated. `Evaluate.run` returns an aggregate report and collects per-example failures; `Evaluate.stream` exposes lifecycle events. Optimizers consume modules, examples, and metrics, then return modules with updated parameters. The `Optimizer.effectSearchInterop` bridge exposes ask/tell and study orchestration when direct control of `effect-search` is needed.

## Public surface

| Namespace                       | Responsibility                                                           |
| ------------------------------- | ------------------------------------------------------------------------ |
| `Signature`                     | Schema-backed signatures, field descriptions, and derived instructions   |
| `Module`                        | Model-program constructors, composition, discovery, and persistence      |
| `Trace`                         | Fiber-scoped traces and token-usage accounting                           |
| `Example`, `Metric`, `Evaluate` | Datasets, scoring, batch reports, and evaluation streams                 |
| `Optimizer`                     | Few-shot, ensemble, MIPROv2, GEPA, progress, and `effect-search` interop |
| `Cache`                         | Shared LM-call memoization with rollout partitioning                     |
| `Errors`                        | Package-owned tagged errors and the `DspError` union                     |

Matching public subpaths include `/Signature`, `/Module`, `/Trace`, `/Evaluate`, `/Optimizer`, `/Metric`, `/Example`, `/Cache`, `/Errors`, `/contracts`, and `/test`. The `/experimental` entrypoint is explicitly unstable and may change outside semver guarantees.

## Errors and operational boundaries

Signature validation, output parsing, composition, metrics, tracing, persistence, and optimization failures use `Schema.TaggedError` types under `Errors`. Provider transport and authentication failures remain in the supplied `@effect/ai` model layer. Optimization can issue many model calls and should be given explicit datasets, budgets, deterministic seeds where supported, and appropriate provider limits.

## Examples and reference

See [`examples/`](./examples) for deterministic model tests, composition, evaluation, provider layers, MIPROv2, GEPA, and `effect-search` interop. Generated API documentation is in [`docs/`](./docs). The package test entrypoint exports a deterministic `MockLanguageModel` for consumer tests.

## Status

This package is pre-1.0. Public APIs may change between minor versions. Experimental exports have weaker stability guarantees than the main namespaces.

## Contributing and support

Read the repository [contributing guide](../../CONTRIBUTING.md). Report defects and request support through [GitHub issues](https://github.com/scenesystems/theoria/issues).

## Attribution

This implementation draws on [DSPy](https://dspy.ai/) and the work of Omar Khattab and collaborators, including [DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines](https://arxiv.org/abs/2310.03714). MIPROv2 follows [Optimizing Instructions and Demonstrations for Multi-Stage Language Model Programs](https://arxiv.org/abs/2406.11695), and GEPA follows [Reflective Prompt Evolution Can Outperform Reinforcement Learning](https://arxiv.org/abs/2507.19457).

## License

[MIT](./LICENSE), Copyright 2026 Scene Systems.
