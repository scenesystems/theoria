import { Result } from "@effect-atom/atom"
import { useAtomValue } from "@effect-atom/atom-react"

import { openAgentTracePanelAtom } from "../../../atoms/workflow/open-agent-trace.js"
import { FailureState, RunningState } from "../../primitives/Skeleton.js"

import { Cluster, Stack } from "../../primitives/Layout.js"

import { OpenAgentTracePanelEntry } from "./OpenAgentTracePanelEntry.js"
import { OpenAgentTracePanelSummaryCard } from "./OpenAgentTracePanelSummaryCard.js"
import { OpenAgentTraceStudyMaterialCard } from "./OpenAgentTraceStudyMaterialCard.js"
import { OpenAgentTracePanelModel } from "./panel-types.js"

const renderOpenAgentTracePanel = (model: OpenAgentTracePanelModel) => (
  <Stack className="gap-5">
    <OpenAgentTracePanelSummaryCard model={model} />
    <Cluster className="items-start gap-3">
      {model.studyMaterials.map((studyMaterial) => (
        <OpenAgentTraceStudyMaterialCard key={studyMaterial.key} model={studyMaterial} />
      ))}
    </Cluster>
    {model.entries.map((entry) => <OpenAgentTracePanelEntry entry={entry} key={entry.entryId} />)}
  </Stack>
)

export const OpenAgentTracePanel = () => {
  const panelResult = useAtomValue(openAgentTracePanelAtom)

  return Result.match(panelResult, {
    onInitial: () => <RunningState text="Loading open-agent-trace corpus lane…" />,
    onFailure: (failure) => <FailureState description={failure.cause.toString()} />,
    onSuccess: (success) => {
      const model = OpenAgentTracePanelModel.project(success.value)

      return renderOpenAgentTracePanel(model)
    }
  })
}
