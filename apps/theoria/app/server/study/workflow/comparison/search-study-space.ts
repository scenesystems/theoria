import type { Schema } from "effect"
import { Effect, Equal, Match, Option } from "effect"
import type {
  GraphExecutionManifest,
  GraphExecutionProjection,
  NodeExecutionContract,
  WorkflowExecutionRecord,
  WorkflowStateLane
} from "effect-inference/Contracts"
import { SearchSpace } from "effect-search"
import * as Arr from "effect/Array"

import {
  chatHandoffWorkflowComparisonId,
  renderSensitiveWorkflowComparisonId,
  retrievalRequiredWorkflowComparisonId,
  taskBriefingWorkflowComparisonId
} from "../../../../contracts/study/workflow/comparison/comparison.js"
import {
  type WorkflowComparisonExecutionError,
  WorkflowComparisonExecutionError as WorkflowComparisonExecutionErrorSchema,
  type WorkflowEntrySeedSelection
} from "../../../../contracts/study/workflow/comparison/run.js"
import { makeWorkflowExecutionRecord } from "./decode.js"
import type { FrozenWorkflowComparisonRun } from "./frozen.js"
import { workflowComparisonChoicesForPlan, workflowComparisonSelectedKnobsForRecord } from "./run-controls.js"
import type { WorkflowComparisonSelectedKnobs } from "./runtime-plan.js"

export type WorkflowComparisonSearchDimension = {
  readonly key: string
  readonly choices: ReadonlyArray<string>
}

const executionError = (message: string): WorkflowComparisonExecutionError =>
  new WorkflowComparisonExecutionErrorSchema({
    code: "execution-failed",
    message,
    retryable: false
  })

export const searchSeedForComparison = (comparison: FrozenWorkflowComparisonRun): number =>
  Match.value(comparison.comparisonId).pipe(
    Match.when(taskBriefingWorkflowComparisonId, () => 410),
    Match.when(chatHandoffWorkflowComparisonId, () => 411),
    Match.when(retrievalRequiredWorkflowComparisonId, () => 412),
    Match.when(renderSensitiveWorkflowComparisonId, () => 413),
    Match.exhaustive
  )

const categoricalDimension = (choices: ReadonlyArray<string>) =>
  Arr.matchLeft(choices, {
    onEmpty: () => SearchSpace.categorical(["unreachable-empty-choice"]),
    onNonEmpty: (head, tail) => SearchSpace.categorical([head, ...tail])
  })

export const workflowComparisonSearchDimensions = (
  comparison: FrozenWorkflowComparisonRun,
  plan: WorkflowEntrySeedSelection
): Effect.Effect<ReadonlyArray<WorkflowComparisonSearchDimension>, WorkflowComparisonExecutionError, never> => {
  const dimensions = comparison.optimized.record.graph.optimizationKnobs.map((knob) => ({
    key: knob.key,
    choices: workflowComparisonChoicesForPlan({
      choices: knob.choices,
      key: knob.key,
      plan
    })
  }))

  return Arr.some(dimensions, (dimension) => Equal.equals(dimension.choices.length, 0))
    ? Effect.fail(
      executionError(`Workflow comparison ${comparison.comparisonId} declared an empty optimization knob choice set.`)
    )
    : Effect.succeed(dimensions)
}

export const searchSpaceForDimensions = (dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>) =>
  SearchSpace.unsafeMake(
    dimensions.reduce<Readonly<Record<string, Schema.Schema.AnyNoContext>>>(
      (definition, dimension) => ({
        ...definition,
        [dimension.key]: categoricalDimension(dimension.choices)
      }),
      {}
    )
  )

export const authoredOptimizedSelection = (
  comparison: FrozenWorkflowComparisonRun,
  plan: WorkflowEntrySeedSelection
): WorkflowComparisonSelectedKnobs =>
  workflowComparisonSelectedKnobsForRecord({
    plan,
    record: comparison.optimized.record
  })

export const selectionValue = ({
  fallback,
  key,
  selection
}: {
  readonly fallback: string
  readonly key: string
  readonly selection: WorkflowComparisonSelectedKnobs
}): string =>
  Option.fromNullable(selection[key]).pipe(
    Option.getOrElse(() => fallback)
  )

export const selectionKey = ({
  dimensions,
  selection
}: {
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly selection: WorkflowComparisonSelectedKnobs
}): string =>
  dimensions
    .map((dimension) => `${dimension.key}:${selectionValue({ fallback: "unset", key: dimension.key, selection })}`)
    .join("|")

const manifestSuffix = ({
  dimensions,
  selection
}: {
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly selection: WorkflowComparisonSelectedKnobs
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
  readonly selection: WorkflowComparisonSelectedKnobs
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
  comparison,
  dimensions,
  selection
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly selection: WorkflowComparisonSelectedKnobs
}): WorkflowExecutionRecord => {
  const optimizedRecord = comparison.optimized.record
  const knobLookup = optimizationKnobByKey(optimizedRecord.graph)
  const nodes = optimizedRecord.graph.nodes.filter((node) => nodeIsEnabled({ knobLookup, node, selection }))
  const remainingNodeIds = nodeIds(nodes)
  const edges = optimizedRecord.graph.edges.filter(
    (edge) => remainingNodeIds.includes(edge.fromNodeId) && remainingNodeIds.includes(edge.toNodeId)
  )
  const manifestId = `${optimizedRecord.graph.manifestId}-${manifestSuffix({ dimensions, selection })}`

  return makeWorkflowExecutionRecord({
    ...optimizedRecord,
    recordId: `${optimizedRecord.recordId}-${manifestSuffix({ dimensions, selection })}`,
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
