/**
 * CanonicalJson conformance against RFC 8785 and cyberphone corpus fixtures.
 */

import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import * as CanonicalJson from "@scenesystems/digest/CanonicalJson"
import { Array as Arr, Effect, Match, Record, Schema, Tuple } from "effect"

import * as Fixtures from "../../scripts/fixtures.js"
import { expectStringMatch } from "../helpers/mismatchDiagnostics.js"

describe("CanonicalJson external conformance", () => {
  it.effect("canonicalizes every external jcs fixture exactly", () =>
    Effect.gen(function*() {
      const manifest = yield* Fixtures.loadManifest
      const jcsSources = Fixtures.sourcesOfKind(manifest, "jcs")

      const fixtures = yield* Effect.forEach(jcsSources, (source) =>
        Fixtures.read(source.fixturePath).pipe(
          Effect.flatMap(Schema.decodeUnknown(Fixtures.CanonicalJson)),
          Effect.map((fixture) => Tuple.make(source, fixture))
        ))

      yield* Effect.forEach(fixtures, ([source, fixture]) =>
        Effect.forEach(fixture.cases, (vector) =>
          Effect.gen(function*() {
            const canonical = yield* CanonicalJson.encode(vector.input)
            expectStringMatch(
              vector.id,
              "jcs",
              source.id,
              source.sourceLocator,
              source.fixturePath,
              canonical,
              vector.expectedCanonical
            )
          })))
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("rejects every local malformed-Unicode key and value verdict", () =>
    Effect.gen(function*() {
      const manifest = yield* Fixtures.loadManifest
      const sources = Fixtures.sourcesOfKind(manifest, "unicode-adversarial")
      const fixtures = yield* Effect.forEach(sources, (source) =>
        Fixtures.read(source.fixturePath).pipe(
          Effect.flatMap((content) =>
            Schema.decodeUnknown(Fixtures.UnicodeAdversarial)(content, {
              onExcessProperty: "error"
            })
          )
        ))

      const cases = Arr.flatMap(fixtures, ({ cases }) => cases)
      yield* Effect.forEach(cases, (vector) =>
        Effect.gen(function*() {
          const input = Match.value(vector.target).pipe(
            Match.when("key", () => Record.singleton(vector.input, "value")),
            Match.when("value", () => vector.input),
            Match.exhaustive
          )
          const error = yield* Effect.flip(CanonicalJson.encode(input))

          expect(error).toMatchObject({
            _tag: vector.expectedTag,
            codeUnitIndex: vector.expectedCodeUnitIndex
          })
        }))
    }).pipe(Effect.provide(BunContext.layer)))
})
