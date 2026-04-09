import { Schema } from "effect"
import * as Arr from "effect/Array"

import type { EntryPresentation } from "../../contracts/entry/routing.js"
import { PresentationDetailRow, presentationDetailRow } from "../../contracts/presentation/detail-row.js"
import type { SurfaceVariant } from "../../contracts/presentation/program.js"
import { SurfaceChromeContentModel, surfaceChromeContentModel } from "../../contracts/presentation/surface-chrome.js"
import { tabHintFor } from "../runtime/kernel/surface-view.js"
import { type EvidenceStreamState } from "../state/evidence/stream.js"
import { statusText } from "../state/run/status.js"
import type { SurfaceState } from "../state/surface/state.js"

import {
  SurfaceStageFrameViewModel,
  surfaceStageFrameViewModel,
  SurfaceStageViewModel,
  surfaceStageViewModel
} from "./deep/surface-stage-model.js"
import { type PresentedRun, presentSections } from "./presenter.js"
import { RunControlsViewModel, runControlsViewModel } from "./runControlsModel.js"
import { SurfaceCodeModel, surfaceCodeModel } from "./surfaceCodeModel.js"

const compactEvidenceRowLimit = 2

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
}) {}

export class DeepDiveSurfaceFrameViewModel extends Schema.Class<DeepDiveSurfaceFrameViewModel>(
  "DeepDiveSurfaceFrameViewModel"
)({
  runControls: RunControlsViewModel,
  chrome: SurfaceChromeContentModel,
  code: SurfaceCodeModel,
  surfaceStageFrame: SurfaceStageFrameViewModel
}) {}

const packageUseCaseRow = (surface: EntryPresentation): PresentationDetailRow =>
  presentationDetailRow("Entry Use Case", `${surface.packageName}: ${surface.useCase}`)

const selectedSectionRows = (
  presented: PresentedRun | null,
  stream: EvidenceStreamState
): ReadonlyArray<PresentationDetailRow> =>
  Arr.flatMap(
    presented === null ? presentSections(stream.sections) : presented.sections,
    (section) => section.rows
  )

const compactRows = ({
  surface,
  rows,
  state
}: {
  readonly surface: EntryPresentation
  readonly rows: ReadonlyArray<PresentationDetailRow>
  readonly state: SurfaceState
}): ReadonlyArray<PresentationDetailRow> => {
  const packageRow = packageUseCaseRow(surface)
  const rowsWithUseCase = rows[0]?.label === packageRow.label ? rows : [packageRow, ...rows]

  return state.run._tag === "RunSuccess" || rows.length > 0
    ? Arr.take(rowsWithUseCase, compactEvidenceRowLimit + 1)
    : [packageRow, presentationDetailRow("Run Intent", surface.summary)]
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
}): SurfaceViewModel => {
  const compact = variant === "compact"
  const rows = selectedSectionRows(presented, stream)

  return SurfaceViewModel.make({
    running: state.run.session.phase() === "running",
    runControls: runControlsViewModel({ run: state.run, runLabel: surface.runLabel }),
    statusTone: compact ? "panel" : "strip",
    evidenceDensity: compact ? "compact" : "expanded",
    status: statusText({ preload: state.preload, run: state.run }, stream.status()),
    chrome: surfaceChromeContentModel(surface),
    evidenceRows: compact ? compactRows({ surface, rows, state }) : rows,
    code: surfaceCodeModel(state, variant),
    surfaceStage: surfaceStageViewModel({
      activeTab: state.stageTab,
      interactiveLabel: surface.interactiveLabel,
      run: state.run,
      stream,
      tabHint: tabHintFor(surface.entryId)
    })
  })
}

export const deepDiveSurfaceFrameViewModel = ({
  surface,
  state
}: {
  readonly surface: EntryPresentation
  readonly state: SurfaceState
}): DeepDiveSurfaceFrameViewModel =>
  DeepDiveSurfaceFrameViewModel.make({
    runControls: runControlsViewModel({ run: state.run, runLabel: surface.runLabel }),
    chrome: surfaceChromeContentModel(surface),
    code: surfaceCodeModel(state, "expanded"),
    surfaceStageFrame: surfaceStageFrameViewModel({
      activeTab: state.stageTab,
      interactiveLabel: surface.interactiveLabel,
      tabHint: tabHintFor(surface.entryId)
    })
  })
