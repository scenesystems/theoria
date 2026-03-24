import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Number, Schema, String as EffectString } from "effect"

import fixtureManifest from "../fixtures/linalg-boundary.fixture-manifest.json" with { type: "json" }
import fixturePayload from "../fixtures/linalg-boundary.fixture.json" with { type: "json" }

import { dot } from "../../src/LinearAlgebra/operations.js"
import { computeFixtureHash } from "../helpers/fixtures/digest.js"

const FixtureManifestSchema = Schema.Struct({
  version: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),
  algorithm: Schema.Literal("blake3-256"),
  fixtures: Schema.NonEmptyArray(
    Schema.Struct({
      name: Schema.String,
      path: Schema.String,
      hash: Schema.String
    })
  )
})

describe("LinearAlgebra fixture authority", () => {
  it.effect("manifest hash matches @scenesystems/digest computation", () =>
    Effect.gen(function*() {
      const manifest = yield* Schema.decodeUnknown(FixtureManifestSchema)(fixtureManifest)
      const fixture = manifest.fixtures[0]

      expect(Number.Equivalence(manifest.version, 1)).toStrictEqual(true)
      expect(EffectString.Equivalence(manifest.algorithm, "blake3-256")).toStrictEqual(true)
      expect(EffectString.Equivalence(fixture.name, "linalg-dot-product-stable")).toStrictEqual(true)

      const computedHash = yield* computeFixtureHash(fixturePayload)

      expect(EffectString.Equivalence(fixture.hash, computedHash)).toStrictEqual(true)
      expect(EffectString.Equivalence(fixture.hash.split(":")[0] ?? "", manifest.algorithm)).toStrictEqual(true)
    }))

  it("fixture replay proves canonical dot product behavior", () => {
    const a = Chunk.fromIterable(fixturePayload.input.a)
    const b = Chunk.fromIterable(fixturePayload.input.b)

    const result = dot(a, b)

    expect(Number.Equivalence(result, fixturePayload.expected.result)).toStrictEqual(true)
  })
})
