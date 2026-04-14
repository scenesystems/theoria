import { Match, Option } from "effect"

import type { RunControlsViewModel } from "../../../../contracts/presentation/run-controls.js"
import type { WorkflowCanvasMode, WorkflowInspectorPanel } from "../../../../contracts/presentation/workflow.js"
import { Button } from "../../../ui/components/action/Button.js"
import { WorkflowActionBar } from "../../../ui/components/workflow/WorkflowActionBar.js"
import { Inline } from "../../../ui/structure/Inline.js"

const workflowInspectorButtons: ReadonlyArray<{
  readonly label: string
  readonly panel: WorkflowInspectorPanel
}> = [
  { label: "Source", panel: "source" },
  { label: "Evidence", panel: "evidence" },
  { label: "Diagnostics", panel: "diagnostics" },
  { label: "Result detail", panel: "result-detail" }
]

const resultsInspectorPanel = (panel: WorkflowInspectorPanel): boolean =>
  panel === "evidence" || panel === "result-detail"

const canvasButtonTone = ({
  active,
  disabled
}: {
  readonly active: boolean
  readonly disabled: boolean
}): "neutral" | "primary" => active && !disabled ? "primary" : "neutral"

type WorkflowWorkspaceActionBarProps = {
  readonly activeCanvasMode: WorkflowCanvasMode
  readonly activeInspectorPanel: WorkflowInspectorPanel
  readonly onCanvasModeChange: (canvasMode: WorkflowCanvasMode) => void
  readonly onInspectorPanelChange: (panel: WorkflowInspectorPanel) => void
  readonly onRunControlAction: (action: RunControlsViewModel["primary"]["action"]) => void
  readonly resultsAvailable: boolean
  readonly runControls: RunControlsViewModel
}

export const WorkflowWorkspaceActionBar = ({
  activeCanvasMode,
  activeInspectorPanel,
  onCanvasModeChange,
  onInspectorPanelChange,
  onRunControlAction,
  resultsAvailable,
  runControls
}: WorkflowWorkspaceActionBarProps) => (
  <WorkflowActionBar
    leading={
      <Inline gap="sm" wrap>
        <Button
          disabled={runControls.primary.disabled}
          onClick={() => {
            onRunControlAction(runControls.primary.action)
          }}
          size="sm"
          tone="primary"
        >
          {runControls.primary.label}
        </Button>
        {Option.match(runControls.secondary, {
          onNone: () => null,
          onSome: (secondary) => (
            <Button
              disabled={secondary.disabled}
              onClick={() => {
                onRunControlAction(secondary.action)
              }}
              size="sm"
              tone="neutral"
            >
              {secondary.label}
            </Button>
          )
        })}
        <Button
          aria-pressed={activeCanvasMode === "setup"}
          onClick={() => {
            onCanvasModeChange("setup")
            onInspectorPanelChange("source")
          }}
          size="sm"
          tone={canvasButtonTone({ active: activeCanvasMode === "setup", disabled: false })}
        >
          Setup
        </Button>
        <Button
          aria-pressed={activeCanvasMode === "results"}
          disabled={!resultsAvailable}
          onClick={() => {
            onCanvasModeChange("results")
            onInspectorPanelChange("evidence")
          }}
          size="sm"
          tone={canvasButtonTone({ active: activeCanvasMode === "results", disabled: !resultsAvailable })}
        >
          Results
        </Button>
      </Inline>
    }
    trailing={
      <Inline gap="sm" wrap>
        {workflowInspectorButtons.map(({ label, panel }) => (
          <Button
            aria-pressed={activeInspectorPanel === panel}
            disabled={!resultsAvailable && resultsInspectorPanel(panel)}
            key={panel}
            onClick={() => {
              Match.value(panel).pipe(
                Match.when("source", () => {
                  onInspectorPanelChange("source")
                }),
                Match.when("diagnostics", () => {
                  onInspectorPanelChange("diagnostics")
                }),
                Match.when("evidence", () => {
                  onCanvasModeChange("results")
                  onInspectorPanelChange("evidence")
                }),
                Match.when("result-detail", () => {
                  onCanvasModeChange("results")
                  onInspectorPanelChange("result-detail")
                }),
                Match.exhaustive
              )
            }}
            size="sm"
            tone={canvasButtonTone({
              active: activeInspectorPanel === panel,
              disabled: !resultsAvailable && resultsInspectorPanel(panel)
            })}
          >
            {label}
          </Button>
        ))}
      </Inline>
    }
  />
)
