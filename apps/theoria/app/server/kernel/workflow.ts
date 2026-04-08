import type { FileSystem, Path } from "@effect/platform"
import { Workflow } from "@effect/workflow"
import type { Scope } from "effect"
import { Effect, Option } from "effect"

import { DemoExecutionError } from "../../contracts/demo-error.js"
import { type RunnableEntryId } from "../../contracts/entry/id.js"
import { type StreamManifest } from "../../contracts/evidence/manifest.js"
import { RunData } from "../../contracts/study/run.js"
import type { DspProviderRuntime } from "../capability/effect-dsp.js"
import { ExecutionPolicy, type Lane } from "./kinds/policy.js"
import { type DemoStreamPlan } from "./kinds/stream-plan.js"
import { encodeEntryStreamRequestJson, EntryStreamRequest } from "./stream-request.js"
import { executionTimeoutError, normalizeWorkflowExecutionError } from "./workflow-execution-error.js"
import { runWorkflowName, validateWorkflowRequest } from "./workflow-request.js"
import { runStreamPlanWorkflow } from "./workflow-stream-plan.js"

type ProgramSourceEnv = FileSystem.FileSystem | Path.Path
type DemoRunEnv = DspProviderRuntime | ProgramSourceEnv
type DemoStreamPlanFactory =
  | ((
    manifest: StreamManifest | null
  ) => Effect.Effect<DemoStreamPlan<DemoRunEnv, unknown>, unknown, DemoRunEnv | Scope.Scope>)
  | null

export type DemoRunWorkflow = Workflow.Workflow<
  string,
  typeof EntryStreamRequest,
  typeof RunData,
  typeof DemoExecutionError
>

const runLaneEffect = <A, E>(lane: Lane, effect: Effect.Effect<A, E, DemoRunEnv>) =>
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

export const makeDemoRunWorkflowRegistration = ({
  acceptsManifest,
  execute,
  id,
  lane,
  streamPlan
}: {
  readonly acceptsManifest: (manifest: StreamManifest | null) => boolean
  readonly execute: Effect.Effect<RunData, unknown, DemoRunEnv>
  readonly id: RunnableEntryId
  readonly lane: Lane
  readonly streamPlan: DemoStreamPlanFactory
}) => {
  const workflow = Workflow.make({
    name: runWorkflowName(id),
    payload: EntryStreamRequest,
    success: RunData,
    error: DemoExecutionError,
    idempotencyKey: encodeEntryStreamRequestJson
  })

  return {
    workflow,
    workflowLive: workflow.toLayer(
      Effect.fnUntraced(function*(request, executionId) {
        yield* validateWorkflowRequest({ acceptsManifest, id, request })

        return yield* Option.fromNullable(streamPlan).pipe(
          Option.match({
            onNone: () =>
              runLaneEffect(lane, execute).pipe(
                Effect.catchAll((error) =>
                  normalizeWorkflowExecutionError({
                    demoId: id,
                    executionId,
                    error,
                    runToken: request.runToken
                  })
                )
              ),
            onSome: (resolvedPlan) =>
              Effect.scoped(
                runStreamPlanWorkflow({
                  executionId,
                  id,
                  lane,
                  request,
                  runLaneEffect,
                  streamPlan: resolvedPlan
                })
              )
          })
        )
      })
    )
  }
}
