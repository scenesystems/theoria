/**
 * External fixture governance contract (RED-first).
 *
 * This suite defines the target-state requirement that every fixture source has
 * explicit provenance metadata and schema-valid payloads.
 */

import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import {
  FixtureManifestSchema,
  HashFixtureSchema,
  HmacHkdfFixtureSchema,
  JcsFixtureSchema,
  RuntimeParityFixtureSchema
} from "../../scripts/fixture-schemas.js"
import {
  loadExternalFixtureManifest,
  readExternalFixture,
  selectExternalSourcesByKind
} from "./helpers/externalFixtures.js"

describe("external conformance — fixture governance", () => {
  it.effect("requires explicit provenance metadata for every fixture source", () =>
    Effect.gen(function*() {
      const content = yield* readExternalFixture("sources.manifest.json")
      const manifest = yield* Schema.decodeUnknown(FixtureManifestSchema)(content).pipe(Effect.orDie)

      expect(manifest.sources.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("keeps external fixture payloads schema-valid by source kind", () =>
    Effect.gen(function*() {
      const manifest = yield* loadExternalFixtureManifest

      const jcsSources = selectExternalSourcesByKind(manifest, "jcs")
      const hashSources = selectExternalSourcesByKind(manifest, "hash")
      const hmacHkdfSources = selectExternalSourcesByKind(manifest, "hmac-hkdf")
      const paritySources = selectExternalSourcesByKind(manifest, "parity-runtime")

      yield* Effect.forEach(jcsSources, (source) =>
        readExternalFixture(source.fixturePath).pipe(
          Effect.flatMap((content) => Schema.decodeUnknown(JcsFixtureSchema)(content).pipe(Effect.orDie)),
          Effect.asVoid
        ))

      yield* Effect.forEach(hashSources, (source) =>
        readExternalFixture(source.fixturePath).pipe(
          Effect.flatMap((content) => Schema.decodeUnknown(HashFixtureSchema)(content).pipe(Effect.orDie)),
          Effect.asVoid
        ))

      yield* Effect.forEach(hmacHkdfSources, (source) =>
        readExternalFixture(source.fixturePath).pipe(
          Effect.flatMap((content) => Schema.decodeUnknown(HmacHkdfFixtureSchema)(content).pipe(Effect.orDie)),
          Effect.asVoid
        ))

      yield* Effect.forEach(paritySources, (source) =>
        readExternalFixture(source.fixturePath).pipe(
          Effect.flatMap((content) => Schema.decodeUnknown(RuntimeParityFixtureSchema)(content).pipe(Effect.orDie)),
          Effect.asVoid
        ))

      expect(jcsSources.length + hashSources.length + hmacHkdfSources.length + paritySources.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(BunContext.layer)))
})
