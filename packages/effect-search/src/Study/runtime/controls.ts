/**
 * Runtime controls wiring stop requests, intermediate reporting, and heartbeat decisions.
 *
 * @since 0.1.0
 */
import { Effect, FiberRef, Option } from "effect"

import { InvalidObjectiveReport } from "../../Errors/index.js"
import { ReportRefs, StopRef } from "./controls/model.js"
import { recordIntermediateReport } from "./controls/reporting.js"
import { heartbeatDecision, requestStudyStop } from "./controls/stop.js"
import { ContinueHeartbeat, ObjectiveTrialRuntime } from "./pruning.js"
import { CurrentTrialContext, type TrialContext } from "./trialContext.js"

export {
  /** @since 0.1.0 */
  heartbeatDecision,
  /** @since 0.1.0 */
  recordIntermediateReport,
  /** @since 0.1.0 */
  ReportRefs,
  /** @since 0.1.0 */
  requestStudyStop,
  /** @since 0.1.0 */
  StopRef
}

const withCurrentTrialContext = <A, E>(
  onNone: () => Effect.Effect<A, E>,
  onSome: (context: TrialContext) => Effect.Effect<A, E>
): Effect.Effect<A, E> =>
  FiberRef.get(CurrentTrialContext).pipe(
    Effect.flatMap(
      Option.match({
        onNone,
        onSome
      })
    )
  )

const missingContextReport = (step: number, value: number): InvalidObjectiveReport =>
  new InvalidObjectiveReport({
    trialNumber: -1,
    reason: "missing-trial-context",
    step,
    value
  })

/**
 * Singleton ObjectiveTrialRuntime wired to the current trial's fiber-local context for report, heartbeat, stop, and resource access.
 *
 * @since 0.1.0
 * @category models
 */
export const objectiveRuntime = new ObjectiveTrialRuntime({
  report: (step, value) =>
    withCurrentTrialContext(
      () => Effect.fail(missingContextReport(step, value)),
      (context) =>
        recordIntermediateReport(
          context.studyRuntime,
          context.reportRefs,
          context.trialNumber,
          context.pruningPolicy,
          step,
          value
        )
    ),
  heartbeat: withCurrentTrialContext(
    () => Effect.succeed(ContinueHeartbeat()),
    (context) => heartbeatDecision(context.stopRef, context.stopMode)
  ),
  requestStop: (reason = "requested") =>
    withCurrentTrialContext(
      () => Effect.void,
      (context) =>
        requestStudyStop(
          context.studyRuntime,
          context.stopRef,
          context.stopMode,
          context.trialNumber,
          reason
        )
    ),
  resource: withCurrentTrialContext(
    () => Effect.succeed(Option.none()),
    (context) => Effect.succeed(context.resource)
  )
})
