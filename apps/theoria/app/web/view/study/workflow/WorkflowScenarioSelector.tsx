import type {
  WorkflowSelectorViewModel,
  WorkflowSurfaceViewModel
} from "../../../../contracts/study/workflow/surface-presentation.js"

import { Stack } from "../../primitives/Layout.js"
import { SemanticText } from "../../primitives/SemanticText.js"
import { TabBar, TabButton } from "../../primitives/TabBar.js"

export const WorkflowScenarioSelector = ({
  onSelectSeed,
  selector
}: {
  readonly onSelectSeed: (seedId: WorkflowSelectorViewModel["selected"]["reference"]["seedId"]) => void
  readonly selector: WorkflowSurfaceViewModel["selector"]
}) => {
  return (
    <Stack className="gap-5">
      <Stack className="gap-2">
        <SemanticText
          as="span"
          className="text-ink-500"
          role="row-label"
          text="Choose a study"
          variant="compact"
        />
        <SemanticText
          as="h3"
          className="text-ink-900"
          role="section-title"
          text={selector.surface.title}
          variant="expanded"
        />
        <SemanticText
          as="p"
          className="text-ink-700"
          role="status"
          text={selector.surface.description}
          variant="expanded"
        />
      </Stack>

      <TabBar appearance="flat">
        {selector.options.map((option) => (
          <TabButton
            appearance="flat"
            key={option.reference.seedId}
            active={option.reference.seedId === selector.selected.reference.seedId}
            disabled={selector.locked}
            label={option.label}
            onClick={() => {
              onSelectSeed(option.reference.seedId)
            }}
          />
        ))}
      </TabBar>

      <Stack className="gap-1.5">
        <SemanticText
          as="span"
          className="text-ink-500"
          role="row-label"
          text="Current workflow"
          variant="compact"
        />
        <SemanticText
          as="p"
          className="text-ink-900"
          role="row-value"
          text={selector.selected.label}
          variant="expanded"
        />
        <SemanticText
          as="p"
          className="text-ink-700"
          role="status"
          text={selector.selected.summary}
          variant="expanded"
        />
      </Stack>
    </Stack>
  )
}
