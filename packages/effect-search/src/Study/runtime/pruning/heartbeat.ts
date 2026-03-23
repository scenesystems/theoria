/**
 * Heartbeat decision types and objective trial runtime for in-trial stop/continue signaling.
 *
 * @since 0.1.0
 */
import type { Effect } from "effect"
import type { Option } from "effect"
import { Data, Match, Schema } from "effect"

import type { PruneDecision } from "./decision.js"
import type { StopMode } from "./stopMode.js"
import { StopModeSchema } from "./stopMode.js"

/**
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
 * @since 0.1.0
 * @category type-level
 */
export type HeartbeatDecision = Schema.Schema.Type<typeof HeartbeatDecisionSchema>

const HeartbeatDecisions = Data.taggedEnum<HeartbeatDecision>()

/**
 * Destructured constructors and pattern matcher for the {@link HeartbeatDecision} tagged union.
 *
 * @since 0.1.0
 * @category constructors
 */
export const {
  /**
   * @since 0.1.0
   * @category constructors
   */
  Continue: ContinueHeartbeat,
  /**
   * @since 0.1.0
   * @category constructors
   */
  Stop: StopHeartbeat,
  /**
   * @since 0.1.0
   * @category pattern-matching
   */
  $match: matchHeartbeatDecision
} = HeartbeatDecisions

/**
 * @since 0.1.0
 * @category models
 */
export class StopRequest extends Data.Class<{
  readonly mode: StopMode
  readonly reason: string
  readonly requestedByTrialNumber: number
}> {}

const modeRank = (mode: StopMode): number =>
  Match.value(mode).pipe(
    Match.when("Interrupt", () => 0),
    Match.when("Drain", () => 1),
    Match.exhaustive
  )

/**
 * Select the preferred stop request between two candidates.
 *
 * @since 0.1.0
 * @category utils
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
 * Runtime context provided to the objective function during evaluation.
 *
 * @since 0.1.0
 * @category models
 */
export class ObjectiveTrialRuntime extends Data.Class<{
  readonly report: (step: number, value: number) => Effect.Effect<PruneDecision, unknown>
  readonly heartbeat: Effect.Effect<HeartbeatDecision>
  readonly requestStop: (reason?: string) => Effect.Effect<void>
  readonly resource: Effect.Effect<Option.Option<number>>
}> {}
