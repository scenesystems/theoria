/**
 * Producer-supplied ancestry and integrity metadata for artifact envelopes.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { ArtifactId, ContentDigest, SourceRef } from "./identity.js"

/**
 * Records an artifact's declared source, identity, emission time, and optional parents.
 *
 * @remarks
 * `derivedFrom` preserves parent order and may contain duplicates. `integrity` records
 * an algorithm-tagged digest. Decoding does not verify that digest, authenticate the
 * producer, or validate ancestry as an acyclic graph.
 *
 * @since 0.1.0
 * @category models
 */
export class ArtifactLineage extends Schema.Class<ArtifactLineage>("ArtifactLineage")({
  /** Producer and logical component that emitted the artifact. */
  sourceRef: SourceRef,
  /** Identity assigned to this artifact within its declared run. */
  artifactId: ArtifactId,
  /** Producer-supplied UTC emission time. */
  emittedAt: Schema.DateTimeUtc,
  /** Ordered parent identities, when the artifact records derivation. */
  derivedFrom: Schema.optional(Schema.Array(ArtifactId)),
  /** Declared content digest; consumers must verify it against the artifact bytes. */
  integrity: Schema.optional(ContentDigest)
}) {}
