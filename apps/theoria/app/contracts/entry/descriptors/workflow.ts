import { packageNameFromString } from "@theoria/source-proof/contracts"
import { workflowStudyId } from "../../study/id.js"
import {
  defaultWorkflowCatalogEntry,
  defaultWorkflowStudyPath,
  publishedWorkflowEntrySeeds
} from "../../study/workflow/catalog-policy.js"
import { EntryDescriptor, EntryProjectionHint } from "../descriptor.js"

export const workflowEntryDescriptor = EntryDescriptor.make({
  entryId: "workflow",
  studyId: workflowStudyId,
  title: "Workflow",
  packageName: packageNameFromString("@theoria/theoria-app"),
  description:
    "Run a workflow study that compares baseline and optimized variants on shared evaluation material, then inspect the evidence behind the outcome.",
  useCase:
    "Study a workflow against real traces or evaluation sets, test improvements, and explain why one revision wins.",
  summary: "Choose a workflow, run the study, and compare the baseline, winner, and evidence side by side.",
  runLabel: "Run Study",
  releaseState: "published",
  path: defaultWorkflowStudyPath,
  interactiveLabel: "Workflow Study",
  projectionHint: EntryProjectionHint.make({
    stage:
      "Choose a workflow, shape the run, and watch the study unfold across controls, interactions, and render-aware outputs.",
    evidence: "Each run records scores, graph changes, node outputs, and study notes on one ordered evidence ledger.",
    source:
      `${defaultWorkflowCatalogEntry.label} is the published starting point. Switch to another workflow before you run if you want to study a different revision.`
  }),
  primaryAuthorityId: "effect-inference",
  authorityIds: ["effect-inference", "effect-search", "effect-dsp", "effect-text", "effect-math"],
  seeds: publishedWorkflowEntrySeeds
})
