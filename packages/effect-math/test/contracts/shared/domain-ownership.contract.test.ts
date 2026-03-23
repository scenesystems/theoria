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

  it("enforces Probability/Statistics ownership boundary — Statistics never owns distribution or measure-space contracts", () => {
    const probabilityExclusiveOwnership = [
      "distribution contracts",
      "measure-space primitives",
      "random variable semantics",
      "stochastic process contracts"
    ]

    probabilityExclusiveOwnership.forEach((concept) => {
      expect(InitialDomainOwnershipMatrix.Probability.owns).toContain(concept)
      expect(InitialDomainOwnershipMatrix.Statistics.owns).not.toContain(concept)
    })
  })

  it("freezes the v1 domain set — nine domains with no additions or removals", () => {
    const frozenV1Domains = [
      "Algebra",
      "Calculus",
      "Geometry",
      "LinearAlgebra",
      "Numeric",
      "Optimization",
      "Probability",
      "Special",
      "Statistics"
    ]

    expect(EffectRecord.keys(InitialDomainOwnershipMatrix).sort()).toStrictEqual(frozenV1Domains)
  })
})
