import { Effect, Match, Option } from "effect"
import { type ScoreProfile, type WorkflowExecutionRecord } from "effect-inference/Contracts"

import { type DurableFingerprint, fingerprintOf } from "../../../contracts/entry/fingerprint.js"
import { WorkflowStudyExecutionError } from "../../../contracts/study/workflow/execution.js"
import {
  type BaselineFrozenWorkflowVariant,
  baselineFrozenWorkflowVariant,
  encodeFrozenWorkflowRun,
  FrozenWorkflowRun,
  type OptimizedFrozenWorkflowVariant,
  optimizedFrozenWorkflowVariant
} from "../../../contracts/study/workflow/frozen.js"
import { type WorkflowScenarioId } from "../../../contracts/study/workflow/manifest.js"

import { workflowProfileLibrary } from "./profile-library.js"
import { workflowScenarioByIdOption } from "./scenario/catalog.js"

const executionError = (message: string) =>
  new WorkflowStudyExecutionError({
    code: "execution-failed",
    message,
    retryable: false
  })

const invalidWorkflowScenarioError = (scenarioId: string) =>
  new WorkflowStudyExecutionError({
    code: "invalid-query",
    message: `Unknown workflow scenario ${scenarioId}.`,
    retryable: false
  })

const profileForRecord = (
  record: WorkflowExecutionRecord
): Effect.Effect<ScoreProfile, WorkflowStudyExecutionError, never> => {
  const profile = Match.value(record.evaluation.profileFamily).pipe(
    Match.when("task-oriented", () => workflowProfileLibrary.taskOriented),
    Match.when("chat-oriented", () => workflowProfileLibrary.chatOriented),
    Match.when("retrieval-oriented", () => workflowProfileLibrary.retrievalOriented),
    Match.when("render-sensitive", () => workflowProfileLibrary.renderSensitive),
    Match.exhaustive
  )

  return profile.profileId !== record.evaluation.profileId
    ? Effect.fail(
      executionError(
        `Workflow score profile ${record.evaluation.profileId} does not match the authored ${record.evaluation.profileFamily} profile.`
      )
    )
    : !profile.workflowKinds.includes(record.workflowKind)
    ? Effect.fail(
      executionError(
        `Workflow score profile ${profile.profileId} does not admit workflow kind ${record.workflowKind}.`
      )
    )
    : Effect.succeed(profile)
}

const freezeBaselineVariant = (
  record: WorkflowExecutionRecord
): Effect.Effect<BaselineFrozenWorkflowVariant, WorkflowStudyExecutionError, never> =>
  Effect.gen(function*() {
    const profile = yield* profileForRecord(record)
    const recordFingerprint = yield* fingerprintOf(record)

    return yield* Effect.try({
      try: () => baselineFrozenWorkflowVariant({ record, profile, recordFingerprint }),
      catch: () => executionError("Workflow scenario freeze failed for the baseline variant.")
    })
  })

const freezeOptimizedVariant = (
  record: WorkflowExecutionRecord
): Effect.Effect<OptimizedFrozenWorkflowVariant, WorkflowStudyExecutionError, never> =>
  Effect.gen(function*() {
    const profile = yield* profileForRecord(record)
    const recordFingerprint = yield* fingerprintOf(record)

    return yield* Effect.try({
      try: () => optimizedFrozenWorkflowVariant({ record, profile, recordFingerprint }),
      catch: () => executionError("Workflow scenario freeze failed for the optimized variant.")
    })
  })

export const frozenWorkflowForRequest = (
  scenarioId: WorkflowScenarioId
): Effect.Effect<FrozenWorkflowRun, WorkflowStudyExecutionError, never> =>
  workflowScenarioByIdOption(scenarioId).pipe(
    Option.match({
      onNone: () => Effect.fail(invalidWorkflowScenarioError(scenarioId)),
      onSome: (workflowScenario) =>
        Effect.all({
          baseline: freezeBaselineVariant(workflowScenario.records.baseline),
          optimized: freezeOptimizedVariant(workflowScenario.records.optimized)
        }).pipe(
          Effect.flatMap(({ baseline, optimized }) =>
            Effect.try({
              try: () =>
                FrozenWorkflowRun.make({
                  entryId: workflowScenario.entry.entryId,
                  scenarioId: workflowScenario.entry.scenarioId,
                  label: workflowScenario.label,
                  summary: workflowScenario.summary,
                  workflowKind: workflowScenario.workflowKind,
                  authorities: workflowScenario.authorities,
                  baseline,
                  optimized
                }),
              catch: () => executionError(`Workflow scenario freeze failed for ${workflowScenario.entry.scenarioId}.`)
            })
          )
        )
    })
  )

export const frozenWorkflowRunFingerprint = (
  workflowRun: FrozenWorkflowRun
): Effect.Effect<typeof DurableFingerprint.Type, never, never> => fingerprintOf(encodeFrozenWorkflowRun(workflowRun))
