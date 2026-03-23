import { Context, Effect, Layer, Option } from "effect"

import { FixtureNotFoundError, type FixtureRegistryError } from "./errors.js"
import { findManifestEntry, loadFixtureByEntry, loadManifest } from "./io.js"
import type { FixtureName, KnownFixture } from "./schemas.js"

const FIXTURE_ROOT_URL = new URL("../../fixtures/optuna/", import.meta.url)
const DEFAULT_MANIFEST_FILE = "manifest.json"

// eslint-disable-next-line no-restricted-syntax
export type FixtureRegistryService = {
  readonly load: (
    name: FixtureName
  ) => Effect.Effect<KnownFixture, FixtureRegistryError>
  readonly loadAll: (
    namespace: string
  ) => Effect.Effect<Array<KnownFixture>, FixtureRegistryError>
  readonly validateManifest: Effect.Effect<void, FixtureRegistryError>
}

export class FixtureRegistry extends Context.Tag("effect-search/test/helpers/FixtureRegistry")<
  FixtureRegistry,
  FixtureRegistryService
>() {}

// eslint-disable-next-line no-restricted-syntax
export type FixtureRegistryOptions = {
  readonly rootUrl?: URL
  readonly manifestFileName?: string
}

export const makeFixtureRegistry = (
  options: FixtureRegistryOptions = {}
): FixtureRegistryService => {
  const rootUrl = options.rootUrl ?? FIXTURE_ROOT_URL
  const manifestFileName = options.manifestFileName ?? DEFAULT_MANIFEST_FILE

  const load = (name: FixtureName): Effect.Effect<KnownFixture, FixtureRegistryError> =>
    Effect.gen(function*() {
      const manifest = yield* loadManifest(rootUrl, manifestFileName)
      const entry = findManifestEntry(manifest, name)

      return yield* Option.match(entry, {
        onNone: () =>
          Effect.fail(
            new FixtureNotFoundError({
              fixture: name
            })
          ),
        onSome: (value) => loadFixtureByEntry(rootUrl, value)
      })
    })

  const loadAll = (
    namespace: string
  ): Effect.Effect<Array<KnownFixture>, FixtureRegistryError> =>
    Effect.gen(function*() {
      const manifest = yield* loadManifest(rootUrl, manifestFileName)
      const entries = manifest.fixtures.filter((entry) => entry.name.startsWith(namespace))

      return yield* Effect.forEach(entries, (entry) => loadFixtureByEntry(rootUrl, entry))
    })

  const validateManifest = Effect.gen(function*() {
    const manifest = yield* loadManifest(rootUrl, manifestFileName)
    yield* Effect.forEach(manifest.fixtures, (entry) =>
      loadFixtureByEntry(rootUrl, entry).pipe(
        Effect.asVoid
      ))
  })

  return {
    load,
    loadAll,
    validateManifest
  }
}

export const FixtureRegistryLive = Layer.succeed(FixtureRegistry, makeFixtureRegistry())

export const loadFixture = (
  name: FixtureName
): Effect.Effect<KnownFixture, FixtureRegistryError, FixtureRegistry> =>
  Effect.flatMap(FixtureRegistry, (registry) => registry.load(name))

export const loadAllFixtures = (
  namespace: string
): Effect.Effect<Array<KnownFixture>, FixtureRegistryError, FixtureRegistry> =>
  Effect.flatMap(FixtureRegistry, (registry) => registry.loadAll(namespace))

export const validateFixtureManifest: Effect.Effect<void, FixtureRegistryError, FixtureRegistry> = Effect.flatMap(
  FixtureRegistry,
  (registry) => registry.validateManifest
)
