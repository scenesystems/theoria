import * as Digest from "@scenesystems/digest/Digest"
import { Array, Effect, FileSystem, type Option, Path, type PlatformError, Schema, Stream, String, Tuple } from "effect"
import { Hex } from "effect/encoding"
import { Url } from "effect/http"

import {
  FixtureFileReadError,
  FixtureHashMismatchError,
  FixtureMalformedJsonError,
  FixtureManifestDecodeError,
  FixtureManifestReadError,
  FixtureRootResolutionError,
  FixtureSchemaDecodeError
} from "./errors.js"
import { FixtureManifestSchema, KnownFixtureSchema } from "./schemas.js"
import type { FixtureManifest, FixtureManifestEntrySchema, FixtureName, KnownFixture } from "./schemas.js"

const decodeJsonUnknown = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown))

/** The directory `relative` names beside the module at `moduleUrl`, as a filesystem path. */
export const directoryBeside = (moduleUrl: string, relative: string) =>
  Effect.gen(function*() {
    const path = yield* Path.Path
    const url = yield* Effect.fromResult(Url.fromString(relative, moduleUrl)).pipe(
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
  onError: (path: string, cause: PlatformError.PlatformError) => E
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
  Schema.decodeUnknownEffect(FixtureManifestSchema)(payload, { onExcessProperty: "error" }).pipe(
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
  Schema.decodeUnknownEffect(KnownFixtureSchema)(payload, { onExcessProperty: "error" }).pipe(
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
          cause: Array.join(
            Array.make("Fixture name mismatch: expected ", fixtureName, ", received ", fixture.fixture),
            ""
          )
        })
    )
  )

/** Lowercase hexadecimal SHA-256 of exact fixture bytes, as recorded in the manifest. */
export const fixtureSha256 = (bytes: Uint8Array) => Effect.map(Digest.hash("sha256", bytes), Hex.encode)

/**
 * Reads the exact bytes of a manifest entry, verifies their recorded SHA-256
 * before any JSON is trusted, then schema-decodes the fixture document.
 */
export const loadFixtureByEntry = (
  rootDirectory: string,
  entry: Schema.Schema.Type<typeof FixtureManifestEntrySchema>
) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const pathService = yield* Path.Path
    const path = pathService.join(rootDirectory, entry.file)
    const bytes = yield* fileSystem.readFile(path).pipe(
      Effect.mapError((cause) => new FixtureFileReadError({ path, cause }))
    )
    yield* fixtureSha256(bytes).pipe(
      Effect.filterOrFail(
        (actual) => String.Equivalence(actual, entry.sha256),
        (actual) => new FixtureHashMismatchError({ fixture: entry.name, path, expected: entry.sha256, actual })
      )
    )
    const raw = yield* Stream.make(bytes).pipe(Stream.decodeText(), Stream.mkString)
    const parsed = yield* parseJson(path, raw)

    return yield* decodeFixture(entry.name, path, parsed)
  })
