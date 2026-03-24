import { describe, expect, it } from "@effect/vitest"
import { Effect, Number as N, Schema, String as EffectString } from "effect"

import fixtureManifest from "../fixtures/special-boundary.fixture-manifest.json" with { type: "json" }
import fixturePayload from "../fixtures/special-boundary.fixture.json" with { type: "json" }

import { gamma } from "../../src/Special/operations.js"

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

describe("Special fixture authority", () => {
  it.effect("manifest conforms to fixture manifest schema", () =>
    Effect.gen(function*() {
      const manifest = yield* Schema.decodeUnknown(FixtureManifestSchema)(fixtureManifest)

      expect(N.Equivalence(manifest.version, 1)).toStrictEqual(true)
      expect(EffectString.Equivalence(manifest.algorithm, "blake3-256")).toStrictEqual(true)
      expect(EffectString.Equivalence(manifest.fixtures[0].name, "special-gamma-stable")).toStrictEqual(true)
    }))

  it("fixture replay proves canonical gamma behavior", () => {
    const result = gamma(fixturePayload.input.x)

    expect(Math.abs(N.subtract(result, fixturePayload.expected.result))).toBeLessThan(1e-10)
  })
})
