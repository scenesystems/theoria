/**
 * Lineage metadata for artifact provenance and replay.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { ArtifactId, ContentDigest, SourceRef } from "./identity.js"

/**
 * Lineage metadata carried by an artifact envelope.
 *
 * @remarks
 * `derivedFrom` is an optional list of parent IDs and `integrity` is an
 * optional algorithm-tagged digest. This schema neither verifies the digest
 * nor enforces uniqueness, graph acyclicity, or producer authenticity.
 *
 * @see {@link SourceRef} — structured locator for the producing module
 * @see {@link ArtifactId} — composite run + sequence identity
 * @see {@link ContentDigest} — algorithm + digest pair for integrity
 * @see {@link ArtifactEnvelope} — the envelope that carries this lineage
 *
 * @since 0.1.0
 * @category models
 */
export class ArtifactLineage extends Schema.Class<ArtifactLineage>("ArtifactLineage")({
  sourceRef: SourceRef,
  artifactId: ArtifactId,
  emittedAt: Schema.DateTimeUtc,
  derivedFrom: Schema.optional(Schema.Array(ArtifactId)),
  integrity: Schema.optional(ContentDigest)
}) {}
