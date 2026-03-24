import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Number, Schema, String as EffectString } from "effect"

import fixtureManifest from "../fixtures/calculus-boundary.fixture-manifest.json" with { type: "json" }
import fixturePayload from "../fixtures/calculus-boundary.fixture.json" with { type: "json" }

import { trapezoid } from "../../src/Calculus/operations.js"

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

describe("Calculus fixture authority", () => {
  it.effect("manifest conforms to fixture manifest schema", () =>
    Effect.gen(function*() {
      const manifest = yield* Schema.decodeUnknown(FixtureManifestSchema)(fixtureManifest)

      expect(Number.Equivalence(manifest.version, 1)).toStrictEqual(true)
      expect(EffectString.Equivalence(manifest.algorithm, "blake3-256")).toStrictEqual(true)
      expect(EffectString.Equivalence(manifest.fixtures[0].name, "calculus-trapezoid-stable")).toStrictEqual(true)
    }))

  it("fixture replay proves canonical trapezoid behavior", () => {
    const values = Chunk.fromIterable(fixturePayload.input.values)

    const result = trapezoid(values, fixturePayload.input.dx)

    expect(Number.Equivalence(result, fixturePayload.expected.result)).toStrictEqual(true)
  })
})
