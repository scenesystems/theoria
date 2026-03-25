/**
 * External conformance fixture loading helpers.
 *
 * These helpers define the target-state fixture contract for cross-language
 * parity work. RED tests consume this loader before fixtures are populated.
 */

import { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Effect, Schema } from "effect"
import { FixtureKindSchema, FixtureManifestSchema, FixtureSourceSchema } from "../../../scripts/fixture-schemas.js"

export const ExternalFixtureKindSchema = FixtureKindSchema
export const ExternalFixtureSourceSchema = FixtureSourceSchema
export const ExternalFixtureManifestSchema = FixtureManifestSchema

export type ExternalFixtureKind = Schema.Schema.Type<typeof ExternalFixtureKindSchema>
export type ExternalFixtureSource = Schema.Schema.Type<typeof ExternalFixtureSourceSchema>
export type ExternalFixtureManifest = Schema.Schema.Type<typeof ExternalFixtureManifestSchema>

const fixtureRootUrl = new URL("../../fixtures/external/", import.meta.url)

const resolveFixtureRoot: Effect.Effect<string, never, Path.Path> = Effect.gen(function*() {
  const path = yield* Path.Path
  return yield* path.fromFileUrl(fixtureRootUrl).pipe(Effect.orDie)
})

export const readExternalFixture = (
  relativePath: string
): Effect.Effect<string, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* resolveFixtureRoot
    return yield* fileSystem.readFileString(path.join(root, relativePath)).pipe(Effect.orDie)
  })

export const loadExternalFixtureManifest = readExternalFixture("sources.manifest.json").pipe(
  Effect.flatMap((content) => Schema.decodeUnknown(ExternalFixtureManifestSchema)(content).pipe(Effect.orDie))
)

export const selectExternalSourcesByKind = (
  manifest: ExternalFixtureManifest,
  kind: ExternalFixtureKind
): ReadonlyArray<ExternalFixtureSource> => Arr.filter(manifest.sources, (source) => source.kind === kind)
