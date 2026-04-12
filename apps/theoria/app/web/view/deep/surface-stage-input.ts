import { runEvidenceViewModel } from "../../../contracts/presentation/run-evidence.js"
import {
  type SurfaceStageFrameViewModel,
  surfaceStageFrameViewModel as projectSurfaceStageFrameViewModel,
  type SurfaceStageViewModel,
  surfaceStageViewModel as projectSurfaceStageViewModel
} from "../../../contracts/presentation/surface-stage.js"

import type { EntryProjectionHint } from "../../../contracts/entry/descriptor.js"
import type { EvidenceStreamState } from "../../state/evidence/stream.js"
import type { RunState } from "../../state/run/types.js"
import type { StageTab } from "../../state/surface/state.js"

import { runEvidencePresentationInput } from "./run-evidence-input.js"

export const surfaceStageViewModel = ({
  activeTab,
  interactiveLabel,
  projectionHint,
  run,
  stream
}: {
  readonly activeTab: StageTab
  readonly interactiveLabel: string | null
  readonly projectionHint: EntryProjectionHint
  readonly run: RunState
  readonly stream: EvidenceStreamState
}): SurfaceStageViewModel =>
  projectSurfaceStageViewModel({
    activeTab,
    evidence: runEvidenceViewModel(runEvidencePresentationInput({ run, stream })),
    interactiveLabel,
    projectionHint
  })

export const surfaceStageFrameViewModel = ({
  activeTab,
  interactiveLabel,
  projectionHint
}: {
  readonly activeTab: StageTab
  readonly interactiveLabel: string | null
  readonly projectionHint: EntryProjectionHint
}): SurfaceStageFrameViewModel => projectSurfaceStageFrameViewModel({ activeTab, interactiveLabel, projectionHint })
