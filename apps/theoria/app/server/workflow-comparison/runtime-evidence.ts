import { Option, Schema } from "effect"
import type { Usage } from "effect-dsp/contracts"
import {
  type ExecutionRoute,
  type GraphVariant,
  type NodeExecutionContract,
  RuntimeCapabilitiesSchema,
  type RuntimeEvidence
} from "effect-inference/Contracts"
import * as InferenceRuntime from "effect-inference/Runtime"
import * as InferenceTesting from "effect-inference/Testing"

import type {
  WorkflowComparisonExecutionLane,
  WorkflowComparisonTraceProjection
} from "../../contracts/workflow/comparison-run.js"
import type { FrozenWorkflowComparisonRun } from "./frozen.js"

const decodeRuntimeCapabilities = Schema.decodeUnknownSync(RuntimeCapabilitiesSchema)

const routeForNode = ({
  comparison,
  node,
  variant
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly node: NodeExecutionContract
  readonly variant: GraphVariant
}): ExecutionRoute => ({
  family: "OpenAiCompatible",
  serveMode: "local-runtime",
  authMethod: "none",
  baseUrl: `in-memory://workflow-comparison/${comparison.comparisonId}/${variant}/${node.nodeId}`,
  runtimeFlavorHint: "unknown"
})

const runtimeCapabilitiesForNode = (node: NodeExecutionContract) =>
  decodeRuntimeCapabilities({
    textGeneration: node.capabilityRequirements?.textGeneration ?? false,
    embeddings: node.capabilityRequirements?.embeddings ?? false,
    streaming: node.capabilityRequirements?.streaming ?? false,
    toolCalling: node.capabilityRequirements?.toolCalling ?? false,
    structuredOutput: node.capabilityRequirements?.structuredOutput ?? "none",
    usageReporting: node.capabilityRequirements?.usageReporting ?? false,
    multimodalInput: node.capabilityRequirements?.multimodalInput ?? false,
    maxContextTokens: node.capabilityRequirements?.minimumContextTokens
  })

const desiredRuntimeForNode = ({
  comparison,
  node,
  variant
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly node: NodeExecutionContract
  readonly variant: GraphVariant
}) => ({
  ...InferenceTesting.makeDesiredRuntimeDescriptor({
    modelRef: `workflow-comparison/${comparison.comparisonId}/${variant}/${node.nodeId}`,
    route: routeForNode({ comparison, node, variant }),
    capabilities: runtimeCapabilitiesForNode(node)
  }),
  role: node.runtimeRole,
  tags: [comparison.workflowKind, variant, node.nodeKind]
})

export const runtimeEvidenceForNodeExecution = ({
  comparison,
  lane,
  node,
  trace,
  usage,
  variant
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly lane: WorkflowComparisonExecutionLane
  readonly node: NodeExecutionContract
  readonly trace: WorkflowComparisonTraceProjection
  readonly usage: Usage
  readonly variant: GraphVariant
}): RuntimeEvidence => {
  const desired = desiredRuntimeForNode({ comparison, node, variant })
  const resolvedRoute = InferenceTesting.makeResolvedRouteDescriptor({
    desired,
    route: routeForNode({ comparison, node, variant }),
    selectedProvider: "deterministic-fallback",
    selectedDeployment: `${comparison.comparisonId}-${variant}`,
    providerModel: desired.artifact.modelRef,
    selectionReason: `${lane}:${node.nodeKind}`
  })
  const resolution = InferenceTesting.makeRuntimeResolution({
    desired,
    resolvedRoute,
    capabilities: runtimeCapabilitiesForNode(node)
  })
  const resolvedRuntime = InferenceTesting.makeResolvedRuntimeDescriptor({
    responseModel: trace.moduleId,
    responseId: `${comparison.comparisonId}-${variant}-${node.nodeId}-${trace.timestamp}`,
    startedAtMs: Math.max(trace.timestamp - trace.durationMs, 0),
    completedAtMs: trace.timestamp,
    finishReason: "stop",
    usage: {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.inputTokens + usage.outputTokens,
      ...Option.fromNullable(usage.cachedCount > 0 ? 0 : undefined).pipe(
        Option.match({
          onNone: () => ({}),
          onSome: (cacheReadTokens) => ({ cacheReadTokens })
        })
      )
    }
  })

  return InferenceRuntime.makeRuntimeEvidence({ resolution, resolvedRuntime })
}
