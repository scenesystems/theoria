import { Effect, Option, Schema } from "effect"
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
} from "../../../../contracts/study/workflow/comparison/run.js"
import { WorkflowComparisonExecutionError } from "../../../../contracts/study/workflow/comparison/run.js"
import { DspProviderRuntime } from "../../../capability/effect-dsp.js"
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

const executionError = (message: string) =>
  new WorkflowComparisonExecutionError({
    code: "execution-failed",
    message,
    retryable: false
  })

const normalizedUsageForNodeExecution = (usage: Usage) => ({
  inputTokens: usage.inputTokens,
  outputTokens: usage.outputTokens,
  totalTokens: usage.inputTokens + usage.outputTokens,
  ...Option.fromNullable(usage.cachedCount > 0 ? 0 : undefined).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (cacheReadTokens) => ({ cacheReadTokens })
    })
  )
})

const responseIdForNodeExecution = ({
  comparison,
  node,
  trace,
  variant
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly node: NodeExecutionContract
  readonly trace: WorkflowComparisonTraceProjection
  readonly variant: GraphVariant
}): string => `${comparison.comparisonId}-${variant}-${node.nodeId}-${trace.timestamp}`

const deterministicRuntimeEvidenceForNodeExecution = ({
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
    responseId: responseIdForNodeExecution({ comparison, node, trace, variant }),
    startedAtMs: Math.max(trace.timestamp - trace.durationMs, 0),
    completedAtMs: trace.timestamp,
    finishReason: "stop",
    usage: normalizedUsageForNodeExecution(usage)
  })

  return InferenceRuntime.makeRuntimeEvidence({ resolution, resolvedRuntime })
}

const providerRuntimeEvidenceForNodeExecution = ({
  comparison,
  node,
  trace,
  usage,
  variant
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly node: NodeExecutionContract
  readonly trace: WorkflowComparisonTraceProjection
  readonly usage: Usage
  readonly variant: GraphVariant
}): Effect.Effect<RuntimeEvidence, WorkflowComparisonExecutionError, DspProviderRuntime> =>
  DspProviderRuntime.pipe(
    Effect.flatMap((runtime) =>
      Option.all({
        desired: runtime.resolution.desired,
        resolvedRoute: runtime.resolution.resolvedRoute
      }).pipe(
        Option.match({
          onNone: () =>
            Effect.fail(
              executionError(
                Option.getOrElse(runtime.capability.reason, () =>
                  "Workflow comparison live provider runtime is not configured.")
              )
            ),
          onSome: ({ desired, resolvedRoute }) => {
            const resolution = new InferenceRuntime.RuntimeResolution({
              desired: {
                ...desired,
                role: node.runtimeRole,
                tags: [...(desired.tags ?? []), comparison.workflowKind, variant, node.nodeKind]
              },
              resolvedRoute,
              capabilities: runtimeCapabilitiesForNode(node),
              layers: InferenceRuntime.emptyResolvedModelLayers()
            })

            return Effect.succeed(
              InferenceRuntime.makeRuntimeEvidence({
                resolution,
                resolvedRuntime: {
                  responseModel: Option.getOrElse(runtime.capability.model, () =>
                    desired.artifact.modelRef),
                  responseId: responseIdForNodeExecution({ comparison, node, trace, variant }),
                  startedAtMs: Math.max(trace.timestamp - trace.durationMs, 0),
                  completedAtMs: trace.timestamp,
                  finishReason: "stop",
                  usage: normalizedUsageForNodeExecution(usage)
                }
              })
            )
          }
        })
      )
    )
  )

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
}): Effect.Effect<RuntimeEvidence, WorkflowComparisonExecutionError, DspProviderRuntime> =>
  lane === "provider"
    ? providerRuntimeEvidenceForNodeExecution({ comparison, node, trace, usage, variant })
    : Effect.succeed(deterministicRuntimeEvidenceForNodeExecution({ comparison, lane, node, trace, usage, variant }))
