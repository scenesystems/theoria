import { describe, expect, it } from "@effect/vitest"

import * as Runtime from "../../src/Runtime/index.js"
import * as Testing from "../../src/testing/index.js"

describe("Runtime/runtime-evidence-boundary", () => {
  it("emits response ids, finish reasons, usage, and provider metadata only after runtime evidence is assembled", () => {
    const desired = {
      artifact: { modelRef: "meta-llama/Llama-3.3-70B-Instruct" }
    }

    const resolution = Testing.RuntimeResolution.fromTesting({ desired })
    const evidence = Runtime.RuntimeEvidence.fromResolution({
      resolution,
      resolvedRuntime: Testing.ResolvedRuntimeDescriptor.fromTesting({
        responseModel: "accounts/fireworks/models/llama-v3p3-70b-instruct",
        responseId: "resp_123",
        finishReason: "stop",
        usage: {
          inputTokens: 800,
          outputTokens: 160,
          totalTokens: 960
        },
        providerMetadata: {
          huggingface: {
            provider: "together",
            requestId: "hf_req_123"
          }
        }
      })
    })

    expect("resolvedRuntime" in resolution).toBe(false)
    expect(evidence.resolvedRuntime.responseId).toBe("resp_123")
    expect(evidence.resolvedRuntime.finishReason).toBe("stop")
    expect(evidence.resolvedRuntime.usage?.totalTokens).toBe(960)
    expect(evidence.resolvedRuntime.providerMetadata?.huggingface?.provider).toBe("together")
  })
})
