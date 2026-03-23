import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import fixtureManifest from "./numeric-boundary.fixture-manifest.json" with { type: "json" }
import fixturePayload from "./numeric-boundary.fixture.json" with { type: "json" }

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"
import { validateNumericBoundary } from "../../src/Numeric/operations.js"

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

describe("numeric fixture authority", () => {
  it.effect("fixture manifest hash matches canonical fixture payload", () =>
    Effect.gen(function*() {
      const manifest = yield* Schema.decodeUnknown(FixtureManifestSchema)(fixtureManifest)
      const fixture = manifest.fixtures[0]
      expect(fixture.hash).toBe("blake3-256:JG8sS88IyW8sqjv8R6_Y5UoyJx0ql8f11eyfGsNfB9E")
      expect(fixture.hash.startsWith(`${manifest.algorithm}:`)).toBe(true)
    }))

  it.effect("fixture replay produces expected boundary validation output", () =>
    Effect.gen(function*() {
      const result = yield* validateNumericBoundary(fixturePayload.input)
      expect(result).toEqual(fixturePayload.expected)
    }).pipe(Effect.provide(deterministicLayer)))
})
