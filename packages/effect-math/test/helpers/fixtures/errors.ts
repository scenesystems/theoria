import { Schema } from "effect"

import { FixtureNameSchema } from "./schemas.js"

export class FixtureManifestReadError extends Schema.TaggedError<FixtureManifestReadError>(
  "@scenesystems/effect-math/test/helpers/fixtures/errors/FixtureManifestReadError"
)(
  "FixtureManifestReadError",
  { path: Schema.String, cause: Schema.Unknown }
) {}

export class FixtureRootResolutionError extends Schema.TaggedError<FixtureRootResolutionError>(
  "@scenesystems/effect-math/test/helpers/fixtures/errors/FixtureRootResolutionError"
)(
  "FixtureRootResolutionError",
  { moduleUrl: Schema.String, relative: Schema.String, cause: Schema.Unknown }
) {}

export class FixtureFileReadError extends Schema.TaggedError<FixtureFileReadError>(
  "@scenesystems/effect-math/test/helpers/fixtures/errors/FixtureFileReadError"
)("FixtureFileReadError", {
  path: Schema.String,
  cause: Schema.Unknown
}) {}

export class FixtureMalformedJsonError extends Schema.TaggedError<FixtureMalformedJsonError>(
  "@scenesystems/effect-math/test/helpers/fixtures/errors/FixtureMalformedJsonError"
)("FixtureMalformedJsonError", {
  path: Schema.String,
  cause: Schema.Unknown
}) {}

export class FixtureManifestDecodeError extends Schema.TaggedError<FixtureManifestDecodeError>(
  "@scenesystems/effect-math/test/helpers/fixtures/errors/FixtureManifestDecodeError"
)(
  "FixtureManifestDecodeError",
  { path: Schema.String, cause: Schema.Unknown }
) {}

export class FixtureSchemaDecodeError extends Schema.TaggedError<FixtureSchemaDecodeError>(
  "@scenesystems/effect-math/test/helpers/fixtures/errors/FixtureSchemaDecodeError"
)(
  "FixtureSchemaDecodeError",
  { fixture: FixtureNameSchema, path: Schema.String, cause: Schema.Unknown }
) {}

export class FixtureNotFoundError extends Schema.TaggedError<FixtureNotFoundError>(
  "@scenesystems/effect-math/test/helpers/fixtures/errors/FixtureNotFoundError"
)("FixtureNotFoundError", {
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
