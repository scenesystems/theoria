import { Schema } from "effect"

import { ArtifactId, ContentDigest, SourceRef } from "./identity.js"

/** Builds lineage around a caller-selected source schema. @since 0.1.0 @category schema factories */
export const makeLineageSchema = <Source extends Schema.Schema.All>(sourceRef: Source) =>
  Schema.Struct({
    sourceRef,
    artifactId: ArtifactId,
    emittedAt: Schema.DateTimeUtc,
    derivedFrom: Schema.optional(Schema.Array(ArtifactId)),
    integrity: Schema.optional(ContentDigest)
  })

/** Canonical lineage accepting any non-empty source origin. @since 0.1.0 @category schemas */
export const ArtifactLineage = makeLineageSchema(SourceRef)
