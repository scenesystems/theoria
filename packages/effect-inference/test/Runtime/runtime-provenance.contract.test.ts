import { describe, expect, it } from "@effect/vitest"

import * as Contracts from "../../src/contracts/index.js"
import * as HuggingFace from "../../src/HuggingFace/index.js"

describe("Runtime/runtime-provenance", () => {
  it("preserves requested runtime truth and emits route provenance as a separate resolution record", () => {
    const desired: Contracts.DesiredRuntimeDescriptor = {
      artifact: {
        modelRef: "meta-llama/Llama-3.3-70B-Instruct",
        alias: "task-llama"
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
    }

    const resolution = HuggingFace.makeHuggingFaceRoutedResolution(
      desired,
      "https://router.huggingface.co/v1"
    )

    expect(resolution.desired).toEqual(desired)
    expect(resolution.desired.route?.gatewayId).toBe("hf-router")
    expect(resolution.resolvedRoute.route.gatewayId).toBe("hf-router")
    expect(resolution.resolvedRoute.selectedProvider).toBe("together")
    expect("selectedProvider" in (resolution.desired.route ?? {})).toBe(false)
  })
})
