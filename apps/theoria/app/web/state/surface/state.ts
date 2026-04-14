import type { EntryError } from "../../../contracts/entry-error.js"
import { type EntryId, workflowEntryId } from "../../../contracts/entry/id.js"
import type { ProgramPreview } from "../../../contracts/presentation/program-preview.js"
import type { ProgramSourceScope } from "../../../contracts/presentation/program.js"
import type { ProjectionPlane } from "../../../contracts/presentation/projection.js"
import { type StudyDraft, StudyRegistry } from "../../../contracts/study/registry.js"

import { RunIdleState } from "../run/state.js"
import type { RunState as RunStateValue } from "../run/types.js"

export type StageTab = "interactive" | "interaction" | "evidence"

const studyRegistry = StudyRegistry.current()

const defaultStageTabForEntryId = (_id: EntryId): StageTab => "interactive"

const defaultProjectedSurfacesForEntryId = (id: EntryId): ReadonlyArray<ProjectionPlane> =>
  id === workflowEntryId ? ["stage", "source"] : ["source", "evidence"]
const defaultFocusedSurfaceForEntryId = (id: EntryId): ProjectionPlane => id === workflowEntryId ? "stage" : "source"

export type PreloadState =
  | { readonly _tag: "PreloadIdle" }
  | { readonly _tag: "PreloadLoading" }
  | { readonly _tag: "PreloadReady"; readonly data: ProgramPreview }
  | { readonly _tag: "PreloadFailed"; readonly error: EntryError }

export type SurfaceState = {
  readonly id: EntryId
  readonly draft: StudyDraft
  readonly stageTab: StageTab
  readonly projectedSurfaces: ReadonlyArray<ProjectionPlane>
  readonly focusedSurface: ProjectionPlane
  readonly preload: PreloadState
  readonly run: RunStateValue
  readonly nextSequence: number
  readonly programSourceScope: ProgramSourceScope
  readonly programFileIndex: number
}

export const initialSurfaceState = (id: EntryId): SurfaceState => ({
  id,
  draft: studyRegistry.defaultDraftForEntryId(id),
  stageTab: defaultStageTabForEntryId(id),
  projectedSurfaces: defaultProjectedSurfacesForEntryId(id),
  focusedSurface: defaultFocusedSurfaceForEntryId(id),
  preload: { _tag: "PreloadIdle" },
  run: RunIdleState.make(),
  nextSequence: 1,
  programSourceScope: "run",
  programFileIndex: 0
})
