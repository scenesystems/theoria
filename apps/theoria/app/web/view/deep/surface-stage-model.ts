import { Schema } from "effect"

import type { SurfaceTabHint } from "../../../contracts/presentation/surface-runtime-hints.js"
import type { EvidenceStreamState } from "../../state/evidence/stream.js"
import { runEvidenceState } from "../../state/run/evidence.js"
import type { RunState } from "../../state/run/types.js"
import type { StageTab } from "../../state/surface/state.js"

export class SurfaceStageFrameViewModel extends Schema.Class<SurfaceStageFrameViewModel>("SurfaceStageFrameViewModel")({
  activeTab: Schema.Literal("interactive", "evidence"),
  showTabs: Schema.Boolean,
  interactiveLabel: Schema.NullOr(Schema.String),
  hintText: Schema.String
}) {}

export class SurfaceStageViewModel extends Schema.Class<SurfaceStageViewModel>("SurfaceStageViewModel")({
  activeTab: Schema.Literal("interactive", "evidence"),
  showTabs: Schema.Boolean,
  interactiveLabel: Schema.NullOr(Schema.String),
  hintText: Schema.String,
  evidence: Schema.Any
}) {}

export const surfaceStageViewModel = ({
  activeTab,
  interactiveLabel,
  run,
  stream,
  tabHint
}: {
  readonly activeTab: StageTab
  readonly interactiveLabel: string | null
  readonly run: RunState
  readonly stream: EvidenceStreamState
  readonly tabHint: SurfaceTabHint
}): SurfaceStageViewModel =>
  SurfaceStageViewModel.make({
    ...surfaceStageFrameViewModel({ activeTab, interactiveLabel, tabHint }),
    evidence: runEvidenceState({ run, stream })
  })

export const surfaceStageFrameViewModel = ({
  activeTab,
  interactiveLabel,
  tabHint
}: {
  readonly activeTab: StageTab
  readonly interactiveLabel: string | null
  readonly tabHint: SurfaceTabHint
}): SurfaceStageFrameViewModel =>
  SurfaceStageFrameViewModel.make({
    activeTab,
    showTabs: interactiveLabel !== null,
    interactiveLabel,
    hintText: activeTab === "interactive" ? tabHint.interactive : tabHint.evidence
  })
