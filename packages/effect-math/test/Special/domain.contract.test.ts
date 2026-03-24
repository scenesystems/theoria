import { describe, expect, it } from "@effect/vitest"
import { Effect, Equivalence, Schema, String as EffectString } from "effect"

import { SpecialDomainContract } from "../../src/Special/contract.js"
import { SpecialDomainModel } from "../../src/Special/model.js"
import { loadSpecialDomain } from "../../src/Special/operations.js"
import { decodeSpecialDomain, encodeSpecialDomain, SpecialDomainSchema } from "../../src/Special/schema.js"

const domainModelEq = Equivalence.struct({
  domain: EffectString.Equivalence,
  stability: EffectString.Equivalence
})

describe("Special domain contracts", () => {
  it.effect("keeps contract, model, schema, and load operation aligned", () =>
    Effect.gen(function*() {
      const loaded = yield* loadSpecialDomain
      const decoded = yield* Schema.decodeUnknown(SpecialDomainSchema)(SpecialDomainModel)

      expect(domainModelEq(decoded, SpecialDomainModel)).toStrictEqual(true)
      expect(domainModelEq(loaded, SpecialDomainModel)).toStrictEqual(true)
      expect(EffectString.Equivalence(SpecialDomainModel.domain, SpecialDomainContract)).toStrictEqual(true)
    }))

  it.effect("round-trips the canonical model through boundary helpers", () =>
    Effect.gen(function*() {
      const decoded = yield* decodeSpecialDomain(SpecialDomainModel)
      const encoded = yield* encodeSpecialDomain(decoded)

      expect(domainModelEq(encoded, SpecialDomainModel)).toStrictEqual(true)
    }))

  it.effect("fails boundary decode with typed context when stability is invalid", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        decodeSpecialDomain({
          domain: "Special",
          stability: "invalid"
        })
      )

      expect(EffectString.Equivalence(error._tag, "BoundaryDecodeError")).toStrictEqual(true)
      expect(EffectString.Equivalence(error.domain, "Special")).toStrictEqual(true)
      expect(EffectString.Equivalence(error.contract, "SpecialDomainSchema")).toStrictEqual(true)
    }))
})
