/**
 * Defines the common transport union for optimizer and evaluation events.
 *
 * @since 0.1.0
 */
import { StudyEventSchema as EffectSearchInteropEventSchema } from "@scenesystems/effect-search/StudyEvent"
import { Data, Effect, Schema } from "effect"
import { OptimizerEventEnvelope } from "../../contracts/OptimizerEventEnvelope.js"
import { encodeAndProjectFieldRecord } from "../../contracts/PayloadProjection.js"
import { type BootstrapEvent as BootstrapEventType, BootstrapEventSchema } from "./bootstrap.js"
import { EvaluationEventSchema } from "./evaluation.js"
import { type GEPAEvent as GEPAEventType, GEPAEventSchema } from "./gepa.js"
import { type MIPROv2Event as MIPROv2EventType, MIPROv2EventSchema } from "./miprov2.js"

export {
  /**
   * Decodes effect-search study events carried by the optimizer union.
   *
   * @since 0.1.4
   * @category events
   */
  StudyEventSchema as EffectSearchInteropEventSchema
} from "@scenesystems/effect-search/StudyEvent"

/**
 * Decodes a tagged wrapper around one domain-specific event.
 *
 * @remarks
 * The outer tag selects the schema for `event`. This union retains the complete
 * typed event and differs from {@link OptimizerEventEnvelope}, whose payload is
 * projected into a string-keyed transport record.
 *
 * @since 0.1.0
 * @category events
 */
export const OptimizerEventSchema = Schema.Union(
  Schema.TaggedStruct("Bootstrap", {
    /** BootstrapFewShot event preserved without payload projection. */
    event: BootstrapEventSchema
  }),
  Schema.TaggedStruct("MIPRO", {
    /** MIPROv2 event preserved without payload projection. */
    event: MIPROv2EventSchema
  }),
  Schema.TaggedStruct("GEPA", {
    /** GEPA event preserved without payload projection. */
    event: GEPAEventSchema
  }),
  Schema.TaggedStruct("EffectSearchInterop", {
    /** Study event emitted by effect-search during optimizer execution. */
    event: EffectSearchInteropEventSchema
  }),
  Schema.TaggedStruct("Evaluation", {
    /** Evaluation event preserved without payload projection. */
    event: EvaluationEventSchema
  })
)

/**
 * Wraps one optimizer, search, or evaluation event with its owning domain tag.
 *
 * @since 0.1.0
 * @category events
 */
export type OptimizerEvent = typeof OptimizerEventSchema.Type

/**
 * Constructs and exhaustively matches wrapped events by `_tag`.
 *
 * @since 0.1.0
 * @category events
 */
export const OptimizerEvent = Data.taggedEnum<OptimizerEvent>()

/**
 * Encodes a Bootstrap event into a transport-oriented payload record.
 *
 * @remarks
 * The envelope uses optimizer ID `bootstrapFewShot` and preserves the event's
 * `_tag`. Encoding or payload projection failure becomes a defect.
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
 * Encodes a MIPROv2 event into a transport-oriented payload record.
 *
 * @remarks
 * The envelope uses optimizer ID `miprov2` and preserves the event's `_tag`.
 * Encoding or payload projection failure becomes a defect.
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
 * Encodes a GEPA event into a transport-oriented payload record.
 *
 * @remarks
 * The envelope uses optimizer ID `gepa` and preserves the event's `_tag`.
 * Encoding or payload projection failure becomes a defect.
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
