import { Schema } from "effect"

import { Envelope } from "./envelope.js"

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

export const PackageVersionsEnvelope = Envelope(PackageVersions)
