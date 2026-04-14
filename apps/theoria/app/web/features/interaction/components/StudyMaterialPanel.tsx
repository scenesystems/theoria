import type { OpenAgentTraceStudyMaterialCardModel } from "../../../../contracts/study/workflow/open-agent-trace.js"
import { DetailBadge } from "../../../ui/components/detail/DetailBadge.js"
import { InspectorSummaryBlock } from "../../../ui/components/inspector/InspectorSummaryBlock.js"

import { InteractionDetailList } from "../primitives/InteractionDetailList.js"

export const StudyMaterialPanel = ({ material }: { readonly material: OpenAgentTraceStudyMaterialCardModel }) => (
  <InspectorSummaryBlock
    meta={<DetailBadge>{`${material.items.length} item${material.items.length === 1 ? "" : "s"}`}</DetailBadge>}
    summary={material.description}
    title={material.title}
  >
    <InteractionDetailList
      emptyText={material.emptyText}
      items={material.items.map((item) => ({ detail: item.detail, label: item.label }))}
    />
  </InspectorSummaryBlock>
)
