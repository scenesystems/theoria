/**
 * Runtime controls wiring stop requests, intermediate reporting, and heartbeat decisions.
 *
 * @since 0.1.0
 */
import { Effect, FiberRef, Option } from "effect"

import * as Stop from "@scenesystems/effect-study/Stop"
import { Runtime as PruningRuntime } from "../../../Pruning.js"
import { InvalidObjectiveReport } from "../../../SearchError.js"
import { makeReportRefs, recordReport } from "./controls/reporting.js"
import { ReportRefs, type StopRef } from "./controls/reportState.js"
import { heartbeatDecision, makeStopRef, requestStudyStop } from "./controls/stop.js"
import { CurrentTrialContext, type TrialContext } from "./trialContext.js"

export { heartbeatDecision, makeReportRefs, makeStopRef, recordReport, ReportRefs, requestStudyStop, type StopRef }

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
 * Singleton PruningRuntime wired to the current trial's fiber-local context for report, heartbeat, stop, and resource access.
 *
 * @since 0.1.0
 * @category models
 */
export const objectiveRuntime = new PruningRuntime({
  report: (step, value) =>
    withCurrentTrialContext(
      () => Effect.fail(missingContextReport(step, value)),
      (context) =>
        recordReport(
          context.studyRuntime,
          context.reportRefs,
          context.trialNumber,
          context.pruningPolicy,
          step,
          value
        )
    ),
  heartbeat: withCurrentTrialContext(
    () => Effect.succeed(Stop.Continue()),
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
    () => Effect.succeedNone,
    (context) => Effect.succeed(context.resource)
  )
})
