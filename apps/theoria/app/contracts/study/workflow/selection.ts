import { Effect, Match, Schema } from "effect"

import { workflowEntryId } from "../../entry/id.js"
import type { EntryDraft } from "../../entry/registry.js"

import {
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
import { WorkflowScenarioIdSchema, WorkflowScenarioManifest } from "./manifest.js"

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

type WorkflowSelectionEntryDraft = Extract<EntryDraft, { readonly entryId: typeof workflowEntryId }>
type WorkflowSelectionDraft = {
  readonly controls: WorkflowSelectionEntryDraft["controls"]
  readonly seedId: WorkflowSelectionEntryDraft["seedId"]
}

export class WorkflowEntryManifestSurface extends Schema.Class<WorkflowEntryManifestSurface>(
  "WorkflowEntryManifestSurface"
)({
  title: Schema.String,
  description: Schema.String
}) {
  static authored(): WorkflowEntryManifestSurface {
    return WorkflowEntryManifestSurface.make({
      title: "Workflow Scenario",
      description:
        "Freeze one workflow seed before running. The server executes baseline, study, and optimized phases on one canonical ledger while the browser projects the resulting graph and evidence stream."
    })
  }
}

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
}) {
  static all(): ReadonlyArray<WorkflowEntryBoundedControlSurface> {
    return workflowEntryBoundedControlSurfaces
  }

  static forKey(key: WorkflowEntryControlKey): WorkflowEntryBoundedControlSurface {
    return Match.value(key).pipe(
      Match.when("lane", () => workflowEntryExecutionLaneControlSurface),
      Match.when("optimize", () => workflowEntryOptimizeControlSurface),
      Match.when("targetMode", () => workflowEntryTargetModeControlSurface),
      Match.when("runtimeProfile", () => workflowEntryRuntimeProfileControlSurface),
      Match.when("surfaceProfile", () => workflowEntrySurfaceProfileControlSurface),
      Match.exhaustive
    )
  }
}

export class WorkflowEntrySelection extends Schema.Class<WorkflowEntrySelection>("WorkflowEntrySelection")({
  seedId: WorkflowScenarioIdSchema,
  controls: WorkflowRunControls
}) {
  static defaults(): WorkflowEntrySelection {
    return WorkflowEntrySelection.make({
      seedId: WorkflowScenarioManifest.defaults().id,
      controls: WorkflowRunControls.defaults()
    })
  }

  static fromDraft(draft: WorkflowSelectionDraft): WorkflowEntrySelection {
    return WorkflowEntrySelection.make({
      seedId: draft.seedId,
      controls: draft.controls
    })
  }

  static optionFromEntryDraft(draft: EntryDraft | null): WorkflowEntrySelection | null {
    return draft !== null && draft.entryId === workflowEntryId ? WorkflowEntrySelection.fromDraft(draft) : null
  }

  static fromEntryDraftOrDefaults(draft: EntryDraft | null): WorkflowEntrySelection {
    return WorkflowEntrySelection.optionFromEntryDraft(draft) ?? WorkflowEntrySelection.defaults()
  }

  static validate<Selection extends WorkflowEntrySelection>(
    selection: Selection
  ): Effect.Effect<Selection, WorkflowStudyExecutionError, never> {
    return !selection.controls.optimize && selection.controls.targetMode === "search-winner"
      ? Effect.fail(
        new WorkflowStudyExecutionError({
          code: "invalid-query",
          message: "Workflow targetMode=search-winner requires optimize=true.",
          retryable: false
        })
      )
      : Effect.succeed(selection)
  }

  static usesOptimization(selection: WorkflowEntrySelection): boolean {
    return selection.controls.optimize
  }

  static usesSearchWinner(selection: WorkflowEntrySelection): boolean {
    return selection.controls.optimize && selection.controls.targetMode === "search-winner"
  }
}

const workflowEntryExecutionLaneControlSurface = WorkflowEntryBoundedControlSurface.make({
  key: "lane",
  kind: "enum",
  title: "Execution Lane",
  description: "Freeze the server execution lane as part of the entry draft rather than inferring it at request time.",
  options: workflowExecutionLanes.map((lane) =>
    WorkflowEntryBoundedControlOption.make({
      value: lane,
      label: workflowExecutionLaneLabel(lane)
    })
  )
})

const workflowEntryOptimizeControlSurface = WorkflowEntryBoundedControlSurface.make({
  key: "optimize",
  kind: "boolean",
  title: "Optimization Study",
  description:
    "Decide whether the frozen entry draft opens the search-study lane or replays only the authored optimized target.",
  options: [true, false].map((optimize) =>
    WorkflowEntryBoundedControlOption.make({
      value: optimize,
      label: workflowOptimizeLabel(optimize)
    })
  )
})

const workflowEntryTargetModeControlSurface = WorkflowEntryBoundedControlSurface.make({
  key: "targetMode",
  kind: "enum",
  title: "Replay Target",
  description:
    "Freeze whether the final workflow replay lands on the authored optimized route or the search-study winner.",
  options: workflowTargetModes.map((targetMode) =>
    WorkflowEntryBoundedControlOption.make({
      value: targetMode,
      label: workflowTargetModeLabel(targetMode)
    })
  )
})

const workflowEntryRuntimeProfileControlSurface = WorkflowEntryBoundedControlSurface.make({
  key: "runtimeProfile",
  kind: "enum",
  title: "Runtime Profile",
  description:
    "Freeze the runtime preference that search and replay are allowed to use when the graph exposes runtime-profile knobs.",
  options: workflowRuntimeProfiles.map((runtimeProfile) =>
    WorkflowEntryBoundedControlOption.make({
      value: runtimeProfile,
      label: workflowRuntimeProfileLabel(runtimeProfile)
    })
  )
})

const workflowEntrySurfaceProfileControlSurface = WorkflowEntryBoundedControlSurface.make({
  key: "surfaceProfile",
  kind: "enum",
  title: "Surface Profile",
  description:
    "Freeze the render-surface preference that the graph and render-evaluation lane should honor when a surface-profile knob is available.",
  options: workflowSurfaceProfiles.map((surfaceProfile) =>
    WorkflowEntryBoundedControlOption.make({
      value: surfaceProfile,
      label: workflowSurfaceProfileLabel(surfaceProfile)
    })
  )
})

const workflowEntryBoundedControlSurfaces = [
  workflowEntryExecutionLaneControlSurface,
  workflowEntryOptimizeControlSurface,
  workflowEntryTargetModeControlSurface,
  workflowEntryRuntimeProfileControlSurface,
  workflowEntrySurfaceProfileControlSurface
]
