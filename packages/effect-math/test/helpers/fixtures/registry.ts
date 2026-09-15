import { Effect, Option } from "effect"

import { FixtureNotFoundError } from "./errors.js"
import { directoryBeside, findManifestEntry, loadFixtureByEntry, loadManifest } from "./io.js"
import type { FixtureName } from "./schemas.js"

const defaultRootDirectory = directoryBeside(import.meta.url, "../../fixtures/scipy/")
const DEFAULT_MANIFEST_FILE = "manifest.json"

export const loadFixture = (
  name: FixtureName
) =>
  Effect.gen(function*() {
    const rootDirectory = yield* defaultRootDirectory
    const manifest = yield* loadManifest(rootDirectory, DEFAULT_MANIFEST_FILE)
    return yield* Option.match(findManifestEntry(manifest, name), {
      onNone: () => Effect.fail(new FixtureNotFoundError({ fixture: name })),
      onSome: (entry) => loadFixtureByEntry(rootDirectory, entry)
    })
  })

export const validateFixtureManifest = Effect.gen(function*() {
  const rootDirectory = yield* defaultRootDirectory
  const manifest = yield* loadManifest(rootDirectory, DEFAULT_MANIFEST_FILE)
  yield* Effect.forEach(manifest.fixtures, (entry) => loadFixtureByEntry(rootDirectory, entry), { discard: true })
})
