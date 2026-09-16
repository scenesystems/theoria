import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Tuple } from "effect"

import * as Contracts from "../../src/contracts/index.js"
import { defaultRuntimeCapabilities } from "../../src/internal/defaultCapabilities.js"
import * as Runtime from "../../src/Runtime/index.js"

describe("Runtime/capability-matrix", () => {
  it.effect("derives hosted OpenAI Responses capabilities from the route family", () =>
    Effect.sync(() => {
      const capabilities = defaultRuntimeCapabilities({
        route: {
          family: "OpenAiResponses",
          serveMode: "hosted-api",
          authMethod: "api-key",
          baseUrl: "https://api.openai.com/v1"
        }
      })

      expect(capabilities.structuredOutput).toBe("strict")
      expect(capabilities.toolCalling).toBe(true)
      expect(capabilities.usageReporting).toBe(true)
    }))

  it.effect("derives local compatible capabilities from runtime flavor", () =>
    Effect.sync(() => {
      const capabilities = defaultRuntimeCapabilities({
        route: {
          family: "OpenAiCompatible",
          serveMode: "local-runtime",
          authMethod: "none",
          baseUrl: "http://localhost:11434/v1",
          runtimeFlavorHint: "ollama"
        }
      })

      expect(capabilities.streaming).toBe(true)
      expect(capabilities.toolCalling).toBe(true)
      expect(capabilities.usageReporting).toBe(true)
    }))

  it.effect("uses conservative compatible capabilities when runtime flavor is absent", () =>
    Effect.sync(() => {
      const capabilities = defaultRuntimeCapabilities({
        route: {
          family: "OpenAiCompatible",
          serveMode: "self-hosted",
          authMethod: "none",
          baseUrl: "https://compatible.example.com/v1"
        }
      })

      expect(capabilities.toolCalling).toBe(false)
      expect(capabilities.usageReporting).toBe(false)
    }))

  it.effect("uses TGI-specific capabilities for dedicated Hugging Face routes", () =>
    Effect.sync(() => {
      const capabilities = defaultRuntimeCapabilities({
        route: {
          family: "HuggingFace",
          serveMode: "dedicated-endpoint",
          authMethod: "hf-token",
          baseUrl: "https://endpoint.example.com/v1",
          runtimeFlavorHint: "tgi"
        }
      })

      expect(capabilities.embeddings).toBe(false)
      expect(capabilities.usageReporting).toBe(false)
    }))

  it.effect("lets explicit overrides win over matrix defaults", () =>
    Effect.sync(() => {
      const capabilities = defaultRuntimeCapabilities({
        route: {
          family: "HuggingFace",
          serveMode: "routed-marketplace",
          authMethod: "hf-token",
          baseUrl: "https://router.huggingface.co/v1"
        },
        overrides: {
          embeddings: false,
          maxContextTokens: 8192
        }
      })

      expect(capabilities.embeddings).toBe(false)
      expect(capabilities.maxContextTokens).toBe(8192)
    }))

  it.effect("admits supported grades and fails unmet requirements before exposing live model layers", () =>
    Effect.gen(function*() {
      const resolver = yield* Runtime.RuntimeResolver.pipe(Effect.provide(Runtime.RuntimeResolverLive))
      const route: Contracts.ExecutionRoute = {
        family: "HuggingFace",
        serveMode: "dedicated-endpoint",
        authMethod: "hf-token",
        baseUrl: "https://endpoint.example.com/v1",
        runtimeFlavorHint: "tgi"
      }

      yield* Effect.forEach(
        Arr.make(
          Contracts.CapabilityRequirementsSchema.make({ structuredOutput: "none", usageReporting: false }),
          Contracts.CapabilityRequirementsSchema.make({ structuredOutput: "best-effort", streaming: true })
        ),
        (capabilities) =>
          Effect.gen(function*() {
            const resolution = yield* resolver.resolve({ artifact: { modelRef: "model" }, route, capabilities })
            expect(Option.isSome(resolution.layers.languageModel)).toBe(true)
            expect(Option.isNone(resolution.layers.embeddingModel)).toBe(true)
          })
      )

      yield* Effect.forEach(
        Arr.make(
          Tuple.make("embeddings", Contracts.CapabilityRequirementsSchema.make({ embeddings: true })),
          Tuple.make("usageReporting", Contracts.CapabilityRequirementsSchema.make({ usageReporting: true })),
          Tuple.make("structuredOutput", Contracts.CapabilityRequirementsSchema.make({ structuredOutput: "strict" })),
          Tuple.make("minimumContextTokens", Contracts.CapabilityRequirementsSchema.make({ minimumContextTokens: 1 }))
        ),
        ([capability, capabilities]) =>
          Effect.gen(function*() {
            const error = yield* resolver.resolve({ artifact: { modelRef: "model" }, route, capabilities }).pipe(
              Effect.flip
            )
            expect(error).toMatchObject({ _tag: "effect-inference/CapabilityMismatch", capability })
          })
      )
    }))
})
