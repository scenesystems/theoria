/** External HMAC conformance against checked-in RFC corpora. */

import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Encoding, Schema } from "effect"

import { HmacFixtureSchema } from "../../scripts/fixture-schemas.js"
import * as Hmac from "../../src/Hmac.js"
import {
  loadExternalFixtureManifest,
  readExternalFixture,
  selectExternalSourcesByKind
} from "../conformance/helpers/externalFixtures.js"
import { expectStringMatch } from "../conformance/helpers/mismatchDiagnostics.js"
import { hexToBytes } from "../helpers/bytes.js"

describe("Hmac external conformance", () => {
  it.effect("matches all seven RFC cases for HMAC-SHA1 and HMAC-SHA256", () =>
    Effect.gen(function*() {
      const manifest = yield* loadExternalFixtureManifest
      const sources = selectExternalSourcesByKind(manifest, "hmac")
      const fixtures = yield* Effect.forEach(sources, (source) =>
        readExternalFixture(source.fixturePath).pipe(
          Effect.flatMap(Schema.decodeUnknown(HmacFixtureSchema, { onExcessProperty: "error" })),
          Effect.map((fixture) => ({ fixture, source }))
        ))

      yield* Effect.forEach(fixtures, ({ fixture, source }) =>
        Effect.forEach(fixture.cases, (vector) =>
          Effect.sync(() => {
            const key = hexToBytes(vector.keyHex)
            const message = hexToBytes(vector.messageHex)
            const result = fixture.algorithm === "hmac-sha1"
              ? Hmac.sha1(key, message)
              : Hmac.sha256(key, message)
            const actual = Encoding.encodeHex(result.slice(0, vector.outputLength))

            expect(vector.expectedHex).toHaveLength(vector.outputLength * 2)
            expectStringMatch(
              vector.id,
              fixture.algorithm,
              source.id,
              source.sourceLocator,
              source.fixturePath,
              actual,
              vector.expectedHex
            )
          })))
    }).pipe(Effect.provide(BunContext.layer)))
})
