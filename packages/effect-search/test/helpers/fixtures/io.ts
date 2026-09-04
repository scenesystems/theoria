import { FileSystem, Path, Url } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { Effect, Option, Schema } from "effect"

import {
  FixtureFileReadError,
  FixtureMalformedJsonError,
  FixtureManifestDecodeError,
  FixtureManifestReadError,
  type FixtureRegistryError,
  FixtureSchemaDecodeError
} from "./errors.js"
import { FixtureManifestSchema, KnownFixtureSchema } from "./schemas.js"
import type { FixtureManifest, FixtureManifestEntrySchema, FixtureName, KnownFixture } from "./schemas.js"

const decodeJsonUnknown = Schema.decodeUnknown(Schema.parseJson(Schema.Unknown))

/** The directory `relative` names beside the module at `moduleUrl`, as a filesystem path. */
export const directoryBeside = (moduleUrl: string, relative: string): Effect.Effect<string> =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const url = yield* Url.fromString(relative, moduleUrl)
    return yield* path.fromFileUrl(url)
  }).pipe(Effect.orDie, Effect.provide(BunContext.layer))

/** Reads `file` under `rootDirectory`, returning the text and the path it was read from. */
const readText = <E>(
  rootDirectory: string,
  file: string,
  onError: (path: string, cause: unknown) => E
): Effect.Effect<{ readonly path: string; readonly raw: string }, E> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const filePath = path.join(rootDirectory, file)
    const raw = yield* fileSystem.readFileString(filePath).pipe(Effect.mapError((cause) => onError(filePath, cause)))

    return { path: filePath, raw }
  }).pipe(Effect.provide(BunContext.layer))

const parseJson = (
  path: string,
  raw: string
): Effect.Effect<unknown, FixtureMalformedJsonError> =>
  decodeJsonUnknown(raw).pipe(
    Effect.mapError(
      (cause) =>
        new FixtureMalformedJsonError({
          path,
          cause
        })
    )
  )

const decodeManifest = (
  path: string,
  payload: unknown
): Effect.Effect<FixtureManifest, FixtureManifestDecodeError> =>
  Schema.decodeUnknown(FixtureManifestSchema)(payload).pipe(
    Effect.mapError(
      (cause) =>
        new FixtureManifestDecodeError({
          path,
          cause
        })
    )
  )

export const loadManifest = (
  rootDirectory: string,
  manifestFileName: string
): Effect.Effect<FixtureManifest, FixtureRegistryError> =>
  Effect.gen(function*() {
    const { path, raw } = yield* readText(
      rootDirectory,
      manifestFileName,
      (path, cause) => new FixtureManifestReadError({ path, cause })
    )
    const parsed = yield* parseJson(path, raw)

    return yield* decodeManifest(path, parsed)
  })

export const findManifestEntry = (
  manifest: FixtureManifest,
  name: FixtureName
): Option.Option<Schema.Schema.Type<typeof FixtureManifestEntrySchema>> =>
  Option.fromNullable(manifest.fixtures.find((entry) => entry.name === name))

const decodeFixture = (
  fixtureName: FixtureName,
  path: string,
  payload: unknown
): Effect.Effect<KnownFixture, FixtureSchemaDecodeError> =>
  Schema.decodeUnknown(KnownFixtureSchema)(payload).pipe(
    Effect.mapError(
      (cause) =>
        new FixtureSchemaDecodeError({
          fixture: fixtureName,
          path,
          cause
        })
    ),
    Effect.flatMap((fixture) =>
      fixture.fixture === fixtureName
        ? Effect.succeed(fixture)
        : Effect.fail(
          new FixtureSchemaDecodeError({
            fixture: fixtureName,
            path,
            cause: `Fixture name mismatch: expected ${fixtureName}, received ${fixture.fixture}`
          })
        )
    )
  )

export const loadFixtureByEntry = (
  rootDirectory: string,
  entry: Schema.Schema.Type<typeof FixtureManifestEntrySchema>
): Effect.Effect<KnownFixture, FixtureRegistryError> =>
  Effect.gen(function*() {
    const { path, raw } = yield* readText(
      rootDirectory,
      entry.file,
      (path, cause) => new FixtureFileReadError({ path, cause })
    )
    const parsed = yield* parseJson(path, raw)

    return yield* decodeFixture(entry.name, path, parsed)
  })
