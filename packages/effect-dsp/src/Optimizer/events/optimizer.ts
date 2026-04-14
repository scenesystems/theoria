/**
 * Wrapped optimizer event contracts.
 *
 * @since 0.1.0
 */
import { Data, Effect, Schema } from "effect"
import {
  type StudyEvent as EffectSearchInteropEvent,
  StudyEventSchema as EffectSearchInteropEventSchema
} from "effect-search/StudyEvent"
import { OptimizerEventEnvelope as OptimizerEventEnvelopeModel } from "../../contracts/OptimizerEventEnvelope.js"
import type { OptimizerKind } from "../../contracts/OptimizerKind.js"
import { encodeAndProjectFieldRecord } from "../../contracts/PayloadProjection.js"
import { type BootstrapEvent as BootstrapEventType, BootstrapEventSchema } from "./bootstrap.js"
import { type COPROEvent as COPROEventType, COPROEventSchema } from "./copro.js"
import { EvaluationEventSchema, type EvaluationEventType } from "./evaluation.js"
import { type GEPAEvent as GEPAEventType, GEPAEventSchema } from "./gepa.js"
import { type MIPROv2Event as MIPROv2EventType, MIPROv2EventSchema } from "./miprov2.js"

export {
  /**
   * Effect-search study event schema, re-exported for the optimizer event union.
   *
   * @since 0.1.4
   * @category events
   */
  StudyEventSchema as EffectSearchInteropEventSchema
} from "effect-search/StudyEvent"

type OptimizerEventEncoded =
  | { readonly _tag: "Bootstrap"; readonly event: Schema.Schema.Encoded<typeof BootstrapEventSchema> }
  | { readonly _tag: "COPRO"; readonly event: Schema.Schema.Encoded<typeof COPROEventSchema> }
  | { readonly _tag: "MIPRO"; readonly event: Schema.Schema.Encoded<typeof MIPROv2EventSchema> }
  | { readonly _tag: "GEPA"; readonly event: Schema.Schema.Encoded<typeof GEPAEventSchema> }
  | {
    readonly _tag: "EffectSearchInterop"
    readonly event: Schema.Schema.Encoded<typeof EffectSearchInteropEventSchema>
  }
  | { readonly _tag: "Evaluation"; readonly event: Schema.Schema.Encoded<typeof EvaluationEventSchema> }

/**
 * Wrapped optimizer event — each variant carries a domain-specific event
 * payload.
 *
 * @since 0.1.0
 * @category events
 */
export type OptimizerEvent =
  | { readonly _tag: "Bootstrap"; readonly event: BootstrapEventType }
  | { readonly _tag: "COPRO"; readonly event: COPROEventType }
  | { readonly _tag: "MIPRO"; readonly event: MIPROv2EventType }
  | { readonly _tag: "GEPA"; readonly event: GEPAEventType }
  | { readonly _tag: "EffectSearchInterop"; readonly event: EffectSearchInteropEvent }
  | { readonly _tag: "Evaluation"; readonly event: EvaluationEventType }

/**
 * Discriminated union schema wrapping all optimizer-specific and evaluation
 * event types under a single envelope.
 *
 * @since 0.1.0
 * @category events
 */
export const OptimizerEventSchema: Schema.Schema<OptimizerEvent, OptimizerEventEncoded> = Schema.Union(
  Schema.TaggedStruct("Bootstrap", {
    event: BootstrapEventSchema
  }),
  Schema.TaggedStruct("COPRO", {
    event: COPROEventSchema
  }),
  Schema.TaggedStruct("MIPRO", {
    event: MIPROv2EventSchema
  }),
  Schema.TaggedStruct("GEPA", {
    event: GEPAEventSchema
  }),
  Schema.TaggedStruct("EffectSearchInterop", {
    event: EffectSearchInteropEventSchema
  }),
  Schema.TaggedStruct("Evaluation", {
    event: EvaluationEventSchema
  })
)

/**
 * Tagged-enum constructors for wrapped optimizer events.
 *
 * @since 0.1.0
 * @category events
 */
export const OptimizerEvent = Data.taggedEnum<OptimizerEvent>()

const projectOptimizerEventEnvelope = <Event>(options: {
  readonly optimizer: OptimizerKind
  readonly eventTag: string
  readonly event: Event
  readonly schema: Schema.Schema<Event>
  readonly projectionFailureMessage: string
}): Effect.Effect<OptimizerEventEnvelopeModel> =>
  encodeAndProjectFieldRecord(
    options.schema,
    options.event,
    () => Data.struct({ message: options.projectionFailureMessage })
  ).pipe(
    Effect.orDie,
    Effect.map((payload) =>
      OptimizerEventEnvelopeModel.make({
        optimizer: options.optimizer,
        eventTag: options.eventTag,
        payload
      })
    )
  )

const fromBootstrapEvent = (event: BootstrapEventType): Effect.Effect<OptimizerEventEnvelopeModel> =>
  projectOptimizerEventEnvelope({
    optimizer: "bootstrapFewShot",
    eventTag: event._tag,
    event,
    schema: BootstrapEventSchema,
    projectionFailureMessage: "Bootstrap event payload projection failed"
  })

const fromCOPROEvent = (event: COPROEventType): Effect.Effect<OptimizerEventEnvelopeModel> =>
  projectOptimizerEventEnvelope({
    optimizer: "copro",
    eventTag: event._tag,
    event,
    schema: COPROEventSchema,
    projectionFailureMessage: "COPRO event payload projection failed"
  })

const fromMIPROv2Event = (event: MIPROv2EventType): Effect.Effect<OptimizerEventEnvelopeModel> =>
  projectOptimizerEventEnvelope({
    optimizer: "miprov2",
    eventTag: event._tag,
    event,
    schema: MIPROv2EventSchema,
    projectionFailureMessage: "MIPROv2 event payload projection failed"
  })

const fromGEPAEvent = (event: GEPAEventType): Effect.Effect<OptimizerEventEnvelopeModel> =>
  projectOptimizerEventEnvelope({
    optimizer: "gepa",
    eventTag: event._tag,
    event,
    schema: GEPAEventSchema,
    projectionFailureMessage: "GEPA event payload projection failed"
  })

/**
 * Canonical owner for projecting optimizer-specific events into shared event
 * envelopes.
 *
 * @since 0.2.0
 * @category constructors
 */
export class OptimizerEventEnvelope extends OptimizerEventEnvelopeModel {
  static fromBootstrapEvent = fromBootstrapEvent

  static fromCOPROEvent = fromCOPROEvent

  static fromMIPROv2Event = fromMIPROv2Event

  static fromGEPAEvent = fromGEPAEvent
}
