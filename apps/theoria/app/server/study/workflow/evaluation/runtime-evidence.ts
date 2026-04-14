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

import type { WorkflowExecutionLane } from "../../../../contracts/study/workflow/controls.js"
import {
  WorkflowStudyExecutionError,
  type WorkflowTraceProjection
} from "../../../../contracts/study/workflow/execution.js"
import type { FrozenWorkflowRun } from "../../../../contracts/study/workflow/frozen.js"
import { DspProviderRuntime } from "../../../capability/effect-dsp.js"

const decodeRuntimeCapabilities = Schema.decodeUnknownSync(RuntimeCapabilitiesSchema)

const routeForNode = ({
  workflowRun,
  node,
  variant
}: {
  readonly workflowRun: FrozenWorkflowRun
  readonly node: NodeExecutionContract
  readonly variant: GraphVariant
}): ExecutionRoute => ({
  family: "OpenAiCompatible",
  serveMode: "local-runtime",
  authMethod: "none",
  baseUrl: `in-memory://workflow/${workflowRun.seedId}/${variant}/${node.nodeId}`,
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
  workflowRun,
  node,
  variant
}: {
  readonly workflowRun: FrozenWorkflowRun
  readonly node: NodeExecutionContract
  readonly variant: GraphVariant
}) =>
  InferenceTesting.DesiredRuntimeDescriptor.fromTesting({
    modelRef: `workflow/${workflowRun.seedId}/${variant}/${node.nodeId}`,
    route: routeForNode({ workflowRun, node, variant }),
    capabilities: runtimeCapabilitiesForNode(node),
    role: node.runtimeRole,
    tags: [workflowRun.workflowKind, variant, node.nodeKind]
  })

const executionError = (message: string) =>
  new WorkflowStudyExecutionError({
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
  workflowRun,
  node,
  trace,
  variant
}: {
  readonly workflowRun: FrozenWorkflowRun
  readonly node: NodeExecutionContract
  readonly trace: WorkflowTraceProjection
  readonly variant: GraphVariant
}): string => `${workflowRun.seedId}-${variant}-${node.nodeId}-${trace.timestamp}`

const deterministicRuntimeEvidenceForNodeExecution = ({
  workflowRun,
  lane,
  node,
  trace,
  usage,
  variant
}: {
  readonly workflowRun: FrozenWorkflowRun
  readonly lane: WorkflowExecutionLane
  readonly node: NodeExecutionContract
  readonly trace: WorkflowTraceProjection
  readonly usage: Usage
  readonly variant: GraphVariant
}): RuntimeEvidence => {
  const desired = desiredRuntimeForNode({ workflowRun, node, variant })
  const resolvedRoute = InferenceTesting.ResolvedRouteDescriptor.fromTesting({
    desired,
    route: routeForNode({ workflowRun, node, variant }),
    selectedProvider: "deterministic-fallback",
    selectedDeployment: `${workflowRun.seedId}-${variant}`,
    providerModel: desired.artifact.modelRef,
    selectionReason: `${lane}:${node.nodeKind}`
  })
  const resolution = InferenceTesting.RuntimeResolution.fromTesting({
    desired,
    resolvedRoute,
    capabilities: runtimeCapabilitiesForNode(node)
  })
  const resolvedRuntime = InferenceTesting.ResolvedRuntimeDescriptor.fromTesting({
    responseModel: trace.moduleId,
    responseId: responseIdForNodeExecution({ workflowRun, node, trace, variant }),
    startedAtMs: Math.max(trace.timestamp - trace.durationMs, 0),
    completedAtMs: trace.timestamp,
    finishReason: "stop",
    usage: normalizedUsageForNodeExecution(usage)
  })

  return InferenceRuntime.RuntimeEvidence.fromResolution({ resolution, resolvedRuntime })
}

const providerRuntimeEvidenceForNodeExecution = ({
  workflowRun,
  node,
  trace,
  usage,
  variant
}: {
  readonly workflowRun: FrozenWorkflowRun
  readonly node: NodeExecutionContract
  readonly trace: WorkflowTraceProjection
  readonly usage: Usage
  readonly variant: GraphVariant
}): Effect.Effect<RuntimeEvidence, WorkflowStudyExecutionError, DspProviderRuntime> =>
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
                Option.getOrElse(runtime.capability.reason, () => "Workflow live provider runtime is not configured.")
              )
            ),
          onSome: ({ desired, resolvedRoute }) => {
            const resolution = new InferenceRuntime.RuntimeResolution({
              desired: {
                ...desired,
                role: node.runtimeRole,
                tags: [...(desired.tags ?? []), workflowRun.workflowKind, variant, node.nodeKind]
              },
              resolvedRoute,
              capabilities: runtimeCapabilitiesForNode(node),
              layers: InferenceRuntime.emptyResolvedModelLayers()
            })

            return Effect.succeed(
              InferenceRuntime.RuntimeEvidence.fromResolution({
                resolution,
                resolvedRuntime: InferenceTesting.ResolvedRuntimeDescriptor.fromTesting({
                  responseModel: Option.getOrElse(runtime.capability.model, () => desired.artifact.modelRef),
                  responseId: responseIdForNodeExecution({ workflowRun, node, trace, variant }),
                  startedAtMs: Math.max(trace.timestamp - trace.durationMs, 0),
                  completedAtMs: trace.timestamp,
                  finishReason: "stop",
                  usage: normalizedUsageForNodeExecution(usage)
                })
              })
            )
          }
        })
      )
    )
  )

export const runtimeEvidenceForNodeExecution = ({
  workflowRun,
  lane,
  node,
  trace,
  usage,
  variant
}: {
  readonly workflowRun: FrozenWorkflowRun
  readonly lane: WorkflowExecutionLane
  readonly node: NodeExecutionContract
  readonly trace: WorkflowTraceProjection
  readonly usage: Usage
  readonly variant: GraphVariant
}): Effect.Effect<RuntimeEvidence, WorkflowStudyExecutionError, DspProviderRuntime> =>
  lane === "provider"
    ? providerRuntimeEvidenceForNodeExecution({ workflowRun, node, trace, usage, variant })
    : Effect.succeed(deterministicRuntimeEvidenceForNodeExecution({ workflowRun, lane, node, trace, usage, variant }))
