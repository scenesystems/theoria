import type { NodeExecutionContract, WorkflowExecutionRecord, WorkflowStateLane } from "effect-inference/Contracts"

import type { WorkflowVariantPlan } from "../../../../contracts/study/workflow/runtime-plan.js"

export type WorkflowExecutionState = Readonly<Record<WorkflowStateLane, ReadonlyArray<string>>>

const emptyWorkflowExecutionState = (): WorkflowExecutionState => ({
  task: [],
  context: [],
  conversation: [],
  retrieval: [],
  "tool-results": [],
  render: []
})

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
  readonly plan: WorkflowVariantPlan
  readonly state: WorkflowExecutionState
}): ReadonlyArray<WorkflowStateLane> => plan.record.projection.activeStateLanes.filter((lane) => state[lane].length > 0)
