import { BunServices } from "@effect/platform-bun"
import { Array as Arr, Effect, FileSystem, Path, Schema, String as Str } from "effect"
import type { Option, PlatformError } from "effect"
import { Url } from "effect/http"

import {
  FixtureFileReadError,
  FixtureMalformedJsonError,
  FixtureManifestDecodeError,
  FixtureManifestReadError,
  FixtureSchemaDecodeError
} from "./errors.js"
import { FixtureManifest, KnownFixture } from "./schemas.js"
import type { FixtureManifestEntry, FixtureName } from "./schemas.js"

const decodeJsonUnknown = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown))

/** The directory `relative` names beside the module at `moduleUrl`, as a filesystem path. */
export const directoryBeside = (moduleUrl: string, relative: string) =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const url = yield* Effect.fromResult(Url.fromString(relative, moduleUrl))
    return yield* path.fromFileUrl(url)
  }).pipe(Effect.orDie, Effect.provide(BunServices.layer))

/** Reads `file` under `rootDirectory`, returning the text and the path it was read from. */
const readText = <E>(
  rootDirectory: string,
  file: string,
  onError: (path: string, cause: PlatformError.PlatformError) => E
) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const filePath = path.join(rootDirectory, file)
    const raw = yield* fileSystem.readFileString(filePath).pipe(Effect.mapError((cause) => onError(filePath, cause)))

    return { path: filePath, raw }
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
  Schema.decodeUnknownEffect(FixtureManifest)(payload).pipe(
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
    const { path, raw } = yield* readText(
      rootDirectory,
      manifestFileName,
      (path, cause) => new FixtureManifestReadError({ path, cause })
    )
    const parsed = yield* parseJson(path, raw)

    return yield* decodeManifest(path, parsed)
  }).pipe(Effect.provide(BunServices.layer))

export const findManifestEntry = (
  manifest: FixtureManifest,
  name: FixtureName
): Option.Option<FixtureManifestEntry> => Arr.findFirst(manifest.fixtures, (entry) => Str.Equivalence(entry.name, name))

const decodeFixture = (
  fixtureName: FixtureName,
  path: string,
  payload: unknown
) =>
  Schema.decodeUnknownEffect(KnownFixture)(payload).pipe(
    Effect.mapError(
      (cause) =>
        new FixtureSchemaDecodeError({
          fixture: fixtureName,
          path,
          cause
        })
    ),
    Effect.filterOrFail(
      (fixture) => Str.Equivalence(fixture.fixture, fixtureName),
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
  entry: FixtureManifestEntry
) =>
  Effect.gen(function*() {
    const { path, raw } = yield* readText(
      rootDirectory,
      entry.file,
      (path, cause) => new FixtureFileReadError({ path, cause })
    )
    const parsed = yield* parseJson(path, raw)

    return yield* decodeFixture(entry.name, path, parsed)
  }).pipe(Effect.provide(BunServices.layer))
