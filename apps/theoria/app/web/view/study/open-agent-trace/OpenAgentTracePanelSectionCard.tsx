import { Match } from "effect"

import { ContentCard } from "../../primitives/ContentCard.js"
import { Cluster, Stack } from "../../primitives/Layout.js"
import { ExternalLink } from "../../primitives/Link.js"
import { SemanticText } from "../../primitives/SemanticText.js"

import type { OpenAgentTraceSummaryRow } from "../../../state/workflow/open-agent-trace-summary-row.js"
import type { OpenAgentTracePanelSection } from "./panel-sections.js"

const SummaryRows = ({ rows }: { readonly rows: ReadonlyArray<OpenAgentTraceSummaryRow> }) => (
  <Cluster className="gap-x-6 gap-y-3">
    {rows.map((row) => (
      <Stack className="gap-1" key={row.label}>
        <SemanticText as="span" className="text-ink-500" role="row-label" text={row.label} variant="compact" />
        <SemanticText as="span" className="text-ink-900" role="row-value" text={row.value} variant="expanded" />
      </Stack>
    ))}
  </Cluster>
)

const DetailCard = (props: {
  readonly emptyText: string
  readonly items: ReadonlyArray<{ readonly detail: string; readonly label: string }>
  readonly title: string
}) => (
  <ContentCard className="min-w-0 flex-1 basis-[18rem]" density="standard">
    <Stack className="gap-3">
      <SemanticText as="h3" className="text-ink-900" role="card-title" text={props.title} variant="compact" />
      {props.items.length === 0
        ? <SemanticText as="p" className="text-ink-700" role="card-summary" text={props.emptyText} variant="expanded" />
        : (
          <Stack className="gap-3">
            {props.items.map((item) => (
              <Stack className="gap-1" key={item.label}>
                <SemanticText as="span" className="text-ink-900" role="row-value" text={item.label} variant="compact" />
                <SemanticText
                  as="p"
                  className="text-ink-700"
                  role="card-summary"
                  text={item.detail}
                  variant="expanded"
                />
              </Stack>
            ))}
          </Stack>
        )}
    </Stack>
  </ContentCard>
)

const SummaryCard = (props: {
  readonly href: string | undefined
  readonly rows: ReadonlyArray<OpenAgentTraceSummaryRow>
  readonly title: string
}) => (
  <ContentCard className="min-w-0 flex-1 basis-[18rem]" density="standard">
    <Stack className="gap-3">
      <Stack className="gap-1">
        <SemanticText as="h3" className="text-ink-900" role="card-title" text={props.title} variant="compact" />
        {props.href === undefined
          ? null
          : (
            <ExternalLink className="text-ink-700 underline decoration-stage-300 underline-offset-4" href={props.href}>
              <SemanticText as="span" role="row-label" text={props.href} variant="compact" />
            </ExternalLink>
          )}
      </Stack>
      <SummaryRows rows={props.rows} />
    </Stack>
  </ContentCard>
)

export const OpenAgentTracePanelSummaryRows = SummaryRows

export const renderOpenAgentTracePanelSection = (section: OpenAgentTracePanelSection) =>
  Match.value(section).pipe(
    Match.tag(
      "OpenAgentTraceSummaryPanelSection",
      ({ href, key, rows, title }) => <SummaryCard href={href} key={key} rows={rows} title={title} />
    ),
    Match.tag(
      "OpenAgentTraceDetailsPanelSection",
      ({ emptyText, items, key, title }) => <DetailCard emptyText={emptyText} items={items} key={key} title={title} />
    ),
    Match.tag("OpenAgentTraceCoveragePanelSection", ({ emptyText, items, key, title }) => (
      <DetailCard
        emptyText={emptyText}
        items={items.map((item) => ({ detail: item.detail, label: `${item.label} · ${item.severity}` }))}
        key={key}
        title={title}
      />
    )),
    Match.exhaustive
  )
