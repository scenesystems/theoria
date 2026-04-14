import { Schema } from "effect"
import { WorkflowKindSchema } from "effect-inference/Contracts"

import { ConsumerArtifactKind } from "./consumer-artifact.js"

export const WorkflowHookupSourceKind = Schema.Literal("open-agent-trace")

export type WorkflowHookupSourceKind = typeof WorkflowHookupSourceKind.Type

export const WorkflowHookupTransport = Schema.Literal("registry", "import")

export type WorkflowHookupTransport = typeof WorkflowHookupTransport.Type
export const registryWorkflowHookupTransport: WorkflowHookupTransport = "registry"
export const importWorkflowHookupTransport: WorkflowHookupTransport = "import"

export class WorkflowHookup extends Schema.Class<WorkflowHookup>("WorkflowHookup")({
  artifactKind: ConsumerArtifactKind,
  sourceKind: WorkflowHookupSourceKind,
  transport: WorkflowHookupTransport,
  workflowKind: WorkflowKindSchema
}) {
  detail(): string {
    return `${this.workflowKind} · ${this.sourceKind} · ${this.transport} · ${this.artifactKind}`
  }
}
