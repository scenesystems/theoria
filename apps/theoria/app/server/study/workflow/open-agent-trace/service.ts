import { Effect } from "effect"

import type { ConsumerArtifact } from "../../../../contracts/study/workflow/consumer-artifact.js"
import type { OpenAgentTraceRegistryEntry } from "../../../../contracts/study/workflow/open-agent-trace.js"
import type { WorkflowHookup } from "../../../../contracts/study/workflow/workflow-hookup.js"

import { loadOpenAgentTraceRegistry } from "./registry.js"

const registry = (): Effect.Effect<ReadonlyArray<OpenAgentTraceRegistryEntry>> =>
  loadOpenAgentTraceRegistry.pipe(Effect.orDie)

const consumerArtifacts = (): Effect.Effect<ReadonlyArray<ConsumerArtifact>> =>
  registry().pipe(Effect.map((entries) => entries.map((entry) => entry.consumerArtifact)))

const workflowHookups = (): Effect.Effect<ReadonlyArray<WorkflowHookup>> =>
  registry().pipe(Effect.map((entries) => entries.map((entry) => entry.workflowHookup)))

export class OpenAgentTraceService extends Effect.Service<OpenAgentTraceService>()(
  "theoria/server/OpenAgentTraceService",
  {
    succeed: {
      registry,
      consumerArtifacts,
      workflowHookups
    }
  }
) {}
