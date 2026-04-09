import { Effect, Option } from "effect"

import type { RunnableEntryId } from "../../contracts/entry/id.js"
import type { StreamManifest } from "../../contracts/evidence/manifest.js"
import type { RunData } from "../../contracts/study/run.js"

import { ExecutionPolicy, type Lane } from "./kinds/policy.js"
import type { EntryRunEnv, EntryStreamPlanFactory } from "./registration.js"
import { type EntryStreamRequest, validateEntryStreamRequest } from "./stream-request.js"
import { executionTimeoutError, normalizeWorkflowExecutionError } from "./workflow-execution-error.js"
import { runStreamPlanWorkflow } from "./workflow-stream-plan.js"

const runEntryEffectInLane = <A, E>(lane: Lane, effect: Effect.Effect<A, E, EntryRunEnv>) =>
  Effect.gen(function*() {
    const policy = yield* ExecutionPolicy

    return yield* policy.withLane(lane, effect).pipe(
      Effect.timeoutOption(policy.timeoutMillis(lane)),
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.fail(executionTimeoutError()),
          onSome: Effect.succeed
        })
      )
    )
  })

export const runEntryWorkflowExecution = ({
  acceptsManifest,
  execute,
  executionId,
  id,
  lane,
  request,
  streamPlan
}: {
  readonly acceptsManifest: (manifest: StreamManifest | null) => boolean
  readonly execute: Effect.Effect<typeof RunData.Type, unknown, EntryRunEnv> | null
  readonly executionId: string
  readonly id: RunnableEntryId
  readonly lane: Lane
  readonly request: EntryStreamRequest
  readonly streamPlan: EntryStreamPlanFactory
}) =>
  Effect.gen(function*() {
    yield* validateEntryStreamRequest({ acceptsManifest, id, request })

    return yield* Option.fromNullable(streamPlan).pipe(
      Option.match({
        onNone: () =>
          Option.fromNullable(execute).pipe(
            Option.match({
              onNone: () => Effect.dieMessage(`Entry ${id} does not define a direct execution effect.`),
              onSome: (resolvedExecute) =>
                runEntryEffectInLane(lane, resolvedExecute).pipe(
                  Effect.catchAll((error) =>
                    normalizeWorkflowExecutionError({
                      entryId: id,
                      executionId,
                      error,
                      runToken: request.runToken
                    })
                  )
                )
            })
          ),
        onSome: (resolveStreamPlan) =>
          Effect.scoped(
            runStreamPlanWorkflow({
              executionId,
              id,
              lane,
              request,
              runLaneEffect: runEntryEffectInLane,
              resolveStreamPlan
            })
          )
      })
    )
  })
