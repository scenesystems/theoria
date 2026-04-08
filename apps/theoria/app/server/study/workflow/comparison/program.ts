import { Match, Schema } from "effect"

import type { GraphVariant, WorkflowExecutionRecord } from "effect-inference/Contracts"
import { multiFileProgram, programFile } from "../../../kernel/presentation.js"
import type { FrozenWorkflowComparisonRun } from "./frozen.js"

const encodeStringLiteral = Schema.encodeSync(Schema.parseJson(Schema.String))

const variantLabel = (variant: GraphVariant): string =>
  Match.value(variant).pipe(
    Match.when("baseline", () => "Baseline"),
    Match.when("optimized", () => "Optimized"),
    Match.exhaustive
  )

const renderArray = (values: ReadonlyArray<string>): string => `[${values.map((value) => `"${value}"`).join(", ")}]`

const renderRecord = (record: WorkflowExecutionRecord, variant: GraphVariant): string => {
  const nodes = record.graph.nodes.map(
    (node) =>
      `  { nodeId: "${node.nodeId}", nodeKind: "${node.nodeKind}", runtimeRole: "${node.runtimeRole}", outputLane: "${node.outputLane}" }`
  )
  const edges = record.graph.edges.map(
    (edge) => `  { edgeId: "${edge.edgeId}", kind: "${edge.kind}", from: "${edge.fromNodeId}", to: "${edge.toNodeId}" }`
  )
  const turns = record.session.turns.map(
    (turn) => `  { turnId: "${turn.turnId}", role: "${turn.role}", content: ${encodeStringLiteral(turn.content)} }`
  )

  return [
    `export const ${variant}Workflow = {`,
    `  workflowKind: "${record.workflowKind}",`,
    `  variant: "${variant}",`,
    `  manifestId: "${record.graph.manifestId}",`,
    `  label: "${variantLabel(variant)}",`,
    `  entryNodeId: "${record.projection.entryNodeId}",`,
    `  terminalNodeIds: ${renderArray(record.projection.terminalNodeIds)},`,
    `  activeStateLanes: ${renderArray(record.projection.activeStateLanes)},`,
    `  nodes: [`,
    ...nodes,
    `  ],`,
    `  edges: [`,
    ...edges,
    `  ],`,
    `  turns: [`,
    ...turns,
    `  ]`,
    `}`
  ].join("\n")
}

export const programForWorkflowComparison = (comparison: FrozenWorkflowComparisonRun) =>
  multiFileProgram([
    programFile(
      "workflow-comparison/baseline.graph.ts",
      renderRecord(comparison.baseline.record, "baseline")
    ),
    programFile(
      "workflow-comparison/optimized.graph.ts",
      renderRecord(comparison.optimized.record, "optimized")
    )
  ])
