import type { DemoError } from "../../../contracts/demo-error.js"
import { defaultEntryDraft } from "../../../contracts/entry/defaults.js"
import type { EntryId } from "../../../contracts/entry/id.js"
import type { EntryDraft } from "../../../contracts/entry/registry.js"
import type { ProgramPreview } from "../../../contracts/presentation/program-preview.js"
import type { ProgramSourceScope } from "../../../contracts/presentation/program.js"

import { initialRunState } from "../run/session.js"
import type { RunState } from "../run/types.js"

export type StageTab = "interactive" | "evidence"

export type PreloadState =
  | { readonly _tag: "PreloadIdle" }
  | { readonly _tag: "PreloadLoading" }
  | { readonly _tag: "PreloadReady"; readonly data: ProgramPreview }
  | { readonly _tag: "PreloadFailed"; readonly error: DemoError }

export type SurfaceState = {
  readonly id: EntryId
  readonly draft: EntryDraft
  readonly stageTab: StageTab
  readonly preload: PreloadState
  readonly run: RunState
  readonly nextSequence: number
  readonly programSourceScope: ProgramSourceScope
  readonly programFileIndex: number
}

export const initialSurfaceState = (id: EntryId): SurfaceState => ({
  id,
  draft: defaultEntryDraft(id),
  stageTab: "interactive",
  preload: { _tag: "PreloadIdle" },
  run: initialRunState(),
  nextSequence: 1,
  programSourceScope: "run",
  programFileIndex: 0
})
