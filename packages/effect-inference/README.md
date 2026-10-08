# @scenesystems/effect-inference

Configure language models and embeddings for `effect/ai`, resolve model routes,
and retain provider response and usage evidence. Applications can use the
configured providers or supply their own runtime resolver.

## Installation

```sh
bun add @scenesystems/effect-inference effect
```

Requires Effect `^4.0.0`. Import namespaces from the root or matching subpaths,
such as `@scenesystems/effect-inference/Runtime`.

## Runtime resolution

```ts typecheck
import { Effect } from "effect"
import { Runtime } from "@scenesystems/effect-inference"

export const resolution = Runtime.resolve({
  model: { modelRef: "local/example-model" },
  route: {
    family: "OpenAiCompatible",
    serveMode: "local-runtime",
    authMethod: "none",
    baseUrl: "http://127.0.0.1:11434/v1",
    runtimeFlavorHint: "ollama"
  }
}).pipe(Effect.provide(Runtime.layer))
```

`Capabilities.Requirements` treats omitted and false booleans as no constraint. Structured output is graded `none < best-effort < strict`; `minimumContextTokens` requires a declared context limit.

Resolution selects a route and executable model layers; it does not call the
model. Use [`Runtime.layerWith`](./src/Runtime.ts) to install your own resolver.
The request records what the caller wants, the resolution records the route
chosen, and response evidence records what the provider actually reports.

## Configured text providers

```ts typecheck
import { LanguageModel } from "effect/ai"
import { Effect } from "effect"
import { TextProvider } from "@scenesystems/effect-inference"

export const program = LanguageModel.generateText({
  prompt: "Name one property of a good API.",
  toolChoice: "none"
}).pipe(Effect.provide(TextProvider.layerConfig()))
```

`DSP_PROVIDER` selects `openai`, `anthropic`, or `openrouter` and defaults to `openai`. Provider-specific `OPENAI_*`, `ANTHROPIC_*`, and `OPENROUTER_*` values override generic `DSP_PROVIDER_*` values; explicit `TextProvider.Options` override both. Credentials remain `Redacted`. `TextProvider.fromConfig` acquires validated config, `resolve` returns provider identity, request intent, and a language-model layer, and `layerConfig` exposes the configured layer directly.

## Hugging Face

`HuggingFace.resolveConfig` merges explicit `HuggingFace.Config` values over `HUGGINGFACE_*` configuration and resolves either a routed marketplace or dedicated endpoint. `HuggingFace.languageModel` and `embeddingModel` select admitted layers.

[`HuggingFaceEmbeddingModel`](./src/HuggingFaceEmbeddingModel.ts) provides
feature extraction for both route modes. `layer` requires your platform
`HttpClient`; `layerFetch` supplies the Fetch implementation. Use `embed` for a
single vector and `embedMany` for an ordered batch. Prefer these methods over
the low-level resolver: `embed` preserves caller interruption, while the
resolver retains Effect 4.0.0's cancellation limitation.

```ts typecheck
import { EmbeddingModel } from "effect/ai"
import { Effect } from "effect"
import { HuggingFaceRouted } from "@scenesystems/effect-inference"
import * as HuggingFaceEmbeddingModel from "@scenesystems/effect-inference/HuggingFaceEmbeddingModel"

const modelLayer = HuggingFaceEmbeddingModel.layerFetch(
  new HuggingFaceEmbeddingModel.Options({
    model: "sentence-transformers/all-MiniLM-L6-v2",
    route: HuggingFaceRouted.route({
      baseUrl: "https://router.huggingface.co/v1",
      authMethod: "none"
    })
  })
)

export const embedding = Effect.flatMap(EmbeddingModel.EmbeddingModel, (model) =>
  model.embed("The station opens at six in the morning.")
).pipe(Effect.provide(modelLayer))
```

Routed embeddings preserve Hub mapping order for `auto` and require an exact
mapping for an explicit provider. Discovery and inference retry HTTP 503 at
most twice. See the linked reference for discovery caching and response validation.

## Runtime evidence

```ts typecheck
import { Schema } from "effect"
import { OpenAiCompatible, RuntimeEvidence } from "@scenesystems/effect-inference"

const resolution = OpenAiCompatible.resolve({ model: { modelRef: "local/example-model" } }, "http://127.0.0.1:11434/v1")

const evidence = RuntimeEvidence.make(resolution, {
  responseModel: "local/example-model",
  usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 }
})

export const encoded = Schema.encodeEffect(RuntimeEvidence.RuntimeEvidence)(evidence)
```

Provider metadata accepts JSON values only. `RuntimeEvidence.decodeUnknown` maps malformed persisted values to `InvalidRuntimeConfig`.

## Usage observation

Each native integration is independently imported and exports `observe` plus its related `Observation` model where provider reports have a serializable projection:

```ts typecheck
import * as OpenAiClient from "@effect/ai-openai/OpenAiClient"
import { Effect } from "effect"
import { OpenAiUsage } from "@scenesystems/effect-inference"

export const observed = Effect.gen(function* () {
  const client = yield* OpenAiClient.OpenAiClient
  return OpenAiUsage.observe(client, (usage, raw) => Effect.log({ usage, raw }))
})
```

Observers execute in the invoking fiber before native response interpretation. Streams remain lazy and interruptible. Missing reports remain unknown, explicit zeros remain zero, cumulative stream snapshots are not summed, and transport failures do not invent observations.

Canonical usage follows Effect v4's nested `inputTokens` and `outputTokens` structure. Provider-reported totals remain distinct from cache and reasoning details. Derived counters remain absent when their components are missing or inconsistent; raw reports retain provider-specific totals and costs. Anthropic observations preserve their source tag and cumulative state when serialized. Use one observation integration per invocation to avoid recording both raw-client and canonical-finish usage.

For Gemini, use OpenRouter or an OpenAI-compatible service with the matching
usage observer.

## Testing

`Testing.languageModel`, `Testing.embeddingModel`, and `Testing.runtimeLayer` provide deterministic layers. `Testing.request`, `resolvedRoute`, `resolution`, `response`, and `evidence` construct coherent fixtures without provider access or live credentials.

## Errors and security

`InferenceError.InferenceError` is the schema and type for `InvalidRuntimeConfig`, `CapabilityMismatch`, `UnsupportedRoute`, and `RuntimeNotImplemented`. Provider transport failures remain in the native `effect/ai/AiError` channel, with semantic failures under `error.reason`. API keys are never stored in requests, resolutions, or evidence.

See the [public API](./src/index.ts) for provider configuration and observation
contracts, and the [changelog](./CHANGELOG.md) when upgrading.

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
