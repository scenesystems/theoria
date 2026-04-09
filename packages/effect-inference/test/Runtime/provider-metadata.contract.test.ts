import { describe, expect, it } from "@effect/vitest"

import * as Testing from "../../src/testing/index.js"

describe("Runtime/provider-metadata", () => {
  it("keeps provider-specific metadata namespaced and additive to normalized runtime evidence", () => {
    const evidence = Testing.RuntimeEvidence.fromTesting({
      desired: {
        artifact: { modelRef: "openai/gpt-4o-mini" }
      },
      resolvedRuntime: Testing.ResolvedRuntimeDescriptor.fromTesting({
        responseModel: "gpt-4o-mini",
        responseId: "resp_123",
        finishReason: "stop",
        usage: {
          inputTokens: 320,
          outputTokens: 96,
          totalTokens: 416,
          costUsd: 0.0021
        },
        providerMetadata: {
          openai: {
            requestId: "req_123",
            serviceTier: "default"
          },
          huggingface: {
            provider: "together"
          }
        }
      })
    })

    expect(evidence.resolvedRuntime.usage?.totalTokens).toBe(416)
    expect(evidence.resolvedRuntime.providerMetadata?.openai?.requestId).toBe("req_123")
    expect(evidence.resolvedRuntime.providerMetadata?.huggingface?.provider).toBe("together")
  })
})
