# `effect-inference`

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

Keep runtime truth intact when you call text or embedding models.

Reach for it when provider choice should stay out of business logic, but provider provenance still matters for storage, replay, and evaluation.

## Why Use It?

- Keep application code on `LanguageModel` and `EmbeddingModel` while still recording the requested model, resolved route, and actual response model.
- Swap between OpenAI-compatible, OpenAI Responses, Anthropic Messages, and Hugging Face runtimes without rewriting the rest of the program.
- Persist runtime, workflow, and evaluation evidence in a form you can decode long after the live call is over.
- Prove runtime boundaries in tests without live credentials.
- Replace ad hoc logs with replay-safe evidence that downstream packages can trust.

## Installation

```sh
npm install effect-inference effect @effect/ai
```

Use `bun add` or `pnpm add` if that is your package manager.

## Quick Start

```ts typecheck
import * as LanguageModel from "@effect/ai/LanguageModel"
import { Effect } from "effect"
import { HuggingFace, Runtime } from "effect-inference"

const program = Effect.gen(function* () {
  const resolution = yield* HuggingFace.resolveLiveRuntimeFromConfig({
    serveMode: "routed-marketplace",
    model: "meta-llama/Llama-3.3-70B-Instruct",
    selectionPolicy: "fastest"
  })

  const languageModelLayer = yield* HuggingFace.languageModelLayer(resolution)
  const response = yield* LanguageModel.generateText({
    prompt: "Summarize runtime provenance in one sentence.",
    toolChoice: "none"
  }).pipe(Effect.provide(languageModelLayer))

  const evidence = Runtime.RuntimeEvidence.fromResolution({
    resolution,
    resolvedRuntime: {
      responseModel: resolution.resolvedRoute.providerModel ?? resolution.desired.artifact.modelRef
    }
  })

  return {
    requestedModel: evidence.desired.artifact.modelRef,
    routeFamily: evidence.resolvedRoute.route.family,
    responseModel: evidence.resolvedRuntime.responseModel,
    text: response.text
  }
})

void program
```

## How Do I Keep Runtime Provenance?

Every live call eventually answers four practical questions:

- What did I ask for? `DesiredRuntimeDescriptor`
- Where did the request go? `ResolvedRouteDescriptor`
- What actually answered? `ResolvedRuntimeDescriptor`
- What should I store? `RuntimeEvidence`

Use `HuggingFace.resolveLiveRuntimeConfig` when you want to decode env-backed Hugging Face config without performing resolution yet. Use `HuggingFace.resolveLiveRuntimeFromConfig` when you want decoding and live resolution in one step. From that resolution, `HuggingFace.languageModelLayer` feeds `LanguageModel.generateText`, and `HuggingFace.embeddingModelLayer` feeds `EmbeddingModel.EmbeddingModel`. If you want config-driven hosted-provider routing outside the Hugging Face package helpers, use `Runtime.resolveLiveTextProviderRuntime`. When a call completes, seal the result with `Runtime.RuntimeEvidence.fromResolution`.

## How Do I Read Stored Workflow Evidence?

Use `effect-inference/Contracts` when you are decoding stored workflow evidence rather than making a live provider call. It provides reusable workflow, session, evaluation, and score schemas that stay tied to runtime provenance.

- Start with `WorkflowExecutionRecordSchema` and `WorkflowEvaluationReportSchema` when you need to decode stored workflow evidence.
- `ScoreProfile` and `WorkflowStateLane` define the shared scoring and state vocabulary that downstream systems can share.
- See [`examples/05-workflow-contracts.ts`](./examples/05-workflow-contracts.ts) for a package-owned example that decodes workflow artifacts without booting a live provider runtime.

## What Can I Do Next?

| Task | Start here |
| --- | --- |
| Self-hosted or brokered OpenAI-compatible runtime descriptors | `OpenAiCompatible` and [`examples/01-openai-compatible-static-runtime.ts`](./examples/01-openai-compatible-static-runtime.ts) |
| Hugging Face routed-provider execution | `HuggingFace` and [`examples/02-hugging-face-routed-runtime.ts`](./examples/02-hugging-face-routed-runtime.ts) |
| Config-driven direct-provider helpers | [`examples/03-runtime-config-decoding.ts`](./examples/03-runtime-config-decoding.ts) via `Runtime.resolveLiveTextProviderRuntime` |
| Hugging Face endpoint execution plus embeddings | [`examples/04-hugging-face-endpoint-runtime.ts`](./examples/04-hugging-face-endpoint-runtime.ts) |
| Deterministic consumer tests | `effect-inference/Testing` |

The main public entrypoints map cleanly to provider styles: `OpenAiCompatible` covers stable OpenAI-compatible transports, `OpenAiResponses` covers direct OpenAI Responses usage, `AnthropicMessages` covers direct Anthropic Messages usage, and `HuggingFace` covers routed-provider and dedicated-endpoint execution.

## Learn More

- Use [`examples/01-openai-compatible-static-runtime.ts`](./examples/01-openai-compatible-static-runtime.ts), [`examples/02-hugging-face-routed-runtime.ts`](./examples/02-hugging-face-routed-runtime.ts), [`examples/03-runtime-config-decoding.ts`](./examples/03-runtime-config-decoding.ts), and [`examples/04-hugging-face-endpoint-runtime.ts`](./examples/04-hugging-face-endpoint-runtime.ts) for runtime-resolution stories.
- Run `bun run --filter 'effect-inference' examples:verify` to execute the live examples behind the explicit opt-in gate. Set `EFFECT_INFERENCE_RUN_LIVE_EXAMPLES=true` first, and optionally scope with `EFFECT_INFERENCE_LIVE_EXAMPLES`.
- From the repository root, run `bun run docs:packages -- --package effect-inference --view agent` for the generated docs surface.

## License

[MIT](./LICENSE) — Copyright © 2026 Scene Systems
