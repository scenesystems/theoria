import { Chunk, Effect, Fiber, Option, Ref, Stream } from "effect"
import { Sampler, Study } from "effect-search"
import * as Arr from "effect/Array"
import * as EffectRecord from "effect/Record"

import type { EvidenceEvent } from "../../../../contracts/evidence/stream.js"
import {
  WorkflowComparisonExecutionError,
  type WorkflowComparisonExecutionLane,
  type WorkflowEntrySeedSelection
} from "../../../../contracts/study/workflow/comparison/run.js"
import type { DspProviderRuntime } from "../../../capability/effect-dsp.js"
import type { FrozenWorkflowComparisonRun } from "./frozen.js"
import { evaluateWorkflowComparisonSearchSelection } from "./search-study-evaluation.js"
import { selectionFromSearchStudyConfig, workflowComparisonSearchStudyOutcome } from "./search-study-outcome.js"
import { bestEvaluation, optimizationStudyProgressEvents } from "./search-study-progress.js"
import type { WorkflowComparisonSearchEvaluation, WorkflowComparisonSearchStudyOutcome } from "./search-study-schema.js"
import {
  searchSeedForComparison,
  searchSpaceForDimensions,
  workflowComparisonSearchDimensions
} from "./search-study-space.js"

type WorkflowComparisonSearchProgressPublisher<R> = (
  events: ReadonlyArray<EvidenceEvent>
) => Effect.Effect<void, never, R>

const executionError = (message: string) =>
  new WorkflowComparisonExecutionError({
    code: "execution-failed",
    message,
    retryable: false
  })

export const runWorkflowComparisonSearchStudy = <R = never>({
  comparison,
  lane,
  plan,
  publishProgress = () => Effect.void
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly lane: WorkflowComparisonExecutionLane
  readonly plan: WorkflowEntrySeedSelection
  readonly publishProgress?: WorkflowComparisonSearchProgressPublisher<R>
}): Effect.Effect<WorkflowComparisonSearchStudyOutcome, WorkflowComparisonExecutionError, R | DspProviderRuntime> =>
  Effect.scoped(
    Effect.gen(function*() {
      const dimensions = yield* workflowComparisonSearchDimensions(comparison, plan)
      const space = searchSpaceForDimensions(dimensions)
      const trialBudget = dimensions.reduce((product, dimension) => product * dimension.choices.length, 1)
      const sampler = Sampler.tpe({
        seed: searchSeedForComparison(comparison),
        nStartupTrials: Math.min(4, trialBudget),
        nEiCandidates: Math.max(8, trialBudget)
      })
      const evaluationByKeyRef = yield* Ref.make<Readonly<Record<string, WorkflowComparisonSearchEvaluation>>>({})
      const handle = yield* Study.open({
        space,
        sampler,
        direction: "maximize",
        trials: trialBudget,
        objective: () => Effect.succeed(0)
      }).pipe(
        Effect.mapError(() => executionError(`Workflow comparison study setup failed for ${comparison.comparisonId}.`))
      )
      const eventFiber = yield* Effect.fork(Stream.runCollect(Study.events(handle)))

      yield* Effect.forEach(
        Arr.range(0, trialBudget - 1),
        () =>
          Study.ask(handle).pipe(
            Effect.mapError(() =>
              executionError(`Workflow comparison study reservation failed for ${comparison.comparisonId}.`)
            ),
            Effect.flatMap((asked) =>
              selectionFromSearchStudyConfig(asked.config).pipe(
                Effect.flatMap((selection) =>
                  evaluateWorkflowComparisonSearchSelection({
                    comparison,
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
                          executionError(`Workflow comparison study scoring failed for ${comparison.comparisonId}.`)
                        ),
                        Effect.zipRight(Ref.get(evaluationByKeyRef)),
                        Effect.flatMap((evaluations) =>
                          bestEvaluation(evaluations).pipe(
                            Option.match({
                              onNone: () => Effect.void,
                              onSome: (best) =>
                                publishProgress(
                                  optimizationStudyProgressEvents({
                                    best,
                                    comparison,
                                    completedTrials: EffectRecord.keys(evaluations).length,
                                    current: evaluation,
                                    dimensions,
                                    trialBudget
                                  })
                                )
                            })
                          )
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

      const result = yield* Study.result(handle).pipe(
        Effect.mapError(() =>
          executionError(`Workflow comparison study result assembly failed for ${comparison.comparisonId}.`)
        )
      )
      const snapshot = yield* Study.snapshot(handle).pipe(
        Effect.mapError(() =>
          executionError(`Workflow comparison study snapshot failed for ${comparison.comparisonId}.`)
        )
      )
      const evaluations = yield* Ref.get(evaluationByKeyRef)
      const events = Chunk.toReadonlyArray(yield* Fiber.join(eventFiber))

      return yield* workflowComparisonSearchStudyOutcome({
        comparison,
        dimensions,
        evaluations,
        events,
        plan,
        result,
        snapshot,
        trialBudget
      })
    })
  )
