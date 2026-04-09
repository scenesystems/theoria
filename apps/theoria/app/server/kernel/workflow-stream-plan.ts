import { Effect } from "effect"

import type { EntryExecutionError } from "../../contracts/entry-error.js"
import type { RunnableEntryId } from "../../contracts/entry/id.js"
import type { ExecutionPolicy, Lane } from "./kinds/policy.js"
import type { EntryRunEnv, EntryStreamPlanFactory } from "./registration.js"
import { type EntryStreamRequest, manifestForRequest, resolveEntryStreamRequestFingerprint } from "./stream-request.js"
import { normalizeWorkflowExecutionError } from "./workflow-execution-error.js"
import { runResolvedWorkflowStreamPlan } from "./workflow-stream-run.js"
import { WorkflowStreamSession } from "./workflow-stream-session.js"

type ResolvedEntryStreamPlanFactory = NonNullable<EntryStreamPlanFactory>

export const runStreamPlanWorkflow = ({
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
    effect: Effect.Effect<A, E, EntryRunEnv>
  ) => Effect.Effect<A, EntryExecutionError | E, EntryRunEnv | ExecutionPolicy>
  readonly resolveStreamPlan: ResolvedEntryStreamPlanFactory
}) =>
  Effect.gen(function*() {
    const sessionKey = yield* resolveEntryStreamRequestFingerprint(request)
    const session = yield* WorkflowStreamSession.allocate(sessionKey)
    const manifest = manifestForRequest(request)
    const plan = yield* resolveStreamPlan(manifest).pipe(
      Effect.catchAll((error) =>
        normalizeWorkflowExecutionError({
          entryId: id,
          executionId,
          error,
          runToken: request.runToken
        })
      )
    )

    return yield* runResolvedWorkflowStreamPlan({
      executionId,
      id,
      lane,
      plan,
      request,
      runLaneEffect,
      session
    })
  })
