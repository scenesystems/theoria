# `effect-dsp`

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

Build language-model workflows the same way you build the rest of an Effect system: typed inputs, composable programs, and optimizer loops you can test, trace, and replay.

Reach for it when a prompt has stopped being a one-off string and has become real program logic.

## Why Use It?

- Turn a `Schema` into a typed prompt-and-parse contract instead of hand-maintaining brittle string formats.
- Keep LM programs inside Effect layers, tracing, retries, and composition instead of treating them as a sidecar client.
- Replace manual prompt churn with repeatable instruction and demo search.
- Store traces, usage, and optimizer output in forms downstream workflows can compare and replay.
- Start with deterministic tests before you bring a live provider into the loop.

## Installation

```sh
npm install effect-dsp effect @effect/ai
```

Use `bun add` or `pnpm add` if that is your package manager. `effect` and `@effect/ai` are peer dependencies.

## Quick Start

```ts typecheck
import * as LanguageModel from "@effect/ai/LanguageModel"
import { Effect, Schema } from "effect"
import { Module, Signature, Trace } from "effect-dsp"
import { MockLanguageModel } from "effect-dsp/test"

const program = Effect.gen(function* () {
  const signature = yield* Signature.make(
    "Label a field note with a response priority",
    {
      note: Signature.describe(Schema.String, "Observed event or report")
    },
    {
      priority: Signature.describe(Schema.String, "low, medium, or high priority")
    }
  )

  const classifier = yield* Module.predict("field-note-priority", signature)
  const [result, traces] = yield* Trace.withTracing(
    classifier.forward({
      note: "Two interview participants reported the same payment outage within ten minutes."
    })
  )

  return {
    priority: result.priority,
    traceCount: traces.length
  }
}).pipe(
  Effect.provide(
    MockLanguageModel.layer(
      LanguageModel.LanguageModel,
      MockLanguageModel.fixed({ priority: "high" })
    )
  )
)

void program
```

For a real provider runtime, swap the mock layer for the live provider setup in [`examples/shared/live-provider-runtime.ts`](./examples/shared/live-provider-runtime.ts) or [`examples/03-basic-classify-live-openai.ts`](./examples/03-basic-classify-live-openai.ts).

## What Can I Build With It?

| Task | Start here |
| --- | --- |
| First typed module with a deterministic LM | [`examples/02-basic-classify-mock.ts`](./examples/02-basic-classify-mock.ts) |
| Add reasoning or executable intermediate steps | [`examples/04-chain-of-thought-mock.ts`](./examples/04-chain-of-thought-mock.ts) and [`examples/16-program-of-thought-mock.ts`](./examples/16-program-of-thought-mock.ts) |
| Compare multiple reasoning candidates or batch many inputs | [`examples/17-multi-chain-comparison-mock.ts`](./examples/17-multi-chain-comparison-mock.ts) and [`examples/18-parallel-batch-mock.ts`](./examples/18-parallel-batch-mock.ts) |
| Drive optimizer search with typed progress | [`examples/19-copro-mock.ts`](./examples/19-copro-mock.ts) |
| Plug into ask/tell search workflows | [`examples/01-effect-search-interop.ts`](./examples/01-effect-search-interop.ts) |
| Work with real agent transcripts and study data | [`examples/21-open-agent-trace-projection.ts`](./examples/21-open-agent-trace-projection.ts), [`examples/23-open-agent-trace-amp.ts`](./examples/23-open-agent-trace-amp.ts), and [`examples/25-open-agent-trace-amp-thread.ts`](./examples/25-open-agent-trace-amp-thread.ts) |
| See live social-science optimization stories | [`examples/11-gepa-teacher-student-debate.ts`](./examples/11-gepa-teacher-student-debate.ts), [`examples/12-miprov2-collective-memory-network-dynamics.ts`](./examples/12-miprov2-collective-memory-network-dynamics.ts), and [`examples/14-gepa-conversational-recall-direction-flows.ts`](./examples/14-gepa-conversational-recall-direction-flows.ts) |

`copro`, `coproStream`, and [`examples/19-copro-mock.ts`](./examples/19-copro-mock.ts) are the place to start when you want typed progress updates, resumable optimizer state, and search workflows that plug into `effect-search`.

Use `effect-dsp/contracts` when you need to store optimizer runs or decode artifacts outside a live process. Use `effect-dsp/test` when you need deterministic `MockLanguageModel` helpers in your own tests. Use `effect-dsp/experimental` only when you are explicitly opting into pre-stable features.

For trace evidence you want to store or compare later, pair `Trace.withTracing` and `Trace.withUsageTracking` with `Contracts.OptimizationObjectiveSurface.fromTraceEntry` and `Contracts.ArtifactEnvelopeSchema`.

## Can I Work With Real Agent Transcripts?

`effect-dsp/experimental` includes OpenAgentTrace for turning real agent transcripts into reusable study data.

- It normalizes the `badlogicgames/pi-mono` dataset, public Amp traces, and imported Amp thread exports into one `OpenAgentTraceRecord` family.
- It projects those records into workflow summaries, coding-task summaries, execution evidence, and end-of-run outcomes.
- It includes `implementationStrategy`, a study surface for comparing how coding traces approach the same task across labeled cases.
- Start with [`examples/21-open-agent-trace-projection.ts`](./examples/21-open-agent-trace-projection.ts) for the core projection flow, [`examples/23-open-agent-trace-amp.ts`](./examples/23-open-agent-trace-amp.ts) for Amp capture normalization, [`examples/24-amp-implementation-strategy-study.ts`](./examples/24-amp-implementation-strategy-study.ts) for the `implementationStrategy` study, and [`examples/25-open-agent-trace-amp-thread.ts`](./examples/25-open-agent-trace-amp-thread.ts) for imported Amp thread exports.

## Learn More

- Browse the runnable examples in [`examples/`](./examples).
- Run `bun run docs:packages -- --package effect-dsp --view agent` from the repository root for the generated docs surface.
- See [`../effect-search/README.md`](../effect-search/README.md) for the optimizer engine behind the search workflows and [`../effect-inference/README.md`](../effect-inference/README.md) for provider-resolution evidence.

## License

[MIT](./LICENSE) — Copyright © 2026 Scene Systems
