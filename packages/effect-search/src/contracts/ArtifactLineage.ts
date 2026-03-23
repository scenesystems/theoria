/**
 * Lineage metadata for artifact provenance and replay.
 *
 * @since 0.1.0
 */
import { Schema } from "effect"

import { ArtifactId, ContentDigest, SourceRef } from "./identity.js"

/**
 * Full provenance record attached to every persisted artifact.
 * `sourceRef` identifies the producing module, `artifactId` provides
 * globally-unique run-scoped identity, `derivedFrom` links parent
 * artifacts to form a DAG, and `integrity` enables content-addressable
 * verification after storage or transport.
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
