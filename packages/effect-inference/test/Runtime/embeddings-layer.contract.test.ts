import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import * as Errors from "../../src/Errors/index.js"
import * as Runtime from "../../src/Runtime/index.js"

describe("Runtime/embeddings-layer", () => {
  it.effect("resolves embeddings-capable compatible runtimes to an EmbeddingModel layer", () =>
    Effect.gen(function*() {
      const resolver = yield* Runtime.RuntimeResolver.pipe(Effect.provide(Runtime.RuntimeResolverLive))
      const resolution = yield* resolver.resolve({
        artifact: { modelRef: "text-embedding-3-small" },
        capabilities: { embeddings: true },
        route: {
          family: "OpenAiCompatible",
          serveMode: "dedicated-endpoint",
          authMethod: "api-key",
          baseUrl: "https://compatible.example.com/v1"
        }
      })

      expect(Option.isSome(resolution.layers.embeddingModel)).toBe(true)
    }))

  it.effect("resolves embeddings-capable Hugging Face endpoints to an EmbeddingModel layer", () =>
    Effect.gen(function*() {
      const resolver = yield* Runtime.RuntimeResolver.pipe(Effect.provide(Runtime.RuntimeResolverLive))
      const resolution = yield* resolver.resolve({
        artifact: { modelRef: "BAAI/bge-base-en-v1.5" },
        capabilities: { embeddings: true },
        route: {
          family: "HuggingFace",
          serveMode: "dedicated-endpoint",
          authMethod: "api-key",
          baseUrl: "https://endpoint.example.com/v1",
          endpointId: "hf-endpoint-prod"
        }
      })

      expect(Option.isSome(resolution.layers.embeddingModel)).toBe(true)
    }))

  it.effect("resolves embeddings-capable Hugging Face routed providers to an EmbeddingModel layer", () =>
    Effect.gen(function*() {
      const resolver = yield* Runtime.RuntimeResolver.pipe(Effect.provide(Runtime.RuntimeResolverLive))
      const resolution = yield* resolver.resolve({
        artifact: { modelRef: "BAAI/bge-base-en-v1.5" },
        capabilities: { embeddings: true },
        route: {
          family: "HuggingFace",
          serveMode: "routed-marketplace",
          authMethod: "hf-token",
          baseUrl: "https://router.huggingface.co/v1"
        }
      })

      expect(Option.isSome(resolution.layers.embeddingModel)).toBe(true)
    }))

  it.effect("fails with a typed capability mismatch when embeddings are requested on unsupported routes", () =>
    Effect.gen(function*() {
      const resolver = yield* Runtime.RuntimeResolver.pipe(Effect.provide(Runtime.RuntimeResolverLive))
      const error = yield* resolver
        .resolve({
          artifact: { modelRef: "claude-3-5-haiku-latest" },
          capabilities: { embeddings: true },
          route: {
            family: "AnthropicMessages",
            serveMode: "hosted-api",
            authMethod: "api-key",
            baseUrl: "https://api.anthropic.com"
          }
        })
        .pipe(Effect.flip)

      expect(error).toEqual(
        new Errors.CapabilityMismatch({
          capability: "embeddings",
          reason: "resolved runtime does not support embeddings"
        })
      )
    }))
})
