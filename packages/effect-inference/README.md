# @scenesystems/effect-inference

`@scenesystems/effect-inference` turns model-provider configuration into `@effect/ai` layers and keeps a typed record of which provider, route, and model served each call. Use it when an application must run the same program against OpenAI, Anthropic, OpenRouter, an OpenAI-compatible local server, or Hugging Face, and needs to say afterwards which one actually answered.

The package separates three things that are often conflated. A desired runtime descriptor records what you asked for: a model reference, route hints, and capability requirements. A resolved route descriptor records what was decided before any request: the provider, endpoint, and model the layer will call. A resolved runtime descriptor records what was observed after a response: the reported model, normalized usage, and provider metadata. `Runtime.makeRuntimeEvidence` joins them into one serializable value.

[`@scenesystems/effect-dsp`](../effect-dsp/README.md) modules consume the `LanguageModel` layers this package produces. Any other `@effect/ai` consumer can use them the same way.

## Installation

```sh
npm install @scenesystems/effect-inference effect @effect/ai
```

Effect `^3.22.1` and `@effect/ai >=0.37.0` are required peer dependencies. The provider adapters for OpenAI, Anthropic, Google AI, and OpenRouter, and the HTTP client they need, are installed as regular dependencies. Google AI observation composes with its native client; it does not require or extend the routing runtime.

## Basic use

`Runtime.liveTextProviderLayer` builds a `LanguageModel` layer from environment configuration. The program below leaves the provider choice to the environment and generates one completion.

```ts typecheck
import * as LanguageModel from "@effect/ai/LanguageModel"
import { Effect } from "effect"
import { Runtime } from "@scenesystems/effect-inference"

const program = LanguageModel.generateText({
  prompt: "Name one property of a well-designed API.",
  toolChoice: "none"
}).pipe(Effect.map((response) => response.text))

export const main = program.pipe(Effect.provide(Runtime.liveTextProviderLayer()))
```

Configuration is read through Effect `Config`, so it comes from environment variables by default. `DSP_PROVIDER` selects `openai`, `anthropic`, or `openrouter` and defaults to `openai`. `DSP_PROVIDER_MODEL`, `DSP_PROVIDER_API_KEY`, and `DSP_PROVIDER_API_URL` apply to whichever provider is selected, and the provider-specific keys `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `OPENROUTER_API_KEY` (with matching `_MODEL` and `_API_URL` keys) take effect for that provider alone. Each provider has a default model, so an API key is the only required value.

Missing or malformed configuration fails the layer with `InvalidRuntimeConfig` when it is built. Provider requests do not happen until a model operation runs.

## Hosted text providers

`Runtime.liveTextProviderLayer(options)` and `Runtime.withLiveTextProvider(effect, options)` accept explicit overrides that take precedence over configuration: `provider`, `model`, `apiKey` as a `Redacted` value, `apiUrl`, and the Anthropic and OpenRouter header options. Pass a `configProvider` to read from a source other than the environment.

```ts typecheck
import * as LanguageModel from "@effect/ai/LanguageModel"
import { Config, Data, Effect } from "effect"
import { Runtime } from "@scenesystems/effect-inference"

export const program = Effect.gen(function* () {
  const apiKey = yield* Config.redacted("ANTHROPIC_API_KEY")
  const runtime = yield* Runtime.resolveLiveTextProviderRuntime({
    provider: "anthropic",
    model: "claude-3-5-haiku-latest",
    apiKey
  })

  const response = yield* LanguageModel.generateText({ prompt: "Say hello.", toolChoice: "none" }).pipe(
    Effect.provide(runtime.languageModelLayer)
  )
  return Data.struct({ model: runtime.model, route: runtime.desired.route, text: response.text })
})
```

`Runtime.resolveLiveTextProviderRuntime` returns the resolved provider and model, the desired descriptor, and the layer, which is useful when you want to log or persist the descriptor alongside the response.

## OpenAI-compatible servers

Local runtimes and self-hosted gateways that speak the OpenAI API are described statically. `OpenAiCompatible.makeOpenAiCompatibleResolution(descriptor, baseUrl)` produces a `RuntimeResolution` whose `layers` hold a `LanguageModel` layer and, when the route admits it, an `EmbeddingModel` layer, with no configuration lookup and no request.

```ts typecheck
import { OpenAiCompatible, Runtime } from "@scenesystems/effect-inference"

const resolution = OpenAiCompatible.makeOpenAiCompatibleResolution(
  { artifact: { modelRef: "local/example-model" } },
  "http://127.0.0.1:11434/v1"
)

export const evidence = Runtime.makeRuntimeEvidence({
  resolution,
  resolvedRuntime: { responseModel: "local/example-model" }
})

export const routeFamily = evidence.resolvedRoute.route.family
```

The resolved route's `family` is one of `OpenAiCompatible`, `OpenAiResponses`, `AnthropicMessages`, or `HuggingFace`. Route families, serve modes, selection policies, and capability schemas live in the `Contracts` module so that descriptors can be validated and stored with `Schema`.

## Hugging Face routes

Hugging Face serves models through two routes. The routed marketplace forwards a request to one of several inference providers chosen by a selection policy such as `fastest`. A dedicated endpoint is a deployment you own, addressed by its base URL. `HuggingFace.resolveLiveRuntimeFromConfig` decodes either shape from configuration and explicit options, checks the requested capabilities against what the route supports, and returns a `RuntimeResolution`.

```ts typecheck
import * as LanguageModel from "@effect/ai/LanguageModel"
import { Data, Effect } from "effect"
import { HuggingFace } from "@scenesystems/effect-inference"

export const program = Effect.gen(function* () {
  const resolution = yield* HuggingFace.resolveLiveRuntimeFromConfig({
    serveMode: "routed-marketplace",
    model: "meta-llama/Llama-3.3-70B-Instruct",
    selectionPolicy: "fastest"
  })
  const languageModelLayer = yield* HuggingFace.languageModelLayer(resolution)

  const response = yield* LanguageModel.generateText({
    prompt: "Summarize route resolution in one sentence.",
    toolChoice: "none"
  }).pipe(Effect.provide(languageModelLayer))

  return Data.struct({ route: resolution.resolvedRoute, text: response.text })
})
```

`HUGGINGFACE_ACCESS_TOKEN` supplies the token; `HUGGINGFACE_SERVE_MODE`, `HUGGINGFACE_MODEL`, `HUGGINGFACE_BASE_URL`, `HUGGINGFACE_SELECTION_POLICY`, `HUGGINGFACE_ENDPOINT_ID`, `HUGGINGFACE_DEPLOYMENT_ID`, and `HUGGINGFACE_RUNTIME_FLAVOR` fill in the rest, and explicit options override them. `HuggingFace.languageModelLayer` and `HuggingFace.embeddingModelLayer` extract a layer from the resolution and fail with `CapabilityMismatch` if the route does not offer that capability. `HuggingFace.resolveLiveRuntime` skips configuration and takes every value, including the redacted token, as an argument.

### Embeddings use native Effect HTTP

`HuggingFaceEndpointEmbeddings(options)` and `HuggingFaceRoutedEmbeddings(options)` require `HttpClient.HttpClient`. Both Hub discovery and inference use that client, so applications can inject a gateway client, tracing, or an in-memory test transport. The corresponding `*EmbeddingsLive` constructors and runtime resolutions still provide `FetchHttpClient.layer` for convenience. No Hugging Face SDK code runs on the embedding path.

```ts typecheck
import * as EmbeddingModel from "@effect/ai/EmbeddingModel"
import * as FetchHttpClient from "@effect/platform/FetchHttpClient"
import { Array as Arr, Config, Effect, Layer } from "effect"
import { HuggingFace } from "@scenesystems/effect-inference"

export const program = Effect.gen(function* () {
  const accessToken = yield* Config.redacted("HUGGINGFACE_ACCESS_TOKEN")
  const baseUrl = yield* Config.string("HUGGINGFACE_BASE_URL")
  const modelLayer = HuggingFace.HuggingFaceEndpointEmbeddings(
    new HuggingFace.HuggingFaceEmbeddingOptions({
      model: "sentence-transformers/all-MiniLM-L6-v2",
      accessToken,
      route: HuggingFace.makeHuggingFaceEndpointRoute({ baseUrl, authMethod: "hf-token" })
    })
  )
  const transportLayer = FetchHttpClient.layer // Replace with your HttpClient layer.
  return yield* EmbeddingModel.EmbeddingModel.pipe(
    Effect.flatMap((model) => model.embedMany(Arr.make("first document", "second document"))),
    Effect.provide(Layer.provide(modelLayer, transportLayer))
  )
})
```

- **Dedicated endpoints:** POST to the exact `route.baseUrl`, without discovery, with `{ inputs }`. One input is a string; a batch is an array.
- **Routed providers:** `auto` (or absent policy) selects the first Hub mapping, preserving Hub order. An explicit provider selection must match a mapping. Supported feature-extraction providers are `hf-inference`, `deepinfra`, `scaleway`, and `together`. The provider model ID comes from the mapping; HF's `sentence-similarity` mapping is also accepted for feature extraction. Staging mappings are usable. Unsupported providers, missing mappings, and wrong tasks fail without fallback.
- **Policies:** `fastest`, `cheapest`, and `preferred` are chat-router policies, not feature-extraction policies. They fail with `MalformedInput` for embeddings. Embedding provider selection belongs in `route.selectionPolicy`, not a model-name suffix.
- **Authentication and gateways:** HF tokens (`hf_…`) authenticate Hub discovery and routed inference. Other nonempty tokens authenticate the provider's direct API and are never sent to the Hub. Without a token, requests are unauthenticated. Routed inference uses `route.baseUrl` as the router root, removing a trailing `/v1` and slash before adding the provider path. Provider keys use the provider's direct origin instead. A custom client can transform both discovery and inference requests. Credentials remain redacted in configuration and diagnostic HTTP headers; errors do not retain raw platform request causes.
- **Cache and lifetime:** each constructed model layer owns one five-minute discovery cache entry for its model and credentials. Concurrent misses share the lookup; interruption removes pending work. Failed lookups have zero TTL. Embedding results are not cached. Rebuilding a layer creates a new cache; keep the model layer alive to reuse discovery.
- **Retries:** discovery and inference retry **only HTTP 503**, twice after 100 ms and 200 ms (three attempts total). Other HTTP failures, transport errors, and malformed output are not retried. Each attempt and body read is scoped, and waiting or in-flight work is interruptible. Retries never switch providers. This deliberately replaces the SDK's unbounded 503 recursion.
- **Output:** exactly one nonempty, finite, equal-width vector is required per input within each batch. Indexed provider responses must form a complete permutation and are restored to input order; wholly unindexed responses use their array order. Missing, duplicate, mixed, or invalid indices and nested token matrices fail with `MalformedOutput`; the adapter never pools or flattens them. HTTP status/decode failures use native AI HTTP errors. Embedding responses do not establish a response model identity.

Contracts are based on the [official feature-extraction API](https://huggingface.co/docs/inference-providers/tasks/feature-extraction), the [chat-only router distinction](https://huggingface.co/docs/inference-providers/en/index#alternative-openai-compatible-chat-completions-endpoint-chat-only), and the [4.13.28 client transport](https://github.com/huggingface/huggingface.js/blob/8fd765721f5ac9fd7c8ef2ef835dc782f407f51c/packages/inference/src/tasks/nlp/featureExtraction.ts). They are implemented with public `EmbeddingModel.make`, platform HTTP, `Schema`, `Cache`, and `Schedule` APIs.

## Runtime evidence

Resolution tells you what will be called; it cannot tell you what answered. After a response arrives, build a resolved runtime descriptor from the provider's reported model, usage, and metadata, and combine it with the resolution:

```ts typecheck
import { Schema } from "effect"
import { Contracts, OpenAiCompatible, Runtime } from "@scenesystems/effect-inference"

const resolution = OpenAiCompatible.makeOpenAiCompatibleResolution(
  { artifact: { modelRef: "local/example-model" } },
  "http://127.0.0.1:11434/v1"
)

const evidence = Runtime.makeRuntimeEvidence({
  resolution,
  resolvedRuntime: {
    responseModel: "local/example-model-2025-01",
    usage: { inputTokens: 12, outputTokens: 40, totalTokens: 52 }
  }
})

export const stored = Schema.encodeSync(Contracts.RuntimeEvidenceSchema)(evidence)
```

`Contracts.RuntimeEvidenceSchema` is a `Schema`, so evidence can be encoded for logs or storage and decoded later with `Runtime.decodeRuntimeEvidence`. Keep the descriptor honest: populate `resolvedRuntime` from the response, not from the request.

## Observe usage before interpretation

`Usage` decorates the public provider-construction boundary, before native tool handling and structured-output decoding. It does not replace Effect's language-model implementation. Import just the integration you need:

| Public module                                        | Operation                             |
| ---------------------------------------------------- | ------------------------------------- |
| `@scenesystems/effect-inference/Usage/Google`        | `observeGoogle(client, observe)`      |
| `@scenesystems/effect-inference/Usage/OpenAi`        | `observeOpenAi(client, observe)`      |
| `@scenesystems/effect-inference/Usage/Anthropic`     | `observeAnthropic(client, observe)`   |
| `@scenesystems/effect-inference/Usage/OpenRouter`    | `observeOpenRouter(client, observe)`  |
| `@scenesystems/effect-inference/Usage/LanguageModel` | `observeConstructor(params, observe)` |

These operations are also exported by `Usage`. Observations retain native `Response.Usage` alongside the provider's decoded usage report. The canonical five counters are independent: absent values stay absent, explicit zeros stay zero, and totals are never inferred. Google prompt counts already include cached content. Anthropic input counts remain the reported `input_tokens`; its unreported total and reasoning count stay unknown. Raw reports retain additional cache-write, tool-use, pricing, or modality fields.

For OpenAI, Google, and OpenRouter, callbacks receive `(usage, raw)`, where `raw` is `Option<Report>`. Every successful non-streaming client response invokes the callback: absent usage produces all-unknown canonical counters and `None`, while a present report produces `Some(report)`. This distinguishes an observed absence from an uninstrumented model, so DSP cannot replace unknown usage with a native converter's synthesized zero. Stream events without usage are ignored and never erase earlier snapshots. The constructor observer receives canonical usage and the encoded finish part.

Anthropic callbacks receive one `AnthropicUsageObservation`: a `Response`, `MessageStart`, or `MessageDelta` with `{ usage, raw }`. `usage` contains cumulative canonical token counters. `raw` is the exact native report for that event, including `server_tool_use`: `BetaUsage` for responses and starts, and `MessageDeltaUsage` for deltas. Raw start and delta reports are never merged into an invented complete report. Consumers needing provider-specific evidence should retain these tagged observations.

```ts typecheck
import * as GoogleClient from "@effect/ai-google/GoogleClient"
import * as GoogleLanguageModel from "@effect/ai-google/GoogleLanguageModel"
import { observeGoogle } from "@scenesystems/effect-inference/Usage/Google"
import { Data, Effect } from "effect"

export const model = Effect.gen(function* () {
  const client = yield* GoogleClient.GoogleClient
  return yield* GoogleLanguageModel.make({ model: "gemini-2.5-flash" }).pipe(
    Effect.provideService(
      GoogleClient.GoogleClient,
      observeGoogle(client, (usage, raw) => Effect.log(Data.struct({ usage, raw })))
    )
  )
})
```

Provide your existing client, including Gateway configuration and HTTP middleware, before building the native model. No `Runtime` resolver is required. For DSP, pass `Trace.observeUsage` instead of the logging callback; for Anthropic, use `(observation) => Trace.observeUsage(observation.usage)`. If you own native `LanguageModel.ConstructorParams`, pass `Usage.observeConstructor(params, Trace.observeUsage)` to `LanguageModel.make`; this path consumes canonical finish-part usage directly and supplies the original encoded finish part as the callback's second argument.

Callbacks run in the invoking fiber and have type `Effect<void>`: they introduce no error or service requirements. Streaming callbacks preserve laziness, backpressure, interruption, and resource lifetimes. Multiple snapshots update one invocation's latest observation; they are not extra model calls or charges. A transport failure or missing report remains unknown. An opaque, already-constructed `LanguageModel` still supports returned-response usage, but cannot promise observation before its internal decoding or tool execution. Applications own durable persistence and settlement.

## Testing

`@scenesystems/effect-inference/Testing` provides layers and fixtures for tests that must not reach a provider. `Testing.staticLanguageModel(text)` is a `LanguageModel` layer that returns a fixed completion, `Testing.staticEmbeddingModel(vector)` returns a fixed embedding for each input, and `Testing.staticRuntimeResolver` serves a prepared resolution. `makeDesiredRuntimeDescriptor`, `makeResolvedRouteDescriptor`, `makeResolvedRuntimeDescriptor`, and `makeRuntimeEvidenceFixture` build descriptor values with sensible defaults.

## Public surface

Every module is available as a namespace from the package root and as a subpath such as `@scenesystems/effect-inference/Runtime`.

| Module                                                | Scope                                                                                        |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [`Runtime`](./src/Runtime/index.ts)                   | Hosted text-provider layers, configuration decoding, resolver service, and evidence assembly |
| [`OpenAiCompatible`](./src/OpenAiCompatible/index.ts) | Static resolutions and transport layers for OpenAI-compatible servers                        |
| [`HuggingFace`](./src/HuggingFace/index.ts)           | Routed-marketplace and dedicated-endpoint resolution for text and embeddings                 |
| [`Usage`](./src/Usage/index.ts)                       | Pre-interpretation usage observation for native provider clients and constructors            |
| [`Contracts`](./src/contracts/index.ts)               | Desired, resolved-route, resolved-runtime, capability, and evidence schemas                  |
| [`Testing`](./src/testing/index.ts)                   | Static model layers and descriptor fixtures                                                  |
| [`Errors`](./src/Errors/index.ts)                     | Configuration, capability, route, and resolver errors                                        |
| [`Experimental`](./src/experimental/index.ts)         | Unstable APIs that may change outside semver guarantees                                      |

Paths under `internal` are not exported.

## Errors and boundaries

`InvalidRuntimeConfig` reports missing or malformed configuration, `CapabilityMismatch` reports a route that cannot serve a requested capability, `UnsupportedRoute` reports a descriptor the resolver does not handle, and `RuntimeResolverNotImplemented` marks a resolver path that is declared but not yet available. All four are `Schema.TaggedError` values. Network, authentication, and rate-limit failures come from the `@effect/ai` adapter layers and are not wrapped.

API keys enter as `Redacted` values and stay redacted through configuration and layer construction. Do not serialize them into descriptors, evidence, logs, or fixtures; the descriptors are designed to be safe to store precisely because they never contain credentials.

## Examples

The [examples directory](./examples/) contains one runnable program per route: a [static OpenAI-compatible runtime](./examples/01-openai-compatible-static-runtime.ts), a [routed Hugging Face text model](./examples/02-hugging-face-routed-runtime.ts), a [configured hosted text provider](./examples/03-runtime-config-decoding.ts), and a [dedicated Hugging Face embedding endpoint](./examples/04-hugging-face-endpoint-runtime.ts).

## Status

This package is pre-1.0. Minor releases may change public APIs; pin a compatible version and review the [changelog](./CHANGELOG.md) when upgrading. The `Experimental` module may change or be removed with less migration support than the other modules.

## Contributing and support

Read the repository [contributing guide](../../CONTRIBUTING.md) before opening a pull request. Report defects and request changes through [GitHub issues](https://github.com/scenesystems/theoria/issues). For security concerns, follow the [security policy](../../SECURITY.md).

## Attribution

Provider integrations build on [`@effect/ai`](https://effect.website/docs/ai/introduction/) and its OpenAI, Anthropic, and OpenRouter adapters.

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
