import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Schema, Tuple } from "effect"

import * as Capabilities from "@scenesystems/effect-inference/Capabilities"
import * as Route from "@scenesystems/effect-inference/Route"
import * as Runtime from "@scenesystems/effect-inference/Runtime"

const route = Route.Route.make({
  family: "HuggingFace",
  serveMode: "dedicated-endpoint",
  authMethod: "hf-token",
  baseUrl: "https://endpoint.example.test",
  runtimeFlavorHint: "tgi"
})

const CapabilityCase = Schema.Struct({
  name: Schema.String,
  route: Route.Route,
  expected: Capabilities.Capabilities
})

const capabilityCases = Arr.make(
  CapabilityCase.make({
    name: "OpenAI Responses",
    route: Route.Route.make({
      family: "OpenAiResponses",
      serveMode: "hosted-api",
      authMethod: "api-key",
      baseUrl: "https://api.openai.com/v1"
    }),
    expected: Capabilities.Capabilities.make({
      textGeneration: true,
      embeddings: false,
      streaming: true,
      toolCalling: true,
      structuredOutput: "strict",
      usageReporting: true,
      multimodalInput: false
    })
  }),
  CapabilityCase.make({
    name: "self-hosted compatible runtime without a flavor",
    route: Route.Route.make({
      family: "OpenAiCompatible",
      serveMode: "self-hosted",
      authMethod: "none",
      baseUrl: "https://compatible.example.test/v1"
    }),
    expected: Capabilities.Capabilities.make({
      textGeneration: true,
      embeddings: false,
      streaming: true,
      toolCalling: false,
      structuredOutput: "best-effort",
      usageReporting: false,
      multimodalInput: false
    })
  }),
  CapabilityCase.make({
    name: "local Ollama compatible runtime",
    route: Route.Route.make({
      family: "OpenAiCompatible",
      serveMode: "local-runtime",
      authMethod: "none",
      baseUrl: "http://localhost:11434/v1",
      runtimeFlavorHint: "ollama"
    }),
    expected: Capabilities.Capabilities.make({
      textGeneration: true,
      embeddings: false,
      streaming: true,
      toolCalling: true,
      structuredOutput: "best-effort",
      usageReporting: true,
      multimodalInput: false
    })
  }),
  CapabilityCase.make({
    name: "hosted OpenAI-compatible endpoint",
    route: Route.Route.make({
      family: "OpenAiCompatible",
      serveMode: "dedicated-endpoint",
      authMethod: "api-key",
      baseUrl: "https://compatible.example.test/v1"
    }),
    expected: Capabilities.Capabilities.make({
      textGeneration: true,
      embeddings: true,
      streaming: true,
      toolCalling: true,
      structuredOutput: "best-effort",
      usageReporting: true,
      multimodalInput: false
    })
  }),
  CapabilityCase.make({
    name: "Hugging Face endpoint without a runtime flavor",
    route: Route.Route.make({
      family: "HuggingFace",
      serveMode: "dedicated-endpoint",
      authMethod: "hf-token",
      baseUrl: "https://endpoint.example.test"
    }),
    expected: Capabilities.Capabilities.make({
      textGeneration: true,
      embeddings: true,
      streaming: true,
      toolCalling: false,
      structuredOutput: "best-effort",
      usageReporting: true,
      multimodalInput: false
    })
  }),
  CapabilityCase.make({
    name: "Hugging Face TGI endpoint",
    route,
    expected: Capabilities.Capabilities.make({
      textGeneration: true,
      embeddings: false,
      streaming: true,
      toolCalling: false,
      structuredOutput: "best-effort",
      usageReporting: false,
      multimodalInput: false
    })
  }),
  CapabilityCase.make({
    name: "Hugging Face routed provider",
    route: Route.Route.make({
      family: "HuggingFace",
      serveMode: "routed-marketplace",
      authMethod: "hf-token",
      baseUrl: "https://router.huggingface.co/v1",
      selectionPolicy: Route.explicitProvider("together")
    }),
    expected: Capabilities.Capabilities.make({
      textGeneration: true,
      embeddings: true,
      streaming: true,
      toolCalling: false,
      structuredOutput: "best-effort",
      usageReporting: true,
      multimodalInput: false
    })
  })
)

describe("Runtime.resolve", () => {
  it.effect.each(capabilityCases)(
    "derives $name capabilities and admits exactly the supported model layers",
    ({ expected, route }) =>
      Effect.gen(function*() {
        const resolution = yield* Runtime.resolve({ model: { modelRef: "model" }, route }).pipe(
          Effect.provide(Runtime.layer)
        )

        expect(resolution.capabilities).toEqual(expected)
        expect(Option.isSome(resolution.models.languageModel)).toBe(expected.textGeneration)
        expect(Option.isSome(resolution.models.embeddingModel)).toBe(expected.embeddings)
      })
  )

  it.effect("records native-provider and explicit routed-provider provenance", () =>
    Effect.gen(function*() {
      const openAi = yield* Runtime.resolve({
        model: { modelRef: "gpt-4o-mini" },
        route: Route.Route.make({
          family: "OpenAiResponses",
          serveMode: "hosted-api",
          authMethod: "api-key",
          baseUrl: "https://api.openai.com/v1"
        })
      }).pipe(Effect.provide(Runtime.layer))
      const anthropic = yield* Runtime.resolve({
        model: { modelRef: "claude-3-5-haiku-latest" },
        route: Route.Route.make({
          family: "AnthropicMessages",
          serveMode: "hosted-api",
          authMethod: "api-key",
          baseUrl: "https://api.anthropic.com"
        })
      }).pipe(Effect.provide(Runtime.layer))
      const routed = yield* Runtime.resolve({
        model: { modelRef: "meta-llama/Llama-3.3-70B-Instruct" },
        route: Route.Route.make({
          family: "HuggingFace",
          serveMode: "routed-marketplace",
          authMethod: "hf-token",
          baseUrl: "https://router.huggingface.co/v1",
          gatewayId: "hf-router",
          selectionPolicy: Route.explicitProvider("together")
        })
      }).pipe(Effect.provide(Runtime.layer))

      expect(openAi.route.selectedProvider).toBe("openai")
      expect(openAi.route.selectionReason).toBe("openai-responses-direct")
      expect(anthropic.route.selectedProvider).toBe("anthropic")
      expect(anthropic.route.selectionReason).toBe("anthropic-messages-direct")
      expect(routed.route.selectedProvider).toBe("together")
      expect(routed.route.route.gatewayId).toBe("hf-router")
      expect(routed.route.selectionReason).toBe("hugging-face-routed-live")
      expect(routed.route.providerModel).toBe("meta-llama/Llama-3.3-70B-Instruct")
    }))

  it.effect("resolves capability false and omission without constraints", () =>
    Effect.forEach(
      Arr.make(
        Capabilities.Requirements.make({ embeddings: false }),
        Capabilities.Requirements.make({ structuredOutput: "none" }),
        Capabilities.Requirements.make({ structuredOutput: "best-effort", streaming: true })
      ),
      (capabilities) =>
        Runtime.resolve({ model: { modelRef: "model" }, route, capabilities }).pipe(
          Effect.provide(Runtime.layer),
          Effect.tap((resolution) =>
            Effect.sync(() => {
              expect(Option.isSome(resolution.models.languageModel)).toBe(true)
              expect(Option.isNone(resolution.models.embeddingModel)).toBe(true)
            })
          )
        )
    ))

  it.effect("fails unmet booleans, minimum context, and stronger structured-output grades", () =>
    Effect.forEach(
      Arr.make(
        Tuple.make("embeddings", Capabilities.Requirements.make({ embeddings: true })),
        Tuple.make("usageReporting", Capabilities.Requirements.make({ usageReporting: true })),
        Tuple.make("structuredOutput", Capabilities.Requirements.make({ structuredOutput: "strict" })),
        Tuple.make("minimumContextTokens", Capabilities.Requirements.make({ minimumContextTokens: 1 }))
      ),
      ([capability, capabilities]) =>
        Runtime.resolve({ model: { modelRef: "model" }, route, capabilities }).pipe(
          Effect.provide(Runtime.layer),
          Effect.flip,
          Effect.tap((error) => Effect.sync(() => expect(error).toMatchObject({ capability })))
        )
    ))

  it.effect("supports caller implementations through layerWith", () =>
    Effect.gen(function*() {
      const request = { model: { modelRef: "test/model" } }
      const expected = new Runtime.Resolution({
        request,
        route: {
          route: {
            family: "OpenAiCompatible",
            serveMode: "local-runtime",
            authMethod: "none",
            baseUrl: "in-memory://runtime"
          },
          selectionReason: "custom",
          schemaVersion: "resolved-route/v1"
        },
        capabilities: {
          textGeneration: false,
          embeddings: false,
          streaming: false,
          toolCalling: false,
          structuredOutput: "none",
          usageReporting: false,
          multimodalInput: false
        },
        models: Runtime.emptyModelLayers()
      })
      const actual = yield* Runtime.resolve(request).pipe(
        Effect.provide(Runtime.layerWith(() => Effect.succeed(expected)))
      )
      expect(actual).toBe(expected)
    }))
})
