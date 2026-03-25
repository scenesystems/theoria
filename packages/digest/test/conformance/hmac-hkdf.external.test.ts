/**
 * External HMAC/HKDF conformance contract (RED-first).
 *
 * This suite defines the target-state requirement that RFC 4231 and RFC 5869
 * vectors are consumed from external fixture corpora.
 */

import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"
import { toHex } from "../../src/encoding.js"
import { hmacSha256 } from "../../src/hmac.js"
import { hkdfSha256 } from "../../src/kdf.js"
import { hexToBytes } from "../helpers/bytes.js"
import {
  loadExternalFixtureManifest,
  readExternalFixture,
  selectExternalSourcesByKind
} from "./helpers/externalFixtures.js"
import { expectStringMatch } from "./helpers/mismatchDiagnostics.js"

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

describe("external conformance — hmac-hkdf", () => {
  it.effect("pins external corpus for RFC 4231 and RFC 5869 fixtures", () =>
    Effect.gen(function*() {
      const manifest = yield* loadExternalFixtureManifest
      const sources = selectExternalSourcesByKind(manifest, "hmac-hkdf")

      expect(sources.length).toBeGreaterThan(0)
      expect(sources.some((source) => source.id.includes("rfc4231"))).toBe(true)
      expect(sources.some((source) => source.id.includes("rfc5869"))).toBe(true)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("matches expected outputs for every external hmac/hkdf fixture", () =>
    Effect.gen(function*() {
      const manifest = yield* loadExternalFixtureManifest
      const sources = selectExternalSourcesByKind(manifest, "hmac-hkdf")

      expect(sources.length).toBeGreaterThan(0)

      const fixtures = yield* Effect.forEach(sources, (source) =>
        readExternalFixture(source.fixturePath).pipe(
          Effect.flatMap((content) => Schema.decodeUnknown(HmacHkdfFixtureSchema)(content).pipe(Effect.orDie)),
          Effect.map((fixture) => ({
            source,
            fixture
          }))
        ))

      yield* Effect.forEach(fixtures, ({ source, fixture }) =>
        fixture.operation === "hmac-sha256"
          ? Effect.gen(function*() {
            const result = yield* hmacSha256(hexToBytes(fixture.keyHex), hexToBytes(fixture.messageHex))
            const resultHex = toHex(result)

            expectStringMatch(
              fixture.id,
              fixture.operation,
              source.id,
              source.sourceUrl,
              source.fixturePath,
              resultHex,
              fixture.expectedHex
            )
          })
          : Effect.gen(function*() {
            const result = yield* hkdfSha256(
              hexToBytes(fixture.ikmHex),
              Option.fromNullable(fixture.saltHex).pipe(Option.map(hexToBytes)),
              hexToBytes(fixture.infoHex),
              fixture.length
            )
            const resultHex = toHex(result)

            expectStringMatch(
              fixture.id,
              fixture.operation,
              source.id,
              source.sourceUrl,
              source.fixturePath,
              resultHex,
              fixture.expectedHex
            )
          }))
    }).pipe(Effect.provide(BunContext.layer)))
})
