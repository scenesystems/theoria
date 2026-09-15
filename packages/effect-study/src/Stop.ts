/**
 * Deterministic study stop requests and cooperative objective polling.
 *
 * @since 0.1.0
 * @module
 */
import {
  Boolean as Bool,
  Data,
  Effect,
  Equal as Eq,
  Match,
  Number as Num,
  Option,
  Order,
  Ref as EffectRef,
  Schema,
  String as Str,
  Tuple
} from "effect"

/**
 * `Drain` stops admission while active work finishes. `Interrupt` additionally
 * asks active work to stop when it next polls; it does not interrupt fibers.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Mode = Schema.Literal("Drain", "Interrupt")

/**
 * Cooperative behavior selected for a study stop request.
 *
 * @since 0.1.0
 * @category type-level
 */
export type Mode = typeof Mode.Type

/**
 * Resolves an omitted mode to draining active work.
 *
 * @since 0.1.0
 * @category constructors
 */
export const defaultMode = (): Mode => "Drain"

/**
 * Returns the selected mode, defaulting to `Drain`.
 *
 * @since 0.1.0
 * @category constructors
 */
export const modeOrDefault = (mode: Option.Option<Mode>): Mode => Option.getOrElse(mode, defaultMode)

/**
 * A trial-attributed request to stop admitting work.
 *
 * @since 0.1.0
 * @category models
 */
export class Request extends Schema.Class<Request>("effect-study/Stop/Request")({
  /** Whether active work may finish or should stop at its next poll. */
  mode: Mode,
  /** Caller-owned diagnostic text. */
  reason: Schema.String,
  /** Trial number used for deterministic request precedence. */
  requestedByTrialNumber: Schema.Number
}) {}

/**
 * Mutable native Effect reference containing the selected request, when present.
 *
 * @since 0.1.0
 * @category type-level
 */
export type Ref = EffectRef.Ref<Option.Option<Request>>

/**
 * Result of cooperatively polling a study stop reference.
 *
 * @since 0.1.0
 * @category schemas
 */
export const Decision = Schema.Union(
  Schema.TaggedStruct("Continue", {}),
  Schema.TaggedStruct("Stop", {
    mode: Mode,
    reason: Schema.String
  })
)

/**
 * A cooperative continue-or-stop decision.
 *
 * @since 0.1.0
 * @category type-level
 */
export type Decision = typeof Decision.Type

const Decisions = Data.taggedEnum<Decision>()

/**
 * Constructors and exhaustive matching for cooperative poll decisions.
 *
 * @since 0.1.0
 * @category constructors
 */
export const {
  /** Indicates that active work may continue. @since 0.1.0 @category constructors */
  Continue,
  /** Asks active work to stop cooperatively. @since 0.1.0 @category constructors */
  Stop,
  /** Matches every cooperative decision tag. @since 0.1.0 @category pattern-matching */
  $match: matchDecision
} = Decisions

const interruptFirst = (mode: Mode): boolean =>
  Match.value(mode).pipe(
    Match.when("Drain", () => true),
    Match.when("Interrupt", () => false),
    Match.exhaustive
  )

const requestOrder: Order.Order<Request> = Order.combine(
  Order.mapInput(Num.Order, (request: Request) => request.requestedByTrialNumber),
  Order.combine(
    Order.mapInput(Bool.Order, (request: Request) => interruptFirst(request.mode)),
    Order.mapInput(Str.Order, (request: Request) => request.reason)
  )
)

/**
 * Selects the lower trial number, then `Interrupt`, then the lexicographically
 * lower reason. Selection is deterministic and independent of arrival order.
 *
 * @since 0.1.0
 * @category combinators
 */
export const preferredRequest = Order.min(requestOrder)

/**
 * Creates a fresh native stop reference with no selected request.
 *
 * @since 0.1.0
 * @category constructors
 */
export const make: Effect.Effect<Ref> = EffectRef.make<Option.Option<Request>>(Option.none())

/**
 * Atomically combines a candidate with the selected request. The result is
 * present only when the selected value changed, allowing callers to publish
 * boundary-specific events without duplicate notifications.
 *
 * @since 0.1.0
 * @category combinators
 */
export const request = (ref: Ref, candidate: Request): Effect.Effect<Option.Option<Request>> =>
  EffectRef.modify(ref, (current) =>
    Option.match(current, {
      onNone: () => Tuple.make(Option.some(candidate), Option.some(candidate)),
      onSome: (existing) => {
        const selected = preferredRequest(existing, candidate)
        const changed = Option.liftPredicate(selected, () => Bool.not(Eq.equals(existing, selected)))
        return Tuple.make(changed, Option.some(selected))
      }
    }))

/**
 * Reads the selected request without waiting. Drain mode always continues;
 * Interrupt mode exposes the selected request while leaving termination to the
 * polling objective.
 *
 * @since 0.1.0
 * @category combinators
 */
export const heartbeat = (ref: Ref, mode: Mode): Effect.Effect<Decision> =>
  EffectRef.get(ref).pipe(
    Effect.map(
      Option.match({
        onNone: () => Continue(),
        onSome: (selected) =>
          Match.value(mode).pipe(
            Match.when("Drain", () => Continue()),
            Match.when("Interrupt", () => Stop({ mode: selected.mode, reason: selected.reason })),
            Match.exhaustive
          )
      })
    )
  )
