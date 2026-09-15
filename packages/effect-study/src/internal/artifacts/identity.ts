import { Schema } from "effect"

/** Canonical ULID execution identifier. @since 0.1.0 @category schemas */
export const RunId = Schema.ULID.pipe(Schema.brand("RunId"))

/** Canonical package version with a numeric triplet prefix. @since 0.1.0 @category schemas */
export const PackageVersion = Schema.NonEmptyString.pipe(
  Schema.pattern(/^\d+\.\d+\.\d+/),
  Schema.brand("PackageVersion")
)

/** Non-empty logical component path. @since 0.1.0 @category schemas */
export const ComponentPath = Schema.NonEmptyArray(Schema.NonEmptyString)

/** Builds source provenance with a caller-owned origin schema. @since 0.1.0 @category schema factories */
export const makeSourceRefSchema = <Origin extends Schema.Schema.All>(origin: Origin) =>
  Schema.Struct({
    origin,
    domain: Schema.NonEmptyString,
    segments: Schema.NonEmptyArray(Schema.NonEmptyString)
  })

/** Source provenance accepting any non-empty origin. @since 0.1.0 @category schemas */
export const SourceRef = makeSourceRefSchema(Schema.NonEmptyString)

/** Artifact identity within one run. @since 0.1.0 @category models */
export class ArtifactId extends Schema.Class<ArtifactId>("ArtifactId")({
  runId: RunId,
  sequence: Schema.NonNegativeInt
}) {}

export { ContentDigest } from "@scenesystems/digest"
