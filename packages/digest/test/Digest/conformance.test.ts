import { Hex } from "effect/encoding"
/** SHA-256 conformance against the checked-in NIST CAVP corpus. */

import { BunServices } from "@effect/platform-bun"
import { describe, it } from "@effect/vitest"
import * as Digest from "@scenesystems/digest/Digest"
import { Effect, Schema } from "effect"

import * as Fixtures from "../../scripts/fixtures.js"
import { hexToBytes } from "../helpers/bytes.js"
import { expectStringMatch } from "../helpers/mismatchDiagnostics.js"

describe("Digest external conformance", () => {
  it.effect("matches every NIST CAVP SHA-256 short-message output", () =>
    Effect.gen(function*() {
      const manifest = yield* Fixtures.loadManifest
      const sources = Fixtures.sourcesOfKind(manifest, "hash")
      const fixtures = yield* Effect.forEach(sources, (source) =>
        Fixtures.read(source.fixturePath).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(Fixtures.Digest, { onExcessProperty: "error" })),
          Effect.map((fixture) => ({ fixture, source }))
        ))

      yield* Effect.forEach(fixtures, ({ fixture, source }) =>
        Effect.forEach(fixture.cases, (vector) =>
          Effect.sync(() =>
            expectStringMatch(
              vector.id,
              fixture.algorithm,
              source.id,
              source.sourceLocator,
              source.fixturePath,
              Hex.encode(Digest.hash("sha256", hexToBytes(vector.inputHex))),
              vector.expectedHex
            )
          )))
    }).pipe(Effect.provide(BunServices.layer)))
})
