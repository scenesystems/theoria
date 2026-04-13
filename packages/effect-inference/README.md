# `effect-inference`

Effect-native provider-blind runtime descriptors, route resolution, and replay-safe runtime evidence for text and embeddings workloads.

## Core Model

`effect-inference` separates each part of runtime truth into its own authority:

- `DesiredRuntimeDescriptor` records what you want to run.
- `ResolvedRouteDescriptor` records how that request mapped onto a provider route, base URL, endpoint, deployment, and provider model where known.
- `ResolvedRuntimeDescriptor` records what actually happened after a call completes, including response model identity, usage, finish metadata, and provider metadata.
- `RuntimeEvidence` joins the pre-execution resolution record with post-execution runtime truth so downstream packages can store one replay-safe artifact.

This is the main value of the package: callers work against `@effect/ai` `LanguageModel` and `EmbeddingModel`, while `effect-inference` keeps the runtime metadata around those calls explicit and serializable.

## Workflow And Score Contracts

`effect-inference/Contracts` also owns the reusable workflow, session,
evaluation, and score family that sits on top of the frozen
runtime-provenance lane. Runtime resolution still lives on `Runtime` and the
route-family helpers, while graph/session/evaluation/score semantics stay on
`effect-inference/Contracts`.

```ts typecheck
import { Effect, Schema } from "effect"
import * as Contracts from "effect-inference/Contracts"

const summarizeWorkflow = (workflowRecordJson: unknown, workflowReportJson: unknown) =>
  Effect.gen(function* () {
    const record = yield* Schema.decodeUnknown(Contracts.WorkflowExecutionRecordSchema)(workflowRecordJson)
    const report = yield* Schema.decodeUnknown(Contracts.WorkflowEvaluationReportSchema)(workflowReportJson)

    return {
      workflowKind: record.workflowKind,
      entryNodeId: record.projection.entryNodeId,
      profileId: report.profile.profileId,
      aggregateScore: report.aggregateScore
    }
  })
```

The released workflow surface includes:

- `WorkflowKind`, `SessionTurnRole`, `WorkflowStateLane`,
  `WorkflowNodeKind`, `WorkflowEdgeKind`, `WorkflowLoopPolicy`,
  `GraphVariant`, `OptimizationKnobKind`, `EvaluationProfileFamily`,
  `SessionManifest`, `NodeExecutionContract`,
  `GraphExecutionManifest`, `GraphExecutionProjection`,
  `EvaluationContract`, and `WorkflowExecutionRecord`
- `ScoreComponentKind`, `ScoreWeights`, `ScoreProfile`,
  `ScoreComponentResult`, `ScoreLossSummary`, and
  `WorkflowEvaluationReport`

See `examples/05-workflow-contracts.ts` for a concrete package-owned example
that decodes a reusable workflow record and workflow evaluation report without
booting a live provider runtime.

## Quick Start

```ts typecheck
import * as EmbeddingModel from "@effect/ai/EmbeddingModel"
import * as LanguageModel from "@effect/ai/LanguageModel"
import { Effect, Redacted } from "effect"
import { HuggingFace, Runtime } from "effect-inference"

const program = Effect.gen(function* () {
  const resolution = yield* HuggingFace.resolveLiveRuntime({
    serveMode: "routed-marketplace",
    model: "meta-llama/Llama-3.3-70B-Instruct",
    accessToken: Redacted.make("hf_xxxxxxxxxxxxxx"),
    selectionPolicy: "fastest"
  })
  const languageModelLayer = yield* HuggingFace.languageModelLayer(resolution)
  const embeddingModelLayer = yield* HuggingFace.embeddingModelLayer(resolution)
  const summary = yield* LanguageModel.generateText({
    prompt: "Explain runtime provenance in one sentence.",
    toolChoice: "none"
  }).pipe(Effect.provide(languageModelLayer))
  const embeddings = yield* EmbeddingModel.EmbeddingModel.pipe(
    Effect.flatMap((model) => model.embedMany([summary.text])),
    Effect.provide(embeddingModelLayer)
  )
  const evidence = Runtime.RuntimeEvidence.fromResolution({
    resolution,
    resolvedRuntime: {
      responseModel: resolution.resolvedRoute.providerModel ?? resolution.desired.artifact.modelRef
    }
  })

  return yield* Effect.log({
    requested: evidence.desired.artifact.modelRef,
    routeFamily: evidence.resolvedRoute.route.family,
    responseModel: evidence.resolvedRuntime.responseModel,
    finishReason: summary.finishReason,
    embeddingDimensions: embeddings[0]?.length
  })
})
```

## Using Hugging Face Live Runtimes

`HuggingFace.resolveLiveRuntime(...)` returns the canonical `RuntimeResolution` record for routed-provider and dedicated-endpoint usage, with requested descriptor truth, resolved route provenance, capability metadata, and authenticated live layers kept together. `HuggingFace.resolveLiveRuntimeConfig(...)` decodes the same routed or endpoint shape from env-backed config, and `HuggingFace.resolveLiveRuntimeFromConfig(...)` composes that config step with live runtime resolution in one call. From the resulting resolution, `HuggingFace.languageModelLayer(...)` and `HuggingFace.embeddingModelLayer(...)` give you the exact layer to provide to `LanguageModel.generateText(...)` or `EmbeddingModel.EmbeddingModel`, and `Runtime.RuntimeEvidence.fromResolution(...)` turns the result into replay-safe runtime evidence after the call completes.

`RuntimeResolver` remains the provider-blind, secret-free resolver surface. The Hugging Face helpers are the auth-bound companion for real routed and endpoint execution.

## Other Entry Paths

If you want a config-driven helper for hosted and brokered text providers, `Runtime.resolveLiveTextProviderRuntime(...)` builds descriptors and `LanguageModel` layers for OpenAI, Anthropic, and OpenRouter without pulling those provider names into the rest of your program.

## Live Example Verification

`bun run --filter 'effect-inference' examples:verify` executes the live examples behind an explicit opt-in gate. Set `EFFECT_INFERENCE_RUN_LIVE_EXAMPLES=true` to enable the harness and optionally pass `EFFECT_INFERENCE_LIVE_EXAMPLES` as a comma-separated list of `runtime-config-decoding`, `hugging-face-routed-runtime`, and `hugging-face-endpoint-runtime`.

The Hugging Face config helper reads env-backed keys such as `HUGGINGFACE_ACCESS_TOKEN`, `HUGGINGFACE_SELECTION_POLICY`, `HUGGINGFACE_ENDPOINT_BASE_URL`, `HUGGINGFACE_ENDPOINT_ID`, `HUGGINGFACE_DEPLOYMENT_ID`, and `HUGGINGFACE_RUNTIME_FLAVOR`. The routed example only needs a token unless you want to override the router URL or selection policy. The endpoint example needs a token plus real endpoint coordinates.

## Route Families

- `OpenAiCompatible` — the stable transport family for brokered, dedicated, and self-hosted OpenAI-compatible text and embeddings runtimes
- `OpenAiResponses` — direct OpenAI Responses support on an explicit companion lane
- `AnthropicMessages` — direct Anthropic Messages support on an explicit companion lane
- `HuggingFace` — Hugging Face routed-provider and dedicated-endpoint authorities with typed selection policy and deployment identity

## Example Stories

- `examples/01-openai-compatible-static-runtime.ts` — self-hosted OpenAI-compatible descriptor and evidence assembly
- `examples/02-hugging-face-routed-runtime.ts` — Hugging Face routed-provider live runtime resolution plus `LanguageModel.generateText`
- `examples/03-runtime-config-decoding.ts` — config-driven direct provider runtime construction through `Runtime.resolveLiveTextProviderRuntime`
- `examples/04-hugging-face-endpoint-runtime.ts` — Hugging Face dedicated endpoint live runtime resolution plus embeddings execution
- `examples/05-workflow-contracts.ts` — package-owned workflow/session/evaluation/score decoding distinct from live runtime resolution

## Entry Points

- `effect-inference`
- `effect-inference/Contracts`
- `effect-inference/Errors`
- `effect-inference/Runtime`
- `effect-inference/OpenAiCompatible`
- `effect-inference/HuggingFace`
- `effect-inference/Testing`
- `effect-inference/experimental`

## Testing

`effect-inference/Testing` exports deterministic fixtures and static layers so downstream packages can prove runtime boundaries without importing live provider adapters:

- `Testing.DesiredRuntimeDescriptor.fromTesting`
- `Testing.ResolvedRouteDescriptor.fromTesting`
- `Testing.ResolvedRuntimeDescriptor.fromTesting`
- `Testing.RuntimeResolution.fromTesting`
- `Testing.RuntimeEvidence.fromTesting`
- `Testing.staticRuntimeResolver`
- `Testing.staticLanguageModel`
- `Testing.staticEmbeddingModel`

## Development

```sh
bun run check
bun run check:tests
bun run lint
bun run test
bun run build
bun run docgen
```
