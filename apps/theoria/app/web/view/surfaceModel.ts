import { Match } from "effect"

import type { EntryPresentation } from "../../contracts/entry/routing.js"
import type { PresentationDetailRow } from "../../contracts/presentation/detail-row.js"
import { type PresentedRun, presentSections } from "../../contracts/presentation/presented-run.js"
import type { SurfaceVariant } from "../../contracts/presentation/program.js"
import { RunControlsViewModel } from "../../contracts/presentation/run-controls.js"
import { type RunEvidencePresentationInput, runEvidenceViewModel } from "../../contracts/presentation/run-evidence.js"
import type { SurfaceChromeContentModel } from "../../contracts/presentation/surface-chrome.js"
import { surfaceChromeContentModel } from "../../contracts/presentation/surface-chrome.js"
import { SurfaceCodeModel } from "../../contracts/presentation/surface-code.js"
import {
  SurfaceViewModel,
  type SurfaceViewModel as SurfaceViewModelType
} from "../../contracts/presentation/surface-presentation.js"
import type { SurfaceStageViewModel } from "../../contracts/presentation/surface-stage.js"
import { surfaceStageViewModel as projectSurfaceStageViewModel } from "../../contracts/presentation/surface-stage.js"
import { surfaceSummaryEvidenceRows } from "../../contracts/presentation/surface-summary.js"
import { type EvidenceStreamState } from "../state/evidence/stream.js"
import { statusFromError } from "../state/run/status.js"
import { statusText } from "../state/run/status.js"
import type { RunState } from "../state/run/types.js"
import type { SurfaceState } from "../state/surface/state.js"

import { surfaceCodePresentationInput } from "./surface-code-input.js"

const runEvidencePresentationInput = ({
  run,
  stream
}: {
  readonly run: RunState
  readonly stream: EvidenceStreamState
}): RunEvidencePresentationInput =>
  Match.value(run).pipe(
    Match.withReturnType<RunEvidencePresentationInput>(),
    Match.tag("RunIdle", () => ({ _tag: "RunEvidenceIdleInput" })),
    Match.tag("RunRunning", ({ session }) => ({
      _tag: "RunEvidenceInFlightInput",
      control: session.control,
      sectionCount: stream.sections.length,
      stageId: session.choreography._tag === "InStage" ? session.choreography.stageId : null,
      step: session.choreography._tag === "InStage" ? session.choreography.step : null
    })),
    Match.tag("RunFailed", ({ error }) => ({
      _tag: "RunEvidenceFailureInput",
      description: statusFromError(error),
      hasRetainedEvidence: stream.sections.length > 0
    })),
    Match.tag("RunSuccess", ({ data }) => ({
      _tag: "RunEvidenceResultsInput",
      summary: data.summary
    })),
    Match.exhaustive
  )

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
    surfaceStage: projectSurfaceStageViewModel({
      activeTab: state.stageTab,
      evidence: runEvidenceViewModel(runEvidencePresentationInput({ run: state.run, stream })),
      interactiveLabel: surface.interactiveLabel,
      projectionHint: surface.projectionHint
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
