import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { unseal } from "../../src/seal.js"
import { decodeDeterministicInput, loadInteropFixture, loadInteropManifest } from "../helpers/interopFixtures.js"

describe("interop/runtime-fixtures", () => {
  it.effect("decrypts committed runtime fixtures for every supported algorithm", () =>
    Effect.gen(function*() {
      const manifest = yield* loadInteropManifest

      yield* Effect.forEach(
        manifest.fixtures,
        (entry) =>
          Effect.gen(function*() {
            const fixture = yield* loadInteropFixture(entry)
            const deterministicInput = yield* decodeDeterministicInput(fixture)
            const plaintext = yield* unseal(
              deterministicInput.key,
              fixture.envelope,
              deterministicInput.associatedData
            )

            expect(fixture.algorithm).toBe(entry.algorithm)
            expect(plaintext).toEqual(deterministicInput.plaintext)
          }),
        { discard: true }
      )
    }).pipe(Effect.provide(BunContext.layer)))
})
