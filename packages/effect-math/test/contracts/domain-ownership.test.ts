import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import { DomainOwnershipMatrix, InitialDomainOwnershipMatrix } from "../../src/contracts/shared/DomainOwnership.js"

describe("domain ownership matrix", () => {
  it.effect("keeps the initial ownership matrix aligned with schema authority", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknown(DomainOwnershipMatrix)(InitialDomainOwnershipMatrix)

      expect(decoded.Probability.owns).toContain("distribution contracts")
      expect(decoded.Statistics.sharedWith).toContain("Probability")
      expect(decoded.Optimization.owns).toContain("objective-space geometry")
      expect(decoded.Geometry.sharedWith).toContain("Optimization")
    }))
})
