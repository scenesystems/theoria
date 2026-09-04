import { Context, Effect, Layer, Option } from "effect"

import { FixtureNotFoundError, type FixtureRegistryError } from "./errors.js"
import { directoryBeside, findManifestEntry, loadFixtureByEntry, loadManifest } from "./io.js"
import type { FixtureName, KnownFixture } from "./schemas.js"

const defaultRootDirectory = directoryBeside(import.meta.url, "../../fixtures/dspy/")
const DEFAULT_MANIFEST_FILE = "manifest.json"

export class FixtureRegistry extends Context.Tag("effect-dsp/test/helpers/DspyFixtureRegistry")<
  FixtureRegistry,
  {
    readonly load: (
      name: FixtureName
    ) => Effect.Effect<KnownFixture, FixtureRegistryError>
    readonly loadAll: (
      namespace: string
    ) => Effect.Effect<Array<KnownFixture>, FixtureRegistryError>
    readonly validateManifest: Effect.Effect<void, FixtureRegistryError>
  }
>() {}

export const makeFixtureRegistry = (
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

  const loadAll = (
    namespace: string
  ): Effect.Effect<Array<KnownFixture>, FixtureRegistryError> =>
    Effect.gen(function*() {
      const manifest = yield* loadManifest(rootDirectory, manifestFileName)
      const entries = manifest.fixtures.filter((entry) => entry.name.startsWith(namespace))

      return yield* Effect.forEach(entries, (entry) => loadFixtureByEntry(rootDirectory, entry))
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
    loadAll,
    validateManifest
  }
}

export const FixtureRegistryLive = Layer.effect(
  FixtureRegistry,
  Effect.map(defaultRootDirectory, (rootDirectory) => makeFixtureRegistry({ rootDirectory }))
)

const loadFixtureFromRegistry = (
  name: FixtureName
): Effect.Effect<KnownFixture, FixtureRegistryError, FixtureRegistry> =>
  Effect.flatMap(FixtureRegistry, (registry) => registry.load(name))

const loadAllFixturesFromRegistry = (
  namespace: string
): Effect.Effect<Array<KnownFixture>, FixtureRegistryError, FixtureRegistry> =>
  Effect.flatMap(FixtureRegistry, (registry) => registry.loadAll(namespace))

const validateFixtureManifestFromRegistry: Effect.Effect<void, FixtureRegistryError, FixtureRegistry> = Effect.flatMap(
  FixtureRegistry,
  (registry) => registry.validateManifest
)

export const loadFixture = (
  name: FixtureName
): Effect.Effect<KnownFixture, FixtureRegistryError> =>
  loadFixtureFromRegistry(name).pipe(Effect.provide(FixtureRegistryLive))

export const loadAllFixtures = (
  namespace: string
): Effect.Effect<Array<KnownFixture>, FixtureRegistryError> =>
  loadAllFixturesFromRegistry(namespace).pipe(Effect.provide(FixtureRegistryLive))

export const validateFixtureManifest: Effect.Effect<void, FixtureRegistryError> = validateFixtureManifestFromRegistry
  .pipe(Effect.provide(FixtureRegistryLive))
