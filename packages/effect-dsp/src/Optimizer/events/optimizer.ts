/**
 * Wrapped optimizer event contracts.
 *
 * @since 0.1.0
 */
import { Data, Effect, Schema } from "effect"
import { StudyEventSchema as EffectSearchInteropEventSchema } from "effect-search/StudyEvent"
import { OptimizerEventEnvelope } from "../../contracts/OptimizerEventEnvelope.js"
import { encodeAndProjectFieldRecord } from "../../contracts/PayloadProjection.js"
import { type BootstrapEvent as BootstrapEventType, BootstrapEventSchema } from "./bootstrap.js"
import { type COPROEvent as COPROEventType, COPROEventSchema } from "./copro.js"
import { EvaluationEventSchema } from "./evaluation.js"
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

/**
 * Discriminated union schema wrapping all optimizer-specific and evaluation
 * event types under a single envelope.
 *
 * @since 0.1.0
 * @category events
 */
export const OptimizerEventSchema = Schema.Union(
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
 * Wrapped optimizer event — each variant carries a domain-specific event
 * payload.
 *
 * @since 0.1.0
 * @category events
 */
export type OptimizerEvent = typeof OptimizerEventSchema.Type

/**
 * Tagged-enum constructors for wrapped optimizer events.
 *
 * @since 0.1.0
 * @category events
 */
export const OptimizerEvent = Data.taggedEnum<OptimizerEvent>()

/**
 * Project a Bootstrap event into the canonical optimizer event envelope.
 *
 * @since 0.1.0
 * @category constructors
 */
export const bootstrapEventEnvelope = (
  event: BootstrapEventType
): Effect.Effect<OptimizerEventEnvelope> =>
  encodeAndProjectFieldRecord(
    BootstrapEventSchema,
    event,
    () => Data.struct({ message: "Bootstrap event payload projection failed" })
  ).pipe(
    Effect.orDie,
    Effect.map((payload) =>
      new OptimizerEventEnvelope({
        optimizer: "bootstrapFewShot",
        eventTag: event._tag,
        payload
      })
    )
  )

/**
 * Project a COPRO event into the canonical optimizer event envelope.
 *
 * @since 0.2.0
 * @category constructors
 */
export const coproEventEnvelope = (
  event: COPROEventType
): Effect.Effect<OptimizerEventEnvelope> =>
  encodeAndProjectFieldRecord(
    COPROEventSchema,
    event,
    () => Data.struct({ message: "COPRO event payload projection failed" })
  ).pipe(
    Effect.orDie,
    Effect.map((payload) =>
      new OptimizerEventEnvelope({
        optimizer: "copro",
        eventTag: event._tag,
        payload
      })
    )
  )

/**
 * Project a MIPROv2 event into the canonical optimizer event envelope.
 *
 * @since 0.1.0
 * @category constructors
 */
export const miprov2EventEnvelope = (
  event: MIPROv2EventType
): Effect.Effect<OptimizerEventEnvelope> =>
  encodeAndProjectFieldRecord(
    MIPROv2EventSchema,
    event,
    () => Data.struct({ message: "MIPROv2 event payload projection failed" })
  ).pipe(
    Effect.orDie,
    Effect.map((payload) =>
      new OptimizerEventEnvelope({
        optimizer: "miprov2",
        eventTag: event._tag,
        payload
      })
    )
  )

/**
 * Project a GEPA event into the canonical optimizer event envelope.
 *
 * @since 0.1.0
 * @category constructors
 */
export const gepaEventEnvelope = (
  event: GEPAEventType
): Effect.Effect<OptimizerEventEnvelope> =>
  encodeAndProjectFieldRecord(
    GEPAEventSchema,
    event,
    () => Data.struct({ message: "GEPA event payload projection failed" })
  ).pipe(
    Effect.orDie,
    Effect.map((payload) =>
      new OptimizerEventEnvelope({
        optimizer: "gepa",
        eventTag: event._tag,
        payload
      })
    )
  )
