import { Effect } from "effect"

import type { EntryExecutionError } from "../../contracts/entry-error.js"
import type { RunnableEntryId } from "../../contracts/entry/id.js"
import type { ExecutionPolicy, Lane } from "./kinds/policy.js"
import type { StudyRunEnv, StudyStreamPlanFactory } from "./registration.js"
import { runResolvedStreamPlan } from "./stream-plan-run.js"
import { type EntryStreamRequest, manifestForRequest, resolveEntryStreamRequestFingerprint } from "./stream-request.js"
import { StudyStreamSession } from "./stream-session.js"
import { normalizeStudyExecutionError } from "./study-execution-error.js"

type ResolvedStudyStreamPlanFactory = NonNullable<StudyStreamPlanFactory>

export const runStreamPlanExecution = ({
  executionId,
  id,
  lane,
  request,
  runLaneEffect,
  resolveStreamPlan
}: {
  readonly executionId: string
  readonly id: RunnableEntryId
  readonly lane: Lane
  readonly request: EntryStreamRequest
  readonly runLaneEffect: <A, E>(
    lane: Lane,
    effect: Effect.Effect<A, E, StudyRunEnv>
  ) => Effect.Effect<A, EntryExecutionError | E, StudyRunEnv | ExecutionPolicy>
  readonly resolveStreamPlan: ResolvedStudyStreamPlanFactory
}) =>
  Effect.gen(function*() {
    const sessionKey = yield* resolveEntryStreamRequestFingerprint(request)
    const session = yield* StudyStreamSession.allocate(sessionKey)
    const manifest = manifestForRequest(request)
    const plan = yield* resolveStreamPlan(manifest).pipe(
      Effect.catchAll((error) =>
        normalizeStudyExecutionError({
          entryId: id,
          executionId,
          error,
          runToken: request.runToken
        })
      )
    )

    return yield* runResolvedStreamPlan({
      executionId,
      id,
      lane,
      plan,
      request,
      runLaneEffect,
      session
    })
  })
