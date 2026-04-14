import { useAtomSet } from "@effect-atom/atom-react"
import { Match } from "effect"

import type { EntryId } from "../../../../contracts/entry/id.js"
import type { RunEvidenceBannerTone } from "../../../../contracts/presentation/run-evidence.js"
import type { RunRuntimeTelemetryViewModel } from "../../../../contracts/presentation/run-runtime-telemetry.js"
import type { SurfaceViewModel } from "../../../../contracts/presentation/surface-presentation.js"
import { selectStageTabAtom } from "../../../atoms/surface/selection-actions.js"
import type { StageTab } from "../../../state/surface/state.js"
import { EvidenceRows } from "../../primitives/EvidenceRows.js"
import { Layer, Stack } from "../../primitives/Layout.js"
import { RunLifecycleDiagnosticsPanel } from "../../primitives/RunLifecycleDiagnosticsPanel.js"
import { SemanticText } from "../../primitives/SemanticText.js"
import { TabBar, TabButton } from "../../primitives/TabBar.js"
import { surfaceMaterials } from "../../primitives/theme/surface.js"

import { OpenAgentTracePanel } from "../open-agent-trace/OpenAgentTracePanel.js"

import { WorkflowControl } from "./WorkflowControl.js"

const evidenceBannerClassName = (tone: RunEvidenceBannerTone): string =>
  tone === "error" ? surfaceMaterials.calloutError : surfaceMaterials.callout

const workflowStageTabLabel = (tab: StageTab): string =>
  Match.value(tab).pipe(
    Match.when("interactive", () => "Setup"),
    Match.when("interaction", () => "Trace"),
    Match.when("evidence", () => "Evidence"),
    Match.exhaustive
  )

const workflowInteractionStageSummaryText =
  "Inspect imported traces, interaction timelines, and workflow handoffs without leaving the study."

const workflowStageTabs: ReadonlyArray<StageTab> = ["interactive", "interaction", "evidence"]

export const workflowStageWorkspaceSummaryText = (model: SurfaceViewModel): string =>
  Match.value(model.surfaceStage.activeTab).pipe(
    Match.when("interactive", () => model.surfaceStage.hintText),
    Match.when("interaction", () => workflowInteractionStageSummaryText),
    Match.when("evidence", () => model.surfaceStage.evidence.description),
    Match.exhaustive
  )

const WorkflowStageEvidence = ({
  diagnostics,
  model
}: {
  readonly diagnostics: RunRuntimeTelemetryViewModel | null
  readonly model: SurfaceViewModel
}) => {
  const evidence = model.surfaceStage.evidence

  return (
    <Stack className="gap-5">
      {Match.value(evidence.banner).pipe(
        Match.when(null, () => null),
        Match.orElse((banner) => (
          <Layer className={evidenceBannerClassName(banner.tone)}>
            <SemanticText
              as="p"
              className="text-ink-900"
              role="status"
              text={banner.text}
              variant="expanded"
            />
          </Layer>
        ))
      )}

      <EvidenceRows density={model.evidenceDensity} rows={model.evidenceRows} variant="expanded" />

      {diagnostics === null
        ? null
        : (
          <Stack className="gap-3 border-t border-stage-200/72 pt-5">
            <SemanticText
              as="h3"
              className="text-ink-900"
              role="section-title"
              text="Diagnostics"
              variant="expanded"
            />
            <SemanticText
              as="p"
              className="text-ink-700"
              role="status"
              text="Execution notes, timing, and lifecycle details stay here when you need to inspect how the run behaved."
              variant="expanded"
            />
            <RunLifecycleDiagnosticsPanel sections={diagnostics.sections} />
          </Stack>
        )}
    </Stack>
  )
}

export const WorkflowStageWorkspace = ({
  diagnostics,
  entryId,
  model
}: {
  readonly diagnostics: RunRuntimeTelemetryViewModel | null
  readonly entryId: EntryId
  readonly model: SurfaceViewModel
}) => {
  const selectStageTab = useAtomSet(selectStageTabAtom)
  const activeTab = model.surfaceStage.activeTab

  return (
    <Stack className="gap-5">
      {model.surfaceStage.showTabs
        ? (
          <TabBar appearance="flat">
            {workflowStageTabs.map((tab) => (
              <TabButton
                active={tab === activeTab}
                appearance="flat"
                key={tab}
                label={workflowStageTabLabel(tab)}
                onClick={() => {
                  selectStageTab({ id: entryId, tab })
                }}
              />
            ))}
          </TabBar>
        )
        : null}

      {Match.value(activeTab).pipe(
        Match.when("interactive", () => <WorkflowControl />),
        Match.when("interaction", () => <OpenAgentTracePanel />),
        Match.when("evidence", () => <WorkflowStageEvidence diagnostics={diagnostics} model={model} />),
        Match.exhaustive
      )}
    </Stack>
  )
}
