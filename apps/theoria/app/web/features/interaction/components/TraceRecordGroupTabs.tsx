import type { ReactNode } from "react"

import type { OpenAgentTraceEntryPanelModel } from "../../../../contracts/study/workflow/open-agent-trace.js"
import { InspectorSummaryBlock } from "../../../ui/components/inspector/InspectorSummaryBlock.js"
import { InspectorTabs } from "../../../ui/components/inspector/InspectorTabs.js"
import { ScrollRegion } from "../../../ui/structure/ScrollRegion.js"
import { SemanticText } from "../../../ui/structure/SemanticText.js"
import { Stack } from "../../../ui/structure/Stack.js"

import { traceGroupDescription, traceGroupTitle } from "../model.js"

import { TraceRecordSectionCard } from "./TraceRecordSectionCard.js"

export const TraceRecordGroupTabs = ({
  action,
  entry
}: {
  readonly action?: ReactNode
  readonly entry: OpenAgentTraceEntryPanelModel
}) => (
  <InspectorTabs.Root defaultValue={entry.groups[0]?.key ?? "source"} key={entry.entryId}>
    <Stack gap="md">
      <InspectorSummaryBlock
        meta={
          <Stack gap="sm">
            {entry.eyebrow === undefined ? null : <SemanticText role="detail-label">{entry.eyebrow}</SemanticText>}
            {action}
          </Stack>
        }
        summary={entry.summary}
        title={entry.title}
      />
      <ScrollRegion direction="horizontal">
        <InspectorTabs.List aria-label={`${entry.title} trace record groups`}>
          <InspectorTabs.Indicator />
          {entry.groups.map((group) => (
            <InspectorTabs.Tab key={group.key} value={group.key}>
              {traceGroupTitle(group.key)}
            </InspectorTabs.Tab>
          ))}
        </InspectorTabs.List>
      </ScrollRegion>
      {entry.groups.map((group) => (
        <InspectorTabs.Panel key={group.key} value={group.key}>
          <Stack gap="md">
            <SemanticText role="pane-meta">
              {traceGroupDescription(group.key)}
            </SemanticText>
            <Stack gap="md">
              {group.sections.map((section) => <TraceRecordSectionCard key={section.key} section={section} />)}
            </Stack>
          </Stack>
        </InspectorTabs.Panel>
      ))}
    </Stack>
  </InspectorTabs.Root>
)
