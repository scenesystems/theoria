import { type WorkflowScenarioOption, workflowScenarioOptions } from "../../../../contracts/study/workflow/scenario.js"
import { workflowEntryManifestSurface } from "../../../../contracts/study/workflow/selection.js"

import { Stack } from "../../primitives/Layout.js"
import { SemanticText } from "../../primitives/SemanticText.js"
import { TabBar, TabButton } from "../../primitives/TabBar.js"

export const WorkflowScenarioSelector = ({
  onSelectSeed,
  selectedSeedId,
  selectionLocked
}: {
  readonly onSelectSeed: (seedId: WorkflowScenarioOption["id"]) => void
  readonly selectedSeedId: WorkflowScenarioOption["id"]
  readonly selectionLocked: boolean
}) => (
  <Stack className="gap-4">
    <Stack className="gap-2">
      <SemanticText
        as="h3"
        className="text-ink-900"
        role="section-title"
        text={workflowEntryManifestSurface.title}
        variant="expanded"
      />
      <SemanticText
        as="p"
        className="text-ink-700"
        role="status"
        text={workflowEntryManifestSurface.description}
        variant="expanded"
      />
    </Stack>

    <TabBar className="flex-wrap">
      {workflowScenarioOptions.map((option) => (
        <TabButton
          key={option.id}
          active={option.id === selectedSeedId}
          disabled={selectionLocked}
          label={option.label}
          onClick={() => {
            onSelectSeed(option.id)
          }}
        />
      ))}
    </TabBar>
  </Stack>
)
