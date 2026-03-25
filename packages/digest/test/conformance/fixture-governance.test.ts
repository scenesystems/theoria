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
  ExternalFixtureKindSchema,
  loadExternalFixtureManifest,
  readExternalFixture,
  selectExternalSourcesByKind
} from "./helpers/externalFixtures.js"

const GovernedSourceSchema = Schema.Struct({
  id: Schema.String,
  kind: ExternalFixtureKindSchema,
  fixturePath: Schema.String,
  sourceUrl: Schema.String.pipe(Schema.pattern(/^https:\/\//)),
  revision: Schema.String,
  retrievedAt: Schema.String,
  sourceLicense: Schema.String,
  normalizationNotes: Schema.String,
  contentSha256: Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/))
})

const GovernedManifestSchema = Schema.parseJson(
  Schema.Struct({
    sources: Schema.NonEmptyArray(GovernedSourceSchema)
  })
)

const JcsFixtureSchema = Schema.parseJson(
  Schema.Struct({
    id: Schema.String,
    input: Schema.Unknown,
    expectedCanonical: Schema.String
  })
)

const HashFixtureSchema = Schema.parseJson(
  Schema.Struct({
    id: Schema.String,
    algorithm: Schema.Literal("blake3-256", "sha256"),
    inputUtf8: Schema.String,
    expectedHex: Schema.String
  })
)

const HmacFixtureSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("hmac-sha256"),
  keyHex: Schema.String,
  messageHex: Schema.String,
  expectedHex: Schema.String
})

const HkdfFixtureSchema = Schema.Struct({
  id: Schema.String,
  operation: Schema.Literal("hkdf-sha256"),
  ikmHex: Schema.String,
  saltHex: Schema.optional(Schema.String),
  infoHex: Schema.String,
  length: Schema.Number,
  expectedHex: Schema.String
})

const HmacHkdfFixtureSchema = Schema.parseJson(Schema.Union(HmacFixtureSchema, HkdfFixtureSchema))

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

describe("external conformance — fixture governance", () => {
  it.effect("requires explicit provenance metadata for every fixture source", () =>
    Effect.gen(function*() {
      const content = yield* readExternalFixture("sources.manifest.json")
      const manifest = yield* Schema.decodeUnknown(GovernedManifestSchema)(content).pipe(Effect.orDie)

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
