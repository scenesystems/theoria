# `@scenesystems/effect-inference`

`@scenesystems/effect-inference` keeps model-runtime intent, route selection, and observed execution metadata as separate typed records. Applications can resolve provider layers for `@effect/ai`, execute text or embedding workloads, and retain serializable evidence about the route and runtime that served each call.

## Core model

A `DesiredRuntimeDescriptor` records the requested artifact, route hints, and capability requirements. Resolution produces a `ResolvedRouteDescriptor` with the chosen route, provider model, endpoint, or deployment information that is known before execution. The resulting `RuntimeResolution` also carries conservative capabilities and the relevant provider layer.

After execution, a `ResolvedRuntimeDescriptor` records actual evidence such as response model identity, normalized usage, finish metadata, and provider metadata. `Runtime.makeRuntimeEvidence` combines this evidence with the original resolution. Callers are responsible for populating post-execution fields from the provider response rather than treating route resolution as proof of what ran.

## Installation

```sh
npm install @scenesystems/effect-inference effect @effect/ai
```

The required peer ranges are `effect ^3.22.1` and `@effect/ai >=0.37.0`. Provider adapter and platform dependencies are installed transitively.

## Minimal example

This example creates a static OpenAI-compatible resolution and records runtime evidence.

```ts typecheck
import { OpenAiCompatible, Runtime } from "@scenesystems/effect-inference"

const resolution = OpenAiCompatible.makeOpenAiCompatibleResolution(
  { artifact: { modelRef: "local/example-model" } },
  "http://127.0.0.1:11434/v1"
)

const evidence = Runtime.makeRuntimeEvidence({
  resolution,
  resolvedRuntime: { responseModel: "local/example-model" }
})

export const routeFamily = evidence.resolvedRoute.route.family
```

For live Hugging Face routes, `HuggingFace.resolveLiveRuntimeConfig` decodes configuration and `HuggingFace.resolveLiveRuntimeFromConfig` resolves it. `HuggingFace.resolveLiveRuntime` accepts an explicit redacted token. A successful resolution can be passed to `HuggingFace.languageModelLayer` for `LanguageModel.generateText` or to `HuggingFace.embeddingModelLayer` for `EmbeddingModel.EmbeddingModel`.

Hosted text configuration is available through `Runtime.resolveLiveTextProviderRuntime` for OpenAI, Anthropic, and OpenRouter. It returns the desired descriptor together with a `LanguageModel` layer. Route families in the descriptor model are `OpenAiCompatible`, `OpenAiResponses`, `AnthropicMessages`, and `HuggingFace`.

## Public surface

| Entry point                              | Responsibility                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| `Contracts`                              | Desired, resolved-route, resolved-runtime, capability, and evidence schemas  |
| `Runtime`                                | Resolver services, config decoding, provider layers, and evidence assembly   |
| `OpenAiCompatible`                       | Static descriptors and OpenAI-compatible transport layers                    |
| `HuggingFace`                            | Routed-marketplace and dedicated-endpoint resolution for text and embeddings |
| `Errors`                                 | Configuration, capability, unsupported-route, and resolver errors            |
| `@scenesystems/effect-inference/Testing` | Static model layers and deterministic descriptor fixtures                    |

The lowercase `/experimental` entrypoint is explicitly unstable and may change outside semver guarantees.

## Secrets and operational boundaries

API keys must remain server-side or in environment-backed Effect `Config`. Keep them as `Redacted` values through configuration and layer construction. Do not serialize credentials into desired descriptors, route evidence, logs, browser bundles, or fixtures.

Resolution validates known route shapes and declared capabilities. It cannot establish the response model or usage before a provider call. `InvalidRuntimeConfig`, `CapabilityMismatch`, `UnsupportedRoute`, and `RuntimeResolverNotImplemented` form the package error union. Network and provider errors are exposed by the underlying adapter layers.

## Testing and live verification

`@scenesystems/effect-inference/Testing` exports `makeDesiredRuntimeDescriptor`, `makeResolvedRouteDescriptor`, `makeResolvedRuntimeDescriptor`, `makeRuntimeEvidenceFixture`, `staticRuntimeResolver`, `staticLanguageModel`, and `staticEmbeddingModel`. These surfaces support unit tests without provider access.

Run opt-in live verification with `bun run --filter '@scenesystems/effect-inference' examples:verify` and enable it with `EFFECT_INFERENCE_RUN_LIVE_EXAMPLES=true`. It performs real provider calls and may incur cost.

## Examples and reference

- [`examples/01-openai-compatible-static-runtime.ts`](./examples/01-openai-compatible-static-runtime.ts) assembles static evidence.
- [`examples/02-hugging-face-routed-runtime.ts`](./examples/02-hugging-face-routed-runtime.ts) executes routed text inference.
- [`examples/03-runtime-config-decoding.ts`](./examples/03-runtime-config-decoding.ts) resolves a configured text provider.
- [`examples/04-hugging-face-endpoint-runtime.ts`](./examples/04-hugging-face-endpoint-runtime.ts) executes dedicated-endpoint embeddings.

Generated API documentation is in [`docs/`](./docs).

## Status

This package is pre-1.0. Public APIs may change between minor versions, and experimental APIs have weaker stability guarantees.

## Contributing and support

Read the repository [contributing guide](../../CONTRIBUTING.md). Report defects and request support through [GitHub issues](https://github.com/scenesystems/theoria/issues).

## Attribution

Provider integrations build on [`@effect/ai`](https://effect.website/docs/ai/introduction/) and the corresponding provider SDKs.

## License

[MIT](./LICENSE), Copyright 2026 Scene Systems.
