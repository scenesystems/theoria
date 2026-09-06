import { Context, Effect, Layer, Option } from "effect"

import { FixtureNotFoundError, type FixtureRegistryError } from "./errors.js"
import { directoryBeside, findManifestEntry, loadFixtureByEntry, loadManifest } from "./io.js"
import type { FixtureName, KnownFixture } from "./schemas.js"

const defaultRootDirectory = directoryBeside(import.meta.url, "../../fixtures/scipy/")
const DEFAULT_MANIFEST_FILE = "manifest.json"

export class FixtureRegistry extends Context.Tag("effect-math/test/helpers/FixtureRegistry")<
  FixtureRegistry,
  {
    readonly load: (
      name: FixtureName
    ) => Effect.Effect<KnownFixture, FixtureRegistryError>
    readonly validateManifest: Effect.Effect<void, FixtureRegistryError>
  }
>() {}

export const makeFixtureRegistry = (
  options: {
    readonly rootDirectory: string
    readonly manifestFileName?: string
  }
): Context.Tag.Service<FixtureRegistry> => {
  const rootDirectory = options.rootDirectory
  const manifestFileName = options.manifestFileName ?? DEFAULT_MANIFEST_FILE

  const load = (name: FixtureName): Effect.Effect<KnownFixture, FixtureRegistryError> =>
    Effect.gen(function*() {
      const manifest = yield* loadManifest(rootDirectory, manifestFileName)
      const entry = findManifestEntry(manifest, name)

      return yield* Option.match(entry, {
        onNone: () =>
          Effect.fail(
            new FixtureNotFoundError({
              fixture: name
            })
          ),
        onSome: (value) => loadFixtureByEntry(rootDirectory, value)
      })
    })

  const validateManifest = Effect.gen(function*() {
    const manifest = yield* loadManifest(rootDirectory, manifestFileName)
    yield* Effect.forEach(manifest.fixtures, (entry) =>
      loadFixtureByEntry(rootDirectory, entry).pipe(
        Effect.asVoid
      ))
  })

  return {
    load,
    validateManifest
  }
}

export const FixtureRegistryLive = Layer.effect(
  FixtureRegistry,
  Effect.map(defaultRootDirectory, (rootDirectory) => makeFixtureRegistry({ rootDirectory }))
)

export const loadFixture = (
  name: FixtureName
): Effect.Effect<KnownFixture, FixtureRegistryError, FixtureRegistry> =>
  Effect.flatMap(FixtureRegistry, (registry) => registry.load(name))

export const validateFixtureManifest: Effect.Effect<void, FixtureRegistryError, FixtureRegistry> = Effect.flatMap(
  FixtureRegistry,
  (registry) => registry.validateManifest
)
