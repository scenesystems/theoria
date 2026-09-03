/**
 * Tagged references that associate artifacts with optimization and external records.
 *
 * @since 0.1.0
 */
import { Data, Schema } from "effect"

import { RunId } from "./identity.js"

/**
 * Validates a non-empty protocol label and brands it against other string references.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ProtocolRef = Schema.NonEmptyString.pipe(Schema.brand("ProtocolRef"))

/**
 * Declared protocol label carried by a protocol relation.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ProtocolRef = Schema.Schema.Type<typeof ProtocolRef>

/**
 * Validates a non-empty protocol-slot label and brands it against other references.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SlotRef = Schema.NonEmptyString.pipe(Schema.brand("SlotRef"))

/**
 * Declared participation-slot label carried by a slot relation.
 *
 * @since 0.1.0
 * @category type-level
 */
export type SlotRef = Schema.Schema.Type<typeof SlotRef>

/**
 * Validates a non-empty label for a directed protocol-slot connection.
 * The string does not encode or validate endpoint identities.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SlotEdgeRef = Schema.NonEmptyString.pipe(Schema.brand("SlotEdgeRef"))

/**
 * Declared slot-connection label carried by a slot-edge relation.
 *
 * @since 0.1.0
 * @category type-level
 */
export type SlotEdgeRef = Schema.Schema.Type<typeof SlotEdgeRef>

/**
 * Validates and brands a non-empty metric, objective, or constraint label.
 *
 * @since 0.1.0
 * @category schemas
 */
export const InstrumentRef = Schema.NonEmptyString.pipe(Schema.brand("InstrumentRef"))

/**
 * Declared measurement-instrument label carried by an instrument relation.
 *
 * @since 0.1.0
 * @category type-level
 */
export type InstrumentRef = Schema.Schema.Type<typeof InstrumentRef>

/**
 * Validates and brands a non-empty parameter-binding label.
 * The reference does not include or verify the run that owns the binding.
 *
 * @since 0.1.0
 * @category schemas
 */
export const BindingRef = Schema.NonEmptyString.pipe(Schema.brand("BindingRef"))

/**
 * Declared parameter-binding label carried by a binding relation.
 *
 * @since 0.1.0
 * @category type-level
 */
export type BindingRef = Schema.Schema.Type<typeof BindingRef>

/**
 * Validates and brands a non-empty observation label.
 * The reference does not include or verify its instrument or run.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ObservationRef = Schema.NonEmptyString.pipe(Schema.brand("ObservationRef"))

/**
 * Declared measurement label carried by an observation relation.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ObservationRef = Schema.Schema.Type<typeof ObservationRef>

/**
 * Decodes built-in artifact associations and namespaced external references.
 *
 * @remarks
 * Built-in references validate their branded string or run ULID. External references
 * require non-empty `namespace` and `ref` strings. The schema does not verify that a
 * referenced entity exists or that relations form a consistent graph.
 *
 * @since 0.1.0
 * @category schemas
 */
export const ArtifactRelationSchema = Schema.Union(
  Schema.TaggedStruct("Protocol", { ref: ProtocolRef }),
  Schema.TaggedStruct("Slot", { ref: SlotRef }),
  Schema.TaggedStruct("SlotEdge", { ref: SlotEdgeRef }),
  Schema.TaggedStruct("Instrument", { ref: InstrumentRef }),
  Schema.TaggedStruct("Run", { ref: RunId }),
  Schema.TaggedStruct("Binding", { ref: BindingRef }),
  Schema.TaggedStruct("Observation", { ref: ObservationRef }),
  Schema.TaggedStruct("External", { ref: Schema.NonEmptyString, namespace: Schema.NonEmptyString })
)

/**
 * Declared association between an artifact and another optimization or external record.
 *
 * @remarks
 * String brands prevent accidental interchange among built-in reference kinds at
 * compile time. They do not establish referential integrity at runtime.
 *
 * @since 0.1.0
 * @category models
 */
export type ArtifactRelation = Schema.Schema.Type<typeof ArtifactRelationSchema>

const ArtifactRelations = Data.taggedEnum<ArtifactRelation>()

/**
 * Constructs an association with a declared optimization protocol.
 *
 * @since 0.1.0
 * @category constructors
 */
export const ProtocolRelation = ArtifactRelations.Protocol

/**
 * Constructs an association with a declared participation slot.
 *
 * @since 0.1.0
 * @category constructors
 */
export const SlotRelation = ArtifactRelations.Slot

/**
 * Constructs an association with a declared directed slot connection.
 *
 * @since 0.1.0
 * @category constructors
 */
export const SlotEdgeRelation = ArtifactRelations.SlotEdge

/**
 * Constructs an association with a declared metric, objective, or constraint.
 *
 * @since 0.1.0
 * @category constructors
 */
export const InstrumentRelation = ArtifactRelations.Instrument

/**
 * Constructs an association with an execution identified by a branded ULID.
 *
 * @since 0.1.0
 * @category constructors
 */
export const RunRelation = ArtifactRelations.Run

/**
 * Constructs an association with a declared parameter binding.
 *
 * @since 0.1.0
 * @category constructors
 */
export const BindingRelation = ArtifactRelations.Binding

/**
 * Constructs an association with a declared measurement observation.
 *
 * @since 0.1.0
 * @category constructors
 */
export const ObservationRelation = ArtifactRelations.Observation

/**
 * Constructs an association with an external entity under a caller-defined namespace.
 *
 * @remarks
 * The constructor does not validate the strings at runtime. Decode with
 * {@link ArtifactRelationSchema} when both fields must be non-empty.
 *
 * @since 0.1.0
 * @category constructors
 */
export const ExternalRelation = ArtifactRelations.External

/**
 * Dispatches an artifact association to the handler for its tagged variant.
 *
 * @typeParam Cases - Exhaustive handler record whose return values determine the result union.
 *
 * @since 0.1.0
 * @category pattern-matching
 */
export const matchRelation = ArtifactRelations.$match

/**
 * Builds a predicate that narrows an artifact association by `_tag`.
 *
 * @typeParam Tag - Relation discriminator selected for narrowing.
 *
 * @since 0.1.0
 * @category guards
 */
export const isRelation = ArtifactRelations.$is
