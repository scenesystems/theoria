/**
 * External JCS conformance contract (RED-first).
 *
 * This suite defines the target-state requirement that RFC 8785 and
 * cyberphone corpus fixtures are ingested from checked-in external manifests.
 */

import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Schema } from "effect"
import { JcsFixtureSchema, UnicodeAdversarialFixtureSchema } from "../../scripts/fixture-schemas.js"
import { canonicalize } from "../../src/canonicalize.js"
import {
  loadExternalFixtureManifest,
  readExternalFixture,
  selectExternalSourcesByKind
} from "./helpers/externalFixtures.js"
import { expectStringMatch } from "./helpers/mismatchDiagnostics.js"

describe("external conformance — jcs", () => {
  it.effect("pins RFC 8785 and cyberphone corpus fixture sources", () =>
    Effect.gen(function*() {
      const manifest = yield* loadExternalFixtureManifest
      const ids = Arr.map(manifest.sources, (source) => source.id)

      expect(ids).toContain("rfc8785-canonicalization")
      expect(ids).toContain("cyberphone-jcs-corpus")
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("canonicalizes every external jcs fixture exactly", () =>
    Effect.gen(function*() {
      const manifest = yield* loadExternalFixtureManifest
      const jcsSources = Arr.filter(manifest.sources, (source) => source.kind === "jcs")

      expect(jcsSources.length).toBeGreaterThan(0)

      const fixtures = yield* Effect.forEach(jcsSources, (source) =>
        readExternalFixture(source.fixturePath).pipe(
          Effect.flatMap((content) => Schema.decodeUnknown(JcsFixtureSchema)(content).pipe(Effect.orDie)),
          Effect.map((fixture) => ({
            source,
            fixture
          }))
        ))

      yield* Effect.forEach(fixtures, ({ source, fixture }) =>
        Effect.forEach(fixture.cases, (vector) =>
          Effect.gen(function*() {
            const canonical = yield* canonicalize(vector.input)
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

      expect(Arr.flatMap(fixtures, ({ fixture }) =>
        fixture.cases)).toHaveLength(32)
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("rejects every local malformed-Unicode key and value verdict", () =>
    Effect.gen(function*() {
      const manifest = yield* loadExternalFixtureManifest
      const sources = selectExternalSourcesByKind(manifest, "unicode-adversarial")
      const fixtures = yield* Effect.forEach(sources, (source) =>
        readExternalFixture(source.fixturePath).pipe(
          Effect.flatMap((content) =>
            Schema.decodeUnknown(UnicodeAdversarialFixtureSchema)(content, {
              onExcessProperty: "error"
            }).pipe(Effect.orDie)
          )
        ))

      const cases = Arr.flatMap(fixtures, ({ cases }) => cases)
      yield* Effect.forEach(cases, (vector) =>
        Effect.gen(function*() {
          const input = vector.target === "key" ? { [vector.input]: "value" } : vector.input
          const error = yield* Effect.flip(canonicalize(input))

          expect(error).toMatchObject({
            _tag: vector.expectedTag,
            codeUnitIndex: vector.expectedCodeUnitIndex
          })
        }))

      expect(cases).toHaveLength(6)
    }).pipe(Effect.provide(BunContext.layer)))
})
