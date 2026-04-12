import { Schema } from "effect"

import type { EntryProjectionHint } from "../entry/descriptor.js"
import { RunEvidenceViewModel } from "./run-evidence.js"

export type SurfaceStageFramePresentationInput = {
  readonly activeTab: "interactive" | "evidence"
  readonly interactiveLabel: string | null
  readonly projectionHint: EntryProjectionHint
}

export type SurfaceStagePresentationInput = SurfaceStageFramePresentationInput & {
  readonly evidence: typeof RunEvidenceViewModel.Type
}

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
  evidence: RunEvidenceViewModel
}) {}

export const surfaceStageFrameViewModel = ({
  activeTab,
  interactiveLabel,
  projectionHint
}: SurfaceStageFramePresentationInput): SurfaceStageFrameViewModel =>
  SurfaceStageFrameViewModel.make({
    activeTab,
    showTabs: interactiveLabel !== null,
    interactiveLabel,
    hintText: activeTab === "interactive" ? projectionHint.stage : projectionHint.evidence
  })

export const surfaceStageViewModel = ({
  activeTab,
  evidence,
  interactiveLabel,
  projectionHint
}: SurfaceStagePresentationInput): SurfaceStageViewModel =>
  SurfaceStageViewModel.make({
    ...surfaceStageFrameViewModel({ activeTab, interactiveLabel, projectionHint }),
    evidence
  })
