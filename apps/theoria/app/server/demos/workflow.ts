import type { FileSystem, Path } from "@effect/platform"
import { Activity, Workflow } from "@effect/workflow"
import type { Scope } from "effect"
import { Clock, Effect, Option, Ref, Schema } from "effect"

import { DemoExecutionError } from "../../contracts/demo-error.js"
import {
  applyEvidenceEventToStore,
  emptyEvidenceStoreState,
  evidenceSectionsFromStore
} from "../../contracts/evidence-store.js"
import { type EvidenceEvent, StreamComplete, StreamFailed } from "../../contracts/evidence-stream.js"
import type { RunnableDemoId } from "../../contracts/id.js"
import { Program } from "../../contracts/presentation.js"
import {
  encodeRunWorkflowRequestJson,
  resolveRunWorkflowIdentity,
  RunWorkflowRequest
} from "../../contracts/run-plan.js"
import { RunData } from "../../contracts/run.js"
import type { StreamManifest } from "../../contracts/stream-manifest.js"
import { RuntimeInfo } from "../config/runtime.js"
import type { DspProviderRuntime } from "./effect-dsp/provider.js"
import { DspProviderUnavailable } from "./effect-dsp/provider.js"
import { ExecutionPolicy, type Lane } from "./policy.js"
import { type DemoStreamPlan, EvidenceEventBatch } from "./stream-plan.js"
import { DemoStreamSessionRegistry } from "./stream-session-registry.js"

type ProgramSourceEnv = FileSystem.FileSystem | Path.Path
type DemoRunEnv = DspProviderRuntime | ProgramSourceEnv
type DemoStreamPlanFactory =
  | ((
    manifest: StreamManifest | null
  ) => Effect.Effect<DemoStreamPlan<DemoRunEnv, unknown>, unknown, DemoRunEnv | Scope.Scope>)
  | null

export type DemoRunWorkflow = Workflow.Workflow<
  string,
  typeof RunWorkflowRequest,
  typeof RunData,
  typeof DemoExecutionError
>

const isProviderUnavailable = Schema.is(DspProviderUnavailable)
const isDemoExecutionError = Schema.is(DemoExecutionError)

const runWorkflowName = (id: RunnableDemoId): string => `theoria-demo-${id}-run`

const invalidDemoRequestError = (id: RunnableDemoId): DemoExecutionError =>
  new DemoExecutionError({
    code: "invalid-demo-id",
    message: `Run workflow request does not match the ${id} demo.`,
    retryable: false
  })

const invalidManifestError = (id: RunnableDemoId): DemoExecutionError =>
  new DemoExecutionError({
    code: "invalid-query",
    message: `Run workflow manifest does not match the ${id} demo.`,
    retryable: false
  })

const executionTimeoutError = (): DemoExecutionError =>
  new DemoExecutionError({
    code: "execution-timeout",
    message: "Demo execution timed out.",
    retryable: true
  })

const providerUnavailableError = (message: string): DemoExecutionError =>
  new DemoExecutionError({
    code: "provider-unavailable",
    message,
    retryable: false
  })

const genericExecutionError = (): DemoExecutionError =>
  new DemoExecutionError({
    code: "execution-failed",
    message: "Demo execution failed.",
    retryable: true
  })

const validateRequest = ({
  acceptsManifest,
  id,
  request
}: {
  readonly acceptsManifest: (manifest: StreamManifest | null) => boolean
  readonly id: RunnableDemoId
  readonly request: typeof RunWorkflowRequest.Type
}) =>
  request.plan.id !== id
    ? Effect.fail(invalidDemoRequestError(id))
    : acceptsManifest(request.plan.manifest)
    ? Effect.void
    : Effect.fail(invalidManifestError(id))

const unexpectedExecutionFailure = ({
  demoId,
  executionId,
  runToken,
  error
}: {
  readonly demoId: RunnableDemoId
  readonly executionId: string
  readonly runToken: string
  readonly error: unknown
}) =>
  Effect.logError("theoria demo workflow failed").pipe(
    Effect.annotateLogs("demoId", demoId),
    Effect.annotateLogs("executionId", executionId),
    Effect.annotateLogs("runToken", runToken),
    Effect.annotateLogs("error", String(error)),
    Effect.as(genericExecutionError())
  )

const resolveExecutionError = ({
  demoId,
  executionId,
  error,
  runToken
}: {
  readonly demoId: RunnableDemoId
  readonly executionId: string
  readonly error: unknown
  readonly runToken: string
}) =>
  isProviderUnavailable(error)
    ? Effect.succeed(providerUnavailableError(error.message))
    : isDemoExecutionError(error)
    ? Effect.succeed(error)
    : unexpectedExecutionFailure({ demoId, executionId, error, runToken })

const normalizeExecutionError = ({
  demoId,
  executionId,
  error,
  runToken
}: {
  readonly demoId: RunnableDemoId
  readonly executionId: string
  readonly error: unknown
  readonly runToken: string
}) => resolveExecutionError({ demoId, executionId, error, runToken }).pipe(Effect.flatMap(Effect.fail))

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

const appendBatchActivity = ({
  batchIndex,
  events,
  phaseName,
  sessionKey
}: {
  readonly batchIndex: number
  readonly events: ReadonlyArray<EvidenceEvent>
  readonly phaseName: string
  readonly sessionKey: string
}) =>
  Activity.make({
    name: `${phaseName}-batch-${batchIndex}`,
    execute: DemoStreamSessionRegistry.pipe(
      Effect.flatMap((registry) => registry.appendBatch({ batchIndex, events, sessionKey }))
    )
  })

const appendActiveBatch = ({
  batchIndexRef,
  events,
  phaseName,
  sessionKey
}: {
  readonly batchIndexRef: Ref.Ref<number>
  readonly events: ReadonlyArray<EvidenceEvent>
  readonly phaseName: string
  readonly sessionKey: string
}) =>
  events.length === 0
    ? Effect.void
    : Ref.get(batchIndexRef).pipe(
      Effect.flatMap((batchIndex) =>
        appendBatchActivity({ batchIndex, events, phaseName, sessionKey }).pipe(
          Effect.zipRight(Ref.set(batchIndexRef, batchIndex + 1))
        )
      )
    )

const runDataFromStreamStore = ({
  durationMs,
  id,
  packageName,
  program,
  store,
  summary
}: {
  readonly durationMs: number
  readonly id: RunnableDemoId
  readonly packageName: string
  readonly program: typeof Program.Type
  readonly store: typeof emptyEvidenceStoreState
  readonly summary: string
}): typeof RunData.Type => ({
  id,
  packageName,
  summary,
  durationMs,
  program,
  sections: evidenceSectionsFromStore(store)
})

const runStreamPlanWorkflow = ({
  executionId,
  id,
  lane,
  request,
  streamPlan
}: {
  readonly executionId: string
  readonly id: RunnableDemoId
  readonly lane: Lane
  readonly request: typeof RunWorkflowRequest.Type
  readonly streamPlan: Exclude<DemoStreamPlanFactory, null>
}) =>
  Effect.gen(function*() {
    const identity = yield* resolveRunWorkflowIdentity(request)
    const sessionKey = identity.requestFingerprint
    const batchIndexRef = yield* Ref.make(0)
    const storeRef = yield* Ref.make(emptyEvidenceStoreState)

    return yield* Effect.gen(function*() {
      const plan = yield* streamPlan(request.plan.manifest).pipe(
        Effect.catchAll((error) =>
          normalizeExecutionError({
            demoId: id,
            executionId,
            error,
            runToken: request.runToken
          })
        )
      )
      const startedAtMs = yield* Clock.currentTimeMillis
      const program = yield* Activity.make({
        error: DemoExecutionError,
        name: "prepare-program",
        success: Program,
        execute: plan.program.pipe(
          Effect.catchAll((error) =>
            normalizeExecutionError({
              demoId: id,
              executionId,
              error,
              runToken: request.runToken
            })
          )
        )
      })

      yield* Effect.forEach(plan.phases, (phase) =>
        Activity.make({
          error: DemoExecutionError,
          name: `phase-${phase.name}`,
          success: EvidenceEventBatch,
          execute: runLaneEffect(lane, phase.events).pipe(
            Effect.catchAll((error) =>
              normalizeExecutionError({
                demoId: id,
                executionId,
                error,
                runToken: request.runToken
              })
            )
          )
        }).pipe(
          Effect.flatMap((events) =>
            Effect.forEach(
              events,
              (event) =>
                Ref.update(storeRef, (store) => applyEvidenceEventToStore(store, event)).pipe(
                  Effect.zipRight(
                    appendActiveBatch({
                      batchIndexRef,
                      events: [event],
                      phaseName: `phase-${phase.name}`,
                      sessionKey
                    })
                  )
                ),
              { discard: true }
            )
          )
        ), { discard: true })

      const store = yield* Ref.get(storeRef)
      const finalizedRun = yield* Activity.make({
        name: "finalize-run",
        success: RunData,
        execute: Clock.currentTimeMillis.pipe(
          Effect.map((endedAtMs) =>
            runDataFromStreamStore({
              durationMs: endedAtMs - startedAtMs,
              id,
              packageName: plan.packageName,
              program,
              store,
              summary: plan.summary
            })
          )
        )
      })
      const runtimeInfo = yield* RuntimeInfo

      yield* appendActiveBatch({
        batchIndexRef,
        events: [
          new StreamComplete({
            summary: finalizedRun.summary,
            meta: {
              requestId: request.runToken,
              buildSha: runtimeInfo.buildSha,
              durationMs: finalizedRun.durationMs
            }
          })
        ],
        phaseName: "finalize-run",
        sessionKey
      })

      return finalizedRun
    }).pipe(
      Effect.catchAll((error) =>
        resolveExecutionError({ demoId: id, executionId, error, runToken: request.runToken }).pipe(
          Effect.flatMap((normalizedError) =>
            appendActiveBatch({
              batchIndexRef,
              events: [
                new StreamFailed({
                  error: {
                    code: normalizedError.code,
                    message: normalizedError.message,
                    retryable: normalizedError.retryable
                  }
                })
              ],
              phaseName: "stream-failed",
              sessionKey
            }).pipe(Effect.zipRight(Effect.fail(normalizedError)))
          )
        )
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
  readonly id: RunnableDemoId
  readonly lane: Lane
  readonly streamPlan: DemoStreamPlanFactory
}) => {
  const workflow = Workflow.make({
    name: runWorkflowName(id),
    payload: RunWorkflowRequest,
    success: RunData,
    error: DemoExecutionError,
    idempotencyKey: encodeRunWorkflowRequestJson
  })

  return {
    workflow,
    workflowLive: workflow.toLayer(
      Effect.fnUntraced(function*(request, executionId) {
        yield* validateRequest({ acceptsManifest, id, request })

        return yield* Option.fromNullable(streamPlan).pipe(
          Option.match({
            onNone: () =>
              runLaneEffect(lane, execute).pipe(
                Effect.catchAll((error) =>
                  normalizeExecutionError({
                    demoId: id,
                    executionId,
                    error,
                    runToken: request.runToken
                  })
                )
              ),
            onSome: (resolvedPlan) =>
              Effect.scoped(runStreamPlanWorkflow({ executionId, id, lane, request, streamPlan: resolvedPlan }))
          })
        )
      })
    )
  }
}
