import { Schema } from "effect"

import { ArtifactLineage } from "./lineage.js"
import { ArtifactRelationSchema } from "./relation.js"

/** Version discriminator for the canonical envelope fields. @since 0.1.0 @category schemas */
export const ArtifactEnvelopeVersion = Schema.Literal("artifact-envelope/v1")

/** Builds canonical envelope fields from producer and lineage schemas. @since 0.1.0 @category schema factories */
export const makeEnvelopeFields = <Producer extends Schema.Schema.Any, Lineage extends Schema.Schema.Any>(
  producer: Producer,
  lineage: Lineage
) => ({
  schemaVersion: ArtifactEnvelopeVersion,
  producer,
  lineage,
  relations: Schema.optional(Schema.Array(ArtifactRelationSchema))
})

/** Composes caller-owned producer, lineage, and payload schemas. @since 0.1.0 @category schema factories */
export const makeEnvelopeSchemaWithLineage = <
  Producer extends Schema.Schema.Any,
  Lineage extends Schema.Schema.Any,
  Payload extends Schema.Schema.Any
>(producer: Producer, lineage: Lineage, payload: Payload) =>
  payload.pipe(Schema.extend(Schema.Struct(makeEnvelopeFields(producer, lineage))))

/** Composes caller-owned producer and payload schemas with open lineage. @since 0.1.0 @category schema factories */
export const makeEnvelopeSchema = <Producer extends Schema.Schema.Any, Payload extends Schema.Schema.Any>(
  producer: Producer,
  payload: Payload
) => makeEnvelopeSchemaWithLineage(producer, ArtifactLineage, payload)
