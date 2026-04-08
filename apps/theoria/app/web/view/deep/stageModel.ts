import type { EvidenceStreamState } from "../../state/evidence/stream.js"
import type { RunState } from "../../state/run/types.js"
import type { StageTab } from "../../state/surface/state.js"

import type { TabHint } from "./interactiveMetadata.js"
import { type DemoEvidenceViewModel, demoEvidenceViewModel } from "./stageEvidenceModel.js"

export type DemoStageViewModel = {
  readonly activeTab: StageTab
  readonly showTabs: boolean
  readonly interactiveLabel: string | null
  readonly hintText: string
  readonly evidence: DemoEvidenceViewModel
}

export type DemoStageFrameViewModel = {
  readonly activeTab: StageTab
  readonly showTabs: boolean
  readonly interactiveLabel: string | null
  readonly hintText: string
}

export const demoStageViewModel = ({
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
  readonly tabHint: TabHint
}): DemoStageViewModel => ({
  ...demoStageFrameViewModel({ activeTab, interactiveLabel, tabHint }),
  evidence: demoEvidenceViewModel({ run, stream })
})

export const demoStageFrameViewModel = ({
  activeTab,
  interactiveLabel,
  tabHint
}: {
  readonly activeTab: StageTab
  readonly interactiveLabel: string | null
  readonly tabHint: TabHint
}): DemoStageFrameViewModel => ({
  activeTab,
  showTabs: interactiveLabel !== null,
  interactiveLabel,
  hintText: activeTab === "interactive" ? tabHint.interactive : tabHint.evidence
})
