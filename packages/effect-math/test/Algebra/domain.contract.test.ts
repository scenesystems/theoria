import { describe, expect, it } from "@effect/vitest"
import { Effect, Equivalence, Schema, String as EffectString } from "effect"

import { AlgebraDomainContract } from "../../src/Algebra/contract.js"
import { AlgebraDomainModel } from "../../src/Algebra/model.js"
import { loadAlgebraDomain } from "../../src/Algebra/operations.js"
import { AlgebraDomainSchema, decodeAlgebraDomain, encodeAlgebraDomain } from "../../src/Algebra/schema.js"

const domainModelEq = Equivalence.struct({
  domain: EffectString.Equivalence,
  stability: EffectString.Equivalence
})

describe("Algebra domain contracts", () => {
  it.effect("keeps contract, model, schema, and load operation aligned", () =>
    Effect.gen(function*() {
      const loaded = yield* loadAlgebraDomain
      const decoded = yield* Schema.decodeUnknown(AlgebraDomainSchema)(AlgebraDomainModel)

      expect(domainModelEq(decoded, AlgebraDomainModel)).toStrictEqual(true)
      expect(domainModelEq(loaded, AlgebraDomainModel)).toStrictEqual(true)
      expect(EffectString.Equivalence(AlgebraDomainModel.domain, AlgebraDomainContract)).toStrictEqual(true)
    }))

  it.effect("round-trips the canonical model through boundary helpers", () =>
    Effect.gen(function*() {
      const decoded = yield* decodeAlgebraDomain(AlgebraDomainModel)
      const encoded = yield* encodeAlgebraDomain(decoded)

      expect(domainModelEq(encoded, AlgebraDomainModel)).toStrictEqual(true)
    }))

  it.effect("fails boundary decode with typed context when stability is invalid", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        decodeAlgebraDomain({
          domain: "Algebra",
          stability: "invalid"
        })
      )

      expect(EffectString.Equivalence(error._tag, "BoundaryDecodeError")).toStrictEqual(true)
      expect(EffectString.Equivalence(error.domain, "Algebra")).toStrictEqual(true)
      expect(EffectString.Equivalence(error.contract, "AlgebraDomainSchema")).toStrictEqual(true)
    }))
})
