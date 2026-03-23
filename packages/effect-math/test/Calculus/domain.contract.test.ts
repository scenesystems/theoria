import { describe, expect, it } from "@effect/vitest"
import { Effect, Equivalence, Schema, String as EffectString } from "effect"

import { CalculusDomainContract } from "../../src/Calculus/contract.js"
import { CalculusDomainModel } from "../../src/Calculus/model.js"
import { loadCalculusDomain } from "../../src/Calculus/operations.js"
import { CalculusDomainSchema, decodeCalculusDomain, encodeCalculusDomain } from "../../src/Calculus/schema.js"

const domainModelEq = Equivalence.struct({
  domain: EffectString.Equivalence,
  stability: EffectString.Equivalence
})

describe("Calculus domain contracts", () => {
  it.effect("keeps contract, model, schema, and load operation aligned", () =>
    Effect.gen(function*() {
      const loaded = yield* loadCalculusDomain
      const decoded = yield* Schema.decodeUnknown(CalculusDomainSchema)(CalculusDomainModel)

      expect(domainModelEq(decoded, CalculusDomainModel)).toStrictEqual(true)
      expect(domainModelEq(loaded, CalculusDomainModel)).toStrictEqual(true)
      expect(EffectString.Equivalence(CalculusDomainModel.domain, CalculusDomainContract)).toStrictEqual(true)
    }))

  it.effect("round-trips the canonical model through boundary helpers", () =>
    Effect.gen(function*() {
      const decoded = yield* decodeCalculusDomain(CalculusDomainModel)
      const encoded = yield* encodeCalculusDomain(decoded)

      expect(domainModelEq(encoded, CalculusDomainModel)).toStrictEqual(true)
    }))

  it.effect("fails boundary decode with typed context when stability is invalid", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        decodeCalculusDomain({
          domain: "Calculus",
          stability: "invalid"
        })
      )

      expect(EffectString.Equivalence(error._tag, "BoundaryDecodeError")).toStrictEqual(true)
      expect(EffectString.Equivalence(error.domain, "Calculus")).toStrictEqual(true)
      expect(EffectString.Equivalence(error.contract, "CalculusDomainSchema")).toStrictEqual(true)
    }))
})
