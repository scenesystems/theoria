import { describe, expect, it } from "@effect/vitest"
import { ConfigProvider, Effect, Match, Option, Redacted } from "effect"

import * as HuggingFace from "@scenesystems/effect-inference/HuggingFace"
import * as Route from "@scenesystems/effect-inference/Route"

describe("HuggingFace", () => {
  it.effect("applies route-specific configuration before generic configuration", () =>
    Effect.gen(function*() {
      const config = yield* HuggingFace.fromConfig(
        new HuggingFace.Config({
          serveMode: "routed-marketplace",
          configProvider: ConfigProvider.fromJson({
            HUGGINGFACE_ACCESS_TOKEN: "hf_test_token",
            HUGGINGFACE_MODEL: "generic-model",
            HUGGINGFACE_ROUTED_MODEL: "routed-model",
            HUGGINGFACE_BASE_URL: "https://generic.example.test",
            HUGGINGFACE_ROUTED_BASE_URL: "https://router.example.test/v1",
            HUGGINGFACE_SELECTION_POLICY: "provider:generic",
            HUGGINGFACE_ROUTED_SELECTION_POLICY: "provider:together"
          }).pipe(ConfigProvider.constantCase)
        })
      )

      yield* Match.value(config).pipe(
        Match.when({ serveMode: "routed-marketplace" }, (config) =>
          Effect.gen(function*() {
            expect(config.model).toBe("routed-model")
            expect(config.baseUrl).toBe("https://router.example.test/v1")
            expect(config.selectionPolicy).toEqual(Route.explicitProvider("together"))
            expect(Redacted.value(config.accessToken)).toBe("hf_test_token")
            const resolution = yield* HuggingFace.resolve(config)
            expect(resolution.route.selectedProvider).toBe("together")
            expect(Option.isSome(resolution.models.embeddingModel)).toBe(true)
          })),
        Match.when({ serveMode: "dedicated-endpoint" }, () => Effect.dieMessage("Expected routed config")),
        Match.exhaustive
      )
    }))

  it.effect("lets explicit endpoint values win over route-specific and generic configuration", () =>
    Effect.gen(function*() {
      const config = yield* HuggingFace.fromConfig(
        new HuggingFace.Config({
          serveMode: "dedicated-endpoint",
          model: "explicit-model",
          accessToken: Redacted.make("explicit-token"),
          baseUrl: "https://explicit-endpoint.example.test",
          endpointId: "explicit-endpoint",
          deploymentId: "explicit-deployment",
          runtimeFlavorHint: "tgi",
          configProvider: ConfigProvider.fromJson({
            HUGGINGFACE_ACCESS_TOKEN: "configured-token",
            HUGGINGFACE_MODEL: "generic-model",
            HUGGINGFACE_ENDPOINT_MODEL: "endpoint-model",
            HUGGINGFACE_BASE_URL: "https://generic.example.test",
            HUGGINGFACE_ENDPOINT_BASE_URL: "https://configured-endpoint.example.test",
            HUGGINGFACE_ENDPOINT_ID: "configured-endpoint",
            HUGGINGFACE_DEPLOYMENT_ID: "configured-deployment",
            HUGGINGFACE_RUNTIME_FLAVOR: "ollama"
          }).pipe(ConfigProvider.constantCase)
        })
      )

      yield* Match.value(config).pipe(
        Match.when({ serveMode: "dedicated-endpoint" }, (config) =>
          Effect.gen(function*() {
            expect(config.model).toBe("explicit-model")
            expect(Redacted.value(config.accessToken)).toBe("explicit-token")
            expect(config.baseUrl).toBe("https://explicit-endpoint.example.test")
            expect(config.endpointId).toBe("explicit-endpoint")
            expect(config.deploymentId).toBe("explicit-deployment")
            expect(config.runtimeFlavorHint).toBe("tgi")

            const resolution = yield* HuggingFace.resolve(config)
            expect(resolution.route.route.endpointId).toBe("explicit-endpoint")
            expect(resolution.route.selectedDeployment).toBe("explicit-deployment")
            expect(resolution.route.runtimeFlavor).toBe("tgi")
            expect(resolution.capabilities.embeddings).toBe(false)
            expect(Option.isNone(resolution.models.embeddingModel)).toBe(true)
          })),
        Match.when({ serveMode: "routed-marketplace" }, () => Effect.dieMessage("Expected endpoint config")),
        Match.exhaustive
      )
    }))

  it.effect("keeps missing credentials in the checked configuration channel", () =>
    Effect.gen(function*() {
      const error = yield* HuggingFace.fromConfig(
        new HuggingFace.Config({
          serveMode: "routed-marketplace",
          model: "meta-llama/Llama-3.3-70B-Instruct",
          configProvider: ConfigProvider.fromJson({}).pipe(ConfigProvider.constantCase)
        })
      ).pipe(Effect.flip)

      expect(error._tag).toBe("effect-inference/InvalidRuntimeConfig")
      expect(error.reason).toContain("Missing Hugging Face access token")
    }))
})
