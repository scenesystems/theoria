/**
 * Ontology-compatible relation references — tagged union with branded refs.
 *
 * @since 0.1.0
 */
import { Data, Schema } from "effect"

import { RunId } from "./identity.js"

/**
 * Identifies an optimization protocol by name within effect-search.
 *
 * Used as the `ref` field in {@link ProtocolRelation} to link an artifact
 * back to the protocol definition that produced it.
 *
 * @see {@link ProtocolRelation} — constructor that wraps this ref
 * @see {@link ArtifactRelation} — parent union
 *
 * @since 0.1.0
 * @category schemas
 */
export const ProtocolRef = Schema.NonEmptyString.pipe(Schema.brand("ProtocolRef"))

/**
 * @see {@link ProtocolRef} — schema definition
 *
 * @since 0.1.0
 * @category type-level
 */
export type ProtocolRef = Schema.Schema.Type<typeof ProtocolRef>

/**
 * Identifies a named participation slot within a protocol.
 *
 * Slots represent the roles an artifact can fill in a protocol — e.g.
 * "objective", "constraint", or "input". The brand prevents accidental
 * interchange with other string-based refs.
 *
 * @see {@link SlotRelation} — constructor that wraps this ref
 * @see {@link ProtocolRef} — the protocol that owns these slots
 *
 * @since 0.1.0
 * @category schemas
 */
export const SlotRef = Schema.NonEmptyString.pipe(Schema.brand("SlotRef"))

/**
 * @see {@link SlotRef} — schema definition
 *
 * @since 0.1.0
 * @category type-level
 */
export type SlotRef = Schema.Schema.Type<typeof SlotRef>

/**
 * Identifies a directed connection between two slots in a protocol graph.
 *
 * Slot edges encode data-flow or dependency relationships between slots,
 * enabling lineage tracking across protocol steps.
 *
 * @see {@link SlotEdgeRelation} — constructor that wraps this ref
 * @see {@link SlotRef} — the slots this edge connects
 *
 * @since 0.1.0
 * @category schemas
 */
export const SlotEdgeRef = Schema.NonEmptyString.pipe(Schema.brand("SlotEdgeRef"))

/**
 * @see {@link SlotEdgeRef} — schema definition
 *
 * @since 0.1.0
 * @category type-level
 */
export type SlotEdgeRef = Schema.Schema.Type<typeof SlotEdgeRef>

/**
 * Identifies a measurement instrument — a metric, objective, or constraint
 * used to evaluate artifact quality during optimization.
 *
 * @see {@link InstrumentRelation} — constructor that wraps this ref
 * @see {@link ObservationRef} — measurements recorded by this instrument
 *
 * @since 0.1.0
 * @category schemas
 */
export const InstrumentRef = Schema.NonEmptyString.pipe(Schema.brand("InstrumentRef"))

/**
 * @see {@link InstrumentRef} — schema definition
 *
 * @since 0.1.0
 * @category type-level
 */
export type InstrumentRef = Schema.Schema.Type<typeof InstrumentRef>

/**
 * Identifies a parameter binding within a run — a specific value assignment
 * to a named hyperparameter or configuration slot.
 *
 * @see {@link BindingRelation} — constructor that wraps this ref
 * @see {@link RunId} — the run that owns this binding
 *
 * @since 0.1.0
 * @category schemas
 */
export const BindingRef = Schema.NonEmptyString.pipe(Schema.brand("BindingRef"))

/**
 * @see {@link BindingRef} — schema definition
 *
 * @since 0.1.0
 * @category type-level
 */
export type BindingRef = Schema.Schema.Type<typeof BindingRef>

/**
 * Identifies an observed measurement — a single data point recorded by an
 * instrument during a run, such as a metric value or constraint evaluation.
 *
 * @see {@link ObservationRelation} — constructor that wraps this ref
 * @see {@link InstrumentRef} — the instrument that produced this observation
 *
 * @since 0.1.0
 * @category schemas
 */
export const ObservationRef = Schema.NonEmptyString.pipe(Schema.brand("ObservationRef"))

/**
 * @see {@link ObservationRef} — schema definition
 *
 * @since 0.1.0
 * @category type-level
 */
export type ObservationRef = Schema.Schema.Type<typeof ObservationRef>

/**
 * Codec for serializing and deserializing {@link ArtifactRelation} values.
 *
 * Encodes the eight-variant tagged union to JSON and back, validating branded
 * refs at decode boundaries. Use with `Schema.decodeUnknown` / `Schema.encode`.
 *
 * @see {@link ArtifactRelation} — the type this schema produces
 * @see {@link ArtifactProducerSchema} — companion schema for producer identity
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
 * Tagged union of ontology-compatible relation references.
 *
 * Each variant carries a branded ref preventing cross-kind assignment.
 *
 * @see {@link ArtifactRelationSchema} — codec for serialization
 * @see {@link matchRelation} — exhaustive pattern match
 * @see {@link isRelation} — type guard
 *
 * @since 0.1.0
 * @category models
 */
export type ArtifactRelation = Schema.Schema.Type<typeof ArtifactRelationSchema>

const ArtifactRelations = Data.taggedEnum<ArtifactRelation>()

/**
 * Links an artifact to the optimization protocol that produced it.
 *
 * Use when recording which protocol definition an artifact belongs to,
 * enabling queries like "all artifacts from protocol X".
 *
 * @see {@link ProtocolRef} — branded ref this relation carries
 * @see {@link ArtifactRelation} — parent union
 *
 * @since 0.1.0
 * @category constructors
 */
export const ProtocolRelation = ArtifactRelations.Protocol

/**
 * Links an artifact to a named participation slot within a protocol.
 *
 * Captures the role an artifact fills — e.g. "objective", "constraint",
 * or "input" — enabling structural queries over protocol topology.
 *
 * @see {@link SlotRef} — branded ref this relation carries
 * @see {@link ProtocolRelation} — the protocol that owns the slot
 *
 * @since 0.1.0
 * @category constructors
 */
export const SlotRelation = ArtifactRelations.Slot

/**
 * Links an artifact to a directed connection between protocol slots.
 *
 * Slot edges represent data-flow or dependency relationships, enabling
 * lineage tracking across steps in a protocol graph.
 *
 * @see {@link SlotEdgeRef} — branded ref this relation carries
 * @see {@link SlotRelation} — the slots this edge connects
 *
 * @since 0.1.0
 * @category constructors
 */
export const SlotEdgeRelation = ArtifactRelations.SlotEdge

/**
 * Links an artifact to a measurement instrument (metric, objective, or constraint)
 * used to evaluate quality during optimization.
 *
 * @see {@link InstrumentRef} — branded ref this relation carries
 * @see {@link ObservationRelation} — measurements recorded by this instrument
 *
 * @since 0.1.0
 * @category constructors
 */
export const InstrumentRelation = ArtifactRelations.Instrument

/**
 * Links an artifact to a specific execution run.
 *
 * Every artifact is produced within a run — this relation enables grouping
 * all outputs from the same execution and correlating with run metadata.
 *
 * @see {@link RunId} — the branded run identifier this relation carries
 * @see {@link BindingRelation} — parameter bindings within this run
 *
 * @since 0.1.0
 * @category constructors
 */
export const RunRelation = ArtifactRelations.Run

/**
 * Links an artifact to a parameter binding within a run — a specific
 * hyperparameter or configuration value assignment.
 *
 * Enables answering "which parameter settings produced this artifact?"
 *
 * @see {@link BindingRef} — branded ref this relation carries
 * @see {@link RunRelation} — the run that owns this binding
 *
 * @since 0.1.0
 * @category constructors
 */
export const BindingRelation = ArtifactRelations.Binding

/**
 * Links an artifact to an observed measurement — a single data point
 * recorded by an instrument during a run.
 *
 * Use to trace which metric observations influenced artifact selection
 * or ranking in multi-objective optimization.
 *
 * @see {@link ObservationRef} — branded ref this relation carries
 * @see {@link InstrumentRelation} — the instrument that produced this observation
 *
 * @since 0.1.0
 * @category constructors
 */
export const ObservationRelation = ArtifactRelations.Observation

/**
 * Links an artifact to a non-effect-search entity via a namespaced reference.
 *
 * The `namespace` field scopes the `ref` to an external system (e.g.
 * "mlflow", "wandb"), preventing collisions across integrations.
 *
 * @see {@link ArtifactRelation} — parent union
 * @see {@link ExternalProducer} — companion for external producer identity
 *
 * @since 0.1.0
 * @category constructors
 */
export const ExternalRelation = ArtifactRelations.External

/**
 * Exhaustive pattern match on relation variants.
 *
 * Provide a handler for each of the eight relation kinds. Adding a new
 * variant to {@link ArtifactRelation} causes a compile error at every
 * uncovered match site.
 *
 * @see {@link ArtifactRelation} — the union being matched
 * @see {@link isRelation} — non-exhaustive type guard alternative
 *
 * @since 0.1.0
 * @category pattern-matching
 */
export const matchRelation = ArtifactRelations.$match

/**
 * Type guard for narrowing a single relation variant by tag.
 *
 * Returns a predicate that narrows {@link ArtifactRelation} to the
 * specified variant — useful in `Array.filter` and conditional branches
 * where exhaustive matching is unnecessary.
 *
 * @see {@link ArtifactRelation} — the union being narrowed
 * @see {@link matchRelation} — exhaustive alternative
 *
 * @since 0.1.0
 * @category guards
 */
export const isRelation = ArtifactRelations.$is
