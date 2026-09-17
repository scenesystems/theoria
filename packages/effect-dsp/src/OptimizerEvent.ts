/**
 * Defines the common transport union for optimizer and evaluation events.
 *
 * @since 0.1.0
 * @module
 */
import type { ParseResult } from "effect"
import { Data, Effect, Schema } from "effect"
import { type Event as BootstrapEvent, Event as BootstrapEventSchema } from "./BootstrapFewShot.js"
import { type Event as GEPAEvent, Event as GEPAEventSchema } from "./GEPA.js"
import { type Event as MIPROv2Event, Event as MIPROv2EventSchema } from "./MIPROv2.js"
import { encode as encodePayload, Payload } from "./Payload.js"

/** Stable optimizer identities used by serialized event envelopes.
 * @since 0.1.0
 * @category schemas
 */
export const Kind = Schema.Literal("bootstrapFewShot", "miprov2", "gepa")
/** Stable optimizer identity.
 * @since 0.1.0
 * @category type-level
 */
export type Kind = typeof Kind.Type

/** Serialized optimizer-specific event payload.
 * @since 0.1.0
 * @category models
 */
export class Envelope extends Schema.Class<Envelope>("@scenesystems/effect-dsp/OptimizerEvent/Envelope")({
  optimizer: Kind,
  eventTag: Schema.String,
  payload: Payload
}) {}

/**
 * Decodes a tagged wrapper around one domain-specific event.
 *
 * @remarks
 * The outer tag selects the schema for `event`. This union retains the complete
 * typed event and differs from {@link Envelope}, whose payload is
 * serialized into a schema-bound JSON document.
 *
 * @since 0.1.0
 * @category events
 */
export const OptimizerEvent = Schema.Union(
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
  })
)

/**
 * Wraps one optimizer, search, or evaluation event with its owning domain tag.
 *
 * @since 0.1.0
 * @category events
 */
export type OptimizerEvent = typeof OptimizerEvent.Type

/**
 * Constructs and exhaustively matches wrapped events by `_tag`.
 *
 * @since 0.1.0
 * @category events
 */
export const events = Data.taggedEnum<OptimizerEvent>()

/**
 * Encodes a Bootstrap event into a schema-bound JSON document.
 *
 * @remarks
 * The envelope uses optimizer ID `bootstrapFewShot` and preserves the event's
 * `_tag`. Encoding failures remain native typed parse failures.
 *
 * @since 0.1.0
 * @category constructors
 */
export const fromBootstrap = (
  event: BootstrapEvent
): Effect.Effect<Envelope, ParseResult.ParseError> =>
  encodePayload(BootstrapEventSchema, event).pipe(
    Effect.map((payload) =>
      new Envelope({
        optimizer: "bootstrapFewShot",
        eventTag: event._tag,
        payload
      })
    )
  )

/**
 * Encodes a MIPROv2 event into a schema-bound JSON document.
 *
 * @remarks
 * The envelope uses optimizer ID `miprov2` and preserves the event's `_tag`.
 * Encoding failures remain native typed parse failures.
 *
 * @since 0.1.0
 * @category constructors
 */
export const fromMIPROv2 = (
  event: MIPROv2Event
): Effect.Effect<Envelope, ParseResult.ParseError> =>
  encodePayload(MIPROv2EventSchema, event).pipe(
    Effect.map((payload) =>
      new Envelope({
        optimizer: "miprov2",
        eventTag: event._tag,
        payload
      })
    )
  )

/**
 * Encodes a GEPA event into a schema-bound JSON document.
 *
 * @remarks
 * The envelope uses optimizer ID `gepa` and preserves the event's `_tag`.
 * Encoding failures remain native typed parse failures.
 *
 * @since 0.1.0
 * @category constructors
 */
export const fromGEPA = (
  event: GEPAEvent
): Effect.Effect<Envelope, ParseResult.ParseError> =>
  encodePayload(GEPAEventSchema, event).pipe(
    Effect.map((payload) =>
      new Envelope({
        optimizer: "gepa",
        eventTag: event._tag,
        payload
      })
    )
  )
