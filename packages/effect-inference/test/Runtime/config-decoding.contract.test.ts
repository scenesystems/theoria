import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import * as Contracts from "../../src/contracts/index.js"
import * as Runtime from "../../src/Runtime/index.js"

describe("Runtime/config-decoding", () => {
  it.effect("decodes stable requested, resolved, and replay-safe runtime records through package-owned config helpers", () =>
    Effect.gen(function*() {
      const route = {
        family: "HuggingFace",
        serveMode: "routed-marketplace",
        authMethod: "hf-token",
        baseUrl: "https://router.huggingface.co/v1",
        gatewayId: "hf-router",
        selectionPolicy: Contracts.explicitProviderSelection("together")
      }

      const desired = yield* Runtime.decodeDesiredRuntimeDescriptor({
        artifact: {
          modelRef: "meta-llama/Llama-3.3-70B-Instruct",
          alias: "llama-task"
        },
        route,
        role: "task"
      })

      const resolvedRuntime = yield* Runtime.decodeResolvedRuntimeDescriptor({
        responseModel: "accounts/fireworks/models/llama-v3p3-70b-instruct",
        responseId: "resp_123",
        finishReason: "stop"
      })

      const evidence = yield* Runtime.decodeRuntimeEvidence({
        desired,
        resolvedRoute: {
          route,
          selectedProvider: "together",
          selectionReason: "hugging-face-routed-live",
          schemaVersion: Contracts.ResolvedRouteProvenanceVersion
        },
        resolvedRuntime: {
          ...resolvedRuntime,
          providerMetadata: {
            huggingface: {
              provider: "together"
            }
          }
        },
        capabilities: {
          textGeneration: true,
          embeddings: true,
          streaming: true,
          toolCalling: false,
          structuredOutput: "best-effort",
          usageReporting: true,
          multimodalInput: false
        }
      })

      expect(desired.route?.selectionPolicy).toEqual(Contracts.explicitProviderSelection("together"))
      expect(resolvedRuntime.responseId).toBe("resp_123")
      expect(evidence.resolvedRuntime.providerMetadata?.huggingface?.provider).toBe("together")
    }))

  it.effect("rejects route families that widen beyond the stable execution-route contract", () =>
    Effect.gen(function*() {
      const error = yield* Runtime.decodeDesiredRuntimeDescriptor({
        artifact: { modelRef: "local/tgi" },
        route: {
          family: "TgiNative",
          serveMode: "local-runtime",
          authMethod: "none",
          baseUrl: "http://127.0.0.1:8080/v1"
        }
      }).pipe(Effect.flip)

      expect(error._tag).toBe("effect-inference/InvalidRuntimeConfig")
    }))
})
