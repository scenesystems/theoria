/**
 * Runtime parity conformance contract (RED-first).
 *
 * This suite defines the target-state requirement that Python and Rust
 * generated parity outputs are checked in and compared against TypeScript.
 */

import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { utf8ToBytes } from "@noble/hashes/utils.js"
import { Array as Arr, Effect, Schema } from "effect"
import { digestBytesHex } from "../../src/convenience.js"
import {
  loadExternalFixtureManifest,
  readExternalFixture,
  selectExternalSourcesByKind
} from "./helpers/externalFixtures.js"
import { expectStringMatch } from "./helpers/mismatchDiagnostics.js"

const RuntimeParityFixtureSchema = Schema.parseJson(
  Schema.Struct({
    runtime: Schema.Literal("python", "rust"),
    generatedAt: Schema.String,
    cases: Schema.NonEmptyArray(
      Schema.Struct({
        id: Schema.String,
        algorithm: Schema.Literal("blake3-256", "sha256"),
        inputUtf8: Schema.String,
        expectedHex: Schema.String
      })
    )
  })
)

const loadRuntimeParitySources = loadExternalFixtureManifest.pipe(
  Effect.map((manifest) => selectExternalSourcesByKind(manifest, "parity-runtime"))
)

describe("external conformance — parity runtimes", () => {
  it.effect("requires checked-in Python and Rust parity outputs", () =>
    Effect.gen(function*() {
      const sources = yield* loadRuntimeParitySources
      const fixtures = yield* Effect.forEach(sources, (source) =>
        readExternalFixture(source.fixturePath).pipe(
          Effect.flatMap((content) => Schema.decodeUnknown(RuntimeParityFixtureSchema)(content).pipe(Effect.orDie)),
          Effect.map((fixture) => ({
            source,
            fixture
          }))
        ))

      expect(sources.length).toBeGreaterThan(0)
      expect(Arr.some(fixtures, ({ fixture }) => fixture.runtime === "python")).toBe(true)
      expect(Arr.some(fixtures, ({ fixture }) => fixture.runtime === "rust")).toBe(true)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("matches TypeScript digest outputs against runtime parity fixtures", () =>
    Effect.gen(function*() {
      const sources = yield* loadRuntimeParitySources
      const fixtures = yield* Effect.forEach(sources, (source) =>
        readExternalFixture(source.fixturePath).pipe(
          Effect.flatMap((content) => Schema.decodeUnknown(RuntimeParityFixtureSchema)(content).pipe(Effect.orDie)),
          Effect.map((fixture) => ({
            source,
            fixture
          }))
        ))

      yield* Effect.forEach(fixtures, ({ source, fixture }) =>
        Effect.forEach(fixture.cases, (vector) =>
          Effect.gen(function*() {
            const actual = yield* digestBytesHex(vector.algorithm, utf8ToBytes(vector.inputUtf8))
            expectStringMatch(
              `${fixture.runtime}:${vector.id}`,
              vector.algorithm,
              source.id,
              source.sourceUrl,
              source.fixturePath,
              actual,
              vector.expectedHex
            )
          })))
    }).pipe(Effect.provide(BunContext.layer)))
})
