import { FileSystem, Path } from "@effect/platform"
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

const readText = <E>(
  fileUrl: URL,
  onError: (cause: unknown) => E
): Effect.Effect<string, E> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const resolvedPath = yield* path.fromFileUrl(fileUrl).pipe(
      Effect.mapError(onError)
    )

    return yield* fileSystem.readFileString(resolvedPath).pipe(
      Effect.mapError(onError)
    )
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
  rootUrl: URL,
  manifestFileName: string
): Effect.Effect<FixtureManifest, FixtureRegistryError> =>
  Effect.gen(function*() {
    const manifestUrl = new URL(manifestFileName, rootUrl)
    const path = manifestUrl.toString()
    const raw = yield* readText(
      manifestUrl,
      (cause) =>
        new FixtureManifestReadError({
          path,
          cause
        })
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
  rootUrl: URL,
  entry: Schema.Schema.Type<typeof FixtureManifestEntrySchema>
): Effect.Effect<KnownFixture, FixtureRegistryError> =>
  Effect.gen(function*() {
    const fileUrl = new URL(entry.file, rootUrl)
    const path = fileUrl.toString()
    const raw = yield* readText(
      fileUrl,
      (cause) =>
        new FixtureFileReadError({
          path,
          cause
        })
    )
    const parsed = yield* parseJson(path, raw)

    return yield* decodeFixture(entry.name, path, parsed)
  })
