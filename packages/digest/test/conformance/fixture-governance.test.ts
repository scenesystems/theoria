/**
 * External fixture governance contract (RED-first).
 *
 * This suite defines the target-state requirement that every fixture source has
 * explicit provenance metadata and schema-valid payloads.
 */

import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Schema } from "effect"
import { validateFixtureByKind } from "../../scripts/fixture-contract.js"
import { FixtureManifestSchema } from "../../scripts/fixture-schemas.js"
import { loadExternalFixtureManifest, readExternalFixture } from "./helpers/externalFixtures.js"

const EXPECTED_SOURCE_IDS = [
  "blake3-official-vectors",
  "cyberphone-jcs-corpus",
  "local-malformed-unicode-adversarial",
  "nist-cavp-sha256-short-message",
  "python-runtime-parity-generated",
  "rfc2202-hmac-sha1",
  "rfc4231-hmac-sha256",
  "rfc5869-hkdf-sha256",
  "rfc8785-canonicalization",
  "rust-runtime-parity-generated",
  "wycheproof-hkdf-sha512"
]

describe("external conformance — fixture governance", () => {
  it.effect("requires explicit provenance metadata for every fixture source", () =>
    Effect.gen(function*() {
      const content = yield* readExternalFixture("sources.manifest.json")
      const manifest = yield* Schema.decodeUnknown(FixtureManifestSchema)(content, {
        onExcessProperty: "error"
      }).pipe(Effect.orDie)

      expect(manifest.sources.map(({ id }) => id).sort()).toEqual(EXPECTED_SOURCE_IDS)
      Arr.forEach(manifest.sources, (source) => {
        expect(source.sourceLocator.length).toBeGreaterThan(0)
        expect(source.sourcePaths.length).toBeGreaterThan(0)
        expect(source.sourceSelectors.length).toBeGreaterThan(0)
        expect(source.licenseUrl).toMatch(/^https:\/\//)
        expect(source.sourceNotice.length).toBeGreaterThan(0)
        expect("normalizationNotes" in source).toBe(false)

        if (source.origin === "external" && source.sourceLocator.includes("github.com")) {
          expect(source.sourceLocator).toContain(source.revision)
        }
      })
    }).pipe(Effect.provide(BunContext.layer)))

  it.effect("keeps external fixture payloads schema-valid by source kind", () =>
    Effect.gen(function*() {
      const manifest = yield* loadExternalFixtureManifest
      yield* Effect.forEach(manifest.sources, (source) =>
        readExternalFixture(source.fixturePath).pipe(
          Effect.flatMap((content) => validateFixtureByKind(source.kind, content)),
          Effect.orDie
        ))

      expect(Arr.dedupe(Arr.map(manifest.sources, ({ kind }) => kind)).sort()).toEqual([
        "blake3",
        "hash",
        "hkdf",
        "hmac",
        "jcs",
        "parity-runtime",
        "unicode-adversarial"
      ])
    }).pipe(Effect.provide(BunContext.layer)))
})
