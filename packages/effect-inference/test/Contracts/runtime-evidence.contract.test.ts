import { describe, expect, it } from "@effect/vitest"
import { Either, Schema } from "effect"

import * as Contracts from "../../src/contracts/index.js"

describe("Contracts/runtime-evidence", () => {
  it("decodes replay-safe runtime evidence with normalized usage and namespaced provider metadata", () => {
    const decoded = Schema.decodeUnknownEither(Contracts.RuntimeEvidenceSchema)({
      desired: {
        artifact: {
          modelRef: "meta-llama/Llama-3.3-70B-Instruct",
          revision: "main"
        },
        route: {
          family: "HuggingFace",
          serveMode: "routed-marketplace",
          authMethod: "hf-token",
          baseUrl: "https://router.huggingface.co/v1",
          gatewayId: "hf-router",
          selectionPolicy: Contracts.explicitProviderSelection("together")
        },
        role: "task"
      },
      resolvedRoute: {
        route: {
          family: "HuggingFace",
          serveMode: "routed-marketplace",
          authMethod: "hf-token",
          baseUrl: "https://router.huggingface.co/v1",
          gatewayId: "hf-router",
          selectionPolicy: Contracts.explicitProviderSelection("together")
        },
        selectedProvider: "together",
        selectionReason: "hugging-face-routed-live",
        schemaVersion: Contracts.ResolvedRouteProvenanceVersion
      },
      resolvedRuntime: {
        responseModel: "accounts/fireworks/models/llama-v3p3-70b-instruct",
        responseId: "resp_123",
        finishReason: "stop",
        usage: {
          inputTokens: 512,
          outputTokens: 128,
          totalTokens: 640,
          costUsd: 0.014
        },
        providerMetadata: {
          huggingface: {
            requestId: "hf_req_123",
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

    expect(Either.isRight(decoded)).toBe(true)

    if (Either.isRight(decoded)) {
      expect(decoded.right.resolvedRuntime.usage?.totalTokens).toBe(640)
      expect(decoded.right.resolvedRuntime.providerMetadata?.huggingface?.requestId).toBe("hf_req_123")
    }
  })

  it("rejects non-serializable provider metadata on the package-owned evidence surface", () => {
    const decoded = Schema.decodeUnknownEither(Contracts.RuntimeEvidenceSchema)({
      desired: {
        artifact: { modelRef: "openai/gpt-4o-mini" }
      },
      resolvedRoute: {
        route: {
          family: "OpenAiCompatible",
          serveMode: "hosted-api",
          authMethod: "api-key",
          baseUrl: "https://api.openai.com/v1"
        },
        selectionReason: "testing-static-resolution",
        schemaVersion: Contracts.ResolvedRouteProvenanceVersion
      },
      resolvedRuntime: {
        responseModel: "gpt-4o-mini",
        providerMetadata: {
          openai: {
            invalid: () => "not-serializable"
          }
        }
      },
      capabilities: {
        textGeneration: true,
        embeddings: false,
        streaming: true,
        toolCalling: true,
        structuredOutput: "strict",
        usageReporting: true,
        multimodalInput: false
      }
    })

    expect(Either.isLeft(decoded)).toBe(true)
  })
})
