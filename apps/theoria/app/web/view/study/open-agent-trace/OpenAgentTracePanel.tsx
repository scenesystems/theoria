import { Result } from "@effect-atom/atom"
import { useAtomValue } from "@effect-atom/atom-react"

import type { OpenAgentTraceTranscriptModel } from "../../../../contracts/study/workflow/open-agent-trace.js"
import { openAgentTraceMessageSurfaceModel } from "../../../../contracts/study/workflow/open-agent-trace.js"
import { openAgentTracePanelAtom } from "../../../atoms/workflow/open-agent-trace.js"
import { MessagePanel } from "../../primitives/interactions/MessagePanel.js"
import { Layer, Stack } from "../../primitives/Layout.js"
import { SemanticText } from "../../primitives/SemanticText.js"
import { FailureState, RunningState } from "../../primitives/Skeleton.js"

const OpenAgentTraceTranscript = ({
  eyebrow,
  panel,
  summary,
  title
}: OpenAgentTraceTranscriptModel) => (
  <Stack className="gap-3">
    <Stack className="gap-1">
      <SemanticText as="span" className="text-ink-500" role="code-meta" text={eyebrow} variant="compact" />
      <SemanticText as="h3" className="text-ink-900" role="section-title" text={title} variant="expanded" />
      <SemanticText as="p" className="text-ink-700" role="card-summary" text={summary} variant="expanded" />
    </Stack>
    <MessagePanel model={panel} />
  </Stack>
)

export const OpenAgentTracePanel = () => {
  const panelResult = useAtomValue(openAgentTracePanelAtom)

  return Result.match(panelResult, {
    onInitial: () => <RunningState text="Loading open-agent-trace corpus lane…" />,
    onFailure: (failure) => <FailureState description={failure.cause.toString()} />,
    onSuccess: (success) => {
      const model = openAgentTraceMessageSurfaceModel(success.value)

      return (
        <Stack className="gap-5">
          <Layer>
            <SemanticText
              as="p"
              className="text-ink-700"
              role="card-summary"
              text={model.description}
              variant="expanded"
            />
          </Layer>
          {model.transcripts.map((transcript) => <OpenAgentTraceTranscript key={transcript.entryId} {...transcript} />)}
        </Stack>
      )
    }
  })
}
