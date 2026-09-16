# @scenesystems/effect-inference

Effect-native model intent, route resolution, provider configuration, response evidence, and native provider usage observation for `@effect/ai`.

## Installation

```sh
npm install @scenesystems/effect-inference effect @effect/ai
```

## Architecture

The package keeps four truths separate:

1. `RuntimeRequest` records caller intent (`Model`, optional `Route`, and `Capabilities.Requirements`).
2. `Runtime.Resolution` records the chosen route, conservative capabilities, and executable model layers before a request runs.
3. `RuntimeEvidence.Response` records only post-response observations.
4. `RuntimeEvidence.make` joins a resolution and response without treating route decisions as provider evidence.

All public modules are root namespaces and matching flat PascalCase subpaths.

| Module                                                            | Responsibility                                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `Model`                                                           | Caller-owned model identity                                                          |
| `Route`                                                           | Route identity, selection policy, runtime flavor, and resolved provenance            |
| `Capabilities`                                                    | Conservative capability truth and caller requirements                                |
| `RuntimeRequest`                                                  | Serializable caller intent and checked decoding                                      |
| `Runtime`                                                         | Resolution service, `Resolution`, `ModelLayers`, `resolve`, `layer`, and `layerWith` |
| `RuntimeEvidence`                                                 | Response, usage, provider metadata, evidence assembly, and checked decoding          |
| `TextProvider`                                                    | Config-driven OpenAI, Anthropic, and OpenRouter language models                      |
| `OpenAiCompatible`                                                | Static compatible routes, transport plans, model layers, and resolution              |
| `HuggingFace`                                                     | Config-driven Hugging Face resolution                                                |
| `HuggingFaceEmbeddingModel`                                       | Native feature extraction for endpoints and routed providers                         |
| `HuggingFaceEndpoint`                                             | Dedicated endpoint routes and model layers                                           |
| `HuggingFaceRouted`                                               | Provider-router routes and model layers                                              |
| `InferenceError`                                                  | Canonical schema-backed package failure union                                        |
| `Usage`                                                           | Native `LanguageModel.ConstructorParams` observation                                 |
| `AnthropicUsage`, `GoogleUsage`, `OpenAiUsage`, `OpenRouterUsage` | Native provider client observation                                                   |
| `Testing`                                                         | Deterministic model layers and runtime fixtures                                      |

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

`Runtime.Runtime` is the Context tag; `Runtime.Service` describes its `resolve` capability. Use `Runtime.layerWith` to install a caller-owned resolver.

## Configured text providers

```ts typecheck
import * as LanguageModel from "@effect/ai/LanguageModel"
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

`HuggingFaceEmbeddingModel` owns native feature extraction for both route modes:

- `Options.route` selects direct endpoint execution or routed provider discovery.
- `layer` requires a caller-provided platform `HttpClient`; `layerFetch` supplies `FetchHttpClient.layer`.
- Successful discovery is cached for five minutes per layer and concurrent misses are coalesced. Discovery and inference retry only HTTP 503, at most twice.

```ts typecheck
import * as EmbeddingModel from "@effect/ai/EmbeddingModel"
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
  model.embed("One concern has one owner.")
).pipe(Effect.provide(modelLayer))
```

Routed embeddings preserve Hub mapping order for `auto`, require an exact mapping for explicit providers, reject chat-only policies, retain injected transport behavior, and validate one finite equal-width vector per input.

## Runtime evidence

```ts typecheck
import { Schema } from "effect"
import { OpenAiCompatible, RuntimeEvidence } from "@scenesystems/effect-inference"

const resolution = OpenAiCompatible.resolve({ model: { modelRef: "local/example-model" } }, "http://127.0.0.1:11434/v1")

const evidence = RuntimeEvidence.make(resolution, {
  responseModel: "local/example-model",
  usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 }
})

export const encoded = Schema.encode(RuntimeEvidence.RuntimeEvidence)(evidence)
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

## Testing

`Testing.languageModel`, `Testing.embeddingModel`, and `Testing.runtimeLayer` provide deterministic layers. `Testing.request`, `resolvedRoute`, `resolution`, `response`, and `evidence` construct coherent fixtures without provider access or live credentials.

## Errors and security

`InferenceError.InferenceError` is the schema and type for `InvalidRuntimeConfig`, `CapabilityMismatch`, `UnsupportedRoute`, and `RuntimeNotImplemented`. Provider transport failures remain in their native `@effect/ai` channels. API keys are never stored in requests, resolutions, or evidence.

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
