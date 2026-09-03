import { describe, expect, it } from "@effect/vitest"
import { Effect, Either, Schema } from "effect"

import {
  CategoricalParzenFixtureSchema,
  makeFixtureRegistry,
  TpeCategoricalStudyReplayFixtureSchema
} from "./fixtures.js"

const invalidFixtureRoot = new URL("../fixtures/optuna/invalid/", import.meta.url)

describe("deterministic fixture registry", () => {
  it.effect("loads schema-validated fixtures from the manifest", () =>
    Effect.gen(function*() {
      const registry = makeFixtureRegistry()
      const categorical = yield* registry.load("categorical-parzen.basic")
      const replay = yield* registry.load("tpe-categorical-study.replay")

      const decodedCategorical = yield* Schema.decodeUnknown(CategoricalParzenFixtureSchema)(categorical)
      const decodedReplay = yield* Schema.decodeUnknown(TpeCategoricalStudyReplayFixtureSchema)(replay)

      expect(decodedCategorical.payload.expected.probabilities).toHaveLength(3)
      expect(decodedReplay.payload.expected.configTrace.length).toBe(decodedReplay.payload.sampler.trials)
    }))

  it.effect("validates the full fixture manifest against schema contracts", () =>
    Effect.gen(function*() {
      const registry = makeFixtureRegistry()
      yield* registry.validateManifest
    }))

  it.effect("fails when a manifest entry points to a missing fixture file", () =>
    Effect.gen(function*() {
      const registry = makeFixtureRegistry({
        rootUrl: invalidFixtureRoot,
        manifestFileName: "manifest.missing-file.json"
      })
      const result = yield* Effect.either(registry.validateManifest)

      expect(Either.isLeft(result)).toBe(true)
      expect(
        Either.match(result, {
          onLeft: (error) => error._tag,
          onRight: () => "Right"
        })
      ).toBe("FixtureFileReadError")
    }))

  it.effect("fails when a fixture file contains malformed JSON", () =>
    Effect.gen(function*() {
      const registry = makeFixtureRegistry({
        rootUrl: invalidFixtureRoot,
        manifestFileName: "manifest.malformed.json"
      })
      const result = yield* Effect.either(registry.validateManifest)

      expect(Either.isLeft(result)).toBe(true)
      expect(
        Either.match(result, {
          onLeft: (error) => error._tag,
          onRight: () => "Right"
        })
      ).toBe("FixtureMalformedJsonError")
    }))

  it.effect("fails when fixture JSON is schema-incompatible", () =>
    Effect.gen(function*() {
      const registry = makeFixtureRegistry({
        rootUrl: invalidFixtureRoot,
        manifestFileName: "manifest.schema-incompatible.json"
      })
      const result = yield* Effect.either(registry.validateManifest)

      expect(Either.isLeft(result)).toBe(true)
      expect(
        Either.match(result, {
          onLeft: (error) => error._tag,
          onRight: () => "Right"
        })
      ).toBe("FixtureSchemaDecodeError")
    }))
})
