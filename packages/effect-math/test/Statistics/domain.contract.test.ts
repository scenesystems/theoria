import { describe, expect, it } from "@effect/vitest"
import { Effect, Equivalence, Schema, String as EffectString } from "effect"

import { StatisticsDomainContract } from "../../src/Statistics/contract.js"
import { StatisticsDomainModel } from "../../src/Statistics/model.js"
import { loadStatisticsDomain } from "../../src/Statistics/operations.js"
import { decodeStatisticsDomain, encodeStatisticsDomain, StatisticsDomainSchema } from "../../src/Statistics/schema.js"

const domainModelEq = Equivalence.struct({
  domain: EffectString.Equivalence,
  stability: EffectString.Equivalence
})

describe("Statistics domain contracts", () => {
  it.effect("keeps contract, model, schema, and load operation aligned", () =>
    Effect.gen(function*() {
      const loaded = yield* loadStatisticsDomain
      const decoded = yield* Schema.decodeUnknown(StatisticsDomainSchema)(StatisticsDomainModel)

      expect(domainModelEq(decoded, StatisticsDomainModel)).toStrictEqual(true)
      expect(domainModelEq(loaded, StatisticsDomainModel)).toStrictEqual(true)
      expect(EffectString.Equivalence(StatisticsDomainModel.domain, StatisticsDomainContract)).toStrictEqual(true)
    }))

  it.effect("round-trips the canonical model through boundary helpers", () =>
    Effect.gen(function*() {
      const decoded = yield* decodeStatisticsDomain(StatisticsDomainModel)
      const encoded = yield* encodeStatisticsDomain(decoded)

      expect(domainModelEq(encoded, StatisticsDomainModel)).toStrictEqual(true)
    }))

  it.effect("fails boundary decode with typed context when stability is invalid", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        decodeStatisticsDomain({
          domain: "Statistics",
          stability: "invalid"
        })
      )

      expect(EffectString.Equivalence(error._tag, "BoundaryDecodeError")).toStrictEqual(true)
      expect(EffectString.Equivalence(error.domain, "Statistics")).toStrictEqual(true)
      expect(EffectString.Equivalence(error.contract, "StatisticsDomainSchema")).toStrictEqual(true)
    }))
})
