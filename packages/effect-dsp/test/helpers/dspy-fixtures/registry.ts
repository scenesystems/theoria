import { Context, Effect, Layer, Option } from "effect"

import { FixtureNotFoundError, type FixtureRegistryError } from "./errors.js"
import { directoryBeside, findManifestEntry, loadFixtureByEntry, loadManifest } from "./io.js"
import type { FixtureName, KnownFixture } from "./schemas.js"

const defaultRootDirectory = directoryBeside(import.meta.url, "../../fixtures/dspy/")
const DEFAULT_MANIFEST_FILE = "manifest.json"

class FixtureRegistry extends Context.Tag("effect-dsp/test/helpers/DspyFixtureRegistry")<
  FixtureRegistry,
  {
    readonly load: (
      name: FixtureName
    ) => Effect.Effect<KnownFixture, FixtureRegistryError>
  }
>() {}

const makeFixtureRegistry = (
  options: {
    readonly rootDirectory: string
    readonly manifestFileName?: string
  }
) => {
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

  return {
    load
  }
}

const FixtureRegistryLive = Layer.effect(
  FixtureRegistry,
  Effect.map(defaultRootDirectory, (rootDirectory) => makeFixtureRegistry({ rootDirectory }))
)

const loadFixtureFromRegistry = (
  name: FixtureName
): Effect.Effect<KnownFixture, FixtureRegistryError, FixtureRegistry> =>
  Effect.flatMap(FixtureRegistry, (registry) => registry.load(name))

export const loadFixture = (
  name: FixtureName
): Effect.Effect<KnownFixture, FixtureRegistryError> =>
  loadFixtureFromRegistry(name).pipe(Effect.provide(FixtureRegistryLive))
