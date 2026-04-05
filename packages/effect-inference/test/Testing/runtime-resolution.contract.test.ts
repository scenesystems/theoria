import { describe, expect, it } from "@effect/vitest"

import * as Testing from "../../src/testing/index.js"

describe("Testing/runtime-resolution", () => {
  it("creates deterministic runtime-resolution fixtures", () => {
    const desired = Testing.makeDesiredRuntimeDescriptor({
      modelRef: "hf:sentence-transformers/all-MiniLM-L6-v2"
    })
    const resolvedRoute = Testing.makeResolvedRouteDescriptor({ desired })
    const resolution = Testing.makeRuntimeResolution({
      desired,
      resolvedRoute
    })

    expect(resolution.desired.artifact.modelRef).toContain("MiniLM")
    expect(resolution.resolvedRoute.providerModel).toBe(desired.artifact.modelRef)
  })
})
