import type {
  WorkflowScenarioSelectorViewModel,
  WorkflowSurfaceViewModel
} from "../../../../contracts/study/workflow/surface-presentation.js"

import { Stack } from "../../primitives/Layout.js"
import { SemanticText } from "../../primitives/SemanticText.js"
import { TabBar, TabButton } from "../../primitives/TabBar.js"

export const WorkflowScenarioSelector = ({
  onSelectSeed,
  selector
}: {
  readonly onSelectSeed: (seedId: WorkflowScenarioSelectorViewModel["selected"]["id"]) => void
  readonly selector: WorkflowSurfaceViewModel["selector"]
}) => {
  return (
    <Stack className="gap-4">
      <Stack className="gap-2">
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

      <TabBar className="flex-wrap">
        {selector.options.map((option) => (
          <TabButton
            key={option.id}
            active={option.id === selector.selected.id}
            disabled={selector.locked}
            label={option.label}
            onClick={() => {
              onSelectSeed(option.id)
            }}
          />
        ))}
      </TabBar>
    </Stack>
  )
}
