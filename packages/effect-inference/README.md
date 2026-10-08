# @scenesystems/effect-inference

Inference configures language models and embeddings for `effect/ai`. It records
which model you requested, which route was selected, and what the provider
reported in its response. Use the included provider configuration or supply
your own runtime resolver.

## Installation

```sh
bun add @scenesystems/effect-inference effect
```

Requires Effect `^4.0.0` as a peer dependency. Import modules from the package root or matching subpaths, such as `@scenesystems/effect-inference/Runtime`.

## Basic use

Resolve an OpenAI-compatible model route for a local Ollama server.

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

Resolution selects a route and model layers without calling the model. Add
`Capabilities.Requirements` to constrain the selection: omitted or false
booleans impose no constraint, structured output is ordered
`none < best-effort < strict`, and `minimumContextTokens` requires a declared
context limit. Use [`Runtime.layerWith`](./src/Runtime.ts) to install your own resolver.

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

Set `DSP_PROVIDER` to `openai`, `anthropic`, or `openrouter`; the default is
`openai`. Provider-specific variables such as `OPENAI_*` take precedence over
`DSP_PROVIDER_*`, and explicit `TextProvider.Options` take precedence over both.
Credentials use `Redacted`.

`layerConfig` provides the configured language-model layer directly, as above.
If you need to inspect the configuration or resolution first, use
[`TextProvider.fromConfig` and `resolve`](./src/TextProvider.ts).

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

Wrap a provider client with its usage observer to record reports before Effect
interprets the response:

```ts typecheck
import * as OpenAiClient from "@effect/ai-openai/OpenAiClient"
import { Effect } from "effect"
import { OpenAiUsage } from "@scenesystems/effect-inference"

export const observed = Effect.gen(function* () {
  const client = yield* OpenAiClient.OpenAiClient
  return OpenAiUsage.observe(client, (usage, raw) => Effect.log({ usage, raw }))
})
```

Observers run in the calling fiber, and streams remain lazy and interruptible.
Use one observation integration per invocation to avoid counting the same usage
at both the raw-client and canonical-response levels.

Usage follows Effect v4's nested `inputTokens` and `outputTokens` structure.
Missing reports remain unknown, explicit zeros remain zero, and cumulative
stream snapshots are not added together. Derived counters are omitted when
their components are missing or inconsistent. Raw reports retain the provider's
totals and costs; serialized Anthropic observations also preserve their source
tag and cumulative state. A transport failure without a report produces no observation.

For Gemini, use OpenRouter or an OpenAI-compatible service with the matching
usage observer.

## Testing

`Testing.languageModel`, `Testing.embeddingModel`, and `Testing.runtimeLayer` provide deterministic layers. `Testing.request`, `resolvedRoute`, `resolution`, `response`, and `evidence` construct coherent fixtures without provider access or live credentials.

## Errors and security

`InferenceError.InferenceError` is the schema and type for `InvalidRuntimeConfig`, `CapabilityMismatch`, `UnsupportedRoute`, and `RuntimeNotImplemented`. Provider transport failures remain in the native `effect/ai/AiError` channel, with semantic failures under `error.reason`. API keys are never stored in requests, resolutions, or evidence.

## Examples

See the [API reference](./src/index.ts) for all modules and the [examples directory](./examples/) for runnable programs:

- [OpenAI-compatible route evidence](./examples/01-openai-compatible-static-runtime.ts)
- [Hugging Face routed models](./examples/02-hugging-face-routed-runtime.ts)
- [Configuration decoding](./examples/03-runtime-config-decoding.ts)
- [Hugging Face endpoints](./examples/04-hugging-face-endpoint-runtime.ts)

## Status

See Theoria's [versioning policy](../../README.md#documentation-and-examples) and the package [changelog](./CHANGELOG.md) when upgrading.

## Contributing and support

See Theoria's [contribution and support information](../../README.md#contributing-and-support).

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
