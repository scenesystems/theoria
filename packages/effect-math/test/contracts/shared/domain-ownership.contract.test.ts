import { describe, expect, it } from "@effect/vitest"
import { Effect, Record as EffectRecord, Schema } from "effect"

import { DomainOwnershipMatrix, InitialDomainOwnershipMatrix } from "../../../src/contracts/shared/DomainOwnership.js"

describe("shared domain ownership contracts", () => {
  it.effect("keeps the initial ownership matrix aligned with schema authority", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknown(DomainOwnershipMatrix)(InitialDomainOwnershipMatrix)

      expect(decoded).toStrictEqual(InitialDomainOwnershipMatrix)
      expect(EffectRecord.keys(decoded).length).toStrictEqual(9)
    }))

  it.effect("preserves declared cross-domain ownership relationships", () =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknown(DomainOwnershipMatrix)(InitialDomainOwnershipMatrix)

      expect(decoded.Probability.owns).toContain("distribution contracts")
      expect(decoded.Probability.owns).toContain("random variable semantics")
      expect(decoded.Probability.owns).toContain("stochastic process contracts")
      expect(decoded.Statistics.sharedWith).toContain("Probability")
      expect(decoded.Statistics.owns).toContain("tests")
      expect(decoded.Statistics.owns).toContain("intervals")
      expect(decoded.Statistics.owns).toContain("diagnostics")
      expect(decoded.Optimization.owns).toContain("objective-space geometry")
      expect(decoded.Geometry.sharedWith).toContain("Optimization")
      expect(decoded.Geometry.note.includes("first-wave stable")).toStrictEqual(true)
      expect(decoded.Numeric.note.includes("tolerance")).toStrictEqual(true)
    }))
})
