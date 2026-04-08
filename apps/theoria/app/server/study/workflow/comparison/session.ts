import { Activity } from "@effect/workflow"
import { Effect, Option } from "effect"
import type { ScoreProfileSchema, WorkflowExecutionRecordSchema } from "effect-inference/Contracts"

import type { WorkflowComparisonId } from "../../../../contracts/study/workflow/comparison/comparison.js"
import {
  WorkflowComparisonExecutionError,
  type WorkflowComparisonExecutionLane,
  WorkflowComparisonNodeExecution
} from "../../../../contracts/study/workflow/comparison/run.js"
import { nodeExecutionEvents, variantEndEvents, variantStartEvents } from "./evidence.js"
import { frozenComparisonForRequest, type FrozenWorkflowComparisonRun } from "./frozen.js"
import { appendWorkflowComparisonEvents, type WorkflowComparisonRunSession } from "./run-session.js"
import {
  prepareVariantPlan,
  type WorkflowComparisonSelectedKnobs,
  WorkflowComparisonVariantPlanSchema
} from "./runtime-plan.js"
import { nodeExecutionForVariant } from "./runtime.js"
import { executeWorkflowComparisonVariantPlan } from "./variant-execution.js"

export const comparisonForRequest = (
  comparisonId: WorkflowComparisonId
): Effect.Effect<FrozenWorkflowComparisonRun, WorkflowComparisonExecutionError, never> =>
  frozenComparisonForRequest(comparisonId)

export const executeVariant = ({
  comparison,
  lane,
  phasePrefix,
  profile,
  record,
  selectedKnobs,
  session,
  variant
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly lane: WorkflowComparisonExecutionLane
  readonly phasePrefix: string
  readonly profile?: typeof ScoreProfileSchema.Type
  readonly record?: typeof WorkflowExecutionRecordSchema.Type
  readonly selectedKnobs?: WorkflowComparisonSelectedKnobs
  readonly session: WorkflowComparisonRunSession
  readonly variant: "baseline" | "optimized"
}) =>
  Effect.gen(function*() {
    const plan = yield* Activity.make({
      error: WorkflowComparisonExecutionError,
      name: `${phasePrefix}-prepare-graph`,
      success: WorkflowComparisonVariantPlanSchema,
      execute: prepareVariantPlan({
        comparison,
        variant,
        ...Option.match(Option.fromNullable(profile), {
          onNone: () => ({}),
          onSome: (value) => ({ profile: value })
        }),
        ...Option.match(Option.fromNullable(record), {
          onNone: () => ({}),
          onSome: (value) => ({ record: value })
        }),
        ...Option.match(Option.fromNullable(selectedKnobs), {
          onNone: () => ({}),
          onSome: (value) => ({ selectedKnobs: value })
        })
      })
    })

    yield* appendWorkflowComparisonEvents({
      events: variantStartEvents({
        variant: plan.variant,
        graphProjection: plan.graphProjection,
        record: plan.record
      }),
      phaseName: `${phasePrefix}-start`,
      session
    })
    const execution = yield* executeWorkflowComparisonVariantPlan({
      comparison,
      lane,
      plan,
      executeNode: (request) =>
        Activity.make({
          error: WorkflowComparisonExecutionError,
          name: `${phasePrefix}-node-${request.nodeId}`,
          success: WorkflowComparisonNodeExecution,
          execute: nodeExecutionForVariant(request)
        }),
      observeNodeExecution: ({ activeStateLanes, aggregateScore, nodeExecution }) =>
        appendWorkflowComparisonEvents({
          events: nodeExecutionEvents({
            comparisonId: comparison.comparisonId,
            execution: nodeExecution,
            workflowKind: comparison.workflowKind,
            aggregateScore,
            activeStateLanes
          }),
          phaseName: `${phasePrefix}-node-${nodeExecution.node.nodeId}`,
          session
        })
    })

    yield* appendWorkflowComparisonEvents({
      events: variantEndEvents(variant),
      phaseName: `${phasePrefix}-complete`,
      session
    })

    return execution
  })
