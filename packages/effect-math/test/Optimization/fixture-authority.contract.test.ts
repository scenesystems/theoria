import { describe, expect, it } from "@effect/vitest"
import { Effect, Number as N, Schema, String as EffectString } from "effect"

import fixtureManifest from "../fixtures/optimization-boundary.fixture-manifest.json" with { type: "json" }
import fixturePayload from "../fixtures/optimization-boundary.fixture.json" with { type: "json" }

import { bisect } from "../../src/Optimization/operations.js"

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

const testFunctions: Record<string, (x: number) => number> = {
  x_squared_minus_2: (x) => N.subtract(N.multiply(x, x), 2)
}

describe("Optimization fixture authority", () => {
  it.effect("manifest conforms to fixture manifest schema", () =>
    Effect.gen(function*() {
      const manifest = yield* Schema.decodeUnknown(FixtureManifestSchema)(fixtureManifest)

      expect(N.Equivalence(manifest.version, 1)).toStrictEqual(true)
      expect(EffectString.Equivalence(manifest.algorithm, "blake3-256")).toStrictEqual(true)
      expect(EffectString.Equivalence(manifest.fixtures[0].name, "optimization-bisect-stable")).toStrictEqual(true)
    }))

  it("fixture replay proves canonical bisect behavior", () => {
    const fn = testFunctions[fixturePayload.input.function]!

    const result = bisect(fn, fixturePayload.input.a, fixturePayload.input.b)

    expect(Math.abs(N.subtract(result, fixturePayload.expected.result))).toBeLessThan(1e-10)
  })
})
