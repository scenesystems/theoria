import { describe, expect, it } from "@effect/vitest"
import { Effect, Match } from "effect"

import { loadFixtureByEntry, loadManifest } from "../helpers/fixtures/io.js"
import { makeFixtureRegistry } from "../helpers/fixtures/registry.js"

const scipyRootUrl = new URL("../fixtures/scipy/", import.meta.url)

describe("fixture authority", () => {
  it.effect("loads every committed SciPy fixture through the shared registry with hash-pinned manifest truth", () =>
    Effect.gen(function*() {
      const manifest = yield* loadManifest(scipyRootUrl, "manifest.json")
      const registry = makeFixtureRegistry({ rootUrl: scipyRootUrl })

      yield* registry.validateManifest

      const fixtures = yield* Effect.forEach(manifest.fixtures, (entry) => registry.load(entry.name))

      expect(fixtures.length).toStrictEqual(manifest.fixtures.length)
      expect(manifest.fixtures.every((entry) => entry.hash.startsWith("blake3-256:"))).toStrictEqual(true)
    }))

  it.effect("rejects manifest drift when a fixture hash no longer matches the payload", () =>
    Effect.gen(function*() {
      const manifest = yield* loadManifest(scipyRootUrl, "manifest.json")
      const entry = yield* Effect.fromNullable(manifest.fixtures[0]).pipe(Effect.orDie)
      const drifted = yield* Effect.either(
        loadFixtureByEntry(scipyRootUrl, {
          ...entry,
          hash: "blake3-256:manifest-drift"
        })
      )

      expect(
        Match.value(drifted).pipe(
          Match.tag("Left", ({ left }) => left._tag === "FixtureHashMismatchError"),
          Match.tag("Right", () => false),
          Match.exhaustive
        )
      ).toStrictEqual(true)
    }))
})
