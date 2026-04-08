import {
  chatHandoffWorkflowComparisonManifest,
  renderSensitiveWorkflowComparisonManifest,
  retrievalRequiredWorkflowComparisonManifest,
  taskBriefingWorkflowComparisonManifest
} from "../../study/workflow/comparison/manifest.js"
import { WorkflowComparisonRunControls } from "../../study/workflow/comparison/run.js"
import type { EntrySeed } from "../descriptor.js"
import { EmptyStruct, makeEntryDescriptor, WorkflowSeedId } from "../descriptor.js"

const workflowEntrySeeds: ReadonlyArray<EntrySeed> = [
  {
    seedId: "task-briefing",
    label: taskBriefingWorkflowComparisonManifest.label,
    summary: taskBriefingWorkflowComparisonManifest.summary
  },
  {
    seedId: "chat-handoff",
    label: chatHandoffWorkflowComparisonManifest.label,
    summary: chatHandoffWorkflowComparisonManifest.summary
  },
  {
    seedId: "retrieval-required",
    label: retrievalRequiredWorkflowComparisonManifest.label,
    summary: retrievalRequiredWorkflowComparisonManifest.summary
  },
  {
    seedId: "render-sensitive",
    label: renderSensitiveWorkflowComparisonManifest.label,
    summary: renderSensitiveWorkflowComparisonManifest.summary
  }
]

export const workflowEntryDescriptor = makeEntryDescriptor({
  entryId: "workflow",
  title: "Workflow",
  packageName: "@theoria/theoria-app",
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
  controlsSchema: WorkflowComparisonRunControls
})
