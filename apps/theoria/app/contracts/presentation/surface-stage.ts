import { Schema } from "effect"

import type { EntryProjectionHint } from "../entry/descriptor.js"
import { RunEvidenceViewModel } from "./run-evidence.js"

export type SurfaceStagePresentationInput = {
  readonly activeTab: "interactive" | "interaction" | "evidence"
  readonly evidence: typeof RunEvidenceViewModel.Type
  readonly interactiveLabel: string | null
  readonly projectionHint: EntryProjectionHint
}

export class SurfaceStageViewModel extends Schema.Class<SurfaceStageViewModel>("SurfaceStageViewModel")({
  activeTab: Schema.Literal("interactive", "interaction", "evidence"),
  showTabs: Schema.Boolean,
  interactiveLabel: Schema.NullOr(Schema.String),
  hintText: Schema.String,
  evidence: RunEvidenceViewModel
}) {}

export const surfaceStageViewModel = ({
  activeTab,
  evidence,
  interactiveLabel,
  projectionHint
}: SurfaceStagePresentationInput): SurfaceStageViewModel =>
  SurfaceStageViewModel.make({
    activeTab,
    showTabs: interactiveLabel !== null,
    interactiveLabel,
    hintText: activeTab === "evidence" ? projectionHint.evidence : projectionHint.stage,
    evidence
  })
