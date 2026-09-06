/**
 * Cooperative stop decisions and objective-scoped study controls.
 *
 * @since 0.1.0
 */
import type { Effect } from "effect"
import type { Option } from "effect"
import { Data, Match, Schema } from "effect"

import type { ArtifactStorageError } from "../../../Errors/Artifact.js"
import type { InvalidObjectiveReport } from "../../../Errors/Study.js"
import type { PruneDecision } from "./decision.js"
import type { StopMode } from "./stopMode.js"
import { StopModeSchema } from "./stopMode.js"

/**
 * Decodes the result of polling `ObjectiveTrialRuntime.heartbeat`. `Stop`
 * includes the selected study request, but the objective remains responsible for
 * ending its own work.
 *
 * @since 0.1.0
 * @category schemas
 */
export const HeartbeatDecisionSchema = Schema.Union(
  Schema.TaggedStruct("Continue", {}),
  Schema.TaggedStruct("Stop", {
    mode: StopModeSchema,
    reason: Schema.String
  })
)

/**
 * Tells a cooperative objective whether a study stop request is currently active.
 *
 * @since 0.1.0
 * @category type-level
 */
export type HeartbeatDecision = Schema.Schema.Type<typeof HeartbeatDecisionSchema>

const HeartbeatDecisions = Data.taggedEnum<HeartbeatDecision>()

/**
 * Constructors and exhaustive matching for heartbeat decisions.
 *
 * @since 0.1.0
 * @category constructors
 */
export const {
  /**
   * Indicates that no interrupting stop request is visible to the objective.
   *
   * @since 0.1.0
   * @category constructors
   */
  Continue: ContinueHeartbeat,
  /**
   * Carries the selected stop mode and reason to a cooperative objective. This
   * value does not interrupt an Effect by itself.
   *
   * @since 0.1.0
   * @category constructors
   */
  Stop: StopHeartbeat,
  /**
   * Builds a function requiring branches for continue and stop decisions.
   *
   * @typeParam Cases - Exhaustive handler record whose return values determine the result union.
   *
   * @since 0.1.0
   * @category pattern-matching
   */
  $match: matchHeartbeatDecision
} = HeartbeatDecisions

/**
 * Attributes a request to stop admitting work to the trial that issued it.
 *
 * @since 0.1.0
 * @category models
 */
export class StopRequest extends Data.Class<{
  /** Whether active objectives may finish or should stop cooperatively. */
  readonly mode: StopMode
  /** Caller-supplied diagnostic text. */
  readonly reason: string
  /** Trial used for deterministic request precedence. */
  readonly requestedByTrialNumber: number
}> {}

const modeRank = (mode: StopMode): number =>
  Match.value(mode).pipe(
    Match.when("Interrupt", () => 0),
    Match.when("Drain", () => 1),
    Match.exhaustive
  )

/**
 * Selects the lower trial number. Requests from the same trial prefer
 * `Interrupt` over `Drain`, then the lexicographically smaller reason. These
 * rules make concurrent request resolution independent of arrival order.
 *
 * @since 0.1.0
 * @category combinators
 */
export const preferredStopRequest = (existing: StopRequest, candidate: StopRequest): StopRequest =>
  candidate.requestedByTrialNumber < existing.requestedByTrialNumber
    ? candidate
    : candidate.requestedByTrialNumber > existing.requestedByTrialNumber
    ? existing
    : modeRank(candidate.mode) < modeRank(existing.mode)
    ? candidate
    : modeRank(candidate.mode) > modeRank(existing.mode)
    ? existing
    : candidate.reason < existing.reason
    ? candidate
    : existing

/**
 * Gives an objective access to ordered intermediate reporting, cooperative stop
 * polling, study-stop requests, and an optional scheduler resource level.
 *
 * @since 0.1.0
 * @category models
 */
export class ObjectiveTrialRuntime extends Data.Class<{
  /**
   * Validates and records a finite value at a strictly increasing,
   * non-negative integer step, then returns the pruning policy's decision.
   * Fails with {@link InvalidObjectiveReport} for a rejected report and with the
   * event sink's {@link ArtifactStorageError} when the report cannot be published.
   */
  readonly report: (
    step: number,
    value: number
  ) => Effect.Effect<PruneDecision, InvalidObjectiveReport | ArtifactStorageError>
  /** Reads the selected stop request without waiting for one to appear. */
  readonly heartbeat: Effect.Effect<HeartbeatDecision>
  /** Requests the configured stop mode, defaulting the reason to `"requested"`; publishing the request may fail with the event sink's error. */
  readonly requestStop: (reason?: string) => Effect.Effect<void, ArtifactStorageError>
  /** Scheduled resource level, or `Option.none()` for a flat study. */
  readonly resource: Effect.Effect<Option.Option<number>>
}> {}
