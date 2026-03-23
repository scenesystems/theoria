import { describe, expect, it } from "@effect/vitest"
import { Effect, Equivalence, Schema, String as EffectString } from "effect"

import { GeometryDomainContract } from "../../src/Geometry/contract.js"
import { GeometryDomainModel } from "../../src/Geometry/model.js"
import { loadGeometryDomain } from "../../src/Geometry/operations.js"
import { decodeGeometryDomain, encodeGeometryDomain, GeometryDomainSchema } from "../../src/Geometry/schema.js"

const domainModelEq = Equivalence.struct({
  domain: EffectString.Equivalence,
  stability: EffectString.Equivalence
})

describe("Geometry domain contracts", () => {
  it.effect("keeps contract, model, schema, and load operation aligned", () =>
    Effect.gen(function*() {
      const loaded = yield* loadGeometryDomain
      const decoded = yield* Schema.decodeUnknown(GeometryDomainSchema)(GeometryDomainModel)

      expect(domainModelEq(decoded, GeometryDomainModel)).toStrictEqual(true)
      expect(domainModelEq(loaded, GeometryDomainModel)).toStrictEqual(true)
      expect(EffectString.Equivalence(GeometryDomainModel.domain, GeometryDomainContract)).toStrictEqual(true)
    }))

  it.effect("round-trips the canonical model through boundary helpers", () =>
    Effect.gen(function*() {
      const decoded = yield* decodeGeometryDomain(GeometryDomainModel)
      const encoded = yield* encodeGeometryDomain(decoded)

      expect(domainModelEq(encoded, GeometryDomainModel)).toStrictEqual(true)
    }))

  it.effect("fails boundary decode with typed context when stability is invalid", () =>
    Effect.gen(function*() {
      const error = yield* Effect.flip(
        decodeGeometryDomain({
          domain: "Geometry",
          stability: "invalid"
        })
      )

      expect(EffectString.Equivalence(error._tag, "BoundaryDecodeError")).toStrictEqual(true)
      expect(EffectString.Equivalence(error.domain, "Geometry")).toStrictEqual(true)
      expect(EffectString.Equivalence(error.contract, "GeometryDomainSchema")).toStrictEqual(true)
    }))
})
