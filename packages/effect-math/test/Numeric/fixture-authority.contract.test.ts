import { describe, expect, it } from "@effect/vitest"
import { Effect, Equivalence, Number, Schema, String as EffectString } from "effect"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import fixtureManifest from "../fixtures/numeric-boundary.fixture-manifest.json" with { type: "json" }
import fixturePayload from "../fixtures/numeric-boundary.fixture.json" with { type: "json" }

import { Seed } from "../../src/contracts/shared/BrandedScalars.js"
import { makeDeterministicRuntimePoliciesLayer } from "../../src/contracts/shared/RuntimePolicies.js"
import { validateNumericBoundary } from "../../src/Numeric/operations.js"

const fixtureDir = dirname(fileURLToPath(import.meta.url))
const canonicalFixtureFingerprint = "blake3-256:JG8sS88IyW8sqjv8R6_Y5UoyJx0ql8f11eyfGsNfB9E"

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
  it.effect("manifest hash and fixture payload remain canonical", () =>
    Effect.gen(function*() {
      const manifest = yield* Schema.decodeUnknown(FixtureManifestSchema)(fixtureManifest)
      const fixture = manifest.fixtures[0]
      const fixtureFile = readFileSync(
        resolve(fixtureDir, fixture.path.replace("test/fixtures", "../fixtures")),
        "utf8"
      )

      expect(Number.Equivalence(manifest.version, 1)).toStrictEqual(true)
      expect(EffectString.Equivalence(manifest.algorithm, "blake3-256")).toStrictEqual(true)
      expect(EffectString.Equivalence(fixture.hash, canonicalFixtureFingerprint)).toStrictEqual(true)
      expect(EffectString.Equivalence(fixture.hash.split(":")[0] ?? "", manifest.algorithm)).toStrictEqual(true)
      expect(fixtureFile.includes("\"name\": \"numeric-boundary-stable\"")).toStrictEqual(true)
    }))

  it.effect("fixture replay proves canonical numeric boundary behavior", () =>
    Effect.gen(function*() {
      const result = yield* validateNumericBoundary(fixturePayload.input).pipe(Effect.provide(deterministicLayer))

      expect(fixtureExpectedEq(result, fixturePayload.expected)).toStrictEqual(true)
    }))
})
