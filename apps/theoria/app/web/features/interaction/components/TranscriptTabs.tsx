import type { OpenAgentTraceTranscriptModel } from "../../../../contracts/study/workflow/open-agent-trace.js"
import { Tabs } from "../../../ui/components/navigation/Tabs.js"
import { ScrollRegion } from "../../../ui/structure/ScrollRegion.js"
import { SemanticText } from "../../../ui/structure/SemanticText.js"
import { Stack } from "../../../ui/structure/Stack.js"

export const TranscriptTabs = ({
  transcripts
}: {
  readonly transcripts: ReadonlyArray<OpenAgentTraceTranscriptModel>
}) => (
  <ScrollRegion direction="horizontal">
    <Tabs.List aria-label="Open agent trace transcripts" className="w-max min-w-full">
      <Tabs.Indicator />
      {transcripts.map((transcript) => (
        <Tabs.Tab className="min-w-[13rem] px-4 py-3 text-left" key={transcript.entryId} value={transcript.entryId}>
          <Stack as="span" align="start" gap="xs">
            <SemanticText as="span" role="label" tone="inherit">
              {transcript.eyebrow}
            </SemanticText>
            <SemanticText as="span" role="tab" tone="inherit">
              {transcript.title}
            </SemanticText>
          </Stack>
        </Tabs.Tab>
      ))}
    </Tabs.List>
  </ScrollRegion>
)
