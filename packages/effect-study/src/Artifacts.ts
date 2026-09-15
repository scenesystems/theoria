/**
 * Schema-composed artifact identity, provenance, relations, and envelopes.
 *
 * @since 0.1.0
 * @module
 */
import type { Schema } from "effect"

export {
  ArtifactEnvelopeVersion,
  makeEnvelopeFields,
  makeEnvelopeSchema,
  makeEnvelopeSchemaWithLineage
} from "./internal/artifacts/envelope.js"
export {
  ArtifactId,
  ComponentPath,
  ContentDigest,
  makeSourceRefSchema,
  PackageVersion,
  RunId,
  SourceRef
} from "./internal/artifacts/identity.js"
export { ArtifactLineage, makeLineageSchema } from "./internal/artifacts/lineage.js"
export {
  type ArtifactRelation,
  ArtifactRelationSchema,
  BindingRef,
  BindingRelation,
  ExternalRelation,
  InstrumentRef,
  InstrumentRelation,
  isRelation,
  matchRelation,
  ObservationRef,
  ObservationRelation,
  ProtocolRef,
  ProtocolRelation,
  RunRelation,
  SlotEdgeRef,
  SlotEdgeRelation,
  SlotRef,
  SlotRelation
} from "./internal/artifacts/relation.js"

import type {
  ComponentPath as ComponentPathSchema,
  PackageVersion as PackageVersionSchema,
  RunId as RunIdSchema,
  SourceRef as SourceRefSchema
} from "./internal/artifacts/identity.js"
import type { ArtifactLineage as ArtifactLineageSchema } from "./internal/artifacts/lineage.js"
import type {
  BindingRef as BindingRefSchema,
  InstrumentRef as InstrumentRefSchema,
  ObservationRef as ObservationRefSchema,
  ProtocolRef as ProtocolRefSchema,
  SlotEdgeRef as SlotEdgeRefSchema,
  SlotRef as SlotRefSchema
} from "./internal/artifacts/relation.js"

/** Canonical decoded run identifier. @since 0.1.0 @category type-level */
export type RunId = Schema.Schema.Type<typeof RunIdSchema>

/** Canonical decoded package version. @since 0.1.0 @category type-level */
export type PackageVersion = Schema.Schema.Type<typeof PackageVersionSchema>

/** Canonical decoded component path. @since 0.1.0 @category type-level */
export type ComponentPath = Schema.Schema.Type<typeof ComponentPathSchema>

/** Decoded source reference with an open origin. @since 0.1.0 @category type-level */
export type SourceRef = Schema.Schema.Type<typeof SourceRefSchema>

/** Decoded canonical artifact lineage. @since 0.1.0 @category type-level */
export type ArtifactLineage = Schema.Schema.Type<typeof ArtifactLineageSchema>

/** Decoded protocol reference. @since 0.1.0 @category type-level */
export type ProtocolRef = Schema.Schema.Type<typeof ProtocolRefSchema>

/** Decoded protocol-slot reference. @since 0.1.0 @category type-level */
export type SlotRef = Schema.Schema.Type<typeof SlotRefSchema>

/** Decoded directed slot-edge reference. @since 0.1.0 @category type-level */
export type SlotEdgeRef = Schema.Schema.Type<typeof SlotEdgeRefSchema>

/** Decoded measurement-instrument reference. @since 0.1.0 @category type-level */
export type InstrumentRef = Schema.Schema.Type<typeof InstrumentRefSchema>

/** Decoded parameter-binding reference. @since 0.1.0 @category type-level */
export type BindingRef = Schema.Schema.Type<typeof BindingRefSchema>

/** Decoded observation reference. @since 0.1.0 @category type-level */
export type ObservationRef = Schema.Schema.Type<typeof ObservationRefSchema>
