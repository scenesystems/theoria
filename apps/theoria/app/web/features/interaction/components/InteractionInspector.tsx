import { RectangleGroupIcon, Squares2X2Icon } from "@heroicons/react/24/outline"

import type { InteractionItem } from "../../../../contracts/presentation/interactions.js"
import type {
  OpenAgentTraceEntryPanelModel,
  OpenAgentTraceStudyMaterialCardModel
} from "../../../../contracts/study/workflow/open-agent-trace.js"
import type { InteractionInspectorMode } from "../../../atoms/interaction/open-agent-trace-workspace.js"
import { EmptyState } from "../../../ui/components/feedback/EmptyState.js"
import { Tabs } from "../../../ui/components/navigation/Tabs.js"
import { Inspector } from "../../../ui/components/surface/Inspector.js"
import { Stack } from "../../../ui/structure/Stack.js"

import { SelectionDetails } from "./SelectionDetails.js"
import { StudyMaterialPanel } from "./StudyMaterialPanel.js"
import { TraceRecordGroupTabs } from "./TraceRecordGroupTabs.js"

const inspectorDescription = (mode: InteractionInspectorMode): string =>
  mode === "selection"
    ? "Selection payloads, timing, and actor context stay here while the transcript canvas remains the dominant reading surface."
    : mode === "trace"
    ? "Trace record details stay contextual to the active imported transcript instead of competing with the main canvas."
    : "Study materials stay inspectable as contextual proof of what was imported into the corpus lane."

const isInteractionInspectorMode = (value: string): value is InteractionInspectorMode =>
  value === "selection" || value === "trace" || value === "materials"

export const InteractionInspector = ({
  activeEntry,
  mode,
  onModeChange,
  selectedItem,
  studyMaterials
}: {
  readonly activeEntry: OpenAgentTraceEntryPanelModel | null
  readonly mode: InteractionInspectorMode
  readonly onModeChange: (mode: InteractionInspectorMode) => void
  readonly selectedItem: InteractionItem | null
  readonly studyMaterials: ReadonlyArray<OpenAgentTraceStudyMaterialCardModel>
}) => (
  <Inspector
    className="h-full min-h-[32rem]"
    description={inspectorDescription(mode)}
    title="Interaction inspector"
  >
    <Tabs.Root
      onValueChange={(value) => {
        if (isInteractionInspectorMode(value)) {
          onModeChange(value)
        }
      }}
      value={mode}
    >
      <Stack className="h-full" gap="md">
        <Tabs.List aria-label="Interaction inspector modes">
          <Tabs.Indicator />
          <Tabs.Tab value="selection">Selection</Tabs.Tab>
          <Tabs.Tab value="trace">Trace</Tabs.Tab>
          <Tabs.Tab value="materials">Materials</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel className="border-none bg-transparent p-0 shadow-none" value="selection">
          <SelectionDetails item={selectedItem} />
        </Tabs.Panel>

        <Tabs.Panel className="border-none bg-transparent p-0 shadow-none" value="trace">
          {activeEntry === null
            ? (
              <EmptyState
                description="Choose an imported transcript to inspect its projected trace record and workflow handoff details."
                eyebrow="Trace"
                icon={RectangleGroupIcon}
                title="No active trace record"
              />
            )
            : <TraceRecordGroupTabs entry={activeEntry} />}
        </Tabs.Panel>

        <Tabs.Panel className="border-none bg-transparent p-0 shadow-none" value="materials">
          {studyMaterials.length === 0
            ? (
              <EmptyState
                description="No study materials are currently published for this corpus lane."
                eyebrow="Materials"
                icon={Squares2X2Icon}
                title="No study materials available"
              />
            )
            : (
              <Stack gap="md">
                {studyMaterials.map((material) => <StudyMaterialPanel key={material.key} material={material} />)}
              </Stack>
            )}
        </Tabs.Panel>
      </Stack>
    </Tabs.Root>
  </Inspector>
)
