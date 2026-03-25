/**
 * External hash conformance contract (RED-first).
 *
 * This suite defines the target-state requirement that BLAKE3 and SHA-256
 * parity is asserted from checked-in external fixture corpora.
 */

import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { utf8ToBytes } from "@noble/hashes/utils.js"
import { Array as Arr, Effect, Schema } from "effect"
import { HashFixtureSchema } from "../../scripts/fixture-schemas.js"
import { digestBytesHex } from "../../src/convenience.js"
import { loadExternalFixtureManifest, readExternalFixture } from "./helpers/externalFixtures.js"
import { expectStringMatch } from "./helpers/mismatchDiagnostics.js"

describe("external conformance — hash", () => {
  it.effect("pins external corpus for BLAKE3 and SHA-256", () =>
    Effect.gen(function*() {
      const manifest = yield* loadExternalFixtureManifest
      const hashSources = Arr.filter(manifest.sources, (source) => source.kind === "hash")

      expect(hashSources.length).toBeGreaterThan(0)
      expect(hashSources.some((source) => source.id.includes("blake3"))).toBe(true)
      expect(hashSources.some((source) => source.id.includes("sha256"))).toBe(true)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("matches expected digest outputs for every external hash fixture", () =>
    Effect.gen(function*() {
      const manifest = yield* loadExternalFixtureManifest
      const hashSources = Arr.filter(manifest.sources, (source) => source.kind === "hash")

      const fixtures = yield* Effect.forEach(hashSources, (source) =>
        readExternalFixture(source.fixturePath).pipe(
          Effect.flatMap((content) => Schema.decodeUnknown(HashFixtureSchema)(content).pipe(Effect.orDie)),
          Effect.map((fixture) => ({
            source,
            fixture
          }))
        ))

      yield* Effect.forEach(fixtures, ({ source, fixture }) =>
        Effect.gen(function*() {
          const digestHex = yield* digestBytesHex(fixture.algorithm, utf8ToBytes(fixture.inputUtf8))
          expectStringMatch(
            fixture.id,
            fixture.algorithm,
            source.id,
            source.sourceUrl,
            source.fixturePath,
            digestHex,
            fixture.expectedHex
          )
        }))
    }).pipe(Effect.provide(BunContext.layer)))
})
