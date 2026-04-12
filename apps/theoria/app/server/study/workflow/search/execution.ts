import { Chunk, Effect, Fiber, Option, Ref, Stream } from "effect"
import { Sampler, Study } from "effect-search"
import * as Arr from "effect/Array"
import * as EffectRecord from "effect/Record"

import type { EvidenceEvent } from "../../../../contracts/evidence/stream.js"
import type { WorkflowExecutionLane } from "../../../../contracts/study/workflow/controls.js"
import { WorkflowStudyExecutionError } from "../../../../contracts/study/workflow/execution.js"
import type { FrozenWorkflowRun } from "../../../../contracts/study/workflow/frozen.js"
import { WorkflowScenarioManifest } from "../../../../contracts/study/workflow/manifest.js"
import type { DspProviderRuntime } from "../../../capability/effect-dsp.js"
import { workflowSearchProgressEvents } from "../evidence/search-progress.js"
import { searchSpaceForDimensions, trialBudgetForDimensions, type WorkflowSearchDimension } from "./dimensions.js"
import { selectionFromSearchStudyConfig } from "./outcome.js"
import { bestEvaluation } from "./progress.js"
import type { WorkflowSearchEvaluation, WorkflowSearchStudyOutcome } from "./schema.js"
import { evaluateWorkflowSearchSelection } from "./selection.js"

type WorkflowSearchProgressPublisher<R> = (
  events: ReadonlyArray<EvidenceEvent>
) => Effect.Effect<void, never, R>

export type WorkflowSearchStudyExecution = {
  readonly trialBudget: number
  readonly evaluations: Readonly<Record<string, WorkflowSearchEvaluation>>
  readonly events: WorkflowSearchStudyOutcome["events"]
  readonly result: Study.StudyResult<unknown>
  readonly snapshot: WorkflowSearchStudyOutcome["snapshot"]
}

const executionError = (message: string) =>
  new WorkflowStudyExecutionError({
    code: "execution-failed",
    message,
    retryable: false
  })

const publishBestEvaluation = <R>({
  workflowRun,
  dimensions,
  evaluations,
  current,
  publishProgress,
  trialBudget
}: {
  readonly workflowRun: FrozenWorkflowRun
  readonly current: WorkflowSearchEvaluation
  readonly dimensions: ReadonlyArray<WorkflowSearchDimension>
  readonly evaluations: Readonly<Record<string, WorkflowSearchEvaluation>>
  readonly publishProgress: WorkflowSearchProgressPublisher<R>
  readonly trialBudget: number
}) =>
  bestEvaluation(evaluations).pipe(
    Option.match({
      onNone: () => Effect.void,
      onSome: (best) =>
        publishProgress(
          workflowSearchProgressEvents({
            best,
            workflowRun,
            completedTrials: EffectRecord.keys(evaluations).length,
            current,
            dimensions,
            trialBudget
          })
        )
    })
  )

export const executeWorkflowSearchStudy = <R = never>({
  workflowRun,
  dimensions,
  lane,
  publishProgress = () => Effect.void
}: {
  readonly workflowRun: FrozenWorkflowRun
  readonly dimensions: ReadonlyArray<WorkflowSearchDimension>
  readonly lane: WorkflowExecutionLane
  readonly publishProgress?: WorkflowSearchProgressPublisher<R>
}): Effect.Effect<WorkflowSearchStudyExecution, WorkflowStudyExecutionError, R | DspProviderRuntime> =>
  Effect.scoped(
    Effect.gen(function*() {
      const trialBudget = trialBudgetForDimensions(dimensions)
      const evaluationByKeyRef = yield* Ref.make<Readonly<Record<string, WorkflowSearchEvaluation>>>({})
      const handle = yield* Study.open({
        space: searchSpaceForDimensions(dimensions),
        sampler: Sampler.tpe({
          seed: WorkflowScenarioManifest.forId(workflowRun.scenarioId).searchSeed(),
          nStartupTrials: Math.min(4, trialBudget),
          nEiCandidates: Math.max(8, trialBudget)
        }),
        direction: "maximize",
        trials: trialBudget,
        objective: () => Effect.succeed(0)
      }).pipe(
        Effect.mapError(() => executionError(`Workflow study setup failed for ${workflowRun.scenarioId}.`))
      )
      const eventFiber = yield* Effect.fork(Stream.runCollect(Study.events(handle)))

      yield* Effect.forEach(
        Arr.range(0, trialBudget - 1),
        () =>
          Study.ask(handle).pipe(
            Effect.mapError(() => executionError(`Workflow study reservation failed for ${workflowRun.scenarioId}.`)),
            Effect.flatMap((asked) =>
              selectionFromSearchStudyConfig(asked.config).pipe(
                Effect.flatMap((selection) =>
                  evaluateWorkflowSearchSelection({
                    workflowRun,
                    dimensions,
                    lane,
                    selection
                  }).pipe(
                    Effect.tap((evaluation) =>
                      Ref.update(evaluationByKeyRef, (current) => ({
                        ...current,
                        [evaluation.selectionKey]: evaluation
                      }))
                    ),
                    Effect.flatMap((evaluation) =>
                      Study.tell(handle, asked.trialNumber, evaluation.execution.report.aggregateScore).pipe(
                        Effect.mapError(() =>
                          executionError(`Workflow study scoring failed for ${workflowRun.scenarioId}.`)
                        ),
                        Effect.zipRight(Ref.get(evaluationByKeyRef)),
                        Effect.flatMap((evaluations) =>
                          publishBestEvaluation({
                            workflowRun,
                            dimensions,
                            evaluations,
                            current: evaluation,
                            publishProgress,
                            trialBudget
                          })
                        )
                      )
                    )
                  )
                )
              )
            )
          ),
        { discard: true }
      )

      const evaluations = yield* Ref.get(evaluationByKeyRef)
      const events: WorkflowSearchStudyOutcome["events"] = Chunk.toReadonlyArray(yield* Fiber.join(eventFiber))
      const result: Study.StudyResult<unknown> = yield* Study.result(handle).pipe(
        Effect.mapError(() => executionError(`Workflow study result assembly failed for ${workflowRun.scenarioId}.`))
      )
      const snapshot: WorkflowSearchStudyOutcome["snapshot"] = yield* Study.snapshot(handle).pipe(
        Effect.mapError(() => executionError(`Workflow study snapshot failed for ${workflowRun.scenarioId}.`))
      )

      return {
        trialBudget,
        evaluations,
        events,
        result,
        snapshot
      }
    })
  )
