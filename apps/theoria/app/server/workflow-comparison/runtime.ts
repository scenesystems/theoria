import { Effect, Match, Option, Schema } from "effect"
import { projectWorkflowModuleGraph, WorkflowModuleGraphProjection } from "effect-dsp/contracts"
import {
  type GraphVariant,
  GraphVariantSchema,
  type NodeExecutionContract,
  ScoreProfileSchema,
  type WorkflowEvaluationReport,
  type WorkflowExecutionRecord,
  WorkflowExecutionRecordSchema,
  type WorkflowStateLane
} from "effect-inference/Contracts"

import {
  WorkflowComparisonExecutionError,
  type WorkflowComparisonExecutionLane,
  type WorkflowComparisonNodeExecution,
  WorkflowComparisonNodeExecution as WorkflowComparisonNodeExecutionSchema,
  type WorkflowComparisonVariantExecution,
  WorkflowComparisonVariantExecution as WorkflowComparisonVariantExecutionSchema
} from "../../contracts/workflow/comparison-run.js"
import type { DspProviderRuntime } from "../demos/effect-dsp/provider.js"
import type { FrozenWorkflowComparisonRun } from "./frozen.js"
import { executeWorkflowNode } from "./node-execution.js"

export const WorkflowComparisonSelectedKnobsSchema = Schema.Record({
  key: Schema.String,
  value: Schema.String
})

export type WorkflowComparisonSelectedKnobs = Schema.Schema.Type<typeof WorkflowComparisonSelectedKnobsSchema>

const emptySelectedKnobs: WorkflowComparisonSelectedKnobs = {}

export const WorkflowComparisonVariantPlanSchema = Schema.Struct({
  variant: GraphVariantSchema,
  record: WorkflowExecutionRecordSchema,
  profile: ScoreProfileSchema,
  selectedKnobs: WorkflowComparisonSelectedKnobsSchema,
  graphProjection: WorkflowModuleGraphProjection
})

export type WorkflowComparisonVariantPlan = Schema.Schema.Type<typeof WorkflowComparisonVariantPlanSchema>

export type WorkflowExecutionState = Readonly<Record<WorkflowStateLane, ReadonlyArray<string>>>

const emptyWorkflowExecutionState = (): WorkflowExecutionState => ({
  task: [],
  context: [],
  conversation: [],
  retrieval: [],
  "tool-results": [],
  render: []
})

const makeNodeExecution = Schema.decodeUnknownSync(WorkflowComparisonNodeExecutionSchema)
const makeVariantExecution = Schema.decodeUnknownSync(WorkflowComparisonVariantExecutionSchema)

const executionError = (message: string) =>
  new WorkflowComparisonExecutionError({
    code: "execution-failed",
    message,
    retryable: false
  })

const frozenVariant = (
  comparison: FrozenWorkflowComparisonRun,
  variant: GraphVariant
): FrozenWorkflowComparisonRun["baseline"] | FrozenWorkflowComparisonRun["optimized"] =>
  Match.value(variant).pipe(
    Match.when("baseline", () => comparison.baseline),
    Match.when("optimized", () => comparison.optimized),
    Match.exhaustive
  )

const appendLaneEntry = (
  state: WorkflowExecutionState,
  lane: WorkflowStateLane,
  entry: string
): WorkflowExecutionState => ({
  ...state,
  [lane]: [...state[lane], entry]
})

export const initialExecutionState = (record: WorkflowExecutionRecord): WorkflowExecutionState =>
  record.session.turns.reduce(
    (state, turn) => appendLaneEntry(state, "conversation", `${turn.role}: ${turn.content}`),
    record.session.stateLanes.reduce<WorkflowExecutionState>(
      (state, laneState) => ({
        ...state,
        [laneState.lane]: [...laneState.entries]
      }),
      emptyWorkflowExecutionState()
    )
  )

export const advanceExecutionState = ({
  node,
  outputText,
  state
}: {
  readonly node: NodeExecutionContract
  readonly outputText: string
  readonly state: WorkflowExecutionState
}): WorkflowExecutionState => appendLaneEntry(state, node.outputLane, outputText)

export const activeStateLanesForState = ({
  plan,
  state
}: {
  readonly plan: WorkflowComparisonVariantPlan
  readonly state: WorkflowExecutionState
}): ReadonlyArray<WorkflowStateLane> => plan.record.projection.activeStateLanes.filter((lane) => state[lane].length > 0)

const lineageForNode = (
  graphProjection: WorkflowModuleGraphProjection,
  nodeId: string
): ReadonlyArray<string> => graphProjection.lineages.find((lineage) => lineage.targetNodeId === nodeId)?.path ?? []

const nodeForId = (
  record: WorkflowExecutionRecord,
  nodeId: string
): Effect.Effect<NodeExecutionContract, WorkflowComparisonExecutionError, never> =>
  Option.fromNullable(record.graph.nodes.find((node) => node.nodeId === nodeId)).pipe(
    Option.match({
      onNone: () => Effect.fail(executionError(`Workflow graph node ${nodeId} is missing from the manifest.`)),
      onSome: Effect.succeed
    })
  )

export const prepareVariantPlan = (
  {
    comparison,
    profile,
    record,
    selectedKnobs = emptySelectedKnobs,
    variant
  }: {
    readonly comparison: FrozenWorkflowComparisonRun
    readonly profile?: Schema.Schema.Type<typeof ScoreProfileSchema>
    readonly record?: WorkflowExecutionRecord
    readonly selectedKnobs?: WorkflowComparisonSelectedKnobs
    readonly variant: GraphVariant
  }
): Effect.Effect<WorkflowComparisonVariantPlan, WorkflowComparisonExecutionError, never> =>
  Option.all({
    profile: Option.fromNullable(profile),
    record: Option.fromNullable(record)
  }).pipe(
    Option.match({
      onNone: () => {
        const variantInput = frozenVariant(comparison, variant)

        return prepareVariantPlanForRecord({
          variant,
          record: variantInput.record,
          profile: variantInput.profile,
          selectedKnobs
        })
      },
      onSome: ({ profile: resolvedProfile, record: resolvedRecord }) =>
        prepareVariantPlanForRecord({
          variant,
          record: resolvedRecord,
          profile: resolvedProfile,
          selectedKnobs
        })
    })
  )

export const prepareVariantPlanForRecord = ({
  profile,
  record,
  selectedKnobs = emptySelectedKnobs,
  variant
}: {
  readonly profile: Schema.Schema.Type<typeof ScoreProfileSchema>
  readonly record: WorkflowExecutionRecord
  readonly selectedKnobs?: WorkflowComparisonSelectedKnobs
  readonly variant: GraphVariant
}): Effect.Effect<WorkflowComparisonVariantPlan, WorkflowComparisonExecutionError, never> =>
  Effect.try({
    try: () => {
      return {
        variant,
        record,
        profile,
        selectedKnobs,
        graphProjection: projectWorkflowModuleGraph({
          manifest: record.graph,
          projection: record.projection
        })
      }
    },
    catch: () => executionError(`Workflow graph projection failed for the ${variant} variant.`)
  })

export const nodeExecutionForVariant = ({
  comparison,
  lane,
  plan,
  state,
  stepIndex,
  stepCount,
  nodeId
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly lane: WorkflowComparisonExecutionLane
  readonly plan: WorkflowComparisonVariantPlan
  readonly state: WorkflowExecutionState
  readonly stepIndex: number
  readonly stepCount: number
  readonly nodeId: string
}): Effect.Effect<WorkflowComparisonNodeExecution, WorkflowComparisonExecutionError, DspProviderRuntime> =>
  Effect.gen(function*() {
    const node = yield* nodeForId(plan.record, nodeId)
    const nodeExecution = yield* executeWorkflowNode({
      comparison,
      lane,
      node,
      record: plan.record,
      selectedKnobs: plan.selectedKnobs,
      state,
      variant: plan.variant
    })

    return makeNodeExecution({
      variant: plan.variant,
      node,
      lineage: lineageForNode(plan.graphProjection, nodeId),
      stepIndex,
      stepCount,
      outputText: nodeExecution.outputText,
      trace: nodeExecution.trace,
      runtimeEvidence: nodeExecution.runtimeEvidence
    })
  })

export const finalizeVariantExecution = ({
  nodeExecutions,
  plan,
  report
}: {
  readonly nodeExecutions: ReadonlyArray<WorkflowComparisonNodeExecution>
  readonly plan: WorkflowComparisonVariantPlan
  readonly report: WorkflowEvaluationReport
}): Effect.Effect<WorkflowComparisonVariantExecution, WorkflowComparisonExecutionError, never> =>
  nodeExecutions.length === 0
    ? Effect.fail(executionError(`Workflow graph traversal for ${plan.variant} produced no node executions.`))
    : Effect.try({
      try: () =>
        makeVariantExecution({
          variant: plan.variant,
          record: plan.record,
          report,
          graphProjection: plan.graphProjection,
          nodeExecutions: [nodeExecutions[0], ...nodeExecutions.slice(1)]
        }),
      catch: () => executionError(`Workflow comparison result assembly failed for the ${plan.variant} variant.`)
    })
