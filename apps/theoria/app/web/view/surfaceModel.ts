import * as Arr from "effect/Array"

import type { Card } from "../../contracts/card.js"
import type {
  ProgramSourceScope,
  SourceFileTab,
  SourceWorkspaceTab,
  SurfaceVariant
} from "../../contracts/presentation.js"
import { statusText } from "../state/status.js"
import { evidenceStatusFromStream, type EvidenceStreamState, runPhase, type SurfaceState } from "../state/types.js"

import { tabHintFor } from "./deep/interactiveMetadata.js"
import {
  type DemoStageFrameViewModel,
  demoStageFrameViewModel,
  type DemoStageViewModel,
  demoStageViewModel
} from "./deep/stageModel.js"
import { type PresentedRun, presentSections } from "./presenter.js"
import type { RunControlsViewModel } from "./runControlsModel.js"
import { runControlsViewModel } from "./runControlsModel.js"
import type { SurfaceChromeContentModel } from "./surfaceChromeModel.js"
import { surfaceChromeContentModel } from "./surfaceChromeModel.js"
import { surfaceCodeModel } from "./surfaceCodeModel.js"

const compactEvidenceRowLimit = 2

export type StatusTone = "panel" | "strip"
export type EvidenceDensity = "compact" | "expanded"

export type SurfaceCodeModel = {
  readonly entry: string
  readonly fileName: string
  readonly selectedSourceScope: ProgramSourceScope
  readonly sourceTabs: ReadonlyArray<SourceWorkspaceTab>
  readonly source: string
  readonly lineCount: number
  readonly truncated: boolean
  readonly hint: string
  readonly originHint: string
  readonly originLabel: string
  readonly fileTabs: ReadonlyArray<SourceFileTab>
  readonly selectedFileIndex: number
}

export type SurfaceViewModel = {
  readonly running: boolean
  readonly runControls: RunControlsViewModel
  readonly statusTone: StatusTone
  readonly evidenceDensity: EvidenceDensity
  readonly status: string
  readonly chrome: SurfaceChromeContentModel
  readonly evidenceRows: ReadonlyArray<{ readonly label: string; readonly value: string }>
  readonly code: SurfaceCodeModel
  readonly stage: DemoStageViewModel
}

export type DeepDiveSurfaceFrameViewModel = {
  readonly runControls: RunControlsViewModel
  readonly chrome: SurfaceChromeContentModel
  readonly code: SurfaceCodeModel
  readonly stageFrame: DemoStageFrameViewModel
}

const packageUseCaseRow = (card: Card): { readonly label: string; readonly value: string } => ({
  label: "Package Use Case",
  value: `${card.packageName}: ${card.useCase}`
})

const selectedSectionRows = (
  presented: PresentedRun | null,
  stream: EvidenceStreamState
): ReadonlyArray<{ readonly label: string; readonly value: string }> =>
  Arr.flatMap(
    presented === null ? presentSections(stream.sections) : presented.sections,
    (section) => section.rows
  )

const compactRows = ({
  card,
  rows,
  state
}: {
  readonly card: Card
  readonly rows: ReadonlyArray<{ readonly label: string; readonly value: string }>
  readonly state: SurfaceState
}): ReadonlyArray<{ readonly label: string; readonly value: string }> => {
  const packageRow = packageUseCaseRow(card)
  const rowsWithUseCase = rows[0]?.label === packageRow.label ? rows : [packageRow, ...rows]

  return state.run._tag === "RunSuccess" || rows.length > 0
    ? Arr.take(rowsWithUseCase, compactEvidenceRowLimit + 1)
    : [packageRow, { label: "Run Intent", value: card.summary }]
}

export const surfaceViewModel = ({
  card,
  presented,
  state,
  stream,
  variant
}: {
  readonly card: Card
  readonly presented: PresentedRun | null
  readonly state: SurfaceState
  readonly stream: EvidenceStreamState
  readonly variant: SurfaceVariant
}): SurfaceViewModel => {
  const compact = variant === "compact"
  const rows = selectedSectionRows(presented, stream)

  return {
    running: runPhase(state.run) === "running",
    runControls: runControlsViewModel({ run: state.run, runLabel: card.runLabel }),
    statusTone: compact ? "panel" : "strip",
    evidenceDensity: compact ? "compact" : "expanded",
    status: statusText({ preload: state.preload, run: state.run }, evidenceStatusFromStream(stream)),
    chrome: surfaceChromeContentModel(card),
    evidenceRows: compact ? compactRows({ card, rows, state }) : rows,
    code: surfaceCodeModel(state, variant),
    stage: demoStageViewModel({
      activeTab: state.stageTab,
      interactiveLabel: card.interactiveLabel ?? null,
      run: state.run,
      stream,
      tabHint: tabHintFor(card.id)
    })
  }
}

export const deepDiveSurfaceFrameViewModel = ({
  card,
  state
}: {
  readonly card: Card
  readonly state: SurfaceState
}): DeepDiveSurfaceFrameViewModel => ({
  runControls: runControlsViewModel({ run: state.run, runLabel: card.runLabel }),
  chrome: surfaceChromeContentModel(card),
  code: surfaceCodeModel(state, "expanded"),
  stageFrame: demoStageFrameViewModel({
    activeTab: state.stageTab,
    interactiveLabel: card.interactiveLabel ?? null,
    tabHint: tabHintFor(card.id)
  })
})
