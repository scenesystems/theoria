import { Activity } from "@effect/workflow"
import { Effect, Option, Ref } from "effect"
import type { ScoreProfileSchema, WorkflowExecutionRecordSchema } from "effect-inference/Contracts"
import { WorkflowEvaluationReportSchema } from "effect-inference/Contracts"

import type { EvidenceStoreState } from "../../contracts/evidence-store.js"
import type { EvidenceEvent } from "../../contracts/evidence-stream.js"
import {
  WorkflowComparisonExecutionError,
  type WorkflowComparisonExecutionLane,
  WorkflowComparisonNodeExecution,
  type WorkflowComparisonNodeExecution as WorkflowComparisonNodeExecutionType
} from "../../contracts/workflow/comparison-run.js"
import type { WorkflowComparisonId } from "../../contracts/workflow/comparison.js"
import { RunStreamSessionRegistry } from "../runtime/stream-session-registry.js"
import { aggregateScoreForNodeExecutions, evaluateVariantExecutionEffect } from "./evaluation.js"
import { applyEventsToStore, nodeExecutionEvents, variantEndEvents, variantStartEvents } from "./evidence.js"
import { frozenComparisonForRequest, type FrozenWorkflowComparisonRun } from "./frozen.js"
import {
  activeStateLanesForState,
  advanceExecutionState,
  finalizeVariantExecution,
  initialExecutionState,
  nodeExecutionForVariant,
  prepareVariantPlan,
  type WorkflowComparisonSelectedKnobs,
  WorkflowComparisonVariantPlanSchema
} from "./runtime.js"

export const appendEvents = ({
  batchIndexRef,
  events,
  phaseName,
  sessionKey,
  storeRef
}: {
  readonly batchIndexRef: Ref.Ref<number>
  readonly events: ReadonlyArray<EvidenceEvent>
  readonly phaseName: string
  readonly sessionKey: string
  readonly storeRef: Ref.Ref<EvidenceStoreState>
}) =>
  events.length === 0
    ? Effect.void
    : Ref.get(batchIndexRef).pipe(
      Effect.flatMap((batchIndex) =>
        Activity.make({
          name: `${phaseName}-batch-${batchIndex}`,
          execute: RunStreamSessionRegistry.pipe(
            Effect.flatMap((registry) => registry.appendBatch({ batchIndex, events, sessionKey }))
          )
        }).pipe(
          Effect.zipRight(Ref.update(storeRef, (store) => applyEventsToStore(store, events))),
          Effect.zipRight(Ref.set(batchIndexRef, batchIndex + 1))
        )
      )
    )

export const comparisonForRequest = (
  comparisonId: WorkflowComparisonId
): Effect.Effect<FrozenWorkflowComparisonRun, WorkflowComparisonExecutionError, never> =>
  frozenComparisonForRequest(comparisonId)

export const executeVariant = ({
  batchIndexRef,
  comparison,
  lane,
  phasePrefix,
  profile,
  record,
  selectedKnobs,
  sessionKey,
  storeRef,
  variant
}: {
  readonly batchIndexRef: Ref.Ref<number>
  readonly comparison: FrozenWorkflowComparisonRun
  readonly lane: WorkflowComparisonExecutionLane
  readonly phasePrefix: string
  readonly profile?: typeof ScoreProfileSchema.Type
  readonly record?: typeof WorkflowExecutionRecordSchema.Type
  readonly selectedKnobs?: WorkflowComparisonSelectedKnobs
  readonly sessionKey: string
  readonly storeRef: Ref.Ref<EvidenceStoreState>
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
    const stateRef = yield* Ref.make(initialExecutionState(plan.record))
    const nodeExecutionsRef = yield* Ref.make<ReadonlyArray<WorkflowComparisonNodeExecutionType>>([])

    yield* appendEvents({
      batchIndexRef,
      events: variantStartEvents({
        variant: plan.variant,
        graphProjection: plan.graphProjection,
        record: plan.record
      }),
      phaseName: `${phasePrefix}-start`,
      sessionKey,
      storeRef
    })

    const indexedTraversal = plan.graphProjection.traversal.map((nodeId, index) => ({
      nodeId,
      stepIndex: index + 1,
      stepCount: plan.graphProjection.traversal.length
    }))

    const nodeExecutions = yield* Effect.forEach(
      indexedTraversal,
      ({ nodeId, stepCount, stepIndex }) =>
        Ref.get(stateRef).pipe(
          Effect.flatMap((state) =>
            Activity.make({
              error: WorkflowComparisonExecutionError,
              name: `${phasePrefix}-node-${nodeId}`,
              success: WorkflowComparisonNodeExecution,
              execute: nodeExecutionForVariant({
                comparison,
                lane,
                plan,
                state,
                nodeId,
                stepCount,
                stepIndex
              })
            }).pipe(
              Effect.flatMap((nodeExecution) => {
                const nextState = advanceExecutionState({
                  state,
                  node: nodeExecution.node,
                  outputText: nodeExecution.outputText
                })

                return Ref.set(stateRef, nextState).pipe(
                  Effect.zipRight(
                    Ref.updateAndGet(nodeExecutionsRef, (executions) => [...executions, nodeExecution]).pipe(
                      Effect.flatMap((executions) =>
                        aggregateScoreForNodeExecutions({
                          plan,
                          nodeExecutions: executions
                        }).pipe(
                          Effect.flatMap((aggregateScore) =>
                            appendEvents({
                              batchIndexRef,
                              events: nodeExecutionEvents({
                                comparisonId: comparison.comparisonId,
                                execution: nodeExecution,
                                workflowKind: comparison.workflowKind,
                                aggregateScore,
                                activeStateLanes: activeStateLanesForState({
                                  plan,
                                  state: nextState
                                })
                              }),
                              phaseName: `${phasePrefix}-node-${nodeId}`,
                              sessionKey,
                              storeRef
                            }).pipe(Effect.as(nodeExecution))
                          )
                        )
                      )
                    )
                  )
                )
              })
            )
          )
        )
    )

    const report = yield* Activity.make({
      error: WorkflowComparisonExecutionError,
      name: `${phasePrefix}-evaluate-report`,
      success: WorkflowEvaluationReportSchema,
      execute: evaluateVariantExecutionEffect({
        comparison,
        nodeExecutions,
        plan
      })
    })
    const execution = yield* finalizeVariantExecution({ nodeExecutions, plan, report })

    yield* appendEvents({
      batchIndexRef,
      events: variantEndEvents(variant),
      phaseName: `${phasePrefix}-complete`,
      sessionKey,
      storeRef
    })

    return execution
  })
