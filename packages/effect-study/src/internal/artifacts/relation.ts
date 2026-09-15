import { Data, Schema } from "effect"

import { RunId } from "./identity.js"

/** Protocol relation reference. @since 0.1.0 @category schemas */
export const ProtocolRef = Schema.NonEmptyString.pipe(Schema.brand("ProtocolRef"))

/** Protocol slot relation reference. @since 0.1.0 @category schemas */
export const SlotRef = Schema.NonEmptyString.pipe(Schema.brand("SlotRef"))

/** Directed slot-edge relation reference. @since 0.1.0 @category schemas */
export const SlotEdgeRef = Schema.NonEmptyString.pipe(Schema.brand("SlotEdgeRef"))

/** Measurement instrument relation reference. @since 0.1.0 @category schemas */
export const InstrumentRef = Schema.NonEmptyString.pipe(Schema.brand("InstrumentRef"))

/** Parameter binding relation reference. @since 0.1.0 @category schemas */
export const BindingRef = Schema.NonEmptyString.pipe(Schema.brand("BindingRef"))

/** Observation relation reference. @since 0.1.0 @category schemas */
export const ObservationRef = Schema.NonEmptyString.pipe(Schema.brand("ObservationRef"))

/** Canonical tagged artifact associations. @since 0.1.0 @category schemas */
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

/** Artifact association derived from the canonical schema. @since 0.1.0 @category models */
export type ArtifactRelation = Schema.Schema.Type<typeof ArtifactRelationSchema>

const ArtifactRelations = Data.taggedEnum<ArtifactRelation>()

/** Constructs a protocol association. @since 0.1.0 @category constructors */
export const ProtocolRelation = ArtifactRelations.Protocol

/** Constructs a protocol-slot association. @since 0.1.0 @category constructors */
export const SlotRelation = ArtifactRelations.Slot

/** Constructs a directed slot-edge association. @since 0.1.0 @category constructors */
export const SlotEdgeRelation = ArtifactRelations.SlotEdge

/** Constructs a measurement-instrument association. @since 0.1.0 @category constructors */
export const InstrumentRelation = ArtifactRelations.Instrument

/** Constructs a run association. @since 0.1.0 @category constructors */
export const RunRelation = ArtifactRelations.Run

/** Constructs a parameter-binding association. @since 0.1.0 @category constructors */
export const BindingRelation = ArtifactRelations.Binding

/** Constructs an observation association. @since 0.1.0 @category constructors */
export const ObservationRelation = ArtifactRelations.Observation

/** Constructs a namespaced external association. @since 0.1.0 @category constructors */
export const ExternalRelation = ArtifactRelations.External

/** Exhaustively dispatches an artifact association. @since 0.1.0 @category pattern matching */
export const matchRelation = ArtifactRelations.$match

/** Narrows an artifact association by tag. @since 0.1.0 @category guards */
export const isRelation = ArtifactRelations.$is
