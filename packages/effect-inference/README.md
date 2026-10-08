# @scenesystems/effect-inference

Effect-native model intent, route resolution, provider configuration, response evidence, and native provider usage observation for `effect/ai`.

## Installation

```sh
bun add @scenesystems/effect-inference effect
```

## Architecture

The package keeps four truths separate:

1. `RuntimeRequest` records caller intent (`Model`, optional `Route`, and `Capabilities.Requirements`).
2. `Runtime.Resolution` records the chosen route, conservative capabilities, and executable model layers before a request runs.
3. `RuntimeEvidence.Response` records only post-response observations.
4. `RuntimeEvidence.make` joins a resolution and response without treating route decisions as provider evidence.

All public modules are root namespaces and matching flat PascalCase subpaths.

| Module                                             | Responsibility                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `Model`                                            | Caller-owned model identity                                                          |
| `Route`                                            | Route identity, selection policy, runtime flavor, and resolved provenance            |
| `Capabilities`                                     | Conservative capability truth and caller requirements                                |
| `RuntimeRequest`                                   | Serializable caller intent and checked decoding                                      |
| `Runtime`                                          | Resolution service, `Resolution`, `ModelLayers`, `resolve`, `layer`, and `layerWith` |
| `RuntimeEvidence`                                  | Response, usage, provider metadata, evidence assembly, and checked decoding          |
| `TextProvider`                                     | Config-driven OpenAI, Anthropic, and OpenRouter language models                      |
| `ModelBinder`                                      | Per-role hosted runtimes and request-scoped generation settings                      |
| `OpenAiCompatible`                                 | Static compatible routes, transport plans, model layers, and resolution              |
| `HuggingFace`                                      | Config-driven Hugging Face resolution                                                |
| `HuggingFaceEmbeddingModel`                        | Native feature extraction for endpoints and routed providers                         |
| `HuggingFaceEndpoint`                              | Dedicated endpoint routes and model layers                                           |
| `HuggingFaceRouted`                                | Provider-router routes and model layers                                              |
| `InferenceError`                                   | Canonical schema-backed package failure union                                        |
| `Usage`                                            | Native language-model hook observation through `Usage.ConstructorParams`             |
| `AnthropicUsage`, `OpenAiUsage`, `OpenRouterUsage` | Native provider client observation                                                   |
| `Testing`                                          | Deterministic model layers and runtime fixtures                                      |

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
import { LanguageModel } from "effect/ai"
import { Effect } from "effect"
import { TextProvider } from "@scenesystems/effect-inference"

export const program = LanguageModel.generateText({
  prompt: "Name one property of a good API.",
  toolChoice: "none"
}).pipe(Effect.provide(TextProvider.layerConfig()))
```

`DSP_PROVIDER` selects `openai`, `anthropic`, or `openrouter` and defaults to `openai`. Provider-specific `OPENAI_*`, `ANTHROPIC_*`, and `OPENROUTER_*` values override generic `DSP_PROVIDER_*` values; explicit `TextProvider.Options` override both. Credentials remain `Redacted`. `TextProvider.fromConfig` acquires validated config, `resolve` returns a `TextProvider.Runtime` whose provider identity, defaults, request intent, and language-model layer all derive from that one config, and `layerConfig` exposes the configured layer directly. A supplied `HttpClient` service replaces only the transport.

Generation defaults come from `TextProvider.Options.defaults` or, when omitted, from `DSP_MODEL_SETTINGS` as JSON-encoded `ModelSettings` from `@scenesystems/effect-lm` (for example `{"temperature":0,"maxTokens":256}`). Each provider sends only the fields its API supports: OpenAI Responses sends `temperature`, `maxTokens`, and `topP`; Anthropic Messages also sends `stop`; OpenRouter sends all five fields, including `seed`. Absent fields keep provider defaults. A configured default the provider cannot send (OpenAI `stop` or `seed`, Anthropic `seed`) makes every operation of the direct layer fail with `AiError.InvalidRequestError` before any HTTP request, rather than being silently dropped.

## Model binding by role

`ModelBinder.layer` installs an `@scenesystems/effect-lm` binder from a `HashMap` of semantic roles (`task`, `teacher`, `proposer`, `evaluator`, `critic`) to `TextProvider.Runtime`s. Each bound request uses its role's runtime, falling back to `task`, and resolves settings as runtime defaults, then ambient provider configuration, then the request's own settings; the result is visible through `ModelSettings.Current`, and the runtime's `ModelIdentity` is declared for durable caching. Unsupported resolved settings, or a role with neither its own runtime nor `task`, fail model operations with `InvalidRequestError` before transport. The binder leaves the wrapped effect's error and service channels unchanged.

```ts typecheck
import { Effect, HashMap } from "effect"
import { ModelSettings, type Role } from "@scenesystems/effect-lm"
import { ModelBinder, TextProvider } from "@scenesystems/effect-inference"

export const binderLayer = Effect.gen(function* () {
  const task = yield* TextProvider.resolve(
    new TextProvider.Options({ provider: "openrouter", defaults: new ModelSettings.ModelSettings({ temperature: 0 }) })
  )
  const critic = yield* TextProvider.resolve(new TextProvider.Options({ provider: "anthropic" }))
  const roles: ReadonlyArray<readonly [Role.Role, TextProvider.Runtime]> = [
    ["task", task],
    ["critic", critic]
  ]
  return ModelBinder.layer(HashMap.fromIterable(roles))
})
```

## Hugging Face

`HuggingFace.resolveConfig` merges explicit `HuggingFace.Config` values over `HUGGINGFACE_*` configuration and resolves either a routed marketplace or dedicated endpoint. `HuggingFace.languageModel` and `embeddingModel` select admitted layers.

`HuggingFaceEmbeddingModel` owns native feature extraction for both route modes:

- `Options.route` selects direct endpoint execution or routed provider discovery.
- `layer` requires a caller-provided platform `HttpClient`; `layerFetch` supplies `FetchHttpClient.layer`.
- Successful discovery is cached for five minutes per layer and concurrent misses are coalesced. Discovery and inference retry only HTTP 503, at most twice.
- `embed` returns an `EmbedResponse` with `vector`; `embedMany` returns ordered `embeddings` and usage metadata. Use `embedMany` for batching. Independent `embed` calls execute in their caller's fiber so interruption cancels inference. Discovery uses a layer-owned `ScopedCache`, retaining shared work only while a caller needs it.
- This avoids the installed Effect 4.0.0 request-resolver cancellation defect for `embed`. Direct use of the model's low-level `resolver` retains upstream behavior.

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

Native Google support has been removed. Gemini remains available through OpenRouter or an OpenAI-compatible service, using the matching usage observer.

## Testing

`Testing.languageModel`, `Testing.embeddingModel`, and `Testing.runtimeLayer` provide deterministic layers. `Testing.request`, `resolvedRoute`, `resolution`, `response`, and `evidence` construct coherent fixtures without provider access or live credentials.

## Errors and security

`InferenceError.InferenceError` is the schema and type for `InvalidRuntimeConfig`, `CapabilityMismatch`, `UnsupportedRoute`, and `RuntimeNotImplemented`. Provider transport failures remain in the native `effect/ai/AiError` channel, with semantic failures under `error.reason`. API keys are never stored in requests, resolutions, or evidence.

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
