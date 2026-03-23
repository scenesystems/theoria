import { describe, expect, it } from "@effect/vitest"
import { Effect, Equivalence, Schema, String as EffectString } from "effect"

import { LinearAlgebraDomainContract } from "../../src/LinearAlgebra/contract.js"
import { LinearAlgebraDomainModel } from "../../src/LinearAlgebra/model.js"
import { loadLinearAlgebraDomain } from "../../src/LinearAlgebra/operations.js"
import {
  decodeLinearAlgebraDomain,
  encodeLinearAlgebraDomain,
  LinearAlgebraDomainSchema
} from "../../src/LinearAlgebra/schema.js"

const domainModelEq = Equivalence.struct({
  domain: EffectString.Equivalence,
  stability: EffectString.Equivalence
})

describe("LinearAlgebra domain contracts", () => {
  it.effect("keeps contract, model, schema, and load operation aligned", () =>
    Effect.gen(function*() {
      const loaded = yield* loadLinearAlgebraDomain
      const decoded = yield* Schema.decodeUnknown(LinearAlgebraDomainSchema)(LinearAlgebraDomainModel)

      expect(domainModelEq(decoded, LinearAlgebraDomainModel)).toStrictEqual(true)
      expect(domainModelEq(loaded, LinearAlgebraDomainModel)).toStrictEqual(true)
      expect(EffectString.Equivalence(LinearAlgebraDomainModel.domain, LinearAlgebraDomainContract)).toStrictEqual(true)
    }))

  it.effect("round-trips the canonical model through boundary helpers", () =>
    Effect.gen(function*() {
      const decoded = yield* decodeLinearAlgebraDomain(LinearAlgebraDomainModel)
      const encoded = yield* encodeLinearAlgebraDomain(decoded)

      expect(domainModelEq(encoded, LinearAlgebraDomainModel)).toStrictEqual(true)
    }))

  it.effect("fails boundary decode with typed context when stability is invalid", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        decodeLinearAlgebraDomain({
          domain: "LinearAlgebra",
          stability: "invalid"
        })
      )

      expect(EffectString.Equivalence(error._tag, "BoundaryDecodeError")).toStrictEqual(true)
      expect(EffectString.Equivalence(error.domain, "LinearAlgebra")).toStrictEqual(true)
      expect(EffectString.Equivalence(error.contract, "LinearAlgebraDomainSchema")).toStrictEqual(true)
    }))
})
