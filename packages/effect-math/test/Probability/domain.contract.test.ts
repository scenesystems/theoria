import { describe, expect, it } from "@effect/vitest"
import { Effect, Equivalence, Schema, String as EffectString } from "effect"

import { ProbabilityDomainContract } from "../../src/Probability/contract.js"
import { ProbabilityDomainModel } from "../../src/Probability/model.js"
import { loadProbabilityDomain } from "../../src/Probability/operations.js"
import {
  decodeProbabilityDomain,
  encodeProbabilityDomain,
  ProbabilityDomainSchema
} from "../../src/Probability/schema.js"

const domainModelEq = Equivalence.struct({
  domain: EffectString.Equivalence,
  stability: EffectString.Equivalence
})

describe("Probability domain contracts", () => {
  it.effect("keeps contract, model, schema, and load operation aligned", () =>
    Effect.gen(function*() {
      const loaded = yield* loadProbabilityDomain
      const decoded = yield* Schema.decodeUnknown(ProbabilityDomainSchema)(ProbabilityDomainModel)

      expect(domainModelEq(decoded, ProbabilityDomainModel)).toStrictEqual(true)
      expect(domainModelEq(loaded, ProbabilityDomainModel)).toStrictEqual(true)
      expect(EffectString.Equivalence(ProbabilityDomainModel.domain, ProbabilityDomainContract)).toStrictEqual(true)
    }))

  it.effect("round-trips the canonical model through boundary helpers", () =>
    Effect.gen(function*() {
      const decoded = yield* decodeProbabilityDomain(ProbabilityDomainModel)
      const encoded = yield* encodeProbabilityDomain(decoded)

      expect(domainModelEq(encoded, ProbabilityDomainModel)).toStrictEqual(true)
    }))

  it.effect("fails boundary decode with typed context when stability is invalid", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        decodeProbabilityDomain({
          domain: "Probability",
          stability: "invalid"
        })
      )

      expect(EffectString.Equivalence(error._tag, "BoundaryDecodeError")).toStrictEqual(true)
      expect(EffectString.Equivalence(error.domain, "Probability")).toStrictEqual(true)
      expect(EffectString.Equivalence(error.contract, "ProbabilityDomainSchema")).toStrictEqual(true)
    }))
})
