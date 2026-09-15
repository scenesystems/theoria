import { FileSystem, Path, Url } from "@effect/platform"
import type { PlatformError } from "@effect/platform/Error"
import { Array, Effect, type Option, Schema, String, Tuple } from "effect"

import {
  FixtureFileReadError,
  FixtureMalformedJsonError,
  FixtureManifestDecodeError,
  FixtureManifestReadError,
  FixtureRootResolutionError,
  FixtureSchemaDecodeError
} from "./errors.js"
import { FixtureManifestSchema, KnownFixtureSchema } from "./schemas.js"
import type { FixtureManifest, FixtureManifestEntrySchema, FixtureName, KnownFixture } from "./schemas.js"

const decodeJsonUnknown = Schema.decodeUnknown(Schema.parseJson(Schema.Unknown))

/** The directory `relative` names beside the module at `moduleUrl`, as a filesystem path. */
export const directoryBeside = (moduleUrl: string, relative: string) =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const url = yield* Url.fromString(relative, moduleUrl).pipe(
      Effect.mapError((cause) => new FixtureRootResolutionError({ moduleUrl, relative, cause }))
    )
    return yield* path.fromFileUrl(url).pipe(
      Effect.mapError((cause) => new FixtureRootResolutionError({ moduleUrl, relative, cause }))
    )
  })

/** Reads `file` under `rootDirectory`, returning the text and the path it was read from. */
const readText = <E>(
  rootDirectory: string,
  file: string,
  onError: (path: string, cause: PlatformError) => E
) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const filePath = path.join(rootDirectory, file)
    const raw = yield* fileSystem.readFileString(filePath).pipe(Effect.mapError((cause) => onError(filePath, cause)))

    return Tuple.make(filePath, raw)
  })

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
  Schema.decodeUnknown(FixtureManifestSchema)(payload, { onExcessProperty: "error" }).pipe(
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
) =>
  Effect.gen(function*() {
    const [path, raw] = yield* readText(
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
  Array.findFirst(manifest.fixtures, (entry) => String.Equivalence(entry.name, name))

const decodeFixture = (
  fixtureName: FixtureName,
  path: string,
  payload: unknown
): Effect.Effect<KnownFixture, FixtureSchemaDecodeError> =>
  Schema.decodeUnknown(KnownFixtureSchema)(payload, { onExcessProperty: "error" }).pipe(
    Effect.mapError(
      (cause) =>
        new FixtureSchemaDecodeError({
          fixture: fixtureName,
          path,
          cause
        })
    ),
    Effect.filterOrFail(
      (fixture) => String.Equivalence(fixture.fixture, fixtureName),
      (fixture) =>
        new FixtureSchemaDecodeError({
          fixture: fixtureName,
          path,
          cause: `Fixture name mismatch: expected ${fixtureName}, received ${fixture.fixture}`
        })
    )
  )

export const loadFixtureByEntry = (
  rootDirectory: string,
  entry: Schema.Schema.Type<typeof FixtureManifestEntrySchema>
) =>
  Effect.gen(function*() {
    const [path, raw] = yield* readText(
      rootDirectory,
      entry.file,
      (path, cause) => new FixtureFileReadError({ path, cause })
    )
    const parsed = yield* parseJson(path, raw)

    return yield* decodeFixture(entry.name, path, parsed)
  })
