import { Data } from "effect"

import type { FixtureName } from "./schemas.js"

export class FixtureManifestReadError extends Data.TaggedError("FixtureManifestReadError")<{
  readonly path: string
  readonly cause: unknown
}> {}

export class FixtureFileReadError extends Data.TaggedError("FixtureFileReadError")<{
  readonly path: string
  readonly cause: unknown
}> {}

export class FixtureMalformedJsonError extends Data.TaggedError("FixtureMalformedJsonError")<{
  readonly path: string
  readonly cause: unknown
}> {}

export class FixtureManifestDecodeError extends Data.TaggedError("FixtureManifestDecodeError")<{
  readonly path: string
  readonly cause: unknown
}> {}

export class FixtureSchemaDecodeError extends Data.TaggedError("FixtureSchemaDecodeError")<{
  readonly fixture: FixtureName
  readonly path: string
  readonly cause: unknown
}> {}

export class FixtureHashMismatchError extends Data.TaggedError("FixtureHashMismatchError")<{
  readonly actualHash: string
  readonly expectedHash: string
  readonly fixture: FixtureName
  readonly path: string
}> {}

export class FixtureNotFoundError extends Data.TaggedError("FixtureNotFoundError")<{
  readonly fixture: FixtureName
}> {}

export type FixtureRegistryError =
  | FixtureManifestReadError
  | FixtureFileReadError
  | FixtureMalformedJsonError
  | FixtureManifestDecodeError
  | FixtureHashMismatchError
  | FixtureSchemaDecodeError
  | FixtureNotFoundError
