import { Schema } from "effect"

import { FailureEnvelope, Metadata } from "../envelope.js"

/**
 * Package version map served by the `/api/versions/packages` endpoint.
 *
 * Keys are npm package names (e.g. `"effect-text"`, `"@scenesystems/digest"`).
 * Values are semver version strings read from the workspace `package.json` files.
 *
 * @since 0.1.0
 */
export const PackageVersions = Schema.Record({ key: Schema.String, value: Schema.String })

export type PackageVersions = typeof PackageVersions.Type

export class PackageVersionsSuccessEnvelope extends Schema.Class<PackageVersionsSuccessEnvelope>(
  "PackageVersionsSuccessEnvelope"
)({
  ok: Schema.Literal(true),
  meta: Metadata,
  data: PackageVersions
}) {}

export const PackageVersionsEnvelope = Schema.Union(PackageVersionsSuccessEnvelope, FailureEnvelope)
