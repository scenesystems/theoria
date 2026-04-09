import { Effect, Schema } from "effect"

import {
  defaultWorkflowEntryControls,
  workflowExecutionLaneLabel,
  workflowExecutionLanes,
  workflowOptimizeLabel,
  WorkflowRunControls,
  workflowRuntimeProfileLabel,
  workflowRuntimeProfiles,
  workflowSurfaceProfileLabel,
  workflowSurfaceProfiles,
  workflowTargetModeLabel,
  workflowTargetModes
} from "./controls.js"
import { WorkflowStudyExecutionError } from "./execution.js"
import { defaultWorkflowScenarioId, WorkflowScenarioIdSchema } from "./manifest.js"

const WorkflowEntryControlKeySchema = Schema.Literal(
  "lane",
  "optimize",
  "targetMode",
  "runtimeProfile",
  "surfaceProfile"
)

export type WorkflowEntryControlKey = typeof WorkflowEntryControlKeySchema.Type

const WorkflowEntryControlKindSchema = Schema.Literal("boolean", "enum")

export type WorkflowEntryControlKind = typeof WorkflowEntryControlKindSchema.Type

const WorkflowEntryControlValueSchema = Schema.Union(Schema.String, Schema.Boolean)

export class WorkflowEntryManifestSurface extends Schema.Class<WorkflowEntryManifestSurface>(
  "WorkflowEntryManifestSurface"
)({
  title: Schema.String,
  description: Schema.String
}) {}

export class WorkflowEntryBoundedControlOption extends Schema.Class<WorkflowEntryBoundedControlOption>(
  "WorkflowEntryBoundedControlOption"
)({
  value: WorkflowEntryControlValueSchema,
  label: Schema.String
}) {}

export class WorkflowEntryBoundedControlSurface extends Schema.Class<WorkflowEntryBoundedControlSurface>(
  "WorkflowEntryBoundedControlSurface"
)({
  key: WorkflowEntryControlKeySchema,
  kind: WorkflowEntryControlKindSchema,
  title: Schema.String,
  description: Schema.String,
  options: Schema.Array(WorkflowEntryBoundedControlOption)
}) {}

export const WorkflowEntrySelection = Schema.Struct({
  seedId: WorkflowScenarioIdSchema,
  controls: WorkflowRunControls
})

export type WorkflowEntrySelection = typeof WorkflowEntrySelection.Type

export const workflowEntryManifestSurface = WorkflowEntryManifestSurface.make({
  title: "Workflow Scenario",
  description:
    "Freeze one workflow seed before running. The server executes baseline, study, and optimized phases on one canonical ledger while the browser projects the resulting graph and evidence stream."
})

const workflowEntryControlOption = (value: string | boolean, label: string): WorkflowEntryBoundedControlOption =>
  WorkflowEntryBoundedControlOption.make({ value, label })

const workflowEntryBoundedControlSurface = ({
  description,
  key,
  kind,
  options,
  title
}: {
  readonly description: string
  readonly key: WorkflowEntryControlKey
  readonly kind: WorkflowEntryControlKind
  readonly options: ReadonlyArray<WorkflowEntryBoundedControlOption>
  readonly title: string
}): WorkflowEntryBoundedControlSurface =>
  WorkflowEntryBoundedControlSurface.make({
    description,
    key,
    kind,
    options,
    title
  })

export const workflowEntryControlsSurface: ReadonlyArray<WorkflowEntryBoundedControlSurface> = [
  workflowEntryBoundedControlSurface({
    key: "lane",
    kind: "enum",
    title: "Execution Lane",
    description:
      "Freeze the server execution lane as part of the entry draft rather than inferring it at request time.",
    options: workflowExecutionLanes.map((lane) => workflowEntryControlOption(lane, workflowExecutionLaneLabel(lane)))
  }),
  workflowEntryBoundedControlSurface({
    key: "optimize",
    kind: "boolean",
    title: "Optimization Study",
    description:
      "Decide whether the frozen entry draft opens the search-study lane or replays only the authored optimized target.",
    options: [true, false].map((optimize) => workflowEntryControlOption(optimize, workflowOptimizeLabel(optimize)))
  }),
  workflowEntryBoundedControlSurface({
    key: "targetMode",
    kind: "enum",
    title: "Replay Target",
    description:
      "Freeze whether the final workflow replay lands on the authored optimized route or the search-study winner.",
    options: workflowTargetModes.map((targetMode) =>
      workflowEntryControlOption(targetMode, workflowTargetModeLabel(targetMode))
    )
  }),
  workflowEntryBoundedControlSurface({
    key: "runtimeProfile",
    kind: "enum",
    title: "Runtime Profile",
    description:
      "Freeze the runtime preference that search and replay are allowed to use when the graph exposes runtime-profile knobs.",
    options: workflowRuntimeProfiles.map((runtimeProfile) =>
      workflowEntryControlOption(runtimeProfile, workflowRuntimeProfileLabel(runtimeProfile))
    )
  }),
  workflowEntryBoundedControlSurface({
    key: "surfaceProfile",
    kind: "enum",
    title: "Surface Profile",
    description:
      "Freeze the render-surface preference that the graph and render-evaluation lane should honor when a surface-profile knob is available.",
    options: workflowSurfaceProfiles.map((surfaceProfile) =>
      workflowEntryControlOption(surfaceProfile, workflowSurfaceProfileLabel(surfaceProfile))
    )
  })
]

export const workflowEntryControlSurfaceForKey = (
  key: WorkflowEntryControlKey
): WorkflowEntryBoundedControlSurface | null =>
  workflowEntryControlsSurface.find((control: WorkflowEntryBoundedControlSurface) => control.key === key) ?? null

export const defaultWorkflowEntrySelection = WorkflowEntrySelection.make({
  seedId: defaultWorkflowScenarioId,
  controls: defaultWorkflowEntryControls
})

export const validateWorkflowEntrySelection = <Selection extends WorkflowEntrySelection>(
  selection: Selection
): Effect.Effect<Selection, WorkflowStudyExecutionError, never> =>
  !selection.controls.optimize && selection.controls.targetMode === "search-winner"
    ? Effect.fail(
      new WorkflowStudyExecutionError({
        code: "invalid-query",
        message: "Workflow targetMode=search-winner requires optimize=true.",
        retryable: false
      })
    )
    : Effect.succeed(selection)

export const workflowEntrySelectionUsesOptimization = (selection: WorkflowEntrySelection): boolean =>
  selection.controls.optimize

export const workflowEntrySelectionUsesSearchWinner = (selection: WorkflowEntrySelection): boolean =>
  selection.controls.optimize && selection.controls.targetMode === "search-winner"
