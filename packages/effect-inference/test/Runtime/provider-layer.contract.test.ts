import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import * as Contracts from "../../src/contracts/index.js"
import * as Runtime from "../../src/Runtime/index.js"

const providerCase = (options: {
  readonly name: string
  readonly desired: Contracts.DesiredRuntimeDescriptor
  readonly expectedProvider?: string
  readonly expectedSelectionReason: string
}) => options

describe("Runtime/provider-layer", () => {
  it.effect.each([
    providerCase({
      name: "OpenAiCompatible dedicated-endpoint",
      desired: {
        artifact: { modelRef: "openai/gpt-4o-mini" },
        route: {
          family: "OpenAiCompatible",
          serveMode: "dedicated-endpoint",
          authMethod: "api-key",
          baseUrl: "https://compatible.example.com/v1",
          endpointId: "compatible-prod",
          deploymentId: "deploy-1"
        }
      },
      expectedSelectionReason: "openai-compatible-live"
    }),
    providerCase({
      name: "OpenAiCompatible self-hosted vLLM",
      desired: {
        artifact: { modelRef: "meta-llama/Llama-3.1-8B-Instruct" },
        route: {
          family: "OpenAiCompatible",
          serveMode: "local-runtime",
          authMethod: "none",
          baseUrl: "http://127.0.0.1:8000/v1",
          runtimeFlavorHint: "vllm"
        }
      },
      expectedSelectionReason: "openai-compatible-live"
    }),
    providerCase({
      name: "OpenAiCompatible self-hosted TGI",
      desired: {
        artifact: { modelRef: "meta-llama/Llama-3.1-8B-Instruct" },
        route: {
          family: "OpenAiCompatible",
          serveMode: "local-runtime",
          authMethod: "none",
          baseUrl: "http://127.0.0.1:8080/v1",
          runtimeFlavorHint: "tgi"
        }
      },
      expectedSelectionReason: "openai-compatible-live"
    }),
    providerCase({
      name: "OpenAiCompatible self-hosted Ollama",
      desired: {
        artifact: { modelRef: "llama3.2" },
        route: {
          family: "OpenAiCompatible",
          serveMode: "local-runtime",
          authMethod: "none",
          baseUrl: "http://127.0.0.1:11434/v1",
          runtimeFlavorHint: "ollama"
        }
      },
      expectedSelectionReason: "openai-compatible-live"
    }),
    providerCase({
      name: "OpenAiCompatible self-hosted LM Studio",
      desired: {
        artifact: { modelRef: "meta-llama/Llama-3.1-8B-Instruct" },
        route: {
          family: "OpenAiCompatible",
          serveMode: "local-runtime",
          authMethod: "none",
          baseUrl: "http://127.0.0.1:1234/v1",
          runtimeFlavorHint: "lm-studio"
        }
      },
      expectedSelectionReason: "openai-compatible-live"
    }),
    providerCase({
      name: "OpenAiResponses",
      desired: {
        artifact: { modelRef: "gpt-4o-mini" },
        route: {
          family: "OpenAiResponses",
          serveMode: "hosted-api",
          authMethod: "api-key",
          baseUrl: "https://api.openai.com/v1"
        }
      },
      expectedProvider: "openai",
      expectedSelectionReason: "openai-responses-direct"
    }),
    providerCase({
      name: "AnthropicMessages",
      desired: {
        artifact: { modelRef: "claude-3-5-haiku-latest" },
        route: {
          family: "AnthropicMessages",
          serveMode: "hosted-api",
          authMethod: "api-key",
          baseUrl: "https://api.anthropic.com"
        }
      },
      expectedProvider: "anthropic",
      expectedSelectionReason: "anthropic-messages-direct"
    }),
    providerCase({
      name: "HuggingFace routed-provider",
      desired: {
        artifact: { modelRef: "meta-llama/Llama-3.3-70B-Instruct" },
        route: {
          family: "HuggingFace",
          serveMode: "routed-marketplace",
          authMethod: "hf-token",
          baseUrl: "https://router.huggingface.co/v1",
          gatewayId: "hf-router",
          selectionPolicy: Contracts.explicitProviderSelection("together")
        }
      },
      expectedProvider: "together",
      expectedSelectionReason: "hugging-face-routed-live"
    })
  ])(
    "resolves $name routes to package-owned text-model layers",
    ({ desired, expectedProvider, expectedSelectionReason }) =>
      Effect.gen(function*() {
        const resolver = yield* Runtime.RuntimeResolver.pipe(Effect.provide(Runtime.RuntimeResolverLive))
        const resolution = yield* resolver.resolve(desired)

        expect(resolution.resolvedRoute.providerModel).toBe(desired.artifact.modelRef)
        expect(resolution.resolvedRoute.selectionReason).toBe(expectedSelectionReason)
        expect(Option.isSome(resolution.layers.languageModel)).toBe(true)
        expect(resolution.resolvedRoute.selectedProvider).toBe(expectedProvider)
      })
  )
})
