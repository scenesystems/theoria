# `effect-dsp`

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

**Programming — not prompting — language models, with Effect.**

An Effect-native implementation of the [DSPy](https://dspy.ai/) paradigm for TypeScript. Define typed signatures, compose learnable modules, and optimize prompts with fiber-scoped traces — without leaving the Effect ecosystem.

[Why effect-dsp?](#why-effect-dsp) · [Installation](#installation) · [Quick start](#quick-start) · [Interop example](#effect-search-interop-example) · [API at a glance](#api-at-a-glance) · [Implemented](#what-is-implemented-today) · [Roadmap](#roadmap) · [Acknowledgements](#acknowledgements) · [Contributing](#contributing)

---

## Why effect-dsp?

`effect-dsp` brings DSPy's "programming, not prompting" paradigm<sup>[1](#ref-1)</sup> to Effect-native TypeScript codebases. It is not a port of the DSPy Python library — it is a ground-up implementation that maps DSPy's core abstractions onto Effect primitives (`Schema`, `Ref`, `FiberRef`, `Layer`, `Effect.gen`), leveraging [`effect-search`](../effect-search) for optimizer search orchestration.

- **Schema-first signatures** — define I/O contracts with `Schema.Struct` and derive field metadata, instructions, and prompt templates. No string parsing.
- **Effect-native module runtime** — modules are values with `forward` effects and `Ref`-backed learnable parameters (instructions + demonstrations).
- **Trace-driven workflows** — collect prompt, response, timing, and score metadata in `FiberRef` with zero cross-fiber contention.
- **Layer-based LM integration** — consume `LanguageModel` from `@effect/ai` through Effect services and layers, with deterministic test layering.
- **Optimizer orchestration via `effect-search`** — optimizers compose `SearchSpace`, `Sampler`, and `Study` primitives for Bayesian and random-search–based prompt tuning.

## What Is Implemented Today?

**Core runtime:**

- Signature construction and validation (`Signature.make`, `Signature.describe`, derived field metadata and instructions)
- Predictor module (`Module.predict`) with dual output strategy resolution (`text` / `structured` / `auto`) and DSPy-compatible `[[ ## field ## ]]` delimiters<sup>[1](#ref-1)</sup>
- Chain-of-thought module (`Module.chainOfThought`) — prepends `reasoning` field to output signature<sup>[6](#ref-6)</sup>
- Module composition (`Module.compose`) — graph-based sub-module wiring with typed `forward` callbacks
- Parsing retry pipeline for text-mode outputs with structured feedback loops
- Fiber-local tracing (`Trace.withTracing`, `Trace.append`, `Trace.get`)
- Core models for examples, demonstrations, metrics, evaluation reports, and tagged errors

**Optimizers:**

- `LabeledFewShot` — attach random labeled demos without model calls<sup>[1](#ref-1)</sup>
- `BootstrapFewShot` — teacher-bootstrapped demonstration generation<sup>[1](#ref-1)</sup>
- `BootstrapRS` — random search over bootstrapped demo candidates<sup>[1](#ref-1)</sup>
- `Ensemble` — run N programs, aggregate via `majorityVote` or custom reduce function<sup>[1](#ref-1)</sup><sup>[8](#ref-8)</sup>
- `MIPROv2` — instruction + demo co-optimization via Bayesian search<sup>[2](#ref-2)</sup>
- `GEPA` — reflective prompt evolution with Pareto frontier analysis, two-gate acceptance, weighted parent sampling, and merge/crossover phases<sup>[3](#ref-3)</sup>

## Installation

```sh
npm install effect-dsp effect @effect/ai
# or
pnpm add effect-dsp effect @effect/ai
# or
bun add effect-dsp effect @effect/ai
```

`effect` and `@effect/ai` are peer dependencies. `effect-search` is a runtime dependency used by optimizer surfaces.

## Quick start

```ts
import * as LanguageModel from "@effect/ai/LanguageModel"
import { Effect, Layer, Schema } from "effect"
import { Module, Signature, Trace } from "effect-dsp"

declare const lmService: LanguageModel.Service

const program = Effect.gen(function* () {
  const qaSignature = yield* Signature.make(
    "Answer questions with short factual answers",
    { question: Signature.describe(Schema.String, "The question to answer") },
    { answer: Signature.describe(Schema.String, "A concise factual answer") }
  )

  const qa = yield* Module.predict("qa", qaSignature)

  return yield* Trace.withTracing(qa.forward({ question: "What is the capital of France?" }))
})

const runnable = program.pipe(Effect.provide(Layer.succeed(LanguageModel.LanguageModel, lmService)))
```

For a real provider runtime using Effect Config (OpenAI / Anthropic / OpenRouter), see [`examples/shared/live-provider-runtime.ts`](./examples/shared/live-provider-runtime.ts) and [`examples/03-basic-classify-live-openai.ts`](./examples/03-basic-classify-live-openai.ts).

Live optimization examples:

- [`examples/11-gepa-teacher-student-debate.ts`](./examples/11-gepa-teacher-student-debate.ts) — GEPA reflective evolution in a teacher/student debate panel
- [`examples/12-miprov2-collective-memory-network-dynamics.ts`](./examples/12-miprov2-collective-memory-network-dynamics.ts) — MIPROv2 optimization for conversational-network collective-memory protocols
- [`examples/13-gepa-conversational-network-collective-memory.ts`](./examples/13-gepa-conversational-network-collective-memory.ts) — GEPA optimization for conversational-network dynamics and collective-memory convergence
- [`examples/14-gepa-conversational-recall-direction-flows.ts`](./examples/14-gepa-conversational-recall-direction-flows.ts) — GEPA panel optimization plus effect-search multi-objective direction-flow studies for conversational recall protocols

## Effect-Search Interop Example

`effect-dsp` exposes a single canonical seam for `effect-search` integration: `Optimizer.effectSearchInterop`.

- First-party example: [`examples/01-effect-search-interop.ts`](./examples/01-effect-search-interop.ts)
- Covers ask/tell orchestration, typed acquisition selection, Pareto helpers, and progress composition

```ts
import { Effect } from "effect"
import { SearchSpace } from "effect-search"
import { Optimizer } from "effect-dsp"

const space = SearchSpace.unsafeMake({ x: SearchSpace.float(0, 1) })
const sampler = Optimizer.effectSearchInterop.makeTpeSampler({
  seed: 345,
  acquisition: "thompson"
})

const program = Effect.scoped(
  Effect.gen(function* () {
    const handle = yield* Optimizer.effectSearchInterop.open({
      direction: "maximize",
      space,
      sampler,
      trials: 1,
      objective: (config) => Effect.succeed(config.x)
    })
    const asked = yield* Optimizer.effectSearchInterop.ask(handle)
    yield* Optimizer.effectSearchInterop.tell(handle, asked.trialNumber, asked.config.x)
    return yield* Optimizer.effectSearchInterop.result(handle)
  })
)
```

## API at a glance

```ts
import { Errors, Evaluate, Example, Metric, Module, Optimizer, Signature, Trace } from "effect-dsp"
```

| Namespace   | Key exports                                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `Signature` | `make`, `describe`, `FieldInfo`, `Signature`, `Input`, `Output`                                                                              |
| `Module`    | `Params`, `SavedState`, `Module`, `predict`, `chainOfThought`, `compose`                                                                     |
| `Trace`     | `Entry`, `TraceRef`, `TraceEnabledRef`, `append`, `get`, `withTracing`, `noScore`                                                            |
| `Example`   | `Example`, `Demo`                                                                                                                            |
| `Metric`    | `Metric`, `Result`, `exactMatch`, `f1`, `contains`, `compose`                                                                                |
| `Evaluate`  | `run`, `stream`, `Report`, `ExampleResult`                                                                                                   |
| `Optimizer` | `labeledFewShot`, `bootstrapFewShot`, `bootstrapRS`, `ensemble`, `miprov2`, `effectSearchInterop` plus event schemas and tagged constructors |
| `Errors`    | Tagged error variants (`SignatureError`, `ParseOutputError`, `BootstrapFailed`, ...) and `DspError` union                                    |

Subpath imports are available (`effect-dsp/Signature`, `effect-dsp/Module`, etc.). Internal and optimizer-implementation subpaths are blocked from consumers via the exports map.

## Roadmap

### Planned modules

| Module                 | DSPy equivalent             | Description                                                | Reference                     |
| ---------------------- | --------------------------- | ---------------------------------------------------------- | ----------------------------- |
| `programOfThought`     | `dspy.ProgramOfThought`     | Generate executable code to derive the answer              | [1](#ref-1)                   |
| `multiChainComparison` | `dspy.MultiChainComparison` | Compare multiple CoT outputs to produce a final prediction | [1](#ref-1)                   |
| `parallel`             | `dspy.Parallel`             | Parallel execution of module over multiple inputs          | [DSPy docs](https://dspy.ai/) |

### Planned optimizers

| Optimizer           | DSPy equivalent          | Description                                                           | Reference                                                  |
| ------------------- | ------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------- |
| `COPRO`             | `dspy.COPRO`             | Coordinate-ascent instruction optimization                            | [1](#ref-1)                                                |
| `SIMBA`             | `dspy.SIMBA`             | Stochastic mini-batch sampling with self-reflective improvement rules | [DSPy docs](https://dspy.ai/learn/optimization/optimizers) |
| `KNNFewShot`        | `dspy.KNNFewShot`        | k-Nearest Neighbors demo selection + `BootstrapFewShot`               | [DSPy docs](https://dspy.ai/learn/optimization/optimizers) |
| `BootstrapFinetune` | `dspy.BootstrapFinetune` | Distill prompt-based program into LM weight updates                   | [4](#ref-4)                                                |
| `BetterTogether`    | `dspy.BetterTogether`    | Meta-optimizer combining prompt + weight optimization                 | [4](#ref-4)                                                |

## Status

`effect-dsp` is in active development. Core modules — `predict`, `chainOfThought`, `bestOfN`, `refine`, `react`, and `compose` — are implemented along with all six optimizers (`LabeledFewShot`, `BootstrapFewShot`, `BootstrapRS`, `Ensemble`, `MIPROv2`, `GEPA`), evaluation, tracing, and caching.

## Acknowledgements

`effect-dsp` implements the DSPy paradigm introduced by [Omar Khattab et al. at Stanford NLP](https://github.com/stanfordnlp/dspy). We build on the theoretical foundations and algorithmic designs from the following papers:

- <span id="ref-1">**[1]**</span> Khattab, O. et al. ["DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines."](https://arxiv.org/abs/2310.03714) ICLR 2024. arXiv:2310.03714, 2023. — Core DSPy framework: signatures, modules (`Predict`, `ChainOfThought`, `ReAct`, `ProgramOfThought`, `MultiChainComparison`), `BootstrapFewShot`, `BootstrapRS`, `LabeledFewShot`, `Ensemble`.
- <span id="ref-2">**[2]**</span> Opsahl-Ong, K. et al. ["Optimizing Instructions and Demonstrations for Multi-Stage Language Model Programs."](https://arxiv.org/abs/2406.11695) EMNLP 2024. arXiv:2406.11695, 2024. — `MIPROv2` optimizer: Bayesian instruction + demonstration co-optimization.
- <span id="ref-3">**[3]**</span> Agrawal, L.A. et al. ["GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning."](https://arxiv.org/abs/2507.19457) ICLR 2026 (Oral). arXiv:2507.19457, 2025. — `GEPA` (Genetic-Pareto) optimizer.
- <span id="ref-4">**[4]**</span> Soylu, D. et al. ["Fine-Tuning and Prompt Optimization: Two Great Steps that Work Better Together."](https://arxiv.org/abs/2407.10930) EMNLP 2024. arXiv:2407.10930, 2024. — `BootstrapFinetune`, `BetterTogether`.

The original DSP (Demonstrate-Search-Predict) framework<sup>[[5]](https://arxiv.org/abs/2212.14024)</sup> preceded DSPy and established the compositional retrieval + LM pipeline pattern.

- <span id="ref-6">**[6]**</span> Wei, J. et al. ["Chain-of-Thought Prompting Elicits Reasoning in Large Language Models."](https://arxiv.org/abs/2201.11903) NeurIPS 2022. arXiv:2201.11903. — Theoretical basis for `Module.chainOfThought`.
- <span id="ref-7">**[7]**</span> Yao, S. et al. ["ReAct: Synergizing Reasoning and Acting in Language Models."](https://arxiv.org/abs/2210.03629) ICLR 2023. arXiv:2210.03629. — Theoretical basis for the planned `react` module.
- <span id="ref-8">**[8]**</span> Wang, X. et al. ["Self-Consistency Improves Chain of Thought Reasoning in Language Models."](https://arxiv.org/abs/2203.11171) ICLR 2023. arXiv:2203.11171. — Theoretical basis for `Ensemble` majority-vote aggregation.

This package also depends on [`effect-search`](../effect-search) for black-box optimization primitives (search spaces, samplers, TPE, study orchestration) used by optimizer surfaces.

## Contributing

```sh
bun run lint
bun run check
bun run test
bun run build
```

## License

[MIT](./LICENSE) — Copyright © 2026 Scene Systems
