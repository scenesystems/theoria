import { describe, expect, it } from "@effect/vitest"

import type { DesiredRuntimeDescriptor } from "../../src/contracts/index.js"
import * as Runtime from "../../src/Runtime/index.js"

describe("Runtime/runtime-evidence-assembly", () => {
  it("assembles runtime evidence from pre-execution resolution and post-execution runtime truth", () => {
    const desired: DesiredRuntimeDescriptor = {
      artifact: { modelRef: "meta-llama/Llama-3.3-70B-Instruct" }
    }

    const resolution = Runtime.makeRuntimeResolution({ desired })
    const evidence = Runtime.makeRuntimeEvidence({
      resolution,
      resolvedRuntime: {
        responseModel: "accounts/fireworks/models/llama-v3p3-70b-instruct",
        responseId: "resp_123",
        finishReason: "stop"
      }
    })

    expect(evidence.desired.artifact.modelRef).toBe("meta-llama/Llama-3.3-70B-Instruct")
    expect(evidence.resolvedRoute.selectionReason).toBe("testing-static-resolution")
    expect(evidence.resolvedRuntime.responseModel).toBe("accounts/fireworks/models/llama-v3p3-70b-instruct")
    expect(evidence.resolvedRuntime.responseId).toBe("resp_123")
  })
})
