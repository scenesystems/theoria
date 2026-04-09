import { Option } from "effect"
import type {
  GraphExecutionManifest,
  GraphExecutionProjection,
  NodeExecutionContract,
  WorkflowExecutionRecord,
  WorkflowStateLane
} from "effect-inference/Contracts"

import type { FrozenWorkflowRun } from "../../../../contracts/study/workflow/frozen.js"
import type { WorkflowSelectedKnobs } from "../../../../contracts/study/workflow/runtime-plan.js"
import type { WorkflowEntrySelection } from "../../../../contracts/study/workflow/selection.js"
import { decodeWorkflowExecutionRecord } from "../decode.js"
import { workflowSelectedKnobsForRecord } from "../selection-controls.js"
import type { WorkflowSearchDimension } from "./dimensions.js"

export const authoredOptimizedSelection = (
  workflowRun: FrozenWorkflowRun,
  plan: WorkflowEntrySelection
): WorkflowSelectedKnobs =>
  workflowSelectedKnobsForRecord({
    plan,
    record: workflowRun.optimized.record
  })

export const selectionValue = ({
  fallback,
  key,
  selection
}: {
  readonly fallback: string
  readonly key: string
  readonly selection: WorkflowSelectedKnobs
}): string =>
  Option.fromNullable(selection[key]).pipe(
    Option.getOrElse(() => fallback)
  )

export const selectionKey = ({
  dimensions,
  selection
}: {
  readonly dimensions: ReadonlyArray<WorkflowSearchDimension>
  readonly selection: WorkflowSelectedKnobs
}): string =>
  dimensions
    .map((dimension) => `${dimension.key}:${selectionValue({ fallback: "unset", key: dimension.key, selection })}`)
    .join("|")

const manifestSuffix = ({
  dimensions,
  selection
}: {
  readonly dimensions: ReadonlyArray<WorkflowSearchDimension>
  readonly selection: WorkflowSelectedKnobs
}): string => selectionKey({ dimensions, selection }).replace(/[^a-z0-9]+/giu, "-").replace(/^-|-$/gu, "")

const optimizationKnobByKey = (
  manifest: GraphExecutionManifest
): Readonly<Record<string, GraphExecutionManifest["optimizationKnobs"][number]>> =>
  manifest.optimizationKnobs.reduce<Readonly<Record<string, GraphExecutionManifest["optimizationKnobs"][number]>>>(
    (lookup, knob) => ({
      ...lookup,
      [knob.key]: knob
    }),
    {}
  )

const nodeIsEnabled = ({
  knobLookup,
  node,
  selection
}: {
  readonly knobLookup: Readonly<Record<string, GraphExecutionManifest["optimizationKnobs"][number]>>
  readonly node: NodeExecutionContract
  readonly selection: WorkflowSelectedKnobs
}): boolean =>
  node.optimizationKnobRefs.reduce(
    (enabled, knobKey) =>
      enabled
      && Option.fromNullable(knobLookup[knobKey]).pipe(
        Option.match({
          onNone: () => true,
          onSome: (knob) =>
            knob.kind !== "node-enabled"
            || selectionValue({ fallback: "enabled", key: knob.key, selection }) !== "disabled"
        })
      ),
    true
  )

const nodeIds = (nodes: ReadonlyArray<NodeExecutionContract>): ReadonlyArray<string> => nodes.map((node) => node.nodeId)

const activeStateLanesForRecord = (record: WorkflowExecutionRecord): ReadonlyArray<WorkflowStateLane> =>
  record.projection.activeStateLanes.filter((lane, index, lanes) => lanes.indexOf(lane) === index)

const projectionForRecord = ({
  edges,
  manifestId,
  nodes,
  record
}: {
  readonly edges: WorkflowExecutionRecord["graph"]["edges"]
  readonly manifestId: string
  readonly nodes: ReadonlyArray<NodeExecutionContract>
  readonly record: WorkflowExecutionRecord
}): GraphExecutionProjection => {
  const remainingNodeIds = nodeIds(nodes)
  const terminalNodeIds = nodes
    .filter((node) => !edges.some((edge) => edge.fromNodeId === node.nodeId))
    .map((node) => node.nodeId)

  return {
    manifestId,
    entryNodeId: record.projection.entryNodeId,
    terminalNodeIds,
    activeStateLanes: activeStateLanesForRecord({
      ...record,
      graph: { ...record.graph, manifestId, nodes, edges }
    }).filter((lane) =>
      record.session.stateLanes.some((stateLane) => stateLane.lane === lane)
      || nodes.some((node) => node.inputLanes.includes(lane) || node.outputLane === lane)
      || remainingNodeIds.includes(record.projection.entryNodeId)
    )
  }
}

export const recordForSelection = ({
  workflowRun,
  dimensions,
  selection
}: {
  readonly workflowRun: FrozenWorkflowRun
  readonly dimensions: ReadonlyArray<WorkflowSearchDimension>
  readonly selection: WorkflowSelectedKnobs
}): WorkflowExecutionRecord => {
  const optimizedRecord = workflowRun.optimized.record
  const knobLookup = optimizationKnobByKey(optimizedRecord.graph)
  const nodes = optimizedRecord.graph.nodes.filter((node) => nodeIsEnabled({ knobLookup, node, selection }))
  const remainingNodeIds = nodeIds(nodes)
  const edges = optimizedRecord.graph.edges.filter(
    (edge) => remainingNodeIds.includes(edge.fromNodeId) && remainingNodeIds.includes(edge.toNodeId)
  )
  const suffix = manifestSuffix({ dimensions, selection })
  const manifestId = `${optimizedRecord.graph.manifestId}-${suffix}`

  return decodeWorkflowExecutionRecord({
    ...optimizedRecord,
    recordId: `${optimizedRecord.recordId}-${suffix}`,
    graph: {
      ...optimizedRecord.graph,
      manifestId,
      nodes,
      edges
    },
    projection: projectionForRecord({
      edges,
      manifestId,
      nodes,
      record: optimizedRecord
    })
  })
}
