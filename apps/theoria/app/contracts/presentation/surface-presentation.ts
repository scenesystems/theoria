import { Schema } from "effect"

import { PresentationDetailRow } from "./detail-row.js"
import { RunControlsViewModel } from "./run-controls.js"
import { SurfaceChromeContentModel } from "./surface-chrome.js"
import { SurfaceCodeModel } from "./surface-code.js"
import { SurfaceStageFrameViewModel, SurfaceStageViewModel } from "./surface-stage.js"

export type SurfacePresentationInput = {
  readonly compact: boolean
  readonly running: boolean
  readonly runControls: RunControlsViewModel
  readonly status: string
  readonly chrome: SurfaceChromeContentModel
  readonly evidenceRows: ReadonlyArray<PresentationDetailRow>
  readonly code: SurfaceCodeModel
  readonly surfaceStage: SurfaceStageViewModel
}

export type DeepDiveSurfaceFramePresentationInput = {
  readonly runControls: RunControlsViewModel
  readonly chrome: SurfaceChromeContentModel
  readonly code: SurfaceCodeModel
  readonly surfaceStageFrame: SurfaceStageFrameViewModel
}

export const StatusTone = Schema.Literal("panel", "strip")
export type StatusTone = typeof StatusTone.Type

export const EvidenceDensity = Schema.Literal("compact", "expanded")
export type EvidenceDensity = typeof EvidenceDensity.Type

export class SurfaceViewModel extends Schema.Class<SurfaceViewModel>("SurfaceViewModel")({
  running: Schema.Boolean,
  runControls: RunControlsViewModel,
  statusTone: StatusTone,
  evidenceDensity: EvidenceDensity,
  status: Schema.String,
  chrome: SurfaceChromeContentModel,
  evidenceRows: Schema.Array(PresentationDetailRow),
  code: SurfaceCodeModel,
  surfaceStage: SurfaceStageViewModel
}) {
  static project({
    chrome,
    code,
    compact,
    evidenceRows,
    runControls,
    running,
    status,
    surfaceStage
  }: SurfacePresentationInput): SurfaceViewModel {
    return SurfaceViewModel.make({
      running,
      runControls,
      statusTone: compact ? "panel" : "strip",
      evidenceDensity: compact ? "compact" : "expanded",
      status,
      chrome,
      evidenceRows,
      code,
      surfaceStage
    })
  }
}

export class DeepDiveSurfaceFrameViewModel extends Schema.Class<DeepDiveSurfaceFrameViewModel>(
  "DeepDiveSurfaceFrameViewModel"
)({
  runControls: RunControlsViewModel,
  chrome: SurfaceChromeContentModel,
  code: SurfaceCodeModel,
  surfaceStageFrame: SurfaceStageFrameViewModel
}) {
  static project({
    chrome,
    code,
    runControls,
    surfaceStageFrame
  }: DeepDiveSurfaceFramePresentationInput): DeepDiveSurfaceFrameViewModel {
    return DeepDiveSurfaceFrameViewModel.make({
      runControls,
      chrome,
      code,
      surfaceStageFrame
    })
  }
}
