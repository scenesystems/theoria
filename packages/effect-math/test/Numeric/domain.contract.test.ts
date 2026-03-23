import { describe, expect, it } from "@effect/vitest"
import { Effect, Equivalence, Schema, String as EffectString } from "effect"

import { NumericDomainContract } from "../../src/Numeric/contract.js"
import { NumericDomainModel } from "../../src/Numeric/model.js"
import { loadNumericDomain } from "../../src/Numeric/operations.js"
import { decodeNumericDomain, encodeNumericDomain, NumericDomainSchema } from "../../src/Numeric/schema.js"

const domainModelEq = Equivalence.struct({
  domain: EffectString.Equivalence,
  stability: EffectString.Equivalence
})

describe("Numeric domain contracts", () => {
  it.effect("keeps contract, model, schema, and load operation aligned", () =>
    Effect.gen(function*() {
      const loaded = yield* loadNumericDomain
      const decoded = yield* Schema.decodeUnknown(NumericDomainSchema)(NumericDomainModel)

      expect(domainModelEq(decoded, NumericDomainModel)).toStrictEqual(true)
      expect(domainModelEq(loaded, NumericDomainModel)).toStrictEqual(true)
      expect(EffectString.Equivalence(NumericDomainModel.domain, NumericDomainContract)).toStrictEqual(true)
    }))

  it.effect("round-trips the canonical model through boundary helpers", () =>
    Effect.gen(function*() {
      const decoded = yield* decodeNumericDomain(NumericDomainModel)
      const encoded = yield* encodeNumericDomain(decoded)

      expect(domainModelEq(encoded, NumericDomainModel)).toStrictEqual(true)
    }))

  it.effect("fails boundary decode with typed context when stability is invalid", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        decodeNumericDomain({
          domain: "Numeric",
          stability: "invalid"
        })
      )

      expect(EffectString.Equivalence(error._tag, "BoundaryDecodeError")).toStrictEqual(true)
      expect(EffectString.Equivalence(error.domain, "Numeric")).toStrictEqual(true)
      expect(EffectString.Equivalence(error.contract, "NumericDomainSchema")).toStrictEqual(true)
    }))
})
