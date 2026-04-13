# `effect-dsp`

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

**Programming — not prompting — language models, with Effect.**

An Effect-native implementation of the [DSPy](https://dspy.ai/) paradigm for TypeScript. Define typed signatures, compose learnable modules, and optimize prompts with fiber-scoped traces — without leaving the Effect ecosystem.

[Why effect-dsp?](#why-effect-dsp) · [Installation](#installation) · [Quick start](#quick-start) · [Interop example](#effect-search-interop-example) · [API at a glance](#api-at-a-glance) · [Implemented](#what-is-implemented-today) · [Roadmap](#roadmap) · [Acknowledgements](#acknowledgements) · [Contributing](#contributing)

---

## Why effect-dsp?

`effect-dsp` brings DSPy's "programming, not prompting" paradigm<sup>[1](#ref-1)</sup> to Effect-native TypeScript codebases. It is not a port of the DSPy Python library — it is a ground-up implementation that maps DSPy's core abstractions onto Effect primitives (`Schema`, `Ref`, `FiberRef`, `Layer`, `Effect.gen`), leveraging [`effect-search`](https://github.com/scenesystems/theoria/tree/main/packages/effect-search) for optimizer search orchestration.

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
- Program-of-thought module (`Module.programOfThought`) — plans executable code through a captured `ProgramInterpreter`, repairs failures, and projects the final typed answer back onto the base signature<sup>[1](#ref-1)</sup>
- Multi-chain comparison module (`Module.multiChainComparison`) — compares multiple reasoning candidates with explicit candidate-count, concurrency, and seed controls before selecting the final typed answer<sup>[1](#ref-1)</sup>
- Parallel batch module (`Module.parallel`) — fans one module over ordered inputs with explicit concurrency, explicit failure policy, and stable optimization plus artifact-envelope-ready evidence projections
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
- `COPRO` — coordinate-ascent instruction refinement with typed progress events, resumable snapshots, and effect-search-compatible study envelopes<sup>[1](#ref-1)</sup>
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

```ts typecheck
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

Mock-backed module examples:

- [`examples/16-program-of-thought-mock.ts`](./examples/16-program-of-thought-mock.ts) — typed numeric reasoning through a deterministic `ProgramInterpreter` layer
- [`examples/17-multi-chain-comparison-mock.ts`](./examples/17-multi-chain-comparison-mock.ts) — side-by-side reasoning comparison with a traced verdict pass
- [`examples/18-parallel-batch-mock.ts`](./examples/18-parallel-batch-mock.ts) — ordered batch inference plus optimization and artifact-envelope-ready evidence projections

Mock-backed optimizer example:

- [`examples/19-copro-mock.ts`](./examples/19-copro-mock.ts) — deterministic coordinate-ascent optimization with typed progress summaries, step-boundary snapshots, and effect-search-compatible study-event plus snapshot envelopes

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
const sampler = Optimizer.effectSearchInterop.Sampler.tpe({
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

| Namespace   | Key exports                                                                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Signature` | `make`, `describe`, `FieldInfo`, `Signature`, `Input`, `Output`                                                                                                              |
| `Module`    | `Params`, `SavedState`, `Module`, `predict`, `chainOfThought`, `programOfThought`, `multiChainComparison`, `parallel`, `compose`                                             |
| `Trace`     | `Entry`, `appendExecution`, `get`, `withTracing`, `withUsageTracking`, `noScore`                                                                                             |
| `Example`   | `Example`, `Demo`                                                                                                                                                            |
| `Metric`    | `Metric`, `Result`, `exactMatch`, `f1`, `contains`, `compose`                                                                                                                |
| `Evaluate`  | `run`, `stream`, `Report`, `ExampleResult`                                                                                                                                   |
| `Optimizer` | `labeledFewShot`, `bootstrapFewShot`, `bootstrapRS`, `ensemble`, `miprov2`, `copro`, `coproStream`, `effectSearchInterop` plus event schemas and typed progress constructors |
| `Errors`    | Tagged error variants (`SignatureError`, `ParseOutputError`, `BootstrapFailed`, ...) and `DspError` union                                                                    |

Subpath imports are available (`effect-dsp/Signature`, `effect-dsp/Module`, etc.). Internal and optimizer-implementation subpaths are blocked from consumers via the exports map.

The preferred public evidence path is `Trace.withTracing(...)`, `Trace.withUsageTracking(...)`, `Contracts.OptimizationObjectiveSurface.fromTraceEntry(...)`, and `Contracts.ArtifactEnvelopeSchema`. That surface keeps prompt text, delimiter-preserving `rawResponse`, parsed output, per-call usage, `totalTokens`, and replay-safe optimizer artifacts on the stable public contract. Low-level refs remain exported for advanced integration, but README examples and contracts treat them as implementation details rather than the default consumer story.

## Subpath Stability

- `effect-dsp/contracts` is the stable release lane for optimizer projections, artifact envelopes, trace projections, `totalTokens` accounting, and workflow interop adapters.
- `effect-dsp/test` is the stable consumer-test lane for deterministic mock layers such as `MockLanguageModel`; use it for consumer proofs, not package internals.
- `effect-dsp/experimental` is intentionally unstable; it currently hosts the fixture-backed OpenAgentTrace corpus lane and stays outside the main compatibility promise until the promotion rule is met.

## Experimental Open-Agent-Trace Lane

`effect-dsp/experimental` currently hosts the fixture-backed OpenAgentTrace corpus lane over `badlogicgames/pi-mono`, the checked-in Amp public-thread corpus, and a separate evidentiary Amp-thread import lane over replay-safe `amp threads export` snapshots.

- Amp is the second public grammar and currently backs the package-owned `implementationStrategy` study surface plus its execution-backed judging lane.
- The checked-in corpus authority is the raw Amp fixture tree under `fixtures/open-agent-trace/amp/`, normalized through the package-owned loader and deterministic importer in `src/OpenAgentTrace/coding/implementationStrategy/`.
- Amp-thread import is distinct from that raw capture authority: `OpenAgentTrace.AmpThread.decodeExportSnapshot` and `OpenAgentTrace.AmpThread.normalizeExportSnapshot` accept replay-safe thread-export snapshots, keep missing raw runtime authority explicit as coverage gaps, and stay evidentiary rather than pretending to be plugin or `--stream-json` capture truth.
- Both `badlogicgames/pi-mono` and the Amp corpus compile into the same `CodingPromptCase` / `CodingPromptDataset` family through the package-owned `implementationStrategy` projector; Amp sidecars only supply canonical expected strategy labels, not app-local reshaping.
- Stable promotion requires `badlogicgames/pi-mono` and the checked-in Amp public-thread corpus to decode into the same normalized OpenAgentTraceRecord family, project into the same implementationStrategy surface, and expand beyond the current three-thread Amp source catalog while keeping projection coverage explicit.
- If branch lineage, redaction provenance, workflow projection, or broader Amp source diversity than the current three-thread public corpus cannot remain explicit without app-local heuristics, the lane stays experimental and read-only.
- The first app surface for this lane is evidentiary and corpus-governed: corpus source, branch tree, projected workflow graph, redaction posture, coverage gaps, digests, and checked-in study cases ship before any stable optimization controls.
- The first package-owned study story for this lane is [`examples/24-amp-implementation-strategy-study.ts`](./examples/24-amp-implementation-strategy-study.ts), which runs the curated Amp implementation-strategy corpus and emits comparison artifacts.
- The first package-owned evidentiary import story for post-hoc threads is [`examples/25-open-agent-trace-amp-thread.ts`](./examples/25-open-agent-trace-amp-thread.ts), which loads a checked-in thread export snapshot and projects it into the workflow lane without requiring a live Amp installation.

## Roadmap

### Planned optimizers

| Optimizer           | DSPy equivalent          | Description                                                           | Reference                                                  |
| ------------------- | ------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------- |
| `SIMBA`             | `dspy.SIMBA`             | Stochastic mini-batch sampling with self-reflective improvement rules | [DSPy docs](https://dspy.ai/learn/optimization/optimizers) |
| `KNNFewShot`        | `dspy.KNNFewShot`        | k-Nearest Neighbors demo selection + `BootstrapFewShot`               | [DSPy docs](https://dspy.ai/learn/optimization/optimizers) |
| `BootstrapFinetune` | `dspy.BootstrapFinetune` | Distill prompt-based program into LM weight updates                   | [4](#ref-4)                                                |
| `BetterTogether`    | `dspy.BetterTogether`    | Meta-optimizer combining prompt + weight optimization                 | [4](#ref-4)                                                |

## Status

`effect-dsp` is in active development. Core modules — `predict`, `chainOfThought`, `programOfThought`, `multiChainComparison`, `parallel`, `bestOfN`, `refine`, `react`, and `compose` — are implemented along with seven optimizers (`LabeledFewShot`, `BootstrapFewShot`, `BootstrapRS`, `Ensemble`, `MIPROv2`, `COPRO`, `GEPA`), evaluation, tracing, and caching.

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

This package also depends on [`effect-search`](https://github.com/scenesystems/theoria/tree/main/packages/effect-search) for black-box optimization primitives (search spaces, samplers, TPE, study orchestration) used by optimizer surfaces.

## Contributing

```sh
bun run lint
bun run check
bun run test
bun run build
```

## License

[MIT](./LICENSE) — Copyright © 2026 Scene Systems
