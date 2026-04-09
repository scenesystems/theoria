import type { EntryError } from "../../../contracts/entry-error.js"
import { defaultEntryDraft } from "../../../contracts/entry/defaults.js"
import type { EntryId } from "../../../contracts/entry/id.js"
import type { EntryDraft } from "../../../contracts/entry/registry.js"
import type { ProgramPreview } from "../../../contracts/presentation/program-preview.js"
import type { ProgramSourceScope } from "../../../contracts/presentation/program.js"

import { RunIdleState } from "../run/state.js"
import type { RunState as RunStateValue } from "../run/types.js"

export type StageTab = "interactive" | "evidence"

export type PreloadState =
  | { readonly _tag: "PreloadIdle" }
  | { readonly _tag: "PreloadLoading" }
  | { readonly _tag: "PreloadReady"; readonly data: ProgramPreview }
  | { readonly _tag: "PreloadFailed"; readonly error: EntryError }

export type SurfaceState = {
  readonly id: EntryId
  readonly draft: EntryDraft
  readonly stageTab: StageTab
  readonly preload: PreloadState
  readonly run: RunStateValue
  readonly nextSequence: number
  readonly programSourceScope: ProgramSourceScope
  readonly programFileIndex: number
}

export const initialSurfaceState = (id: EntryId): SurfaceState => ({
  id,
  draft: defaultEntryDraft(id),
  stageTab: "interactive",
  preload: { _tag: "PreloadIdle" },
  run: RunIdleState.make(),
  nextSequence: 1,
  programSourceScope: "run",
  programFileIndex: 0
})
