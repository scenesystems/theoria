import { describe, expect, it } from "@effect/vitest"

import { CapabilityMismatch } from "../../src/Errors/index.js"

describe("Errors/inference-error", () => {
  it("creates a tagged capability mismatch error", () => {
    const error = new CapabilityMismatch({
      capability: "embeddings",
      reason: "route does not expose embeddings"
    })

    expect(error._tag).toBe("effect-inference/CapabilityMismatch")
    expect(error.capability).toBe("embeddings")
    expect(error.reason).toBe("route does not expose embeddings")
  })
})
