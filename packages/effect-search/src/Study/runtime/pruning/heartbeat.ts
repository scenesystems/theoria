/**
 * Cooperative stop decisions and objective-scoped study controls.
 *
 * @since 0.1.0
 */
import type * as Stop from "@scenesystems/effect-study/Stop"
import type { Effect } from "effect"
import type { Option } from "effect"
import { Data } from "effect"

import type { ArtifactStorageError } from "../../../Errors/Artifact.js"
import type { InvalidObjectiveReport } from "../../../Errors/Study.js"
import type { PruneDecision } from "./decision.js"

export {
  Continue as ContinueHeartbeat,
  type Decision as HeartbeatDecision,
  Decision as HeartbeatDecisionSchema,
  matchDecision as matchHeartbeatDecision,
  preferredRequest as preferredStopRequest,
  Request as StopRequest,
  Stop as StopHeartbeat
} from "@scenesystems/effect-study/Stop"

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
  readonly heartbeat: Effect.Effect<Stop.Decision>
  /** Requests the configured stop mode, defaulting the reason to `"requested"`; publishing the request may fail with the event sink's error. */
  readonly requestStop: (reason?: string) => Effect.Effect<void, ArtifactStorageError>
  /** Scheduled resource level, or `Option.none()` for a flat study. */
  readonly resource: Effect.Effect<Option.Option<number>>
}> {}
