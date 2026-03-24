import { describe, expect, it } from "@effect/vitest"
import { Effect, Equivalence, Number, Schema, String as EffectString } from "effect"

import fixtureManifest from "../fixtures/numeric-boundary.fixture-manifest.json" with { type: "json" }
import fixturePayload from "../fixtures/numeric-boundary.fixture.json" with { type: "json" }

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"
import { validateNumericBoundary } from "../../src/Numeric/operations.js"
import { computeFixtureHash } from "../helpers/fixtures/digest.js"

const fixtureExpectedEq = Equivalence.struct({
  ok: Equivalence.boolean
})

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

const deterministicLayer = makeDeterministicRuntimePoliciesLayer({
  seed: Schema.decodeUnknownSync(Seed)(1337),
  precision: "strict",
  backend: "typed-array",
  diagnostics: "enabled"
})

describe("Numeric fixture authority", () => {
  it.effect("manifest hash matches @scenesystems/digest computation", () =>
    Effect.gen(function*() {
      const manifest = yield* Schema.decodeUnknown(FixtureManifestSchema)(fixtureManifest)
      const fixture = manifest.fixtures[0]

      expect(Number.Equivalence(manifest.version, 1)).toStrictEqual(true)
      expect(EffectString.Equivalence(manifest.algorithm, "blake3-256")).toStrictEqual(true)
      expect(EffectString.Equivalence(fixture.name, "numeric-boundary-stable")).toStrictEqual(true)

      const computedHash = yield* computeFixtureHash(fixturePayload)

      expect(EffectString.Equivalence(fixture.hash, computedHash)).toStrictEqual(true)
      expect(EffectString.Equivalence(fixture.hash.split(":")[0] ?? "", manifest.algorithm)).toStrictEqual(true)
    }))

  it.effect("fixture replay proves canonical numeric boundary behavior", () =>
    Effect.gen(function*() {
      const result = yield* validateNumericBoundary(fixturePayload.input).pipe(Effect.provide(deterministicLayer))

      expect(fixtureExpectedEq(result, fixturePayload.expected)).toStrictEqual(true)
    }))
})
