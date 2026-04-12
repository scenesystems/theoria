import { Effect, Match } from "effect"
import { type ScoreProfile, type WorkflowExecutionRecord } from "effect-inference/Contracts"

import { fingerprintOf } from "../../../contracts/entry/fingerprint.js"
import { WorkflowStudyExecutionError } from "../../../contracts/study/workflow/execution.js"
import {
  BaselineFrozenWorkflowVariant,
  FrozenWorkflowRun,
  OptimizedFrozenWorkflowVariant
} from "../../../contracts/study/workflow/frozen.js"
import { type WorkflowScenarioId } from "../../../contracts/study/workflow/manifest.js"

import { workflowProfileLibrary } from "./profile-library.js"
import { scenarioById } from "./scenario/catalog.js"

const executionError = (message: string) =>
  new WorkflowStudyExecutionError({
    code: "execution-failed",
    message,
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
      try: () => BaselineFrozenWorkflowVariant.make({ record, profile, recordFingerprint }),
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
      try: () => OptimizedFrozenWorkflowVariant.make({ record, profile, recordFingerprint }),
      catch: () => executionError("Workflow scenario freeze failed for the optimized variant.")
    })
  })

export const frozenWorkflowForRequest = (
  scenarioId: WorkflowScenarioId
): Effect.Effect<FrozenWorkflowRun, WorkflowStudyExecutionError, never> =>
  Effect.gen(function*() {
    const scenario = scenarioById(scenarioId)
    const variants = yield* Effect.all({
      baseline: freezeBaselineVariant(scenario.records.baseline),
      optimized: freezeOptimizedVariant(scenario.records.optimized)
    })

    return yield* Effect.try({
      try: () =>
        FrozenWorkflowRun.fromScenario({
          baseline: variants.baseline,
          optimized: variants.optimized,
          scenario
        }),
      catch: () => executionError(`Workflow scenario freeze failed for ${scenario.entry.scenarioId}.`)
    })
  })
