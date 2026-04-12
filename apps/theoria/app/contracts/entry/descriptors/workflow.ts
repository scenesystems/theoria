import { packageNameFromString } from "@theoria/source-proof/contracts"
import { WorkflowRunControls } from "../../study/workflow/controls.js"
import { WorkflowScenarioManifest } from "../../study/workflow/manifest.js"
import { WorkflowEntrySelection } from "../../study/workflow/selection.js"
import { EmptyStruct, EntryDescriptor, EntryProjectionHint, EntrySeed, WorkflowSeedId } from "../descriptor.js"

const defaultWorkflowSelection = WorkflowEntrySelection.defaults()

const workflowEntrySeeds: ReadonlyArray<EntrySeed> = WorkflowScenarioManifest.catalog().map((manifest) =>
  EntrySeed.make({
    seedId: manifest.id,
    label: manifest.label,
    summary: manifest.summary
  })
)

export const workflowEntryDescriptor = EntryDescriptor.make({
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
  projectionHint: EntryProjectionHint.make({
    stage:
      "Run one frozen workflow study at a time and let the browser project canonical graph steps, transcript outputs, and rendered replays from the same server-authored stream.",
    evidence:
      "Every workflow run accumulates graph deltas, node outputs, score changes, and study evidence on one ordered ledger.",
    source:
      `${WorkflowScenarioManifest.defaults().label} is the default proving route; switch scenarios before running to freeze a different workflow replay.`
  }),
  primaryAuthorityId: "effect-inference",
  authorityIds: ["effect-inference", "effect-search", "effect-dsp", "effect-text", "effect-math"],
  seeds: workflowEntrySeeds,
  defaultSeedId: defaultWorkflowSelection.seedId,
  defaultInput: {},
  defaultControls: defaultWorkflowSelection.controls,
  seedIdSchema: WorkflowSeedId,
  inputSchema: EmptyStruct,
  controlsSchema: WorkflowRunControls
})
