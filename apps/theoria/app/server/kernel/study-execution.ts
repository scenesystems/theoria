import { Effect, Option } from "effect"

import type { RunnableEntryId } from "../../contracts/entry/id.js"
import type { StudyManifest } from "../../contracts/study/manifest.js"
import type { RunData } from "../../contracts/study/run.js"

import { ExecutionPolicy, type Lane } from "./kinds/policy.js"
import type { StudyRunEnv, StudyStreamPlanFactory } from "./registration.js"
import { runStreamPlanExecution } from "./stream-plan-execution.js"
import { type EntryStreamRequest, validateEntryStreamRequest } from "./stream-request.js"
import { executionTimeoutError, normalizeStudyExecutionError } from "./study-execution-error.js"

const runStudyEffectInLane = <A, E>(lane: Lane, effect: Effect.Effect<A, E, StudyRunEnv>) =>
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

export const runStudyExecution = ({
  acceptsManifest,
  execute,
  executionId,
  id,
  lane,
  request,
  streamPlan
}: {
  readonly acceptsManifest: (manifest: StudyManifest | null) => boolean
  readonly execute: Effect.Effect<typeof RunData.Type, unknown, StudyRunEnv> | null
  readonly executionId: string
  readonly id: RunnableEntryId
  readonly lane: Lane
  readonly request: EntryStreamRequest
  readonly streamPlan: StudyStreamPlanFactory
}) =>
  Effect.gen(function*() {
    yield* validateEntryStreamRequest({ acceptsManifest, id, request })

    return yield* Option.fromNullable(streamPlan).pipe(
      Option.match({
        onNone: () =>
          Option.fromNullable(execute).pipe(
            Option.match({
              onNone: () => Effect.dieMessage(`Study ${id} does not define a direct execution effect.`),
              onSome: (resolvedExecute) =>
                runStudyEffectInLane(lane, resolvedExecute).pipe(
                  Effect.catchAll((error) =>
                    normalizeStudyExecutionError({
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
            runStreamPlanExecution({
              executionId,
              id,
              lane,
              request,
              runLaneEffect: runStudyEffectInLane,
              resolveStreamPlan
            })
          )
      })
    )
  })
