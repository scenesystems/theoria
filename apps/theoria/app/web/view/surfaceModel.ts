import type { EntryPresentation } from "../../contracts/entry/routing.js"
import type { PresentationDetailRow } from "../../contracts/presentation/detail-row.js"
import { type PresentedRun, presentSections } from "../../contracts/presentation/presented-run.js"
import type { SurfaceVariant } from "../../contracts/presentation/program.js"
import { RunControlsViewModel } from "../../contracts/presentation/run-controls.js"
import type { SurfaceChromeContentModel } from "../../contracts/presentation/surface-chrome.js"
import { surfaceChromeContentModel } from "../../contracts/presentation/surface-chrome.js"
import { SurfaceCodeModel } from "../../contracts/presentation/surface-code.js"
import {
  DeepDiveSurfaceFrameViewModel,
  SurfaceViewModel,
  type SurfaceViewModel as SurfaceViewModelType
} from "../../contracts/presentation/surface-presentation.js"
import type { SurfaceStageViewModel } from "../../contracts/presentation/surface-stage.js"
import { surfaceSummaryEvidenceRows } from "../../contracts/presentation/surface-summary.js"
import { type EvidenceStreamState } from "../state/evidence/stream.js"
import { statusText } from "../state/run/status.js"
import type { SurfaceState } from "../state/surface/state.js"

import { surfaceStageFrameViewModel, surfaceStageViewModel } from "./deep/surface-stage-input.js"
import { surfaceCodePresentationInput } from "./surface-code-input.js"

type SurfacePresentationParts = {
  readonly compact: boolean
  readonly chrome: SurfaceChromeContentModel
  readonly code: SurfaceCodeModel
  readonly evidenceRows: ReadonlyArray<PresentationDetailRow>
  readonly runControls: RunControlsViewModel
  readonly surfaceStage: SurfaceStageViewModel
}

const surfacePresentationParts = ({
  compact,
  presented,
  state,
  stream,
  surface,
  variant
}: {
  readonly compact: boolean
  readonly presented: PresentedRun | null
  readonly state: SurfaceState
  readonly stream: EvidenceStreamState
  readonly surface: EntryPresentation
  readonly variant: SurfaceVariant
}): SurfacePresentationParts => {
  const sections = presented === null ? presentSections(stream.sections) : presented.sections

  return {
    compact,
    runControls: RunControlsViewModel.project({ phase: state.run.session.phase(), runLabel: surface.runLabel }),
    chrome: surfaceChromeContentModel(surface),
    evidenceRows: surfaceSummaryEvidenceRows({
      compact,
      hasSuccessfulRun: state.run._tag === "RunSuccess",
      sections,
      surface
    }),
    code: SurfaceCodeModel.project(surfaceCodePresentationInput(state, variant)),
    surfaceStage: surfaceStageViewModel({
      activeTab: state.stageTab,
      interactiveLabel: surface.interactiveLabel,
      projectionHint: surface.projectionHint,
      run: state.run,
      stream
    })
  }
}

export const surfaceViewModel = ({
  surface,
  presented,
  state,
  stream,
  variant
}: {
  readonly surface: EntryPresentation
  readonly presented: PresentedRun | null
  readonly state: SurfaceState
  readonly stream: EvidenceStreamState
  readonly variant: SurfaceVariant
}): SurfaceViewModelType => {
  const compact = variant === "compact"
  const parts = surfacePresentationParts({ compact, presented, state, stream, surface, variant })

  return SurfaceViewModel.project({
    ...parts,
    running: state.run.session.phase() === "running",
    status: statusText({ preload: state.preload, run: state.run }, stream.status()),
    compact
  })
}

export const deepDiveSurfaceFrameViewModel = ({
  surface,
  state
}: {
  readonly surface: EntryPresentation
  readonly state: SurfaceState
}): DeepDiveSurfaceFrameViewModel =>
  DeepDiveSurfaceFrameViewModel.project({
    runControls: RunControlsViewModel.project({ phase: state.run.session.phase(), runLabel: surface.runLabel }),
    chrome: surfaceChromeContentModel(surface),
    code: SurfaceCodeModel.project(surfaceCodePresentationInput(state, "expanded")),
    surfaceStageFrame: surfaceStageFrameViewModel({
      activeTab: state.stageTab,
      interactiveLabel: surface.interactiveLabel,
      projectionHint: surface.projectionHint
    })
  })
