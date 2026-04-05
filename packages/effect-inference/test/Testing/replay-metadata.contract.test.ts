import { describe, expect, it } from "@effect/vitest"
import { Schema } from "effect"

import * as Contracts from "../../src/contracts/index.js"
import * as Testing from "../../src/testing/index.js"

describe("Testing/replay-metadata", () => {
  it("preserves requested runtime, resolved route, and resolved runtime metadata in deterministic fixtures", () => {
    const evidence = Testing.makeRuntimeEvidenceFixture({
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
        selectionReason: "testing-static-resolution",
        schemaVersion: Contracts.ResolvedRouteProvenanceVersion
      },
      resolvedRuntime: Testing.makeResolvedRuntimeDescriptor({
        responseModel: "accounts/fireworks/models/llama-v3p3-70b-instruct",
        responseId: "resp_789",
        finishReason: "stop",
        usage: {
          inputTokens: 600,
          outputTokens: 140,
          totalTokens: 740
        },
        providerMetadata: {
          huggingface: {
            provider: "together",
            requestId: "hf_req_789"
          }
        }
      })
    })
    const encoded = Schema.encodeSync(Contracts.RuntimeEvidenceSchema)(evidence)

    expect(evidence.desired.route?.gatewayId).toBe("hf-router")
    expect(evidence.resolvedRoute.selectedProvider).toBe("together")
    expect(evidence.resolvedRuntime.responseId).toBe("resp_789")
    expect(encoded.resolvedRuntime.providerMetadata?.huggingface?.requestId).toBe("hf_req_789")
  })
})
