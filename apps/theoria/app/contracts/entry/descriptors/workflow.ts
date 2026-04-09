import { packageNameFromString } from "@theoria/source-proof/contracts"
import { WorkflowRunControls } from "../../study/workflow/controls.js"
import {
  chatHandoffWorkflowScenarioManifest,
  renderSensitiveWorkflowScenarioManifest,
  retrievalRequiredWorkflowScenarioManifest,
  taskBriefingWorkflowScenarioManifest
} from "../../study/workflow/manifest.js"
import type { EntrySeed } from "../descriptor.js"
import { EmptyStruct, EntryDescriptor, WorkflowSeedId } from "../descriptor.js"

const workflowEntrySeeds: ReadonlyArray<EntrySeed> = [
  {
    seedId: "task-briefing",
    label: taskBriefingWorkflowScenarioManifest.label,
    summary: taskBriefingWorkflowScenarioManifest.summary
  },
  {
    seedId: "chat-handoff",
    label: chatHandoffWorkflowScenarioManifest.label,
    summary: chatHandoffWorkflowScenarioManifest.summary
  },
  {
    seedId: "retrieval-required",
    label: retrievalRequiredWorkflowScenarioManifest.label,
    summary: retrievalRequiredWorkflowScenarioManifest.summary
  },
  {
    seedId: "render-sensitive",
    label: renderSensitiveWorkflowScenarioManifest.label,
    summary: renderSensitiveWorkflowScenarioManifest.summary
  }
]

export const workflowEntryDescriptor = EntryDescriptor.define({
  entryId: "workflow",
  title: "Workflow",
  packageName: packageNameFromString("@theoria/theoria-app"),
  description:
    "Compare baseline and optimized graph-backed workflow seeds on the same evaluation set, render envelope, and study-backed runtime spine.",
  useCase: "Prove prompt, routing, and chat-agent improvement from one integrated workflow entry.",
  summary:
    "Run a baseline-versus-optimized workflow, inspect the winning study selection, and trace why the graph improved.",
  runLabel: "Run Workflow",
  releaseState: "published",
  path: "/workflow",
  interactiveLabel: "Graph Workflow Comparison",
  primaryAuthorityId: "effect-inference",
  authorityIds: ["effect-inference", "effect-search", "effect-dsp", "effect-text", "effect-math"],
  seeds: workflowEntrySeeds,
  seedIdSchema: WorkflowSeedId,
  inputSchema: EmptyStruct,
  controlsSchema: WorkflowRunControls
})
