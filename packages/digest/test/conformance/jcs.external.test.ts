/**
 * External JCS conformance contract (RED-first).
 *
 * This suite defines the target-state requirement that RFC 8785 and
 * cyberphone corpus fixtures are ingested from checked-in external manifests.
 */

import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Schema } from "effect"
import { JcsFixtureSchema } from "../../scripts/fixture-schemas.js"
import { canonicalize } from "../../src/canonicalize.js"
import { loadExternalFixtureManifest, readExternalFixture } from "./helpers/externalFixtures.js"
import { expectStringMatch } from "./helpers/mismatchDiagnostics.js"

describe("external conformance — jcs", () => {
  it.effect("pins RFC 8785 and cyberphone corpus fixture sources", () =>
    Effect.gen(function*() {
      const manifest = yield* loadExternalFixtureManifest
      const ids = Arr.map(manifest.sources, (source) => source.id)

      expect(ids).toContain("rfc8785-appendix")
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
        Effect.gen(function*() {
          const canonical = yield* canonicalize(fixture.input)
          expectStringMatch(
            fixture.id,
            "jcs",
            source.id,
            source.sourceUrl,
            source.fixturePath,
            canonical,
            fixture.expectedCanonical
          )
        }))
    }).pipe(Effect.provide(BunContext.layer)))
})
