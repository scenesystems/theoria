import { Schema } from "effect"

import { FixtureNameSchema } from "./schemas.js"

export class FixtureManifestReadError extends Schema.TaggedError<FixtureManifestReadError>()(
  "FixtureManifestReadError",
  { path: Schema.String, cause: Schema.Unknown }
) {}

export class FixtureRootResolutionError extends Schema.TaggedError<FixtureRootResolutionError>()(
  "FixtureRootResolutionError",
  { moduleUrl: Schema.String, relative: Schema.String, cause: Schema.Unknown }
) {}

export class FixtureFileReadError extends Schema.TaggedError<FixtureFileReadError>()("FixtureFileReadError", {
  path: Schema.String,
  cause: Schema.Unknown
}) {}

export class FixtureMalformedJsonError
  extends Schema.TaggedError<FixtureMalformedJsonError>()("FixtureMalformedJsonError", {
    path: Schema.String,
    cause: Schema.Unknown
  })
{}

export class FixtureManifestDecodeError extends Schema.TaggedError<FixtureManifestDecodeError>()(
  "FixtureManifestDecodeError",
  { path: Schema.String, cause: Schema.Unknown }
) {}

export class FixtureSchemaDecodeError extends Schema.TaggedError<FixtureSchemaDecodeError>()(
  "FixtureSchemaDecodeError",
  { fixture: FixtureNameSchema, path: Schema.String, cause: Schema.Unknown }
) {}

export class FixtureNotFoundError extends Schema.TaggedError<FixtureNotFoundError>()("FixtureNotFoundError", {
  fixture: FixtureNameSchema
}) {}

export const FixtureRegistryError = Schema.Union(
  FixtureRootResolutionError,
  FixtureManifestReadError,
  FixtureFileReadError,
  FixtureMalformedJsonError,
  FixtureManifestDecodeError,
  FixtureSchemaDecodeError,
  FixtureNotFoundError
)

export type FixtureRegistryError = typeof FixtureRegistryError.Type
