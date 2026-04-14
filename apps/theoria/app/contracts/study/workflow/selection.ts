import { Effect, Match, Schema } from "effect"

import { workflowEntryId } from "../../entry/id.js"
import type { StudyDraft } from "../registry.js"

import { defaultWorkflowSeedId } from "./catalog-policy.js"
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
import { WorkflowSeedIdSchema } from "./manifest.js"

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

type WorkflowSelectionStudyDraft = Extract<StudyDraft, { readonly entryId: typeof workflowEntryId }>
type WorkflowSelectionDraft = {
  readonly controls: WorkflowSelectionStudyDraft["controls"]
  readonly seedId: WorkflowSelectionStudyDraft["seedId"]
}

export class WorkflowEntryManifestSurface extends Schema.Class<WorkflowEntryManifestSurface>(
  "WorkflowEntryManifestSurface"
)({
  title: Schema.String,
  description: Schema.String
}) {
  static authored(): WorkflowEntryManifestSurface {
    return WorkflowEntryManifestSurface.make({
      title: "Workflow Study",
      description:
        "Choose the workflow you want to study, then compare the baseline, the authored improvement, and any study-selected winner in one evidence-rich workspace."
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
  seedId: WorkflowSeedIdSchema,
  controls: WorkflowRunControls
}) {
  static defaults(): WorkflowEntrySelection {
    return WorkflowEntrySelection.make({
      seedId: defaultWorkflowSeedId,
      controls: WorkflowRunControls.defaults()
    })
  }

  static fromDraft(draft: WorkflowSelectionDraft): WorkflowEntrySelection {
    return WorkflowEntrySelection.make({
      seedId: draft.seedId,
      controls: draft.controls
    })
  }

  static optionFromDraft(draft: StudyDraft | null): WorkflowEntrySelection | null {
    return draft !== null && draft.entryId === workflowEntryId ? WorkflowEntrySelection.fromDraft(draft) : null
  }

  static fromDraftOrDefaults(draft: StudyDraft | null): WorkflowEntrySelection {
    return WorkflowEntrySelection.optionFromDraft(draft) ?? WorkflowEntrySelection.defaults()
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
  title: "Execution path",
  description: "Choose whether this study should replay deterministically or use a live provider runtime.",
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
  title: "Search mode",
  description: "Decide whether this run should search for a better workflow or simply replay the authored improvement.",
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
  title: "Final replay",
  description:
    "Choose whether the final replay should show the authored improvement or the best workflow the study finds.",
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
  title: "Runtime choice",
  description: "Pick the runtime preference the workflow may use when runtime selection is part of the study.",
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
  title: "Surface choice",
  description: "Pick the render surface preference the workflow should honor when presentation affects the result.",
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
