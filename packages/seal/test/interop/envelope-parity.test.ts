import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"

import { loadInteropFixture, loadInteropManifest, runtimeFixtureEnvelope } from "../helpers/interopFixtures.js"

describe("interop/envelope-parity", () => {
  it.effect("reconstructs the released envelope wire format from deterministic runtime fixtures", () =>
    Effect.gen(function*() {
      const manifest = yield* loadInteropManifest

      yield* Effect.forEach(
        manifest.fixtures,
        (entry) =>
          Effect.gen(function*() {
            const fixture = yield* loadInteropFixture(entry)
            const envelope = yield* runtimeFixtureEnvelope(fixture)

            expect(envelope).toEqual(fixture.envelope)
          }),
        { discard: true }
      )
    }).pipe(Effect.provide(BunContext.layer)))
})
