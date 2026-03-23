import { describe, expect, it } from "@effect/vitest"
import { Effect, Equivalence, Schema, String as EffectString } from "effect"

import { OptimizationDomainContract } from "../../src/Optimization/contract.js"
import { OptimizationDomainModel } from "../../src/Optimization/model.js"
import { loadOptimizationDomain } from "../../src/Optimization/operations.js"
import {
  decodeOptimizationDomain,
  encodeOptimizationDomain,
  OptimizationDomainSchema
} from "../../src/Optimization/schema.js"

const domainModelEq = Equivalence.struct({
  domain: EffectString.Equivalence,
  stability: EffectString.Equivalence
})

describe("Optimization domain contracts", () => {
  it.effect("keeps contract, model, schema, and load operation aligned", () =>
    Effect.gen(function*() {
      const loaded = yield* loadOptimizationDomain
      const decoded = yield* Schema.decodeUnknown(OptimizationDomainSchema)(OptimizationDomainModel)

      expect(domainModelEq(decoded, OptimizationDomainModel)).toStrictEqual(true)
      expect(domainModelEq(loaded, OptimizationDomainModel)).toStrictEqual(true)
      expect(EffectString.Equivalence(OptimizationDomainModel.domain, OptimizationDomainContract)).toStrictEqual(true)
    }))

  it.effect("round-trips the canonical model through boundary helpers", () =>
    Effect.gen(function*() {
      const decoded = yield* decodeOptimizationDomain(OptimizationDomainModel)
      const encoded = yield* encodeOptimizationDomain(decoded)

      expect(domainModelEq(encoded, OptimizationDomainModel)).toStrictEqual(true)
    }))

  it.effect("fails boundary decode with typed context when stability is invalid", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        decodeOptimizationDomain({
          domain: "Optimization",
          stability: "invalid"
        })
      )

      expect(EffectString.Equivalence(error._tag, "BoundaryDecodeError")).toStrictEqual(true)
      expect(EffectString.Equivalence(error.domain, "Optimization")).toStrictEqual(true)
      expect(EffectString.Equivalence(error.contract, "OptimizationDomainSchema")).toStrictEqual(true)
    }))
})
