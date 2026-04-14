import { Match } from "effect"

import type { OpenAgentTracePanelSection } from "../../../../contracts/study/workflow/open-agent-trace.js"
import { DetailBadge } from "../../../ui/components/detail/DetailBadge.js"
import { InspectorSummaryBlock } from "../../../ui/components/inspector/InspectorSummaryBlock.js"
import { Link } from "../../../ui/structure/Link.js"
import { SemanticText } from "../../../ui/structure/SemanticText.js"

import { interactionCoverageTone } from "../model.js"

import { InteractionDetailList } from "../primitives/InteractionDetailList.js"

export const TraceRecordSectionCard = ({ section }: { readonly section: OpenAgentTracePanelSection }) =>
  Match.value(section).pipe(
    Match.tag(
      "OpenAgentTraceSummaryPanelSection",
      ({ href, rows, title }) => (
        <InspectorSummaryBlock
          meta={href === undefined
            ? undefined
            : (
              <Link href={href} tone="muted">
                <SemanticText role="pane-meta" tone="inherit">
                  {href}
                </SemanticText>
              </Link>
            )}
          title={title}
        >
          <InteractionDetailList
            emptyText="No summary rows were projected for this section."
            items={rows.map((row) => ({ detail: row.value, label: row.label }))}
          />
        </InspectorSummaryBlock>
      )
    ),
    Match.tag(
      "OpenAgentTraceDetailsPanelSection",
      ({ emptyText, items, title }) => (
        <InspectorSummaryBlock title={title}>
          <InteractionDetailList
            emptyText={emptyText}
            items={items.map((item) => ({ detail: item.detail, label: item.label }))}
          />
        </InspectorSummaryBlock>
      )
    ),
    Match.tag(
      "OpenAgentTraceCoveragePanelSection",
      ({ emptyText, items, title }) => (
        <InspectorSummaryBlock title={title}>
          <InteractionDetailList
            emptyText={emptyText}
            items={items.map((item) => ({
              detail: item.detail,
              label: item.label,
              meta: <DetailBadge tone={interactionCoverageTone(item.severity)}>{item.severity}</DetailBadge>
            }))}
          />
        </InspectorSummaryBlock>
      )
    ),
    Match.exhaustive
  )
