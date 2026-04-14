import type { FileSystem, Path } from "@effect/platform"
import { Chunk, Effect, Fiber, Option, Ref, Stream } from "effect"
import { Contracts, Sampler, Study } from "effect-search"
import * as Arr from "effect/Array"
import * as EffectRecord from "effect/Record"

import type { EvidenceEvent } from "../../../../contracts/evidence/stream.js"
import type { WorkflowExecutionLane } from "../../../../contracts/study/workflow/controls.js"
import { WorkflowStudyExecutionError } from "../../../../contracts/study/workflow/execution.js"
import { WorkflowFixtureManifest } from "../../../../contracts/study/workflow/fixture-manifest.js"
import type { FrozenWorkflowRun } from "../../../../contracts/study/workflow/frozen.js"
import type { WorkflowStudyInput } from "../../../../contracts/study/workflow/input.js"
import type { WorkflowEntrySelection } from "../../../../contracts/study/workflow/selection.js"
import type { DspProviderRuntime } from "../../../capability/effect-dsp.js"
import { workflowSearchProgressEvents } from "../evidence/search-progress.js"
import { searchSpaceForDimensions, trialBudgetForDimensions, type WorkflowSearchDimension } from "./dimensions.js"
import { selectionFromSearchStudyConfig } from "./outcome.js"
import { completedPriorTrialsFromStorage, workflowSearchPersistence } from "./persistence.js"
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

const derivedSearchSeed = (workflowRun: FrozenWorkflowRun): number =>
  Arr.fromIterable(`${workflowRun.revisionDigest.algorithm}:${workflowRun.revisionDigest.digest}`).reduce(
    (hash, character, index) => ((hash * 33) + character.charCodeAt(0) + index) % 2_147_483_647,
    5381
  ) || 1

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
  input,
  workflowRun,
  dimensions,
  lane,
  plan,
  publishProgress = () => Effect.void
}: {
  readonly input: WorkflowStudyInput
  readonly workflowRun: FrozenWorkflowRun
  readonly dimensions: ReadonlyArray<WorkflowSearchDimension>
  readonly lane: WorkflowExecutionLane
  readonly plan: WorkflowEntrySelection
  readonly publishProgress?: WorkflowSearchProgressPublisher<R>
}): Effect.Effect<
  WorkflowSearchStudyExecution,
  WorkflowStudyExecutionError,
  R | DspProviderRuntime | FileSystem.FileSystem | Path.Path
> =>
  Effect.scoped(
    Effect.gen(function*() {
      const trialBudget = trialBudgetForDimensions(dimensions)
      const persistence = yield* workflowSearchPersistence({ input, workflowRun, plan })
      const space = searchSpaceForDimensions(dimensions)
      const searchSeed = WorkflowFixtureManifest.optionForSeedId(workflowRun.seedId).pipe(
        Option.match({
          onNone: () => derivedSearchSeed(workflowRun),
          onSome: (fixture) => fixture.searchSeed()
        })
      )
      return yield* Effect.gen(function*() {
        const evaluationByKeyRef = yield* Ref.make<Readonly<Record<string, WorkflowSearchEvaluation>>>({})
        const artifactSink = yield* Contracts.ArtifactSink
        const eventPublisher = yield* Study.envelopeEventPublisher(artifactSink)
        const storage = yield* Study.StudyStorage
        const priorTrials = yield* completedPriorTrialsFromStorage({
          space,
          storage,
          workflowRun
        })
        const remainingTrialCount = Math.max(0, trialBudget - priorTrials.length)
        const remainingTrialNumbers = remainingTrialCount <= 0 ? [] : Arr.range(0, remainingTrialCount - 1)
        const handle = yield* Study.open({
          space,
          sampler: Sampler.tpe({
            seed: searchSeed,
            nStartupTrials: Math.min(4, trialBudget),
            nEiCandidates: Math.max(8, trialBudget)
          }),
          direction: "maximize",
          trials: trialBudget,
          priorTrials,
          objective: () => Effect.succeed(0)
        }).pipe(
          Effect.mapError(() => executionError(`Workflow study setup failed for ${workflowRun.seedId}.`))
        )
        const eventFiber = yield* Effect.fork(
          Stream.runCollect(
            Study.events(handle).pipe(
              Stream.tap((event) => eventPublisher.publish(event))
            )
          )
        )

        yield* Effect.forEach(
          remainingTrialNumbers,
          () =>
            Study.ask(handle).pipe(
              Effect.mapError(() => executionError(`Workflow study reservation failed for ${workflowRun.seedId}.`)),
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
                            executionError(`Workflow study scoring failed for ${workflowRun.seedId}.`)
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

        const result: Study.StudyResult<unknown> = yield* Study.result(handle).pipe(
          Effect.mapError(() => executionError(`Workflow study result assembly failed for ${workflowRun.seedId}.`))
        )
        const snapshot: WorkflowSearchStudyOutcome["snapshot"] = yield* Study.snapshot(handle).pipe(
          Effect.mapError(() => executionError(`Workflow study snapshot failed for ${workflowRun.seedId}.`))
        )

        yield* storage.writeSnapshot(snapshot)

        const evaluations = yield* Ref.get(evaluationByKeyRef)
        const events: WorkflowSearchStudyOutcome["events"] = Chunk.toReadonlyArray(yield* Fiber.join(eventFiber))

        return {
          trialBudget,
          evaluations,
          events,
          result,
          snapshot
        }
      }).pipe(
        Effect.provide(Study.StudyStorageLive(Study.studyStorageOptions(persistence.directory))),
        Effect.provide(Contracts.fileSystemSink(persistence.directory)),
        Effect.provide(Contracts.EnvelopeContextLive({
          packageVersion: persistence.packageVersion,
          runId: persistence.runId,
          studyId: persistence.studyId
        }))
      )
    })
  )
