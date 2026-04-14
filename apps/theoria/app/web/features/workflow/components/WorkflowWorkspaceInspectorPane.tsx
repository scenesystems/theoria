import { Match } from "effect"

import type { PresentedRun } from "../../../../contracts/presentation/presented-run.js"
import type { ProgramSourceScope } from "../../../../contracts/presentation/program.js"
import type { RunRuntimeTelemetryViewModel } from "../../../../contracts/presentation/run-runtime-telemetry.js"
import type { SurfaceCodeModel } from "../../../../contracts/presentation/surface-code.js"
import type { SurfaceViewModel } from "../../../../contracts/presentation/surface-presentation.js"
import type { WorkflowInspectorPanel } from "../../../../contracts/presentation/workflow.js"
import type { WorkflowSurfaceViewModel } from "../../../../contracts/study/workflow/surface-presentation.js"
import { Button } from "../../../ui/components/action/Button.js"
import { DiagnosticsInspector } from "../../../ui/components/workflow/DiagnosticsInspector.js"
import { EvidencePanel } from "../../../ui/components/workflow/EvidencePanel.js"
import { ResultInspector } from "../../../ui/components/workflow/ResultInspector.js"
import { SourceWorkspace } from "../../../ui/components/workflow/SourceWorkspace.js"
import { WorkflowDetailList } from "../../../ui/components/workflow/WorkflowDetailList.js"
import { WorkflowInspectorSection } from "../../../ui/components/workflow/WorkflowInspectorSection.js"
import { WorkflowSummaryBlock } from "../../../ui/components/workflow/WorkflowSummaryBlock.js"
import { Inline } from "../../../ui/structure/Inline.js"
import { SemanticText } from "../../../ui/structure/SemanticText.js"
import { ProgramCodeWorkspace } from "../../../view/primitives/ProgramCodeWorkspace.js"
import { surfaceForCard } from "../../../view/primitives/theme/surface.js"

const workflowSourceWorkspace = ({
  code,
  onSelectFile,
  onSelectSourceScope
}: {
  readonly code: SurfaceCodeModel
  readonly onSelectFile: (fileIndex: number) => void
  readonly onSelectSourceScope: (scope: ProgramSourceScope) => void
}) => {
  const theme = surfaceForCard("workflow")

  return (
    <SourceWorkspace
      label="Workflow source"
      summary={code.originHint}
      title="Source workspace"
      toolbar={code.sourceTabs.length <= 1
        ? undefined
        : (
          <WorkflowInspectorSection>
            <Inline gap="sm" wrap>
              {code.sourceTabs.map((tab) => (
                <Button
                  aria-pressed={tab.scope === code.selectedSourceScope}
                  key={tab.scope}
                  onClick={() => {
                    onSelectSourceScope(tab.scope)
                  }}
                  size="sm"
                  tone={tab.scope === code.selectedSourceScope ? "primary" : "neutral"}
                >
                  {tab.label}
                </Button>
              ))}
            </Inline>
          </WorkflowInspectorSection>
        )}
    >
      <ProgramCodeWorkspace
        codeClassName={theme.codePanel.codeContainer}
        codePanel={theme.codePanel}
        entry={code.entry}
        fileName={code.fileName}
        fileTabs={code.fileTabs}
        filesVisible
        onSelectFile={onSelectFile}
        selectedFileIndex={code.selectedFileIndex}
        source={code.source}
        variant="expanded"
      />
      {code.sourceTabs.length <= 1
        ? null
        : (
          <WorkflowInspectorSection>
            <WorkflowDetailList
              items={code.sourceTabs.map((tab) => ({
                label: tab.label,
                value: tab.scope === code.selectedSourceScope ? "Active" : "Available"
              }))}
            />
            <WorkflowSummaryBlock
              summary="Switch between prepared and run-bound files without leaving the workflow workspace."
              title="Source scopes"
            />
          </WorkflowInspectorSection>
        )}
    </SourceWorkspace>
  )
}

const workflowInspectorEmptyState = (text: string) => <SemanticText role="pane-meta">{text}</SemanticText>

type WorkflowWorkspaceInspectorPaneProps = {
  readonly activeInspectorPanel: WorkflowInspectorPanel
  readonly diagnostics: RunRuntimeTelemetryViewModel | null
  readonly onSelectFile: (fileIndex: number) => void
  readonly onSelectSourceScope: (scope: ProgramSourceScope) => void
  readonly presentedRun: PresentedRun | null
  readonly surfaceViewModel: SurfaceViewModel
  readonly workflowViewModel: WorkflowSurfaceViewModel
}

export const WorkflowWorkspaceInspectorPane = ({
  activeInspectorPanel,
  diagnostics,
  onSelectFile,
  onSelectSourceScope,
  presentedRun,
  surfaceViewModel,
  workflowViewModel
}: WorkflowWorkspaceInspectorPaneProps) =>
  Match.value(activeInspectorPanel).pipe(
    Match.when("source", () =>
      workflowSourceWorkspace({ code: surfaceViewModel.code, onSelectFile, onSelectSourceScope })),
    Match.when(
      "evidence",
      () => (
        <EvidencePanel label="Workflow evidence" summary={workflowViewModel.phaseDetail} title="Evidence panel">
          <WorkflowSummaryBlock
            summary={presentedRun?.summary ?? "Run the workflow to collect durable result sections and proof rows."}
            title={workflowViewModel.selector.selected.label}
          />
          {presentedRun === null
            ? workflowInspectorEmptyState("No workflow evidence sections are available yet.")
            : presentedRun.sections.map((section) => (
              <WorkflowInspectorSection key={section.title}>
                <WorkflowSummaryBlock
                  summary={`${section.rows.length} detail row${section.rows.length === 1 ? "" : "s"}.`}
                  title={section.title}
                />
                <WorkflowDetailList items={section.rows} />
              </WorkflowInspectorSection>
            ))}
        </EvidencePanel>
      )
    ),
    Match.when("diagnostics", () => (
      <DiagnosticsInspector
        summary="Inspect run lifecycle facts, timing, and stream history without leaving the workflow screen."
        summaryBlock={
          <WorkflowSummaryBlock summary={workflowViewModel.phaseDetail} title={workflowViewModel.phaseLabel} />
        }
        title="Diagnostics inspector"
      >
        {diagnostics === null
          ? workflowInspectorEmptyState("No lifecycle diagnostics are available yet.")
          : diagnostics.sections.map((section) => (
            <WorkflowInspectorSection key={section.title}>
              <WorkflowSummaryBlock summary={section.description} title={section.title} />
              <WorkflowDetailList items={section.rows} />
            </WorkflowInspectorSection>
          ))}
      </DiagnosticsInspector>
    )),
    Match.when("result-detail", () => (
      <ResultInspector
        summary="Read the final workflow result as named sections so detailed proof stays contextual instead of becoming a top-level tab."
        summaryBlock={
          <WorkflowSummaryBlock
            summary={workflowViewModel.runStory}
            title={presentedRun?.summary ?? "Workflow result pending"}
          />
        }
        title="Result detail"
      >
        {presentedRun === null
          ? workflowInspectorEmptyState("No workflow result is available yet.")
          : presentedRun.sections.map((section) => (
            <WorkflowInspectorSection key={section.title}>
              <WorkflowSummaryBlock
                summary={`${section.rows.length} proof row${section.rows.length === 1 ? "" : "s"}.`}
                title={section.title}
              />
              <WorkflowDetailList items={section.rows} />
            </WorkflowInspectorSection>
          ))}
      </ResultInspector>
    )),
    Match.exhaustive
  )
