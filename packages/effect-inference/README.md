# @scenesystems/effect-inference

`@scenesystems/effect-inference` turns model-provider configuration into `@effect/ai` layers and keeps a typed record of which provider, route, and model served each call. Use it when an application must run the same program against OpenAI, Anthropic, OpenRouter, an OpenAI-compatible local server, or Hugging Face, and needs to say afterwards which one actually answered.

The package separates three things that are often conflated. A desired runtime descriptor records what you asked for: a model reference, route hints, and capability requirements. A resolved route descriptor records what was decided before any request: the provider, endpoint, and model the layer will call. A resolved runtime descriptor records what was observed after a response: the reported model, normalized usage, and provider metadata. `Runtime.makeRuntimeEvidence` joins them into one serializable value.

[`@scenesystems/effect-dsp`](../effect-dsp/README.md) modules consume the `LanguageModel` layers this package produces. Any other `@effect/ai` consumer can use them the same way.

## Installation

```sh
npm install @scenesystems/effect-inference effect @effect/ai
```

Effect `^3.22.1` and `@effect/ai >=0.37.0` are required peer dependencies. The provider adapters for OpenAI, Anthropic, and OpenRouter, and the HTTP client they need, are installed as regular dependencies.

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
import { Config, Effect } from "effect"
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
  return { model: runtime.model, route: runtime.desired.route, text: response.text }
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
import { Effect } from "effect"
import { HuggingFace, Runtime } from "@scenesystems/effect-inference"

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

  const evidence = Runtime.makeRuntimeEvidence({
    resolution,
    resolvedRuntime: { responseModel: resolution.resolvedRoute.providerModel ?? resolution.desired.artifact.modelRef }
  })
  return { selectedProvider: evidence.resolvedRoute.selectedProvider, text: response.text }
})
```

`HUGGINGFACE_ACCESS_TOKEN` supplies the token; `HUGGINGFACE_SERVE_MODE`, `HUGGINGFACE_MODEL`, `HUGGINGFACE_BASE_URL`, `HUGGINGFACE_SELECTION_POLICY`, `HUGGINGFACE_ENDPOINT_ID`, `HUGGINGFACE_DEPLOYMENT_ID`, and `HUGGINGFACE_RUNTIME_FLAVOR` fill in the rest, and explicit options override them. `HuggingFace.languageModelLayer` and `HuggingFace.embeddingModelLayer` extract a layer from the resolution and fail with `CapabilityMismatch` if the route does not offer that capability. `HuggingFace.resolveLiveRuntime` skips configuration and takes every value, including the redacted token, as an argument.

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

## Testing

`@scenesystems/effect-inference/Testing` provides layers and fixtures for tests that must not reach a provider. `Testing.staticLanguageModel(text)` is a `LanguageModel` layer that returns a fixed completion, `Testing.staticEmbeddingModel(vector)` returns a fixed embedding for each input, and `Testing.staticRuntimeResolver` serves a prepared resolution. `makeDesiredRuntimeDescriptor`, `makeResolvedRouteDescriptor`, `makeResolvedRuntimeDescriptor`, and `makeRuntimeEvidenceFixture` build descriptor values with sensible defaults.

## Public surface

Every module is available as a namespace from the package root and as a subpath such as `@scenesystems/effect-inference/Runtime`.

| Module                                                | Scope                                                                                        |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [`Runtime`](./src/Runtime/index.ts)                   | Hosted text-provider layers, configuration decoding, resolver service, and evidence assembly |
| [`OpenAiCompatible`](./src/OpenAiCompatible/index.ts) | Static resolutions and transport layers for OpenAI-compatible servers                        |
| [`HuggingFace`](./src/HuggingFace/index.ts)           | Routed-marketplace and dedicated-endpoint resolution for text and embeddings                 |
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
